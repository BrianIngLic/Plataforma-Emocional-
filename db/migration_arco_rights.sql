-- =========================================================================================
-- MIGRACIÓN: DERECHOS ARCO (ACCESO, RECTIFICACIÓN, CANCELACIÓN Y OPOSICIÓN)
-- =========================================================================================

-- 1. Tabla para registrar solicitudes formales de Derechos ARCO (Rectificación y Cancelación)
CREATE TABLE IF NOT EXISTS public.arco_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('Access', 'Rectification', 'Cancellation', 'Opposition')),
    details TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 2. Tabla para preferencias de privacidad de Oposición (Derecho de Oposición)
CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    share_clinical_data BOOLEAN DEFAULT TRUE, -- Oposición a compartir expediente con especialistas asignados
    use_anonymous_stats BOOLEAN DEFAULT TRUE, -- Oposición a uso de datos estadísticos anonimizados
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Habilitar RLS en ambas tablas
ALTER TABLE public.arco_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para arco_requests
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias solicitudes" ON public.arco_requests;
CREATE POLICY "Los usuarios pueden ver sus propias solicitudes" 
    ON public.arco_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propias solicitudes" ON public.arco_requests;
CREATE POLICY "Los usuarios pueden insertar sus propias solicitudes" 
    ON public.arco_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Solo administradores pueden gestionar solicitudes" ON public.arco_requests;
CREATE POLICY "Solo administradores pueden gestionar solicitudes" 
    ON public.arco_requests FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE public.users.id = auth.uid() AND public.users.role_id = 1
        )
    );

-- 5. Políticas RLS para user_privacy_settings
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus preferencias de privacidad" ON public.user_privacy_settings;
CREATE POLICY "Los usuarios pueden gestionar sus preferencias de privacidad" 
    ON public.user_privacy_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Solo administradores pueden ver todas las preferencias" ON public.user_privacy_settings;
CREATE POLICY "Solo administradores pueden ver todas las preferencias" 
    ON public.user_privacy_settings FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE public.users.id = auth.uid() AND public.users.role_id = 1
        )
    );

-- 6. Trigger para crear configuración de privacidad por defecto al insertar un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_privacy()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_privacy_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_privacy ON public.users;
CREATE TRIGGER on_auth_user_created_privacy
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_privacy();

-- 7. Insertar configuración por defecto para los usuarios existentes
INSERT INTO public.user_privacy_settings (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
