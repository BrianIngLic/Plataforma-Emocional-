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

-- Insertar roles por defecto
INSERT INTO public.roles (name) VALUES ('Admin'), ('Estudiante'), ('Psicologo') ON CONFLICT DO NOTHING;

-- En la V2 con Supabase, los usuarios reales se manejan en `auth.users`.
-- Esta tabla pública actúa como extensión del perfil, enlazada mediante auth.uid()
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Perfiles públicos (nombres, avatares)
-- NOTA DE CIFRADO: Si el usuario exige cifrado total, los nombres aquí almacenados
-- llegarán como cadenas AES Base64 desde Angular.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL, -- TEXT en lugar de VARCHAR para soportar hashes largos
    last_name TEXT NOT NULL,
    avatar_url VARCHAR(255),
    UNIQUE(user_id)
);

-- =========================================================================================
-- 3. EXPEDIENTES CLÍNICOS
-- =========================================================================================

CREATE TABLE public.student_clinical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
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

-- Política de Usuarios: Un usuario solo puede ver y editar su propia data pública
CREATE POLICY user_own_data ON public.users FOR ALL USING (id = auth.uid());
CREATE POLICY profile_own_data ON public.profiles FOR ALL USING (user_id = auth.uid());

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

