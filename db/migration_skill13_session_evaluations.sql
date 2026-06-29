-- =========================================================================================
-- MIGRACIÓN: SKILL 13 — EVALUACIONES DE SESIÓN (session_evaluations)
-- Archivo : migration_skill13_session_evaluations.sql
-- Fecha   : 2026-06-29
-- Autor   : Plataforma Emocional BUAP — Módulo de Alianza Terapéutica
-- Versión : 1.0.0
--
-- Descripción:
--   Crea la tabla session_evaluations para almacenar las evaluaciones post-sesión
--   que el paciente (estudiante) realiza al finalizar una cita. Incluye:
--     • Columna generada score_global (promedio ponderado)
--     • rupture_flag calculado automáticamente por trigger BEFORE INSERT
--     • RLS restrictivo: paciente, especialista y admin con permisos diferenciados
--     • Las evaluaciones son INMUTABLES (sin UPDATE / DELETE para ningún rol)
--
-- Dependencias del schema existente:
--   • public.appointments (id UUID, student_id, professional_id)
--   • public.users        (id UUID, role_id INTEGER)
--   • public.get_auth_role() — función SECURITY DEFINER ya definida en schema.sql
-- =========================================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 1: CREACIÓN DE LA TABLA session_evaluations
-- ─────────────────────────────────────────────────────────────────────────────
-- Nota: La tabla appointments usa `student_id` para el paciente. Sin embargo,
-- en session_evaluations se usa `patient_id` para mayor claridad semántica del
-- módulo de alianza terapéutica. Ambas columnas referencian public.users(id).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_evaluations (
  -- Clave primaria generada automáticamente con UUID v4
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relación con la cita evaluada (1 evaluación por cita, ver constraint UNIQUE abajo)
  appointment_id            UUID          NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,

  -- Participantes de la sesión evaluada
  patient_id                UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  professional_id           UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- ── DIMENSIONES DE EVALUACIÓN (escala 1.0 – 5.0) ──────────────────────────
  -- q1_global  : Satisfacción global con la sesión
  q1_global               DECIMAL(2,1)  NOT NULL CHECK (q1_global  BETWEEN 1.0 AND 5.0),
  -- q2_bond    : Calidad del vínculo / alianza terapéutica percibida
  q2_bond                 DECIMAL(2,1)  NOT NULL CHECK (q2_bond    BETWEEN 1.0 AND 5.0),
  -- q3_goals   : Claridad y avance en objetivos terapéuticos
  q3_goals                DECIMAL(2,1)  NOT NULL CHECK (q3_goals   BETWEEN 1.0 AND 5.0),
  -- q4_impact  : Impacto percibido de la sesión en el bienestar
  q4_impact               DECIMAL(2,1)  NOT NULL CHECK (q4_impact  BETWEEN 1.0 AND 5.0),

  -- Comentario libre opcional del paciente
  q5_comment              TEXT,

  -- ── PUNTUACIÓN GLOBAL PONDERADA (columna generada, inmutable) ─────────────
  -- Fórmula: q1(20%) + q2(30%) + q3(25%) + q4(25%) — redondeado a 1 decimal
  score_global            DECIMAL(2,1)  GENERATED ALWAYS AS (
    ROUND(
      (q1_global * 0.20 + q2_bond * 0.30 + q3_goals * 0.25 + q4_impact * 0.25)::numeric,
      1
    )
  ) STORED,

  -- ── BANDERA DE RUPTURA TERAPÉUTICA ────────────────────────────────────────
  -- Valores posibles: 'critical' | 'decline' | 'healthy' | 'pending'
  -- El valor inicial es 'pending'; el trigger trg_set_rupture_flag lo reemplaza
  -- en BEFORE INSERT con el resultado de compute_rupture_flag().
  rupture_flag            TEXT          NOT NULL DEFAULT 'pending'
    CHECK (rupture_flag IN ('critical', 'decline', 'healthy', 'pending')),

  -- Control de visibilidad: el admin puede ocultar evaluaciones al especialista
  is_visible_to_professional BOOLEAN   NOT NULL DEFAULT TRUE,

  -- Timestamp de creación (inmutable)
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.session_evaluations IS
  'Evaluaciones post-sesión del paciente. Inmutables tras su creación. '
  'Alimentan el módulo de alianza terapéutica y detección de rupturas.';

COMMENT ON COLUMN public.session_evaluations.score_global IS
  'Promedio ponderado generado: q1×0.20 + q2×0.30 + q3×0.25 + q4×0.25';
COMMENT ON COLUMN public.session_evaluations.rupture_flag IS
  'Estado de ruptura terapéutica calculado automáticamente en INSERT por el trigger.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 2: CONSTRAINT DE UNICIDAD (1 evaluación por cita)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.session_evaluations
  ADD CONSTRAINT IF NOT EXISTS session_evaluations_appointment_id_unique
    UNIQUE (appointment_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 3: ÍNDICES DE RENDIMIENTO
-- ─────────────────────────────────────────────────────────────────────────────

-- Consultas frecuentes por paciente (historial de evaluaciones del estudiante)
CREATE INDEX IF NOT EXISTS idx_session_evaluations_patient_id
  ON public.session_evaluations (patient_id);

-- Consultas frecuentes por especialista (dashboard del profesional)
CREATE INDEX IF NOT EXISTS idx_session_evaluations_professional_id
  ON public.session_evaluations (professional_id);

-- Ordenamiento cronológico y análisis longitudinal de tendencias
CREATE INDEX IF NOT EXISTS idx_session_evaluations_created_at
  ON public.session_evaluations (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 4: HABILITAR ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.session_evaluations ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 5: POLÍTICAS RLS
-- Principio de menor privilegio aplicado:
--   • INSERT   → solo el paciente (patient_id = auth.uid())
--   • SELECT   → paciente (sus propias), especialista (sus citas), admin (todas)
--   • UPDATE   → NINGÚN rol (evaluaciones inmutables)
--   • DELETE   → NINGÚN rol (evaluaciones inmutables)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 5.1 INSERT: Solo el paciente puede enviar su propia evaluación ────────────
DROP POLICY IF EXISTS se_patient_insert ON public.session_evaluations;
CREATE POLICY se_patient_insert
  ON public.session_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- ── 5.2 SELECT paciente: Solo puede leer sus propias evaluaciones ─────────────
DROP POLICY IF EXISTS se_patient_select ON public.session_evaluations;
CREATE POLICY se_patient_select
  ON public.session_evaluations
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- ── 5.3 SELECT especialista: Lee evaluaciones de sus propias citas ────────────
--   Restricción adicional: solo si is_visible_to_professional = TRUE
DROP POLICY IF EXISTS se_professional_select ON public.session_evaluations;
CREATE POLICY se_professional_select
  ON public.session_evaluations
  FOR SELECT
  TO authenticated
  USING (
    professional_id = auth.uid()
    AND is_visible_to_professional = TRUE
  );

-- ── 5.4 SELECT admin: Lectura total sin restricciones ────────────────────────
--   Usa get_auth_role() SECURITY DEFINER para evitar recursión en RLS de users
DROP POLICY IF EXISTS se_admin_select ON public.session_evaluations;
CREATE POLICY se_admin_select
  ON public.session_evaluations
  FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 1);

-- ── NOTA DE SEGURIDAD ─────────────────────────────────────────────────────────
-- No se definen políticas de UPDATE ni DELETE en esta tabla.
-- Por diseño, PostgreSQL RLS rechazará cualquier intento de modificar o
-- eliminar evaluaciones, preservando la integridad del historial clínico.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 6: FUNCIÓN compute_rupture_flag
-- ─────────────────────────────────────────────────────────────────────────────
-- Determina el estado de ruptura terapéutica basado en las dimensiones de la
-- evaluación y la puntuación global ponderada.
--
-- Lógica de clasificación:
--   CRITICAL  → alguna dimensión ≤ 2.0 (señal de alarma individual)
--               O score_global < 3.5   (deterioro general severo)
--   HEALTHY   → score_global ≥ 4.0 Y todas las dimensiones ≥ 3.0
--   DECLINE   → zona intermedia: score_global ≥ 3.5 pero no alcanza healthy
--               (posible caída longitudinal a detectar con análisis externo)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_rupture_flag(
  p_q1_global    DECIMAL(2,1),
  p_q2_bond      DECIMAL(2,1),
  p_q3_goals     DECIMAL(2,1),
  p_q4_impact    DECIMAL(2,1),
  p_score_global DECIMAL(2,1)
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
AS $$
DECLARE
  v_has_critical_dimension BOOLEAN;
  v_all_dimensions_healthy BOOLEAN;
BEGIN
  -- Verificar si alguna dimensión individual es crítica (≤ 2.0)
  v_has_critical_dimension := (
    p_q1_global <= 2.0 OR
    p_q2_bond   <= 2.0 OR
    p_q3_goals  <= 2.0 OR
    p_q4_impact <= 2.0
  );

  -- Verificar si todas las dimensiones superan el umbral saludable (≥ 3.0)
  v_all_dimensions_healthy := (
    p_q1_global >= 3.0 AND
    p_q2_bond   >= 3.0 AND
    p_q3_goals  >= 3.0 AND
    p_q4_impact >= 3.0
  );

  -- ── CLASIFICACIÓN JERÁRQUICA ──────────────────────────────────────────────
  -- Prioridad 1 — CRITICAL: dimensión crítica O score global bajo
  IF v_has_critical_dimension OR p_score_global < 3.5 THEN
    RETURN 'critical';
  END IF;

  -- Prioridad 2 — HEALTHY: score alto Y todas las dimensiones saludables
  IF p_score_global >= 4.0 AND v_all_dimensions_healthy THEN
    RETURN 'healthy';
  END IF;

  -- Prioridad 3 — DECLINE: zona intermedia (3.5 ≤ score < 4.0)
  -- Indica posible tendencia declinante; requiere seguimiento longitudinal
  RETURN 'decline';
END;
$$;

COMMENT ON FUNCTION public.compute_rupture_flag(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) IS
  'Clasifica el estado de ruptura terapéutica de una evaluación de sesión. '
  'Retorna: ''critical'' | ''decline'' | ''healthy''. '
  'Invocada automáticamente por el trigger trg_set_rupture_flag en BEFORE INSERT.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECCIÓN 7: FUNCIÓN Y TRIGGER trg_set_rupture_flag
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger BEFORE INSERT que calcula y asigna el rupture_flag automáticamente.
-- Se ejecuta ANTES de que el registro sea escrito, sobrescribiendo el valor
-- default 'pending' con la clasificación real.
--
-- IMPORTANTE: score_global es una columna GENERATED ALWAYS AS ... STORED,
-- por lo que PostgreSQL ya la habrá calculado antes de ejecutar el trigger
-- en el contexto de NEW. Sin embargo, para garantizar consistencia y
-- compatibilidad, recalculamos el score dentro del trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_rupture_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_score_global DECIMAL(2,1);
BEGIN
  -- Recalcular score_global explícitamente (la columna generada puede no estar
  -- disponible aún en NEW al momento de ejecución del BEFORE trigger)
  v_score_global := ROUND(
    (
      NEW.q1_global * 0.20 +
      NEW.q2_bond   * 0.30 +
      NEW.q3_goals  * 0.25 +
      NEW.q4_impact * 0.25
    )::numeric,
    1
  );

  -- Asignar el rupture_flag calculado
  NEW.rupture_flag := public.compute_rupture_flag(
    NEW.q1_global,
    NEW.q2_bond,
    NEW.q3_goals,
    NEW.q4_impact,
    v_score_global
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_rupture_flag() IS
  'Función de trigger: calcula y asigna rupture_flag en BEFORE INSERT '
  'sobre session_evaluations usando compute_rupture_flag().';

-- Eliminar trigger si ya existe (idempotente)
DROP TRIGGER IF EXISTS trg_set_rupture_flag ON public.session_evaluations;

-- Crear trigger BEFORE INSERT
CREATE TRIGGER trg_set_rupture_flag
  BEFORE INSERT
  ON public.session_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_rupture_flag();

COMMENT ON TRIGGER trg_set_rupture_flag ON public.session_evaluations IS
  'Trigger BEFORE INSERT: calcula automáticamente rupture_flag antes de '
  'persistir cada evaluación de sesión. Las evaluaciones son inmutables, '
  'por lo que no se define un trigger BEFORE UPDATE.';


-- =========================================================================================
-- INSTRUCCIONES PARA EJECUTAR EN SUPABASE SQL EDITOR
-- =========================================================================================
--
-- 1. Accede al Dashboard de Supabase:
--      https://app.supabase.com → Tu proyecto → SQL Editor
--
-- 2. Haz clic en "+ New query" (esquina superior izquierda).
--
-- 3. Copia el contenido completo de este archivo y pégalo en el editor.
--
-- 4. Haz clic en "Run" (▶) o presiona Ctrl + Enter para ejecutar.
--
-- 5. Verifica la ejecución exitosa revisando:
--      a) Table Editor → Buscar "session_evaluations" → debe aparecer la tabla.
--      b) Authentication → Policies → session_evaluations → deben aparecer 4 políticas.
--      c) Database → Functions → deben aparecer compute_rupture_flag y fn_set_rupture_flag.
--      d) Database → Triggers → session_evaluations → debe aparecer trg_set_rupture_flag.
--
-- 6. Prueba rápida de inserción (con un appointment_id, patient_id y professional_id válidos):
--
--    INSERT INTO public.session_evaluations
--      (appointment_id, patient_id, professional_id, q1_global, q2_bond, q3_goals, q4_impact, q5_comment)
--    VALUES
--      ('<UUID_CITA>', '<UUID_PACIENTE>', '<UUID_PROFESIONAL>', 4.5, 4.0, 3.5, 4.0, 'Sesión muy productiva.');
--
--    -- Verifica el resultado:
--    SELECT id, score_global, rupture_flag, created_at
--    FROM public.session_evaluations
--    ORDER BY created_at DESC LIMIT 1;
--    -- Esperado: score_global = 4.0, rupture_flag = 'healthy'
--
-- 7. ROLLBACK en caso de error:
--    Si necesitas deshacer esta migración, ejecuta:
--
--    DROP TRIGGER IF EXISTS trg_set_rupture_flag ON public.session_evaluations;
--    DROP FUNCTION IF EXISTS public.fn_set_rupture_flag();
--    DROP FUNCTION IF EXISTS public.compute_rupture_flag(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL);
--    DROP TABLE IF EXISTS public.session_evaluations CASCADE;
--
-- =========================================================================================
