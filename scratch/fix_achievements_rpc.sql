-- ============================================================================
-- MIGRACIÓN COMPLETA: Sistema de Gamificación
-- Problema: El schema de las tablas no coincide con lo que espera el código
-- Solución: Agregar columnas faltantes y recrear la función RPC corregida
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PASO 1: Completar la tabla user_achievements
-- Schema actual: id, user_id, achievement_id, unlocked_at
-- Schema requerido: + progress, is_completed, earned_at, awarded_by, notes
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE user_achievements
  ADD COLUMN IF NOT EXISTS progress        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_completed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS earned_at       timestamptz,
  ADD COLUMN IF NOT EXISTS awarded_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes           text;

-- Sincronizar: si existe unlocked_at, marcar como completado
UPDATE user_achievements
SET is_completed = true,
    earned_at    = unlocked_at,
    progress     = 1
WHERE unlocked_at IS NOT NULL
  AND is_completed = false;

-- Constraint único para evitar duplicados (user + achievement)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_achievements'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'user_achievements_user_id_achievement_id_key'
  ) THEN
    ALTER TABLE user_achievements
      ADD CONSTRAINT user_achievements_user_id_achievement_id_key
      UNIQUE (user_id, achievement_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- PASO 2: Completar la tabla user_streaks
-- Necesitamos verificar qué columnas tiene y agregar las que faltan
-- ────────────────────────────────────────────────────────────────────────────
-- Si la tabla user_streaks no existe, crearla
CREATE TABLE IF NOT EXISTS user_streaks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak      integer     NOT NULL DEFAULT 0,
  best_streak         integer     NOT NULL DEFAULT 0,
  last_activity_date  date,
  total_xp            integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Si ya existe, agregar columnas que puedan faltar
ALTER TABLE user_streaks
  ADD COLUMN IF NOT EXISTS current_streak      integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak         integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date  date,
  ADD COLUMN IF NOT EXISTS total_xp            integer     NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────────────
-- PASO 3: Políticas RLS (Row Level Security) para gamificación
-- ────────────────────────────────────────────────────────────────────────────

-- user_streaks: cada usuario puede leer y escribir su propia racha
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streaks_select_own" ON user_streaks;
DROP POLICY IF EXISTS "user_streaks_insert_own" ON user_streaks;
DROP POLICY IF EXISTS "user_streaks_update_own" ON user_streaks;

CREATE POLICY "user_streaks_select_own" ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_streaks_insert_own" ON user_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_streaks_update_own" ON user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- user_achievements: cada usuario puede leer sus logros
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select_own" ON user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert_own" ON user_achievements;
DROP POLICY IF EXISTS "user_achievements_update_own" ON user_achievements;

CREATE POLICY "user_achievements_select_own" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_achievements_insert_own" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_achievements_update_own" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- achievements (catálogo): todos pueden leer
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_select_all" ON achievements;
CREATE POLICY "achievements_select_all" ON achievements
  FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- PASO 4: Función RPC corregida
-- Bug original: usaba "a.points" en lugar de "a.xp_value"
-- También corrige: tabla del chat es "chats" (no "chat_messages")
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS update_user_activity_streak(uuid, text);

CREATE OR REPLACE FUNCTION update_user_activity_streak(
  p_user_id uuid,
  p_category text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak        user_streaks%ROWTYPE;
  v_today         date := current_date;
  v_new_streak    int := 1;
  v_xp_gain       int := 10;
  v_unlocked      jsonb := '[]'::jsonb;
  v_ach           record;
  v_count         int;
BEGIN
  -- ─── 1. Obtener o crear la racha del usuario ───────────────────────────
  SELECT * INTO v_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, best_streak, last_activity_date, total_xp)
    VALUES (p_user_id, 1, 1, v_today, v_xp_gain)
    RETURNING * INTO v_streak;
  ELSE
    IF v_streak.last_activity_date = v_today THEN
      v_new_streak := v_streak.current_streak;  -- Ya registró hoy
    ELSIF v_streak.last_activity_date = v_today - INTERVAL '1 day' THEN
      v_new_streak := v_streak.current_streak + 1;  -- Consecutivo
    ELSE
      v_new_streak := 1;  -- Racha rota
    END IF;

    UPDATE user_streaks
    SET
      current_streak     = v_new_streak,
      best_streak        = GREATEST(best_streak, v_new_streak),
      last_activity_date = v_today,
      total_xp           = total_xp + v_xp_gain
    WHERE user_id = p_user_id
    RETURNING * INTO v_streak;
  END IF;

  -- ─── 2. Evaluar logros de esta categoría ──────────────────────────────
  FOR v_ach IN
    SELECT a.id, a.title, a.xp_value, a.requirement_type, a.requirement_value
    FROM achievements a
    WHERE a.requirement_type = p_category
      AND NOT EXISTS (
        SELECT 1 FROM user_achievements ua
        WHERE ua.achievement_id = a.id
          AND ua.user_id = p_user_id
          AND ua.is_completed = true
      )
  LOOP
    v_count := 0;

    CASE v_ach.requirement_type
      WHEN 'diary' THEN
        SELECT COUNT(*) INTO v_count
        FROM diary_entries WHERE student_id = p_user_id;

      WHEN 'nutrition' THEN
        SELECT COUNT(*) INTO v_count
        FROM food_diary_entries WHERE student_id = p_user_id;

      WHEN 'streak' THEN
        v_count := v_streak.current_streak;

      WHEN 'amati' THEN
        SELECT COUNT(*) INTO v_count
        FROM chats WHERE student_id = p_user_id;

      WHEN 'appointment' THEN
        SELECT COUNT(*) INTO v_count
        FROM appointments
        WHERE student_id = p_user_id AND status = 'completed';

      ELSE
        v_count := 0;
    END CASE;

    IF v_count >= v_ach.requirement_value THEN
      -- Desbloquear logro
      INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, earned_at)
      VALUES (p_user_id, v_ach.id, v_count, true, now())
      ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress     = EXCLUDED.progress,
            is_completed = true,
            earned_at    = COALESCE(user_achievements.earned_at, now())
      WHERE user_achievements.is_completed = false;

      -- Si se desbloqueó recién (was false, now true)
      IF FOUND THEN
        v_unlocked := v_unlocked || jsonb_build_object(
          'id',       v_ach.id,
          'title',    v_ach.title,
          'xp_value', v_ach.xp_value
        );
        UPDATE user_streaks
        SET total_xp = total_xp + v_ach.xp_value
        WHERE user_id = p_user_id;
      END IF;
    ELSE
      -- Actualizar progreso sin completar
      INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed)
      VALUES (p_user_id, v_ach.id, v_count, false)
      ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress = GREATEST(user_achievements.progress, EXCLUDED.progress)
      WHERE user_achievements.is_completed = false;
    END IF;
  END LOOP;

  -- ─── 3. Leer estado actualizado ───────────────────────────────────────
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'current_streak',        v_streak.current_streak,
    'best_streak',           v_streak.best_streak,
    'total_xp',              v_streak.total_xp,
    'unlocked_achievements', v_unlocked
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[update_user_activity_streak] %: %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'error',                 SQLERRM,
    'current_streak',        0,
    'total_xp',              0,
    'unlocked_achievements', '[]'::jsonb
  );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION update_user_activity_streak(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION update_user_activity_streak(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- RECALCULAR LOGROS EN FRÍO PARA TODOS LOS USUARIOS EXISTENTES
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_user_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak        user_streaks%ROWTYPE;
  v_ach           record;
  v_count         int;
  v_today         date := current_date;
BEGIN
  -- Asegurar que el usuario tenga un registro de racha
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, best_streak, last_activity_date, total_xp)
    VALUES (p_user_id, 0, 0, v_today - INTERVAL '2 days', 0)
    RETURNING * INTO v_streak;
  END IF;

  FOR v_ach IN
    SELECT id, title, xp_value, requirement_type, requirement_value
    FROM achievements
  LOOP
    v_count := 0;

    CASE v_ach.requirement_type
      WHEN 'diary' THEN
        SELECT COUNT(*) INTO v_count
        FROM diary_entries WHERE student_id = p_user_id;

      WHEN 'nutrition' THEN
        SELECT COUNT(*) INTO v_count
        FROM food_diary_entries WHERE student_id = p_user_id;

      WHEN 'streak' THEN
        v_count := v_streak.current_streak;

      WHEN 'amati' THEN
        SELECT COUNT(*) INTO v_count
        FROM chats WHERE student_id = p_user_id;

      WHEN 'appointment' THEN
        SELECT COUNT(*) INTO v_count
        FROM appointments
        WHERE student_id = p_user_id AND status = 'completed';

      ELSE
        v_count := 0;
    END CASE;

    IF v_count >= v_ach.requirement_value THEN
      -- Desbloquear logro retroactivamente
      INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, earned_at)
      VALUES (p_user_id, v_ach.id, v_count, true, now())
      ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress     = EXCLUDED.progress,
            is_completed = true,
            earned_at    = COALESCE(user_achievements.earned_at, EXCLUDED.earned_at);
    ELSE
      -- Registrar progreso parcial
      INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed)
      VALUES (p_user_id, v_ach.id, v_count, false)
      ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress     = GREATEST(user_achievements.progress, EXCLUDED.progress);
    END IF;
  END LOOP;

  -- Calcular total_xp sumando la base y el valor de todos los logros completados
  UPDATE user_streaks
  SET total_xp = COALESCE((
    SELECT SUM(a.xp_value)
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = p_user_id AND ua.is_completed = true
  ), 0) + (current_streak * 10)
  WHERE user_id = p_user_id;
END;
$$;

-- Ejecutar para todos los usuarios existentes
DO $$
DECLARE
  v_user record;
BEGIN
  FOR v_user IN SELECT id FROM users
  LOOP
    PERFORM recalculate_user_achievements(v_user.id);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'user_achievements columns' AS check_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_name = 'user_achievements' AND table_schema = 'public'
UNION ALL
SELECT
  'user_streaks columns',
  string_agg(column_name, ', ' ORDER BY ordinal_position)
FROM information_schema.columns
WHERE table_name = 'user_streaks' AND table_schema = 'public'
UNION ALL
SELECT
  'RPC function exists',
  security_type
FROM information_schema.routines
WHERE routine_name = 'update_user_activity_streak' AND routine_schema = 'public';

