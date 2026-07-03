-- =========================================================================================
-- MIGRACIÓN: Módulo de Nota Nutricional
-- Archivo : db/migration_nutricion_consultas.sql
-- Propósito:
--   Crea el catálogo dinámico de campos del formulario nutricional y la tabla
--   de consultas nutricionales inmutables para Supabase.
--
-- Dependencias:
--   • public.users (id UUID, role_id INTEGER)
--   • public.get_auth_role() — función SECURITY DEFINER definida en schema.sql
--   • uuid-ossp habilitado en el proyecto
-- =========================================================================================

-- =========================================================================================
-- 1) CATÁLOGO DINÁMICO DE CAMPOS
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.campos_formulario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bloque TEXT NOT NULL,
    clave TEXT NOT NULL UNIQUE,
    etiqueta TEXT NOT NULL,
    tipo_campo TEXT NOT NULL CHECK (tipo_campo IN ('text', 'number', 'boolean', 'select')),
    orden INTEGER NOT NULL DEFAULT 0,
    ayuda TEXT,
    opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_campos_formulario_bloque_activo
    ON public.campos_formulario (bloque, activo, orden);

ALTER TABLE public.campos_formulario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cf_select_nutritionist_admin ON public.campos_formulario;
CREATE POLICY cf_select_nutritionist_admin
    ON public.campos_formulario
    FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN (1, 4));

DROP POLICY IF EXISTS cf_admin_write ON public.campos_formulario;
CREATE POLICY cf_admin_write
    ON public.campos_formulario
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 1)
    WITH CHECK (public.get_auth_role() = 1);

COMMENT ON TABLE public.campos_formulario IS
    'Catálogo dinámico de campos usados por la nota nutricional del nutriólogo.';

-- =========================================================================================
-- 2) CONSULTAS NUTRICIONALES
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.consultas_nutricion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    fecha_consulta TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    calorias_totales INTEGER NOT NULL DEFAULT 0 CHECK (calorias_totales >= 0),
    datos_especificos JSONB NOT NULL DEFAULT '{}'::jsonb,
    consumo_semanal JSONB NOT NULL DEFAULT '{}'::jsonb,
    recordatorio_24h JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_consultas_nutricion_paciente_fecha
    ON public.consultas_nutricion (student_id, fecha_consulta DESC);

CREATE INDEX IF NOT EXISTS idx_consultas_nutricion_nutriologo_fecha
    ON public.consultas_nutricion (professional_id, fecha_consulta DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consultas_nutricion_appointment_id
    ON public.consultas_nutricion (appointment_id)
    WHERE appointment_id IS NOT NULL;

ALTER TABLE public.consultas_nutricion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cn_select_patient_nutritionist_admin ON public.consultas_nutricion;
CREATE POLICY cn_select_patient_nutritionist_admin
    ON public.consultas_nutricion
    FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        OR professional_id = auth.uid()
        OR public.get_auth_role() = 1
    );

DROP POLICY IF EXISTS cn_insert_nutritionist_admin ON public.consultas_nutricion;
CREATE POLICY cn_insert_nutritionist_admin
    ON public.consultas_nutricion
    FOR INSERT
    TO authenticated
    WITH CHECK (
        professional_id = auth.uid()
        OR public.get_auth_role() = 1
    );

COMMENT ON TABLE public.consultas_nutricion IS
    'Notas nutricionales inmutables con datos específicos, consumo semanal y snapshot de recordatorio 24h.';

-- =========================================================================================
-- 3) CATÁLOGO INICIAL DE CAMPOS
-- =========================================================================================
INSERT INTO public.campos_formulario (bloque, clave, etiqueta, tipo_campo, orden, ayuda, opciones, activo)
VALUES
    ('Datos específicos', 'problemas_gastrointestinales', 'Problemas gastrointestinales', 'text', 10, 'Describe malestares digestivos, dolor, reflujo, estreñimiento u otros.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'alergia_intolerancia', 'Alergias o intolerancias', 'text', 20, 'Anota alergias alimentarias o intolerancias relevantes.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'enfermedad_padecimiento', 'Enfermedad o padecimiento', 'text', 30, 'Diagnóstico o condición clínica que impacta la alimentación.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'medicamentos_consumo', 'Medicamentos en consumo', 'text', 40, 'Medicamentos, suplementos o tratamiento actual.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'alimentos_desagrado', 'Alimentos de desagrado', 'text', 50, 'Alimentos que el paciente evita o rechaza.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'actividad_fisica', 'Actividad física', 'text', 60, 'Tipo de actividad física realizada habitualmente.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'dias_actividad', 'Días de actividad por semana', 'number', 70, 'Número de días con actividad física semanal.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'tiempo_actividad', 'Tiempo de actividad por día (min)', 'number', 80, 'Minutos aproximados por sesión.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'comidas_al_dia', 'Comidas al día', 'number', 90, 'Total de comidas principales consumidas al día.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'colaciones_al_dia', 'Colaciones al día', 'number', 100, 'Número de colaciones al día.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'comidas_mantener', 'Comidas que desea mantener', 'text', 110, 'Platillos o hábitos que el paciente quiere conservar.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'consumo_agua', 'Consumo de agua (L)', 'number', 120, 'Litros de agua al día o promedio estimado.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'tiempo_sueno', 'Tiempo de sueño (hrs)', 'number', 130, 'Horas promedio de sueño por noche.', '[]'::jsonb, TRUE),
    ('Datos específicos', 'comentarios_clinicos', 'Comentarios clínicos', 'text', 140, 'Observaciones libres del nutriólogo.', '[]'::jsonb, TRUE),

    ('Consumo semanal', 'verduras', 'Verduras', 'number', 210, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'frutas', 'Frutas', 'number', 220, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'lacteos', 'Lácteos', 'number', 230, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'cereales', 'Cereales', 'number', 240, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'leguminosas', 'Leguminosas', 'number', 250, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'azucar', 'Azúcar', 'number', 260, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'aoa', 'AOA', 'number', 270, 'Alimentos de origen animal por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'aceites', 'Aceites y grasas', 'number', 280, 'Veces por semana.', '[]'::jsonb, TRUE),
    ('Consumo semanal', 'comentarios_semanales', 'Comentarios semanales', 'text', 290, 'Observaciones sobre la frecuencia alimentaria.', '[]'::jsonb, TRUE)
ON CONFLICT (clave) DO UPDATE
SET bloque = EXCLUDED.bloque,
    etiqueta = EXCLUDED.etiqueta,
    tipo_campo = EXCLUDED.tipo_campo,
    orden = EXCLUDED.orden,
    ayuda = EXCLUDED.ayuda,
    opciones = EXCLUDED.opciones,
    activo = EXCLUDED.activo;

-- =========================================================================================
-- 4) NOTAS OPERATIVAS
-- =========================================================================================
-- Si la app ya está desplegada, ejecutar este archivo en el SQL Editor de Supabase
-- o aplicarlo como migración antes de probar la ruta /nutritionist/consulta/:id.
-- Los registros son insert-only desde la aplicación; no se definen políticas UPDATE/DELETE.