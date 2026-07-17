-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP
-- ARCHIVO: db/migration_meta_chats_isolation.sql
-- DESCRIPCIÓN: Aísla el historial de chats de WhatsApp por especialista.
--              Añade la columna professional_id, realiza backfill seguro,
--              reemplaza la restricción UNIQUE por una compuesta (student_id, professional_id),
--              y actualiza las políticas RLS correspondientes.
-- =========================================================================================

-- 1. Añadir la columna professional_id (temporalmente nullable para el backfill)
ALTER TABLE public.internal_meta_conversations 
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. Backfill de las conversaciones existentes
-- Prioridad:
--   a) Psicólogo primario asignado al estudiante en student_clinical_records
--   b) Nutriólogo primario asignado al estudiante en student_clinical_records
--   c) Primer psicólogo registrado en el sistema
--   d) Primer administrador registrado en el sistema
UPDATE public.internal_meta_conversations c
SET professional_id = COALESCE(
  (SELECT primary_psychologist_id FROM public.student_clinical_records r WHERE r.student_id = c.student_id),
  (SELECT primary_nutritionist_id FROM public.student_clinical_records r WHERE r.student_id = c.student_id),
  (SELECT id FROM public.users WHERE role_id = 3 LIMIT 1),
  (SELECT id FROM public.users WHERE role_id = 1 LIMIT 1)
)
WHERE professional_id IS NULL;

-- 3. Hacer professional_id NOT NULL una vez completado el backfill
ALTER TABLE public.internal_meta_conversations 
  ALTER COLUMN professional_id SET NOT NULL;

-- 4. Eliminar la restricción UNIQUE anterior sobre student_id
-- El nombre por defecto generado por postgres es internal_meta_conversations_student_id_key
ALTER TABLE public.internal_meta_conversations 
  DROP CONSTRAINT IF EXISTS internal_meta_conversations_student_id_key;

-- 5. Crear la nueva restricción única compuesta (student_id, professional_id)
ALTER TABLE public.internal_meta_conversations 
  ADD CONSTRAINT uniq_student_professional UNIQUE (student_id, professional_id);

-- 6. Actualizar Políticas RLS para public.internal_meta_conversations
DROP POLICY IF EXISTS internal_meta_conv_select ON public.internal_meta_conversations;
DROP POLICY IF EXISTS internal_meta_conv_all ON public.internal_meta_conversations;

CREATE POLICY internal_meta_conv_select ON public.internal_meta_conversations
    FOR SELECT TO authenticated USING (
        public.get_auth_role() = 1 OR
        professional_id = auth.uid()
    );

CREATE POLICY internal_meta_conv_all ON public.internal_meta_conversations
    FOR ALL TO authenticated USING (
        public.get_auth_role() = 1 OR
        professional_id = auth.uid()
    );

-- 7. Actualizar Políticas RLS para public.internal_meta_chats
DROP POLICY IF EXISTS internal_meta_chats_select ON public.internal_meta_chats;
DROP POLICY IF EXISTS internal_meta_chats_all ON public.internal_meta_chats;

CREATE POLICY internal_meta_chats_select ON public.internal_meta_chats
    FOR SELECT TO authenticated USING (
        public.get_auth_role() = 1 OR
        EXISTS (
            SELECT 1 FROM public.internal_meta_conversations c
            WHERE c.id = conversation_id AND c.professional_id = auth.uid()
        )
    );

CREATE POLICY internal_meta_chats_all ON public.internal_meta_chats
    FOR ALL TO authenticated USING (
        public.get_auth_role() = 1 OR
        EXISTS (
            SELECT 1 FROM public.internal_meta_conversations c
            WHERE c.id = conversation_id AND c.professional_id = auth.uid()
        )
    );
