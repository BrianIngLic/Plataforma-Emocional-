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
INSERT INTO public.achievements (category_id, title, description, points, badge_url, criteria_type, criteria_value, is_active, created_at)
VALUES
  -- Categoría Diario (criteria_type = 'diary')
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Primeros Pasos Emocionales', 'Registra tu primera entrada en el diario emocional.', 50, '/assets/icons/diary-first.svg', 'diary', 1, true, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Escritor Constante', 'Registra 5 entradas en tu diario emocional.', 100, '/assets/icons/diary-5.svg', 'diary', 5, true, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Reflexión Profunda', 'Registra 15 entradas en tu diario emocional.', 250, '/assets/icons/diary-15.svg', 'diary', 15, true, now()),
  
  -- Categoría Racha/Global (criteria_type = 'streak')
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Racha de Bronce', 'Mantén una racha de actividad consecutiva de 3 días.', 80, '/assets/icons/streak-3.svg', 'streak', 3, true, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Racha de Plata', 'Mantén una racha de actividad consecutiva de 7 días (Una semana completa).', 200, '/assets/icons/streak-7.svg', 'streak', 7, true, now()),
  ((SELECT id FROM cat WHERE name = 'Diario'), 'Héroe de la Constancia', 'Mantén una racha de actividad consecutiva de 15 días.', 450, '/assets/icons/streak-15.svg', 'streak', 15, true, now()),
  
  -- Categoría Amati IA (criteria_type = 'amati')
  ((SELECT id FROM cat WHERE name = 'Amati IA'), 'Charla de Bienestar', 'Interactúa con Amati IA para una sesión de apoyo emocional.', 50, '/assets/icons/amati-first.svg', 'amati', 1, true, now()),
  ((SELECT id FROM cat WHERE name = 'Amati IA'), 'Confidente de Amati', 'Completa 5 interacciones con Amati IA.', 120, '/assets/icons/amati-5.svg', 'amati', 5, true, now()),

  -- Categoría Nutrición (criteria_type = 'nutrition')
  ((SELECT id FROM cat WHERE name = 'Nutrición'), 'NutriMind Inicial', 'Registra tu primera comida en la bitácora alimentaria.', 50, '/assets/icons/nutrition-first.svg', 'nutrition', 1, true, now()),
  ((SELECT id FROM cat WHERE name = 'Nutrición'), 'Estilo de Vida Saludable', 'Registra 7 días de bitácora alimentaria.', 150, '/assets/icons/nutrition-7.svg', 'nutrition', 7, true, now()),

  -- Categoría Citas (criteria_type = 'appointment')
  ((SELECT id FROM cat WHERE name = 'Citas'), 'Cita Cumplida', 'Asiste a tu primera cita agendada con un especialista.', 100, '/assets/icons/appt-first.svg', 'appointment', 1, true, now())
ON CONFLICT DO NOTHING;

