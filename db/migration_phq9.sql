-- 1) Agregar columna de configuración de re-aplicación del PHQ-9 en la tabla real
ALTER TABLE public.student_clinical_records_table 
ADD COLUMN IF NOT EXISTS phq9_config JSONB NOT NULL DEFAULT '{"mode": "weeks", "value": 4}'::jsonb;

-- 1b) Actualizar la función del disparador de modificación de la vista para soportar la columna phq9_config
CREATE OR REPLACE FUNCTION public.trg_student_clinical_records_view_modify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.student_clinical_records_table (id, student_id, primary_psychologist_id, primary_nutritionist_id, known_conditions, consent_given, additional_notes, updated_at, phq9_config)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            NEW.primary_psychologist_id,
            NEW.primary_nutritionist_id,
            NEW.known_conditions,
            COALESCE(NEW.consent_given, FALSE),
            public.encrypt_server(NEW.additional_notes),
            COALESCE(NEW.updated_at, now()),
            COALESCE(NEW.phq9_config, '{"mode": "weeks", "value": 4}'::jsonb)
        )
        RETURNING id, student_id, primary_psychologist_id, primary_nutritionist_id, known_conditions, consent_given, public.decrypt_server(additional_notes), updated_at, phq9_config INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.student_clinical_records_table
        SET student_id = NEW.student_id,
            primary_psychologist_id = NEW.primary_psychologist_id,
            primary_nutritionist_id = NEW.primary_nutritionist_id,
            known_conditions = NEW.known_conditions,
            consent_given = NEW.consent_given,
            additional_notes = public.encrypt_server(NEW.additional_notes),
            updated_at = COALESCE(NEW.updated_at, now()),
            phq9_config = NEW.phq9_config
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.student_clinical_records_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$;

-- 1c) Recrear la vista para exponer phq9_config hacia PostgREST
CREATE OR REPLACE VIEW public.student_clinical_records AS
 SELECT id,
    student_id,
    primary_psychologist_id,
    primary_nutritionist_id,
    known_conditions,
    consent_given,
    decrypt_server(additional_notes) AS additional_notes,
    updated_at,
    phq9_config
   FROM public.student_clinical_records_table;

-- 2) Agregar columnas de PHQ-9 en la tabla de diario emocional real
ALTER TABLE public.diary_entries_table 
ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50) DEFAULT 'diary' NOT NULL;

ALTER TABLE public.diary_entries_table 
ADD COLUMN IF NOT EXISTS phq9_score INTEGER DEFAULT NULL;

ALTER TABLE public.diary_entries_table 
ADD COLUMN IF NOT EXISTS survey_data JSONB DEFAULT NULL;

-- 2b) Actualizar la función del disparador de modificación de la vista diary_entries
CREATE OR REPLACE FUNCTION public.trg_diary_entries_view_modify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.diary_entries_table (id, student_id, content, moods, high_risk, created_at, entry_type, phq9_score, survey_data)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            public.encrypt_server(NEW.content),
            NEW.moods,
            COALESCE(NEW.high_risk, FALSE),
            COALESCE(NEW.created_at, now()),
            COALESCE(NEW.entry_type, 'diary'),
            NEW.phq9_score,
            NEW.survey_data
        )
        RETURNING id, student_id, public.decrypt_server(content), moods, high_risk, created_at, entry_type, phq9_score, survey_data INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.diary_entries_table
        SET student_id = NEW.student_id,
            content = public.encrypt_server(NEW.content),
            moods = NEW.moods,
            high_risk = NEW.high_risk,
            created_at = NEW.created_at,
            entry_type = NEW.entry_type,
            phq9_score = NEW.phq9_score,
            survey_data = NEW.survey_data
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.diary_entries_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$;

-- 2c) Recrear la vista diary_entries para incluir las nuevas columnas expuestas
CREATE OR REPLACE VIEW public.diary_entries AS
 SELECT id,
    student_id,
    decrypt_server(content) AS content,
    moods,
    high_risk,
    created_at,
    entry_type,
    phq9_score,
    survey_data
   FROM public.diary_entries_table;

-- 3) Insertar logro global por completar el primer cuestionario PHQ-9
DO $$
DECLARE
    v_cat_id UUID;
BEGIN
    SELECT id INTO v_cat_id FROM public.achievement_categories WHERE name = 'Diario' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
        -- Insertar el logro si no existe
        INSERT INTO public.achievements (category_id, title, description, xp_value, badge_image_url, requirement_type, requirement_value, creator_role)
        SELECT v_cat_id, 'Primer Diagnóstico PHQ-9', 'Completaste tu primer cuestionario de salud mental PHQ-9.', 50, 'favorite', 'phq9', 1, '1'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.achievements WHERE title = 'Primer Diagnóstico PHQ-9'
        );
    END IF;
END $$;

-- 4) Actualizar la función update_user_activity_streak para soportar la categoría 'phq9'
CREATE OR REPLACE FUNCTION public.update_user_activity_streak(
    p_user_id UUID,
    p_category TEXT -- 'diary', 'nutrition', 'amati', 'appointment', 'phq9'
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
  -- Si es la categoría 'phq9', otorgamos más XP de recompensa (50 XP por responder el cuestionario)
  IF p_category = 'phq9' THEN
    v_xp_gain := 50;
  END IF;

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

      WHEN 'phq9' THEN
        SELECT COUNT(*) INTO v_count
        FROM diary_entries WHERE student_id = p_user_id AND entry_type = 'phq9';

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
      INSERT INTO user_achievements (user_id, achievement_id, is_completed, earned_at, progress)
      VALUES (p_user_id, v_ach.id, true, now(), v_count)
      ON CONFLICT (user_id, achievement_id) DO UPDATE
      SET is_completed = true, earned_at = now(), progress = v_count;

      -- Sumar el valor de XP del logro al total del usuario
      UPDATE user_streaks
      SET total_xp = total_xp + v_ach.xp_value
      WHERE user_id = p_user_id;

      v_unlocked := v_unlocked || jsonb_build_object(
        'id', v_ach.id,
        'title', v_ach.title,
        'xp_reward', v_ach.xp_value
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'current_streak', v_new_streak,
    'total_xp', v_streak.total_xp,
    'unlocked_achievements', v_unlocked
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[update_user_activity_streak] %: %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
