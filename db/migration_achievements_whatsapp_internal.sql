-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP (Refactorización V2 - Supabase)
-- ARCHIVO: db/migration_achievements_whatsapp_internal.sql
-- DESCRIPCIÓN: Script DDL para la creación del Sistema de Logros, Chat Interno Administrativo
--              conectado a WhatsApp Meta, Bitácora de Webhooks y Vistas Consolidadas para
--              la exportación masiva del Expediente Unificado.
-- =========================================================================================

-- =========================================================================================
-- 1. SISTEMA DE LOGROS (GAMIFICACIÓN Y REFUERZO POSITIVO)
-- =========================================================================================

-- Tabla de Categorías de Logros
CREATE TABLE public.achievement_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Logros (Catálogo de medallas y metas)
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.achievement_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    points INTEGER DEFAULT 10,
    badge_url TEXT,
    criteria_type VARCHAR(50), -- Ej. 'SESSIONS_ATTENDED', 'DIARY_ENTRIES', 'STREAK', 'CUSTOM_GOAL'
    criteria_value INTEGER DEFAULT 1, -- Cantidad requerida para desbloquear el logro
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Logros de Usuarios (Seguimiento del progreso y medallas obtenidas)
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    progress INTEGER DEFAULT 0, -- Progreso actual hacia el criteria_value
    is_completed BOOLEAN DEFAULT FALSE,
    awarded_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Clínico/Admin que lo otorgó (si fue manual)
    notes TEXT, -- Notas de felicitación o contexto clínico
    UNIQUE(user_id, achievement_id)
);

-- =========================================================================================
-- 2. CHAT INTERNO ADMINISTRATIVO/MÉDICO Y WEBHOOKS (META WHATSAPP INTEGRATION)
-- =========================================================================================

-- Tabla de Mensajería Interna conectada a WhatsApp (Coordinación Jefatura <-> Clínicos)
CREATE TABLE public.internal_meta_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin, Psicólogo o Nutricionista que envía
    recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Destinatario interno
    whatsapp_message_id TEXT UNIQUE, -- ID del mensaje en Meta WhatsApp API (wamid.HBg...)
    whatsapp_thread_id TEXT, -- ID del hilo o conversación en WhatsApp
    message_direction VARCHAR(20) NOT NULL, -- 'outbound' (Plataforma -> WA) o 'inbound' (WA -> Plataforma)
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'template', 'image', 'document'
    content TEXT, -- Contenido del mensaje (puede ser texto plano o cifrado según requerimiento)
    media_url TEXT, -- URL del archivo adjunto si es multimedia
    status VARCHAR(50) DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'read', 'failed'
    error_message TEXT, -- Razón del fallo si la API de Meta rechaza el envío
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Auditoría y Depuración de Webhooks (Meta WhatsApp Webhooks & Eventos Externos)
CREATE TABLE public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) DEFAULT 'whatsapp_meta', -- 'whatsapp_meta', 'twilio', 'stripe', etc.
    event_type VARCHAR(100), -- Ej. 'messages', 'messages_status', 'message_echoes'
    payload JSONB NOT NULL, -- Cuerpo completo del webhook recibido
    headers JSONB, -- Cabeceras HTTP para verificación de firmas (X-Hub-Signature-256)
    status VARCHAR(50) DEFAULT 'received', -- 'received', 'processed', 'error'
    error_details TEXT, -- Traza de error si falló el procesamiento del webhook
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================================
-- 3. ÍNDICES PARA ALTO RENDIMIENTO
-- =========================================================================================

CREATE INDEX idx_achievements_category ON public.achievements(category_id);
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON public.user_achievements(achievement_id);
CREATE INDEX idx_internal_meta_chats_sender ON public.internal_meta_chats(sender_id);
CREATE INDEX idx_internal_meta_chats_recipient ON public.internal_meta_chats(recipient_id);
CREATE INDEX idx_internal_meta_chats_wamid ON public.internal_meta_chats(whatsapp_message_id);
CREATE INDEX idx_internal_meta_chats_thread ON public.internal_meta_chats(whatsapp_thread_id);
CREATE INDEX idx_webhook_logs_provider_status ON public.webhook_logs(provider, status);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at);

-- =========================================================================================
-- 4. SEGURIDAD RLS (ROW LEVEL SECURITY)
-- =========================================================================================

ALTER TABLE public.achievement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_meta_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para Categorías de Logros y Logros (Catálogo)
-- Lectura pública para todos los autenticados. Edición solo para Admins (1) y Clínicos (3, 4)
CREATE POLICY achievement_categories_select ON public.achievement_categories
    FOR SELECT TO authenticated USING (true);

CREATE POLICY achievement_categories_modify ON public.achievement_categories
    FOR ALL TO authenticated USING (public.get_auth_role() IN (1, 3, 4));

CREATE POLICY achievements_select ON public.achievements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY achievements_modify ON public.achievements
    FOR ALL TO authenticated USING (public.get_auth_role() IN (1, 3, 4));

