-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP
-- ARCHIVO: db/schema.sql
-- DESCRIPCIÓN: Script de inicialización de la base de datos PostgreSQL.
--              Diseñado para ser consumido por PostgREST.
--              Incluye Tablas, Relaciones y Políticas RLS (Row Level Security) 
--              para asegurar la privacidad clínica.
-- =========================================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================================
-- 1. TABLAS CORE (USUARIOS Y ROLES)
-- =========================================================================================

-- Tabla de Roles: Define los niveles de acceso al sistema (Admin, Estudiante, Psicologo)
CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Insertar roles por defecto
INSERT INTO public.roles (name) VALUES ('Admin'), ('Estudiante'), ('Psicologo') ON CONFLICT DO NOTHING;

-- Tabla de Usuarios: Almacena credenciales básicas.
-- Nota: En producción, PostgREST delega la autenticación a Supabase Auth o un JWT externo,
-- pero esta tabla sirve como referencia interna.
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricula VARCHAR(50) UNIQUE NOT NULL, -- Número de control único para estudiantes y psicólogos
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Perfiles: Información pública o general del usuario.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255),
    UNIQUE(user_id)
);

-- =========================================================================================
-- 2. TABLAS CLÍNICAS (EXPEDIENTES Y CONDICIONES)
-- =========================================================================================

-- Tabla de Expediente Clínico (Estudiantes): 
-- Almacena las condiciones médicas declaradas en el onboarding.
CREATE TABLE public.student_clinical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    known_conditions TEXT[] DEFAULT '{}', -- Ejemplo: ['Depresión', 'Ansiedad']
    consent_given BOOLEAN DEFAULT FALSE,
    additional_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id)
);

-- =========================================================================================
-- 3. TABLAS DEL ASISTENTE EMOCIONAL (EMOLA)
-- =========================================================================================

-- Tabla de Chats: Agrupa los mensajes de una sesión de conversación.
CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(150),
    status VARCHAR(20) DEFAULT 'active', -- active, archived
    highest_urgency_score DECIMAL(3,2) DEFAULT 0.00, -- Almacena el pico de urgencia detectado en la sesión
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Mensajes: El historial completo del chat.
-- ¡CRÍTICO PARA PRIVACIDAD!: Protegido estrictamente por RLS.
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'user' o 'ai'
    content TEXT NOT NULL,
    urgency_score DECIMAL(3,2), -- Evaluado por el LLM en tiempo real
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 4. TABLAS DE GESTIÓN Y CITAS (COMMAND CENTER PSICÓLOGO)
-- =========================================================================================

-- Tabla de Citas (Appointments): El psicólogo usa esta tabla para priorizar atención
-- en base al urgency_score.
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    psychologist_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority_level VARCHAR(20) DEFAULT 'Routine', -- 'Urgent', 'High', 'Routine'
    status VARCHAR(20) DEFAULT 'Scheduled', -- 'Scheduled', 'Completed', 'Cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 5. TABLAS DE NUTRIMIND (SEGUIMIENTO ALIMENTARIO)
-- =========================================================================================

-- Tabla de Registros Diarios de Nutrición
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

-- Tabla de Alimentos: Detalles de cada comida ingresada
CREATE TABLE public.food_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nutrition_log_id UUID REFERENCES public.nutrition_logs(id) ON DELETE CASCADE,
    meal_type VARCHAR(50) NOT NULL, -- 'Desayuno', 'Almuerzo', 'Cena', 'Snack'
    name VARCHAR(150) NOT NULL,
    calories INTEGER NOT NULL,
    protein DECIMAL(5,2) DEFAULT 0.00,
    carbs DECIMAL(5,2) DEFAULT 0.00,
    fats DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================================
-- 6. POLÍTICAS DE SEGURIDAD DE FILAS (ROW LEVEL SECURITY - RLS)
-- =========================================================================================
-- Nota para PostgREST: Estas políticas asumen que el ID del usuario se inyecta
-- en el contexto JWT como `request.jwt.claim.sub` (estándar de Supabase/PostgREST).

-- Habilitar RLS en las tablas clínicas y sensibles
ALTER TABLE public.student_clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Política 1: Los estudiantes pueden leer y modificar sus propios expedientes
CREATE POLICY student_own_records 
ON public.student_clinical_records FOR ALL 
USING (student_id = (current_setting('request.jwt.claim.sub', true))::uuid);

-- Política 2: Los psicólogos pueden LEER los expedientes de estudiantes 
-- (En un escenario más restrictivo, requeriríamos una tabla `psychologist_student_assignments`)
-- Por simplicidad del prototipo, se asume que un rol 'Psicologo' puede leer.
CREATE POLICY psych_read_records 
ON public.student_clinical_records FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    JOIN public.roles r ON u.role_id = r.id 
    WHERE u.id = (current_setting('request.jwt.claim.sub', true))::uuid AND r.name = 'Psicologo'
  )
);

-- Política 3: Los estudiantes solo pueden ver sus propios chats
CREATE POLICY student_own_chats 
ON public.chats FOR ALL 
USING (student_id = (current_setting('request.jwt.claim.sub', true))::uuid);

-- Política 4: Los psicólogos pueden leer los chats para evaluación clínica
CREATE POLICY psych_read_chats 
ON public.chats FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    JOIN public.roles r ON u.role_id = r.id 
    WHERE u.id = (current_setting('request.jwt.claim.sub', true))::uuid AND r.name = 'Psicologo'
  )
);

-- Política 5: Privacidad de mensajes heredada del chat
CREATE POLICY message_privacy 
ON public.messages FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id 
      AND (
        c.student_id = (current_setting('request.jwt.claim.sub', true))::uuid 
        OR 
        EXISTS (
          SELECT 1 FROM public.users u 
          JOIN public.roles r ON u.role_id = r.id 
          WHERE u.id = (current_setting('request.jwt.claim.sub', true))::uuid AND r.name = 'Psicologo'
        )
      )
  )
);
