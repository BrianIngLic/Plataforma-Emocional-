-- Migration: Crear tabla de Fila de Espera Virtual
CREATE TABLE IF NOT EXISTS public.virtual_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    specialty VARCHAR(20) NOT NULL CHECK (specialty IN ('psychologist', 'nutritionist')),
    faculty TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, specialty)
);

-- RLS y Seguridad
ALTER TABLE public.virtual_queue ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
CREATE POLICY "virtual_queue_select" ON public.virtual_queue
    FOR SELECT TO authenticated USING (
        public.get_auth_role() IN (1, 3, 4) 
        OR student_id = auth.uid()
    );

CREATE POLICY "virtual_queue_insert" ON public.virtual_queue
    FOR INSERT TO authenticated WITH CHECK (
        student_id = auth.uid() 
        OR public.get_auth_role() = 1
    );

CREATE POLICY "virtual_queue_delete" ON public.virtual_queue
    FOR DELETE TO authenticated USING (
        public.get_auth_role() IN (1, 3, 4) 
        OR student_id = auth.uid()
    );
