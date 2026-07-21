-- =========================================================================================
-- MIGRACIÓN: RECORDATORIO DE CITAS DE 24 HORAS POR CORREO
-- =========================================================================================

-- 1. Añadir columna para rastrear el envío del recordatorio
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE;

-- 2. Crear índice de optimización para la consulta de citas programadas sin notificar
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_lookup 
ON public.appointments (status, scheduled_date, reminder_24h_sent);

-- 3. Función segura para obtener citas y correos de auth.users sin exponer la tabla auth directamente
CREATE OR REPLACE FUNCTION public.get_appointments_for_reminder()
RETURNS TABLE (
  appointment_id UUID,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  student_first_name TEXT,
  student_last_name TEXT,
  student_email VARCHAR,
  prof_first_name TEXT,
  prof_last_name TEXT,
  prof_role TEXT,
  modality TEXT,
  location TEXT,
  building TEXT,
  office_room TEXT,
  faculty_name TEXT,
  virtual_tour_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios del creador para acceder a auth.users
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id::UUID AS appointment_id,
    a.scheduled_date::timestamp with time zone,
    a.start_time::time without time zone,
    a.end_time::time without time zone,
    COALESCE(sp.first_name, 'Paciente')::text AS student_first_name,
    COALESCE(sp.last_name, '')::text AS student_last_name,
    au.email::varchar AS student_email,
    COALESCE(pp.first_name, 'Especialista')::text AS prof_first_name,
    COALESCE(pp.last_name, '')::text AS prof_last_name,
    COALESCE(r.name::text, 'Especialista')::text AS prof_role,
    COALESCE(hps.modality::text, 'virtual')::text AS modality,
    COALESCE(hps.location::text, 'Consultorio Virtual')::text AS location,
    hps.building::text,
    hps.office_room::text,
    f.name::text AS faculty_name,
    f.virtual_tour_url::text
  FROM public.appointments a
  LEFT JOIN public.profiles sp ON a.student_id = sp.user_id
  JOIN auth.users au ON a.student_id = au.id
  LEFT JOIN public.users pu ON a.professional_id = pu.id
  LEFT JOIN public.roles r ON pu.role_id = r.id
  LEFT JOIN public.profiles pp ON a.professional_id = pp.user_id
  LEFT JOIN public.health_professional_settings hps ON a.professional_id = hps.professional_id
  LEFT JOIN public.faculties f ON hps.faculty_id = f.id
  WHERE a.status = 'scheduled'
    AND a.reminder_24h_sent = false
    AND ((a.scheduled_date::date + a.start_time) AT TIME ZONE 'America/Mexico_City') >= (now() + interval '23 hours')
    AND ((a.scheduled_date::date + a.start_time) AT TIME ZONE 'America/Mexico_City') <= (now() + interval '25 hours');
END;
$$;

-- 4. Comentarios instructivos para configurar pg_cron en el Dashboard de Supabase
--
-- Para automatizar la ejecución cada hora, ejecute el siguiente comando en el SQL Editor de Supabase:
--
-- select cron.schedule(
--   'send-24h-appointment-reminders',
--   '0 * * * *', -- Cada hora en el minuto 0
--   $$
--     select net.http_post(
--       url := 'https://<SU-PROJECT-REF>.supabase.co/functions/v1/send-appointment-reminder',
--       headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SU-SERVICE-ROLE-KEY>"}'::jsonb,
--       body := '{}'::jsonb
--     );
--   $$
-- );