-- Políticas para Logros de Usuarios
-- El estudiante ve sus propios logros; Admins y Clínicos ven todos y pueden asignar/actualizar
CREATE POLICY user_achievements_select ON public.user_achievements
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.get_auth_role() IN (1, 3, 4));

CREATE POLICY user_achievements_modify ON public.user_achievements
    FOR ALL TO authenticated USING (public.get_auth_role() IN (1, 3, 4));

-- Políticas para Chat Interno Meta (WhatsApp)
-- Exclusivo para Admins (1), Psicólogos (3) y Nutricionistas (4). Cada quien ve sus conversaciones; Admins ven todo.
CREATE POLICY internal_meta_chats_select ON public.internal_meta_chats
    FOR SELECT TO authenticated USING (
        public.get_auth_role() IN (1, 3, 4) AND 
        (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.get_auth_role() = 1)
    );

CREATE POLICY internal_meta_chats_insert ON public.internal_meta_chats
    FOR INSERT TO authenticated WITH CHECK (
        public.get_auth_role() IN (1, 3, 4) AND sender_id = auth.uid()
    );

CREATE POLICY internal_meta_chats_update ON public.internal_meta_chats
    FOR UPDATE TO authenticated USING (
        public.get_auth_role() IN (1, 3, 4) AND (sender_id = auth.uid() OR public.get_auth_role() = 1)
    );

-- Políticas para Webhook Logs
-- Inserción permitida para roles de servicio/autenticados, lectura y gestión exclusiva de Administradores (1)
CREATE POLICY webhook_logs_insert ON public.webhook_logs
    FOR INSERT TO public WITH CHECK (true);

CREATE POLICY webhook_logs_select ON public.webhook_logs
    FOR SELECT TO authenticated USING (public.get_auth_role() = 1);

CREATE POLICY webhook_logs_modify ON public.webhook_logs
    FOR ALL TO authenticated USING (public.get_auth_role() = 1);

-- =========================================================================================
-- 5. VISTAS SQL CONSOLIDADAS PARA EXPORTACIÓN MASIVA (EXPEDIENTE UNIFICADO)
-- =========================================================================================

-- VISTA 1: EXPEDIENTE UNIFICADO CONSOLIDADO (Demografía, Clínica, Métricas y Logros)
-- NOTA: Se utiliza security_invoker = true para heredar el RLS nativo de las tablas base (PG 15+)
CREATE OR REPLACE VIEW public.vw_unified_student_records WITH (security_invoker = true) AS
SELECT 
    u.id AS student_id,
    u.matricula,
    u.mobile_phone,
    u.whatsapp_opt_in,
    u.created_at AS user_registered_at,
    p.first_name,
    p.last_name,
    p.faculty,
    p.programa_educativo,
    p.celular AS profile_phone,
    p.sexo,
    p.fecha_nacimiento,
    p.antecedentes_familiares,
    cr.known_conditions,
    cr.consent_given,
    cr.additional_notes AS clinical_notes,
    cr.primary_psychologist_id,
    concat(psy_p.first_name, ' ', psy_p.last_name) AS primary_psychologist_name,
    cr.primary_nutritionist_id,
    concat(nut_p.first_name, ' ', nut_p.last_name) AS primary_nutritionist_name,
    ps.status AS patient_status,
    ps.self_diagnosis,
    -- Métricas de Citas
    COALESCE(apt.total_appointments, 0) AS total_appointments,
    COALESCE(apt.completed_appointments, 0) AS completed_appointments,
    COALESCE(apt.cancelled_appointments, 0) AS cancelled_appointments,
    apt.last_appointment_date,
    -- Métricas de Diario
    COALESCE(diary.total_diary_entries, 0) AS total_diary_entries,
    COALESCE(diary.high_risk_entries, 0) AS high_risk_entries,
    diary.last_diary_entry_date,
    -- Métricas de Nutrición
    COALESCE(nut.total_nutrition_logs, 0) AS total_nutrition_logs,
    nut.avg_calories,
    nut.last_nutrition_log_date,
    -- Métricas de Logros
    COALESCE(ach.total_achievements_earned, 0) AS total_achievements_earned,
    COALESCE(ach.total_points, 0) AS total_achievement_points,
    -- Métricas de IA (Chat AMATI)
    COALESCE(amati.total_ai_chats, 0) AS total_ai_chats,
    COALESCE(amati.max_urgency_score, 0.00) AS max_ai_urgency_score
