-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP (Módulo de Administración - Skill 8)
-- ARCHIVO: db/migration_admin_skill8.sql
-- DESCRIPCIÓN: Script de migración y extensión arquitectónica para el Backend en Supabase.
--              Implementa funciones seguras de alta centralizada (Psicólogos y Nutriólogos),
--              lógica de asignación dual de pacientes y ruteo de almacenamiento seguro para
--              la Marca de Agua Institucional (institutional_assets) con estricto RLS.
-- CUMPLIMIENTO CIBERSEGURIDAD: NOM-024, HIPAA y principio de mínimo privilegio (SECURITY DEFINER).
-- =========================================================================================

BEGIN;

-- =========================================================================================
-- 1. FUNCIONES SEGURAS PARA ALTA CENTRALIZADA DE PERSONAL DE LA SALUD (SKILL 8.1)
-- =========================================================================================

-- Función RPC Segura para dar de alta tanto a Psicólogos (role = 3) como a Nutriólogos (role = 4)
-- Garantiza atomicidad transaccional al insertar en users, profiles y health_professional_settings.
CREATE OR REPLACE FUNCTION public.admin_register_health_professional(
    p_user_id UUID,
    p_matricula TEXT,
    p_role_id INTEGER,
    p_first_name TEXT,
    p_last_name TEXT,
    p_faculty TEXT,
    p_programa_educativo TEXT,
    p_celular TEXT,
    p_capacity INTEGER,
    p_location TEXT,
    p_modality TEXT,
    p_faculty_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con los privilegios del creador (acceso seguro del Admin)
AS $$
DECLARE
    v_role_name TEXT;
    v_result JSONB;
BEGIN
    -- 1. Verificación Estricta de Ciberseguridad: Solo el Admin (role_id = 1) puede ejecutar
    IF public.get_auth_role() != 1 THEN
        RAISE EXCEPTION 'CRITICAL_SECURITY_ERR: Acceso denegado. Solo la Jefatura (Admin) está autorizada para registrar personal de la salud.';
    END IF;

    -- 2. Validación del rol objetivo (Debe ser Psicólogo = 3 o Nutriólogo = 4)
    IF p_role_id NOT IN (3, 4) THEN
        RAISE EXCEPTION 'VALIDATION_ERR: El rol especificado (%) no es válido para personal de la salud. Use 3 (Psicólogo) o 4 (Nutriólogo).', p_role_id;
    END IF;

    -- Determinar nombre del rol para el registro de auditoría
    SELECT name INTO v_role_name FROM public.roles WHERE id = p_role_id;

    -- 3. Inserción o actualización en public.users
    INSERT INTO public.users (id, matricula, role_id, mobile_phone, whatsapp_opt_in, created_at)
    VALUES (p_user_id, p_matricula, p_role_id, p_celular, TRUE, NOW())
    ON CONFLICT (id) DO UPDATE 
    SET matricula = EXCLUDED.matricula,
        role_id = EXCLUDED.role_id,
        mobile_phone = EXCLUDED.mobile_phone;

    -- 4. Inserción o actualización en public.profiles
    INSERT INTO public.profiles (user_id, first_name, last_name, faculty, programa_educativo, celular, created_at)
    VALUES (p_user_id, p_first_name, p_last_name, p_faculty, p_programa_educativo, p_celular, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        faculty = EXCLUDED.faculty,
        programa_educativo = EXCLUDED.programa_educativo,
        celular = EXCLUDED.celular;

    -- 5. Inserción o actualización en public.health_professional_settings
    INSERT INTO public.health_professional_settings (professional_id, capacity, location, modality, faculty_id, updated_at)
    VALUES (p_user_id, p_capacity, p_location, p_modality, p_faculty_id, NOW())
    ON CONFLICT (professional_id) DO UPDATE
    SET capacity = EXCLUDED.capacity,
        location = EXCLUDED.location,
        modality = EXCLUDED.modality,
        faculty_id = EXCLUDED.faculty_id,
        updated_at = NOW();

    -- 6. Bitácora de Auditoría (Cumplimiento NOM-024 / HIPAA)
    INSERT INTO public.audit_logs (user_id, event_type, description, ip_address, created_at)
    VALUES (
        auth.uid(), 
        'ADMIN_REGISTER_PROFESSIONAL', 
        FORMAT('Registro centralizado exitoso de %s: %s %s (Matrícula: %s, ID: %s)', v_role_name, p_first_name, p_last_name, p_matricula, p_user_id),
        coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', 'local'),
        NOW()
    );

    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'matricula', p_matricula,
        'role_id', p_role_id,
        'role_name', v_role_name,
        'message', FORMAT('El %s ha sido registrado exitosamente en el sistema.', v_role_name)
    );

    RETURN v_result;
END;
$$;

-- Función RPC Extensiva para consultar tanto Psicólogos como Nutriólogos en el panel administrativo
CREATE OR REPLACE FUNCTION public.get_admin_health_professionals()
RETURNS TABLE (
    id UUID,
    role_id INTEGER,
    role_name VARCHAR,
    matricula VARCHAR,
    first_name TEXT,
    last_name TEXT,
    faculty TEXT,
    email VARCHAR,
    capacity INTEGER,
    location TEXT,
    modality TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validar que el usuario que ejecuta sea Admin (role_id = 1)
    IF public.get_auth_role() != 1 THEN
        RAISE EXCEPTION 'Acceso denegado. Solo la Jefatura (Admin) puede consultar el directorio completo de profesionales de la salud.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.role_id,
        r.name::VARCHAR AS role_name,
        u.matricula,
        p.first_name,
        p.last_name,
        p.faculty,
        a.email::VARCHAR,
        s.capacity,
        s.location,
        s.modality
    FROM public.users u
    JOIN auth.users a ON u.id = a.id
    JOIN public.roles r ON u.role_id = r.id
    LEFT JOIN public.profiles p ON u.id = p.user_id
    LEFT JOIN public.health_professional_settings s ON u.id = s.professional_id
    WHERE u.role_id IN (3, 4)
    ORDER BY u.role_id ASC, p.last_name ASC;
END;
$$;


-- =========================================================================================
-- 2. LÓGICA DE ASIGNACIÓN DE PACIENTES (SKILL 8.2)
-- =========================================================================================

-- Función RPC Segura para asignar o reasignar pacientes a Psicólogo y/o Nutriólogo tratante
CREATE OR REPLACE FUNCTION public.admin_assign_patient_to_professionals(
    p_student_id UUID,
    p_primary_psychologist_id UUID DEFAULT NULL,
    p_primary_nutritionist_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_exists BOOLEAN;
    v_psy_valid BOOLEAN := TRUE;
    v_nut_valid BOOLEAN := TRUE;
    v_result JSONB;
BEGIN
    -- 1. Verificación Estricta de Ciberseguridad: Solo Admin (role_id = 1)
    IF public.get_auth_role() != 1 THEN
        RAISE EXCEPTION 'CRITICAL_SECURITY_ERR: Acceso denegado. Solo la Jefatura (Admin) puede asignar o reasignar pacientes.';
    END IF;

    -- 2. Verificar existencia del estudiante
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_student_id AND role_id = 2) INTO v_student_exists;
    IF NOT v_student_exists THEN
        RAISE EXCEPTION 'VALIDATION_ERR: El estudiante especificado no existe o no tiene el rol de Estudiante (role_id = 2).';
    END IF;

    -- 3. Verificar validez del Psicólogo si se proporcionó
    IF p_primary_psychologist_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_primary_psychologist_id AND role_id = 3) INTO v_psy_valid;
        IF NOT v_psy_valid THEN
            RAISE EXCEPTION 'VALIDATION_ERR: El usuario asignado como psicólogo primario no existe o no tiene el rol de Psicólogo (role_id = 3).';
        END IF;
    END IF;

    -- 4. Verificar validez del Nutriólogo si se proporcionó
    IF p_primary_nutritionist_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_primary_nutritionist_id AND role_id = 4) INTO v_nut_valid;
        IF NOT v_nut_valid THEN
            RAISE EXCEPTION 'VALIDATION_ERR: El usuario asignado como nutriólogo primario no existe o no tiene el rol de Nutriólogo (role_id = 4).';
        END IF;
    END IF;

    -- 5. Actualizar o insertar el expediente clínico con las nuevas asignaciones
    INSERT INTO public.student_clinical_records (student_id, primary_psychologist_id, primary_nutritionist_id, updated_at)
    VALUES (p_student_id, p_primary_psychologist_id, p_primary_nutritionist_id, NOW())
    ON CONFLICT (student_id) DO UPDATE
    SET primary_psychologist_id = coalesce(p_primary_psychologist_id, public.student_clinical_records.primary_psychologist_id),
        primary_nutritionist_id = coalesce(p_primary_nutritionist_id, public.student_clinical_records.primary_nutritionist_id),
        updated_at = NOW();

    -- 6. Bitácora de Auditoría (Cumplimiento NOM-024 / HIPAA)
    INSERT INTO public.audit_logs (user_id, event_type, description, ip_address, created_at)
    VALUES (
        auth.uid(), 
        'ADMIN_ASSIGN_PATIENT', 
        FORMAT('Asignación de paciente %s. Psicólogo: %s, Nutriólogo: %s', p_student_id, coalesce(p_primary_psychologist_id::text, 'Sin cambio'), coalesce(p_primary_nutritionist_id::text, 'Sin cambio')),
        coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', 'local'),
        NOW()
    );

    v_result := jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'primary_psychologist_id', p_primary_psychologist_id,
        'primary_nutritionist_id', p_primary_nutritionist_id,
        'message', 'El paciente ha sido asignado exitosamente a sus especialistas tratantes.'
    );

    RETURN v_result;
