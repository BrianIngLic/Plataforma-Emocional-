-- =========================================================================================
-- MIGRACIÓN: TABLA DE CONTROL DE POLÍTICAS CLÍNICAS (SKILL 18)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS public.student_policy_tracking (
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    academic_period VARCHAR(20) NOT NULL,
    late_cancellations INTEGER DEFAULT 0,
    specialist_changes_psychologist INTEGER DEFAULT 0,
    specialist_changes_nutritionist INTEGER DEFAULT 0,
    bypass_session_limit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, academic_period)
);

-- Habilitar RLS
ALTER TABLE public.student_policy_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS):
-- 1. Los estudiantes pueden ver su propio registro de control.
CREATE POLICY student_policy_tracking_select ON public.student_policy_tracking
    FOR SELECT TO authenticated
    USING (auth.uid() = student_id);

-- 2. Los estudiantes pueden insertar/actualizar su propio registro para incrementar cambios/cancelaciones.
CREATE POLICY student_policy_tracking_insert ON public.student_policy_tracking
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY student_policy_tracking_update ON public.student_policy_tracking
    FOR UPDATE TO authenticated
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- 3. Los especialistas y administradores pueden hacer SELECT y UPDATE en los registros de todos los estudiantes.
CREATE POLICY professional_admin_policy_tracking_all ON public.student_policy_tracking
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN (1, 3, 4) -- Admin, Psicólogo, Nutriólogo
        )
    );