FROM public.users u
JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.student_clinical_records cr ON u.id = cr.student_id
LEFT JOIN public.profiles psy_p ON cr.primary_psychologist_id = psy_p.user_id
LEFT JOIN public.profiles nut_p ON cr.primary_nutritionist_id = nut_p.user_id
LEFT JOIN public.patient_settings ps ON u.id = ps.student_id
-- Subconsulta de Citas
LEFT JOIN (
    SELECT 
        student_id,
        count(*) AS total_appointments,
        count(CASE WHEN status = 'completed' THEN 1 END) AS completed_appointments,
        count(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_appointments,
        max(scheduled_date) AS last_appointment_date
    FROM public.appointments
    GROUP BY student_id
) apt ON u.id = apt.student_id
-- Subconsulta de Diario
LEFT JOIN (
    SELECT 
        student_id,
        count(*) AS total_diary_entries,
        count(CASE WHEN high_risk = true THEN 1 END) AS high_risk_entries,
        max(created_at) AS last_diary_entry_date
    FROM public.diary_entries
    GROUP BY student_id
) diary ON u.id = diary.student_id
-- Subconsulta de Nutrición
LEFT JOIN (
    SELECT 
        student_id,
        count(*) AS total_nutrition_logs,
        round(avg(total_calories), 0) AS avg_calories,
        max(log_date) AS last_nutrition_log_date
    FROM public.nutrition_logs
    GROUP BY student_id
) nut ON u.id = nut.student_id
-- Subconsulta de Logros
LEFT JOIN (
    SELECT 
        ua.user_id,
        count(*) AS total_achievements_earned,
        sum(a.points) AS total_points
    FROM public.user_achievements ua
    JOIN public.achievements a ON ua.achievement_id = a.id
    WHERE ua.is_completed = true
    GROUP BY ua.user_id
) ach ON u.id = ach.user_id
-- Subconsulta de Chat IA AMATI
LEFT JOIN (
    SELECT 
        student_id,
        count(*) AS total_ai_chats,
        max(highest_urgency_score) AS max_urgency_score
    FROM public.chats
    GROUP BY student_id
) amati ON u.id = amati.student_id
WHERE u.role_id = 2; -- Filtro para incluir únicamente Estudiantes (role_id = 2)


-- VISTA 2: BITÁCORA CRONOLÓGICA LONGITUDINAL (Línea de tiempo del Paciente)
-- Unifica Citas, Entradas de Diario, Registros de Nutrición y Logros en un solo flujo temporal
CREATE OR REPLACE VIEW public.vw_student_detailed_timeline WITH (security_invoker = true) AS
-- 1. Citas (Appointments)
SELECT 
    student_id,
    scheduled_date AS event_timestamp,
    'APPOINTMENT' AS event_type,
    concat('Cita (', priority_level, ') - Estado: ', status) AS event_title,
    notes AS event_details,
    professional_id AS related_user_id
FROM public.appointments
UNION ALL
-- 2. Entradas de Diario (Diary Entries)
SELECT 
    student_id,
    created_at AS event_timestamp,
    'DIARY_ENTRY' AS event_type,
    CASE WHEN high_risk THEN 'Entrada de Diario [ALTO RIESGO]' ELSE 'Entrada de Diario' END AS event_title,
    content AS event_details,
    NULL AS related_user_id
FROM public.diary_entries
UNION ALL
-- 3. Registros de Nutrición (Nutrition Logs)
SELECT 
    student_id,
    log_date::timestamp with time zone AS event_timestamp,
    'NUTRITION_LOG' AS event_type,
    concat('Registro Nutricional: ', total_calories, ' kcal') AS event_title,
    concat('Proteínas: ', total_protein, 'g, Carbos: ', total_carbs, 'g, Grasas: ', total_fats, 'g') AS event_details,
    NULL AS related_user_id
FROM public.nutrition_logs
UNION ALL
-- 4. Logros Obtenidos (Achievements)
SELECT 
    ua.user_id AS student_id,
    ua.earned_at AS event_timestamp,
    'ACHIEVEMENT' AS event_type,
    concat('Logro Desbloqueado: ', a.title) AS event_title,
    concat(a.description, ' (+', a.points, ' pts)') AS event_details,
    ua.awarded_by AS related_user_id
FROM public.user_achievements ua
JOIN public.achievements a ON ua.achievement_id = a.id
WHERE ua.is_completed = true;


-- VISTA 3: MÉTRICAS GENERALES DE OCUPACIÓN DE PERSONAL DE LA SALUD (Psicólogos y Nutricionistas)
CREATE OR REPLACE VIEW public.vw_health_professional_metrics WITH (security_invoker = true) AS
SELECT 
    u.id AS professional_id,
    u.matricula,
    r.name AS professional_role,
    p.first_name,
    p.last_name,
    p.faculty,
    hps.modality,
    hps.location,
    hps.building,
    hps.office_room,
    hps.capacity,
    hps.session_duration,
    count(DISTINCT apt.student_id) AS active_patients_count,
    count(apt.id) AS total_appointments_scheduled,
    count(CASE WHEN apt.status = 'completed' THEN 1 END) AS total_appointments_completed,
    count(CASE WHEN apt.status = 'cancelled' THEN 1 END) AS total_appointments_cancelled
FROM public.users u
JOIN public.roles r ON u.id = r.id
JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.health_professional_settings hps ON u.id = hps.professional_id
LEFT JOIN public.appointments apt ON u.id = apt.professional_id
WHERE u.role_id IN (3, 4) -- Psicólogos (3) y Nutricionistas (4)
GROUP BY u.id, u.matricula, r.name, p.first_name, p.last_name, p.faculty, hps.modality, hps.location, hps.building, hps.office_room, hps.capacity, hps.session_duration;