-- 4. MOTOR DE RACHAS: FUNCIÓN PostgreSQL ALMACENADA (STREAK ENGINE)
CREATE OR REPLACE FUNCTION public.update_user_activity_streak(
    p_user_id UUID,
    p_category TEXT -- 'diary', 'nutrition', 'amati', 'appointment'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_date DATE := CURRENT_DATE;
    v_streak_record RECORD;
    v_xp_earned INTEGER := 10; -- XP base por registrar actividad diaria
    v_streak_incremented BOOLEAN := FALSE;
    v_unlocked_achievements JSONB := '[]'::jsonb;
    v_ach_record RECORD;
    v_current_progress INTEGER;
BEGIN
    -- 1. Verificar o insertar registro de racha en user_streaks
    SELECT * INTO v_streak_record FROM public.user_streaks WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.user_streaks (user_id, current_streak, best_streak, last_activity_date, total_xp)
        VALUES (p_user_id, 1, 1, v_current_date, v_xp_earned)
        RETURNING * INTO v_streak_record;
        v_streak_incremented := TRUE;
    ELSE
        -- Evaluar la racha comparando la fecha de última actividad
        IF v_streak_record.last_activity_date = v_current_date THEN
            -- Ya hizo actividad hoy, no incrementamos racha pero sí acumulamos XP base por actividad
            UPDATE public.user_streaks
            SET total_xp = total_xp + v_xp_earned,
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        ELSIF v_streak_record.last_activity_date = (v_current_date - 1) THEN
            -- Actividad ayer: racha se incrementa
            v_streak_incremented := TRUE;
            UPDATE public.user_streaks
            SET current_streak = current_streak + 1,
                best_streak = GREATEST(best_streak, current_streak + 1),
                last_activity_date = v_current_date,
                total_xp = total_xp + v_xp_earned + 10, -- Bono extra +10 XP por mantener racha
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        ELSE
            -- Actividad más antigua: racha se reinicia a 1
            v_streak_incremented := TRUE;
            UPDATE public.user_streaks
            SET current_streak = 1,
                last_activity_date = v_current_date,
                total_xp = total_xp + v_xp_earned,
                updated_at = NOW()
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        END IF;
    END IF;

    -- 2. Actualizar progreso y evaluar logros del catálogo aplicables
    FOR v_ach_record IN 
        SELECT a.id, a.title, a.points, a.criteria_type, a.criteria_value 
        FROM public.achievements a
        WHERE a.is_active = TRUE 
          AND (a.criteria_type = p_category OR a.criteria_type = 'streak')
    LOOP
        -- Calcular progreso actual del alumno para este tipo de requisito
        IF v_ach_record.criteria_type = 'streak' THEN
            v_current_progress := v_streak_record.current_streak;
        ELSIF v_ach_record.criteria_type = 'diary' THEN
            SELECT count(*)::integer INTO v_current_progress FROM public.diary_entries WHERE student_id = p_user_id;
        ELSIF v_ach_record.criteria_type = 'nutrition' THEN
            SELECT count(*)::integer INTO v_current_progress FROM public.nutrition_logs WHERE student_id = p_user_id;
        ELSIF v_ach_record.criteria_type = 'amati' THEN
            SELECT count(*)::integer INTO v_current_progress FROM public.chats WHERE student_id = p_user_id;
        ELSIF v_ach_record.criteria_type = 'appointment' THEN
            SELECT count(CASE WHEN status = 'completed' THEN 1 END)::integer INTO v_current_progress FROM public.appointments WHERE student_id = p_user_id;
        ELSE
            v_current_progress := 0;
        END IF;

        -- Registrar o actualizar el progreso en user_achievements
        -- Nota: is_completed = true, progress = progress_current, earned_at = unlocked_at
        INSERT INTO public.user_achievements (user_id, achievement_id, progress, is_completed, earned_at)
        VALUES (p_user_id, v_ach_record.id, LEAST(v_current_progress, v_ach_record.criteria_value), 
                v_current_progress >= v_ach_record.criteria_value, 
                CASE WHEN v_current_progress >= v_ach_record.criteria_value THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress = LEAST(EXCLUDED.progress, v_ach_record.criteria_value),
            is_completed = CASE WHEN v_current_progress >= v_ach_record.criteria_value THEN TRUE ELSE public.user_achievements.is_completed END,
            earned_at = CASE WHEN v_current_progress >= v_ach_record.criteria_value AND public.user_achievements.is_completed = FALSE THEN NOW() ELSE public.user_achievements.earned_at END;

        -- Si el logro se acaba de desbloquear en esta ejecución, sumamos su XP de recompensa
        IF v_current_progress >= v_ach_record.criteria_value THEN
            -- Verificar si se completó en la ventana de los últimos 5 segundos (nueva consecución)
            IF EXISTS (
                SELECT 1 FROM public.user_achievements 
                WHERE user_id = p_user_id AND achievement_id = v_ach_record.id AND is_completed = TRUE AND earned_at >= NOW() - INTERVAL '5 seconds'
            ) THEN
                -- Sumar XP del logro al total del usuario
                UPDATE public.user_streaks
                SET total_xp = total_xp + v_ach_record.points
                WHERE user_id = p_user_id;
                
                -- Agregar a la lista de logros desbloqueados devueltos
                v_unlocked_achievements := v_unlocked_achievements || jsonb_build_object(
                    'id', v_ach_record.id,
                    'title', v_ach_record.title,
                    'xp_reward', v_ach_record.points
                );
            END IF;
        END IF;
    END LOOP;

    -- Obtener estado final actualizado de la racha y XP
    SELECT * INTO v_streak_record FROM public.user_streaks WHERE user_id = p_user_id;

    RETURN json_build_object(
        'success', true,
        'current_streak', v_streak_record.current_streak,
        'best_streak', v_streak_record.best_streak,
        'total_xp', v_streak_record.total_xp,
        'unlocked_achievements', v_unlocked_achievements
    );
END;
$$;
