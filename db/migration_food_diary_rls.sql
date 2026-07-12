-- =========================================================================================
-- MIGRACIÓN: RLS para Diarios Clínicos (Alimentario y Emocional)
-- Archivo : db/migration_food_diary_rls.sql
-- Propósito:
--   Permite a los profesionales de la salud (psicólogos y nutriólogos) y administradores
--   leer el diario alimentario y emocional de los estudiantes para seguimiento clínico.
-- =========================================================================================

-- 1) Políticas para Diario Alimentario (food_diary_entries)
DROP POLICY IF EXISTS "food_diary_own" ON public.food_diary_entries;
DROP POLICY IF EXISTS "food_diary_access" ON public.food_diary_entries;

CREATE POLICY "food_diary_access"
    ON public.food_diary_entries
    FOR ALL
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.get_auth_role() IN (1, 3, 4)
    )
    WITH CHECK (
        student_id = auth.uid()
        OR public.get_auth_role() = 1
    );

-- 2) Políticas para Diario Emocional (diary_entries)
DROP POLICY IF EXISTS "diary_own" ON public.diary_entries;
DROP POLICY IF EXISTS "diary_access" ON public.diary_entries;

CREATE POLICY "diary_access"
    ON public.diary_entries
    FOR ALL
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.get_auth_role() IN (1, 3, 4)
    )
    WITH CHECK (
        student_id = auth.uid()
        OR public.get_auth_role() = 1
    );