END;
$$;


-- =========================================================================================
-- 3. RUTEO DEL ALMACENAMIENTO: MARCA DE AGUA INSTITUCIONAL (SKILL 8.3)
-- =========================================================================================

-- Crear el bucket de activos institucionales (público para consulta, protegido para escritura)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('institutional_assets', 'institutional_assets', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Limpieza de políticas previas si existieran
DROP POLICY IF EXISTS institutional_assets_public_read ON storage.objects;
DROP POLICY IF EXISTS institutional_assets_admin_insert ON storage.objects;
DROP POLICY IF EXISTS institutional_assets_admin_update ON storage.objects;
DROP POLICY IF EXISTS institutional_assets_admin_delete ON storage.objects;

-- Política 1: Lectura pública de la Marca de Agua e Insignias Institucionales
CREATE POLICY institutional_assets_public_read ON storage.objects 
FOR SELECT USING (bucket_id = 'institutional_assets');

-- Política 2: Solo el Admin (Jefatura) puede subir nuevos activos institucionales
CREATE POLICY institutional_assets_admin_insert ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'institutional_assets' AND public.get_auth_role() = 1
);

-- Política 3: Solo el Admin puede actualizar activos institucionales
CREATE POLICY institutional_assets_admin_update ON storage.objects 
FOR UPDATE USING (
    bucket_id = 'institutional_assets' AND public.get_auth_role() = 1
);

-- Política 4: Solo el Admin puede eliminar activos institucionales
CREATE POLICY institutional_assets_admin_delete ON storage.objects 
FOR DELETE USING (
    bucket_id = 'institutional_assets' AND public.get_auth_role() = 1
);


-- =========================================================================================
-- 4. RECARGA DEL CACHÉ DE ESQUEMA EN POSTGREST
-- =========================================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
