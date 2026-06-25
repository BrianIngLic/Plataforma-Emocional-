-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP (Refactorización V2 - Supabase & Cifrado)
-- ARCHIVO: db/schema.sql
-- DESCRIPCIÓN: Script de inicialización de la base de datos PostgreSQL adaptado
--              para Supabase Auth nativo y preparado para recibir datos cifrados
--              desde Angular (E2EE).
-- =========================================================================================

-- =========================================================================================
-- 1. EXTENSIONES Y SEGURIDAD
-- =========================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================================
-- 2. TABLAS CORE (USUARIOS Y ROLES)
-- =========================================================================================

-- Tabla de Roles
CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Insertar roles por defecto con IDs explícitos para consistencia
INSERT INTO public.roles (id, name) VALUES 
  (1, 'Admin'), 
  (2, 'Estudiante'), 
  (3, 'Psicologo'), 
  (4, 'Nutricionista') 
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Ajustar la secuencia del serial de roles tras la inserción manual
SELECT setval('public.roles_id_seq', 4, true);

-- Tabla de Campus
CREATE TABLE public.campuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Facultades
CREATE TABLE public.faculties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar campus por defecto
INSERT INTO public.campuses (name) VALUES 
  ('Área Centro'), 
  ('Ciudad Universitaria'), 
  ('Área de la Salud') 
ON CONFLICT (name) DO NOTHING;

-- Insertar facultades por defecto
INSERT INTO public.faculties (name, campus_id) VALUES 
  ('Facultad de Ciencias de la Computación (FCC)', (SELECT id FROM public.campuses WHERE name = 'Ciudad Universitaria')),
  ('Facultad de Medicina', (SELECT id FROM public.campuses WHERE name = 'Área de la Salud')),
  ('Facultad de Derecho y Ciencias Sociales', (SELECT id FROM public.campuses WHERE name = 'Área Centro'))
ON CONFLICT (name) DO NOTHING;

-- En la V2 con Supabase, los usuarios reales se manejan en `auth.users`.
-- Esta tabla pública actúa como extensión del perfil, enlazada mediante auth.uid()
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES public.roles(id) ON DELETE SET NULL,
    requires_password_change BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Perfiles de usuarios — almacena TODOS los campos del formulario de registro de pacientes.
-- NOTA DE CIFRADO: Si el usuario exige cifrado total, los nombres aquí almacenados
-- llegarán como cadenas AES Base64 desde Angular.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    -- Datos de identidad (Paso 2: Perfil)
    first_name TEXT NOT NULL,          -- Nombre(s)
    last_name TEXT NOT NULL,           -- Apellidos
    -- Datos académicos
    faculty TEXT,                      -- Facultad / Unidad Académica
    programa_educativo TEXT,           -- Programa Educativo (Carrera)
    -- Datos de contacto
    celular VARCHAR(15),               -- Teléfono Celular (10 dígitos)
    -- Datos demográficos y clínicos básicos
    antecedentes_familiares TEXT,      -- Antecedentes Clínicos Familiares
    sexo VARCHAR(20),                  -- Femenino | Masculino | Otro
    fecha_nacimiento DATE,             -- Fecha de Nacimiento (para cálculo de edad)
    edad INTEGER,                      -- Edad calculada al momento del registro
    -- Avatar
    avatar_url VARCHAR(255),
    UNIQUE(user_id)
);

-- =========================================================================================
-- 3. EXPEDIENTES CLÍNICOS
-- =========================================================================================

CREATE TABLE public.student_clinical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    primary_psychologist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    primary_nutritionist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    known_conditions TEXT[] DEFAULT '{}',
    consent_given BOOLEAN DEFAULT FALSE,
    additional_notes TEXT, -- Texto cifrado E2EE
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id)
);

-- =========================================================================================
-- 4. CHAT EMOLA (ASISTENTE IA) - ALTA SEGURIDAD
-- =========================================================================================

CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT, -- Título del chat (Cifrado E2EE)
    status VARCHAR(20) DEFAULT 'active',
    highest_urgency_score DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Los mensajes llegarán ya cifrados a la base de datos gracias al CryptoService de Angular.
-- Supabase nunca conocerá el texto real.
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'user' o 'ai'
    content TEXT NOT NULL, -- Hashes AES en Base64
    urgency_score DECIMAL(3,2),   
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 5. AGENDA (COMMAND CENTER PSICÓLOGO)
-- =========================================================================================

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    psychologist_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority_level VARCHAR(20) DEFAULT 'Routine',
    status VARCHAR(20) DEFAULT 'Scheduled',
    notes TEXT, -- Cifrado E2EE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 5.1. CONFIGURACIÓN DE AGENDA Y HORARIOS (SKILL 7)
