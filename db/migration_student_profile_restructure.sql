-- Migración para reestructurar el perfil del estudiante
-- Agrega columna JSONB para el expediente completo con árbol genealógico y contactos de emergencia

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expediente_completo JSONB DEFAULT '{}'::jsonb;
