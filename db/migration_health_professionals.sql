-- =========================================================================================
-- SCRIPT DE MIGRACIÓN DEFINITIVO: REFACTORIZACIÓN A PERSONAL DE LA SALUD
-- Objetivo: Transformar el modelo de datos de "psicólogo" a "personal de la salud" genérico,
--           alineando y limpiando exhaustivamente las políticas RLS de producción.
-- Ejecución: Supabase SQL Editor
-- =========================================================================================

BEGIN;

-- =========================================================================================
-- 1. RENOMBRADO DE TABLAS Y COLUMNAS
-- =========================================================================================

-- Renombrar tabla de configuraciones
ALTER TABLE public.psychologist_settings RENAME TO health_professional_settings;

-- Renombrar columna llave en configuraciones
ALTER TABLE public.health_professional_settings RENAME COLUMN psychologist_id TO professional_id;

-- Renombrar tabla de excepciones de horario
ALTER TABLE public.psychologist_exceptions RENAME TO health_professional_exceptions;

-- Renombrar columna llave en excepciones
ALTER TABLE public.health_professional_exceptions RENAME COLUMN psychologist_id TO professional_id;

-- Renombrar columna en citas (appointments)
ALTER TABLE public.appointments RENAME COLUMN psychologist_id TO professional_id;

-- Renombrar índice asociado a citas para reflejar el nuevo nombre de columna
ALTER INDEX IF EXISTS idx_appointments_psy RENAME TO idx_appointments_professional;


-- =========================================================================================
-- 2. LIMPIEZA Y HOMOLOGACIÓN DE POLÍTICAS RLS EN PRODUCCIÓN
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- A. Tabla: public.appointments
-- -----------------------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_own_data ON public.appointments;
DROP POLICY IF EXISTS appointments_access ON public.appointments;
DROP POLICY IF EXISTS "Psicologos pueden editar citas" ON public.appointments;
DROP POLICY IF EXISTS "Personal de la salud pueden editar citas" ON public.appointments;

-- Crear política definitiva de acceso propio para estudiante y profesional de la salud
CREATE POLICY appointments_own_data ON public.appointments
    FOR ALL USING (student_id = auth.uid() OR professional_id = auth.uid())
    WITH CHECK (student_id = auth.uid() OR professional_id = auth.uid());

-- Renombrar semánticamente la política de edición de citas
CREATE POLICY "Personal de la salud pueden editar citas" ON public.appointments
    FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);


-- -----------------------------------------------------------------------------------------
-- B. Tabla: public.health_professional_settings
-- -----------------------------------------------------------------------------------------
-- Eliminar políticas heredadas y redundantes detectadas en producción
DROP POLICY IF EXISTS psychologist_own_settings ON public.health_professional_settings;
DROP POLICY IF EXISTS student_read_settings ON public.health_professional_settings;
DROP POLICY IF EXISTS "Estudiantes pueden leer ajustes" ON public.health_professional_settings;
DROP POLICY IF EXISTS "Enable read access for authenticated users settings" ON public.health_professional_settings;
DROP POLICY IF EXISTS health_prof_settings_own ON public.health_professional_settings;
DROP POLICY IF EXISTS health_prof_settings_read ON public.health_professional_settings;

-- Crear políticas limpias y definitivas
CREATE POLICY health_prof_settings_own ON public.health_professional_settings
    FOR ALL USING (professional_id = auth.uid()) WITH CHECK (professional_id = auth.uid());

CREATE POLICY health_prof_settings_read ON public.health_professional_settings
    FOR SELECT USING (true);


-- -----------------------------------------------------------------------------------------
-- C. Tabla: public.health_professional_exceptions
-- -----------------------------------------------------------------------------------------
-- Eliminar políticas heredadas y redundantes detectadas en producción
DROP POLICY IF EXISTS psychologist_own_exceptions ON public.health_professional_exceptions;
DROP POLICY IF EXISTS student_read_exceptions ON public.health_professional_exceptions;
DROP POLICY IF EXISTS "Estudiantes pueden leer excepciones" ON public.health_professional_exceptions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.health_professional_exceptions;
DROP POLICY IF EXISTS admin_global_exceptions ON public.health_professional_exceptions;
DROP POLICY IF EXISTS health_prof_exceptions_own ON public.health_professional_exceptions;
DROP POLICY IF EXISTS health_prof_exceptions_read ON public.health_professional_exceptions;

-- Crear políticas limpias y definitivas (incluyendo gestión global para Admin)
CREATE POLICY health_prof_exceptions_own ON public.health_professional_exceptions
    FOR ALL USING (professional_id = auth.uid()) WITH CHECK (professional_id = auth.uid());

CREATE POLICY health_prof_exceptions_read ON public.health_professional_exceptions
    FOR SELECT USING (true);

CREATE POLICY admin_global_exceptions ON public.health_professional_exceptions
    FOR ALL USING (public.get_auth_role() = 1);


-- =========================================================================================
-- 3. ACTUALIZACIÓN DE FUNCIONES RPC DE SUPABASE
-- =========================================================================================
-- Reevaluar la consulta en PL/pgSQL para apuntar a la nueva tabla health_professional_settings
-- y su respectiva columna professional_id, garantizando el funcionamiento del panel Admin.

CREATE OR REPLACE FUNCTION public.get_admin_psychologists()
RETURNS TABLE (
    id UUID,
    role_id INTEGER,
    matricula VARCHAR,
    first_name TEXT,
    last_name TEXT,
    faculty TEXT,
    email VARCHAR,
    capacity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validar que el usuario que ejecuta sea Admin (role_id = 1)
    IF public.get_auth_role() != 1 THEN
        RAISE EXCEPTION 'Acceso denegado. Solo la Jefatura de Psicología (Admin) puede consultar esta información.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.role_id,
        u.matricula,
        p.first_name,
        p.last_name,
        p.faculty,
        a.email::VARCHAR,
        s.capacity
    FROM public.users u
    JOIN auth.users a ON u.id = a.id
    LEFT JOIN public.profiles p ON u.id = p.user_id
    LEFT JOIN public.health_professional_settings s ON u.id = s.professional_id
    WHERE u.role_id = 3;
END;
$$;


-- =========================================================================================
-- 4. NOTIFICACIÓN A POSTGREST PARA RECARGA DEL CACHÉ DE ESQUEMA
-- =========================================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