-- =========================================================================================

CREATE TABLE public.psychologist_settings (
    psychologist_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    session_duration INTEGER DEFAULT 50,
    working_days JSONB DEFAULT '{}', -- Ejemplo: {"monday": {"start": "09:00", "end": "17:00"}}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Nota: psychologist_id es NULL si es una excepción global creada por un Admin para todos
CREATE TABLE public.psychologist_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Configuración de Pacientes (Nuevo)
CREATE TABLE public.patient_settings (
    student_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active', -- active, dropout, discharged
    self_diagnosis VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 6. NUTRIMIND (SEGUIMIENTO ALIMENTARIO)
-- =========================================================================================

CREATE TABLE public.nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_calories INTEGER DEFAULT 0,
    total_protein DECIMAL(5,2) DEFAULT 0.00,
    total_carbs DECIMAL(5,2) DEFAULT 0.00,
    total_fats DECIMAL(5,2) DEFAULT 0.00,
    UNIQUE(student_id, log_date)
);

CREATE TABLE public.food_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nutrition_log_id UUID REFERENCES public.nutrition_logs(id) ON DELETE CASCADE,
    meal_type VARCHAR(50) NOT NULL,
    name TEXT NOT NULL, -- Cifrado E2EE opcional
    calories INTEGER NOT NULL,
    protein DECIMAL(5,2) DEFAULT 0.00,
    carbs DECIMAL(5,2) DEFAULT 0.00,
    fats DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 7. MI DIARIO (SKILL 6)
-- =========================================================================================

CREATE TABLE public.diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Cifrado E2EE
    moods TEXT[], -- Array de strings con emociones
    high_risk BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 8. RLS (ROW LEVEL SECURITY)
-- =========================================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologist_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

-- Política de Usuarios: Un usuario solo puede ver y editar su propia data pública
CREATE POLICY user_own_data ON public.users FOR ALL USING (id = auth.uid());
CREATE POLICY profile_own_data ON public.profiles FOR ALL USING (user_id = auth.uid());

-- Política de Campus y Facultades (Lectura pública para autenticados, escritura solo para Admin)
CREATE POLICY select_campuses ON public.campuses FOR SELECT TO authenticated USING (true);
CREATE POLICY select_faculties ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_all_campuses ON public.campuses FOR ALL USING (public.get_auth_role() = 1);
CREATE POLICY admin_all_faculties ON public.faculties FOR ALL USING (public.get_auth_role() = 1);

-- Política de Chats: El estudiante solo ve sus chats (Los psicólogos leerán mediante backend seguro)
CREATE POLICY chat_own_data ON public.chats FOR ALL USING (student_id = auth.uid());
CREATE POLICY message_own_data ON public.messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.student_id = auth.uid())
);

-- Política de Diario:
CREATE POLICY diary_own_data ON public.diary_entries FOR ALL USING (student_id = auth.uid());

-- Políticas adicionales faltantes
CREATE POLICY clinical_own_data ON public.student_clinical_records FOR ALL USING (student_id = auth.uid());
CREATE POLICY appointments_own_data ON public.appointments FOR ALL USING (student_id = auth.uid() OR psychologist_id = auth.uid());

-- =========================================================================================
-- 9. FUNCIONES DE SEGURIDAD (Evitar recursión infinita en RLS)
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role_id FROM public.users WHERE id = auth.uid();
$$;

-- Políticas para Psicólogos (Skill 5.3):
-- 1. Los psicólogos pueden ver la tabla pública de usuarios si estos son estudiantes (role_id = 2)
CREATE POLICY psychologist_read_users ON public.users FOR SELECT USING (
    public.get_auth_role() = 3 AND role_id = 2
);

-- 2. Los psicólogos pueden ver el perfil público de cualquier estudiante
CREATE POLICY psychologist_read_profiles ON public.profiles FOR SELECT USING (
    public.get_auth_role() = 3
);

-- 3. Los psicólogos pueden ver todos los expedientes clínicos de estudiantes
CREATE POLICY psychologist_read_clinical ON public.student_clinical_records FOR SELECT USING (
    public.get_auth_role() = 3
);

-- 4. Los psicólogos pueden actualizar los expedientes (asignarse como tratante)
CREATE POLICY psychologist_update_clinical ON public.student_clinical_records FOR UPDATE USING (
    public.get_auth_role() = 3
);

-- 5. Los psicólogos pueden ver las entradas del diario de los pacientes (Skill 5.5)
CREATE POLICY psychologist_read_diary ON public.diary_entries FOR SELECT USING (
    public.get_auth_role() = 3
);

