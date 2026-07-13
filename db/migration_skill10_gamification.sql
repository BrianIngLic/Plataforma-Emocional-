-- =========================================================================================
-- PROYECTO: Plataforma Emocional BUAP
-- ARCHIVO: db/migration_skill10_gamification.sql
-- DESCRIPCIÓN: Migración SQL para la Skill 10 (Logros y Gamificación). Crea la tabla de rachas,
--              agrega categorías y logros iniciales al catálogo, y define la lógica
--              automatizada del Streak Engine (Motor de Rachas y XP) en base de datos.
--              Alineado con los nombres de columna de migration_achievements_whatsapp_internal.sql
-- =========================================================================================

-- 1. CREACIÓN DE TABLA DE RACHAS (USER STREAKS)
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    best_streak INTEGER DEFAULT 0 NOT NULL,
    last_activity_date DATE DEFAULT CURRENT_DATE NOT NULL,
    total_xp INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en user_streaks
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para user_streaks
-- El estudiante ve su propia racha, clínicos y admins ven todas
CREATE POLICY user_streaks_select ON public.user_streaks
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.get_auth_role() IN (1, 3, 4));

-- Permiso de inserción/actualización interno/servicio
CREATE POLICY user_streaks_modify ON public.user_streaks
    FOR ALL TO authenticated USING (true);

-- 2. SEED DATA - CATEGORÍAS DE LOGROS (ACHIEVEMENT CATEGORIES)
-- Insertar si no existen las categorías principales en base al DDL anterior
INSERT INTO public.achievement_categories (name, description, icon_url)
VALUES 
  ('Diario', 'Logros obtenidos por escribir en tu diario emocional constantemente.', 'edit_note'),
  ('Nutrición', 'Logros obtenidos por registrar tus comidas y hábitos alimentarios en NutriMind.', 'restaurant'),
  ('Amati IA', 'Logros obtenidos por conversar y buscar soporte emocional con Amati IA.', 'smart_toy'),
  ('Citas', 'Logros obtenidos por asistir a tus citas agendadas con especialistas.', 'event_available'),
  ('Clínicos', 'Logros personalizados y metas asignadas manualmente por tus especialistas tratantes.', 'verified')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, icon_url = EXCLUDED.icon_url;

-- 3. SEED DATA - CATALOGO DE LOGROS PREDEFINIDOS (ACHIEVEMENTS)
-- Insertar logros base en el catálogo global
WITH cat AS (
  SELECT name, id FROM public.achievement_categories
)
INSERT INTO public.achievements (category_id, title, description, xp_value, badge_image_url, requirement_type, requirement_value, created_at)
VALUES
  -- Categoría Diario (requirement_type = 'diary')
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Primeros Pasos Emocionales', 'Registra tu primera entrada en el diario emocional.', 50, '/assets/icons/diary-first.svg', 'diary', 1, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Escritor Constante', 'Registra 5 entradas en tu diario emocional.', 100, '/assets/icons/diary-5.svg', 'diary', 5, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Reflexión Profunda', 'Registra 15 entradas en tu diario emocional.', 250, '/assets/icons/diary-15.svg', 'diary', 15, now()),
  
  -- Categoría Racha/Global (requirement_type = 'streak')
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Racha de Bronce', 'Mantén una racha de actividad consecutiva de 3 días.', 80, '/assets/icons/streak-3.svg', 'streak', 3, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Racha de Plata', 'Mantén una racha de actividad consecutiva de 7 días (Una semana completa).', 200, '/assets/icons/streak-7.svg', 'streak', 7, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Héroe de la Constancia', 'Mantén una racha de actividad consecutiva de 15 días.', 450, '/assets/icons/streak-15.svg', 'streak', 15, now()),
  
  -- Categoría Amati IA (requirement_type = 'amati')
  ((SELECT id FROM cat WHERE name = 'Amati IA'), 'Charla de Bienestar', 'Interactúa con Amati IA para una sesión de apoyo emocional.', 50, '/assets/icons/amati-first.svg', 'amati', 1, now()),
  ((SELECT id FROM cat WHERE name = 'Amati IA'), 'Confidente de Amati', 'Completa 5 interacciones con Amati IA.', 120, '/assets/icons/amati-5.svg', 'amati', 5, now()),
 
  -- Categoría Nutrición (requirement_type = 'nutrition')
  ((SELECT id FROM cat WHERE name = 'Nutrición'), 'NutriMind Inicial', 'Registra tu primera comida en la bitácora alimentaria.', 50, '/assets/icons/nutrition-first.svg', 'nutrition', 1, now()),
  ((SELECT id FROM cat WHERE name = 'Nutrición'), 'Estilo de Vida Saludable', 'Registra 7 días de bitácora alimentaria.', 150, '/assets/icons/nutrition-7.svg', 'nutrition', 7, now()),
 
  -- Categoría Citas (requirement_type = 'appointment')
  ((SELECT id FROM cat WHERE name = 'Citas'), 'Cita Cumplida', 'Asiste a tu primera cita agendada con un especialista.', 100, '/assets/icons/appt-first.svg', 'appointment', 1, now())
ON CONFLICT DO NOTHING;

-- 4. MOTOR DE RACHAS: FUNCIÓN PostgreSQL ALMACENADA (STREAK ENGINE)
CREATE OR REPLACE FUNCTION public.update_user_activity_streak(
    p_user_id UUID,
    p_category TEXT -- 'diary', 'nutrition', 'amati', 'appointment'
)
RETURNS JSONB
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
      -- Solo actualizar progreso
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

-- 5. RECALCULAR LOGROS EN FRÍO PARA TODOS LOS USUARIOS EXISTENTES
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

-- Ejecutar para todos los usuarios existentes al correr la migración
DO $$
DECLARE
  v_user record;
BEGIN
  FOR v_user IN SELECT id FROM users
  LOOP
    PERFORM recalculate_user_achievements(v_user.id);
  END LOOP;
END $$;

