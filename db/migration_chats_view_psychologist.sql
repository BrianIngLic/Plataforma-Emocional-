-- =========================================================================================
-- MIGRACIÓN: RLS para Lectura de Chats de Amati por Psicólogos/Admins
-- Archivo : db/migration_chats_view_psychologist.sql
-- Propósito:
--   Permite a los psicólogos (role_id = 3) y administradores (role_id = 1)
--   leer el historial de chats de Amati (tablas chats_table y messages_table) para seguimiento clínico.
-- =========================================================================================

-- 1) Actualizar políticas para chats_table (permitir SELECT a clínicos/admins)
DROP POLICY IF EXISTS chat_own_data ON public.chats_table;
DROP POLICY IF EXISTS chat_access ON public.chats_table;

CREATE POLICY "chat_access"
    ON public.chats_table
    FOR ALL
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.get_auth_role() IN (1, 3)
    )
    WITH CHECK (
        student_id = auth.uid()
        OR public.get_auth_role() = 1
    );

-- 2) Actualizar políticas para messages_table (permitir SELECT a clínicos/admins)
DROP POLICY IF EXISTS message_own_data ON public.messages_table;
DROP POLICY IF EXISTS message_access ON public.messages_table;

CREATE POLICY "message_access"
    ON public.messages_table
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chats_table c 
            WHERE c.id = chat_id 
            AND (c.student_id = auth.uid() OR public.get_auth_role() IN (1, 3))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chats_table c 
            WHERE c.id = chat_id 
            AND c.student_id = auth.uid()
        )
        OR public.get_auth_role() = 1
    );