-- 6. Los psicólogos pueden ver y editar sus propios ajustes
CREATE POLICY psychologist_own_settings ON public.psychologist_settings FOR ALL USING (
    psychologist_id = auth.uid()
);

-- 7. Los psicólogos pueden ver y editar sus propias excepciones
CREATE POLICY psychologist_own_exceptions ON public.psychologist_exceptions FOR ALL USING (
    psychologist_id = auth.uid()
);

-- Políticas para Nutricionistas (role_id = 4):
-- 1. Los nutricionistas pueden ver la tabla pública de usuarios si estos son estudiantes (role_id = 2)
CREATE POLICY nutritionist_read_users ON public.users FOR SELECT USING (
    public.get_auth_role() = 4 AND role_id = 2
);

-- 2. Los nutricionistas pueden ver el perfil público de cualquier estudiante
CREATE POLICY nutritionist_read_profiles ON public.profiles FOR SELECT USING (
    public.get_auth_role() = 4
);

-- 3. Los nutricionistas pueden ver todos los expedientes clínicos de estudiantes
CREATE POLICY nutritionist_read_clinical ON public.student_clinical_records FOR SELECT USING (
    public.get_auth_role() = 4
);

-- 4. Los nutricionistas pueden actualizar los expedientes (asignarse como tratante/nutriólogo)
CREATE POLICY nutritionist_update_clinical ON public.student_clinical_records FOR UPDATE USING (
    public.get_auth_role() = 4
);

-- 5. Los nutricionistas pueden ver las entradas del diario de los pacientes
CREATE POLICY nutritionist_read_diary ON public.diary_entries FOR SELECT USING (
    public.get_auth_role() = 4
);

-- Políticas para Patient Settings:
-- 1. Los estudiantes pueden ver y editar sus propios ajustes de paciente
CREATE POLICY patient_settings_own_data ON public.patient_settings FOR ALL USING (student_id = auth.uid());
-- 2. Los psicólogos y nutricionistas pueden ver los ajustes de pacientes
CREATE POLICY psychologist_read_patient_settings ON public.patient_settings FOR SELECT USING (public.get_auth_role() = 3);
CREATE POLICY nutritionist_read_patient_settings ON public.patient_settings FOR SELECT USING (public.get_auth_role() = 4);
-- 3. Los admins pueden ver y editar todos los ajustes de pacientes
CREATE POLICY admin_patient_settings ON public.patient_settings FOR ALL USING (public.get_auth_role() = 1);

-- Políticas para NutriMind (nutrition_logs y food_items):
-- 1. Los estudiantes tienen acceso completo a sus propios registros de nutrición y comidas
CREATE POLICY student_own_nutrition_logs ON public.nutrition_logs FOR ALL USING (student_id = auth.uid());
CREATE POLICY student_own_food_items ON public.food_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.nutrition_logs l WHERE l.id = nutrition_log_id AND l.student_id = auth.uid())
);
-- 2. Los nutricionistas pueden leer los registros de nutrición y comidas de los estudiantes
CREATE POLICY nutritionist_read_nutrition_logs ON public.nutrition_logs FOR SELECT USING (public.get_auth_role() = 4);
CREATE POLICY nutritionist_read_food_items ON public.food_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.nutrition_logs l WHERE l.id = nutrition_log_id AND public.get_auth_role() = 4)
);
-- 3. Los administradores tienen control total sobre nutrición
CREATE POLICY admin_all_nutrition_logs ON public.nutrition_logs FOR ALL USING (public.get_auth_role() = 1);
CREATE POLICY admin_all_food_items ON public.food_items FOR ALL USING (public.get_auth_role() = 1);

-- 8. Los estudiantes pueden leer los ajustes y excepciones para el auto-registro
CREATE POLICY student_read_settings ON public.psychologist_settings FOR SELECT USING (
    public.get_auth_role() = 2
);
CREATE POLICY student_read_exceptions ON public.psychologist_exceptions FOR SELECT USING (
    public.get_auth_role() = 2 OR psychologist_id IS NULL
);

-- 9. Los admins pueden ver y crear excepciones globales
CREATE POLICY admin_global_exceptions ON public.psychologist_exceptions FOR ALL USING (
    public.get_auth_role() = 1
);

-- =========================================================================================
-- 10. SUPABASE STORAGE (BUCKETS)
-- =========================================================================================

-- Crear el bucket de avatares (público)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Política: Lectura pública de avatares
CREATE POLICY avatar_public_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Política: Los usuarios solo pueden insertar y actualizar sus propios avatares
CREATE POLICY avatar_insert ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() = owner
);

CREATE POLICY avatar_update ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid() = owner
);

CREATE POLICY avatar_delete ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid() = owner
);

