-- =========================================================================================
-- 1. HABILITAR EXTENSIONES Y TABLA DE LLAVES
-- =========================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.encryption_keys (
    id SERIAL PRIMARY KEY,
    key_value TEXT NOT NULL,
    version INT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
-- Nota: No se crean políticas RLS, de modo que queda bloqueada para lectura/escritura de clientes directos.

-- =========================================================================================
-- 2. FUNCIONES DE CIFRADO Y DESCIFRADO EN SERVIDOR (SECURITY DEFINER)
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.encrypt_server(plaintext text, key_version int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key TEXT;
    v_ver INT;
    v_encrypted BYTEA;
BEGIN
    IF plaintext IS NULL OR plaintext = '' THEN
        RETURN '';
    END IF;

    -- Obtener versión activa si no se especifica
    IF key_version IS NULL THEN
        SELECT key_value, version INTO v_key, v_ver FROM public.encryption_keys WHERE active = TRUE LIMIT 1;
    ELSE
        SELECT key_value, version INTO v_key, v_ver FROM public.encryption_keys WHERE version = key_version LIMIT 1;
    END IF;

    IF v_key IS NULL THEN
        RAISE EXCEPTION 'No hay una llave de cifrado activa en el servidor.';
    END IF;

    -- Cifrar usando pg_sym_encrypt
    v_encrypted := pgp_sym_encrypt(plaintext, v_key);

    -- Devolver formato v[ver]#[base64]
    RETURN 'v' || v_ver || '#' || encode(v_encrypted, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_server(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ver_str TEXT;
    v_ver INT;
    v_data_str TEXT;
    v_key TEXT;
    v_decrypted TEXT;
BEGIN
    IF ciphertext IS NULL OR ciphertext = '' THEN
        RETURN '';
    END IF;

    -- Validar si tiene el formato v[ver]#[base64]
    IF ciphertext NOT LIKE 'v%#%' THEN
        -- Compatibilidad: si no está en formato de servidor, devolver tal cual (deja pasar datos antiguos)
        RETURN ciphertext;
    END IF;

    -- Extraer versión y datos
    v_ver_str := split_part(ciphertext, '#', 1);
    v_ver := replace(v_ver_str, 'v', '')::INT;
    v_data_str := split_part(ciphertext, '#', 2);

    -- Obtener llave
    SELECT key_value INTO v_key FROM public.encryption_keys WHERE version = v_ver;

    IF v_key IS NULL THEN
        RETURN '[ERROR: Llave de descifrado no disponible]';
    END IF;

    BEGIN
        v_decrypted := pgp_sym_decrypt(decode(v_data_str, 'base64'), v_key);
        RETURN v_decrypted;
    EXCEPTION WHEN OTHERS THEN
        RETURN '[ERROR: Descifrado fallido]';
    END;
END;
$$;

-- =========================================================================================
-- 3. CAMBIAR NOMBRES DE TABLAS A _TABLE
-- =========================================================================================
ALTER TABLE public.chats RENAME TO chats_table;
ALTER TABLE public.messages RENAME TO messages_table;
ALTER TABLE public.diary_entries RENAME TO diary_entries_table;
ALTER TABLE public.food_diary_entries RENAME TO food_diary_entries_table;
ALTER TABLE public.student_clinical_records RENAME TO student_clinical_records_table;

-- =========================================================================================
-- 4. CREAR VISTAS CON SEGURIDAD SECURITY INVOKER
-- =========================================================================================
CREATE OR REPLACE VIEW public.chats WITH (security_invoker = on) AS
SELECT id, student_id, public.decrypt_server(title) AS title, status, highest_urgency_score, created_at, updated_at
FROM public.chats_table;

CREATE OR REPLACE VIEW public.messages WITH (security_invoker = on) AS
SELECT id, chat_id, sender_type, public.decrypt_server(content) AS content, urgency_score, timestamp
FROM public.messages_table;

CREATE OR REPLACE VIEW public.diary_entries WITH (security_invoker = on) AS
SELECT id, student_id, public.decrypt_server(content) AS content, moods, high_risk, created_at
FROM public.diary_entries_table;

CREATE OR REPLACE VIEW public.food_diary_entries WITH (security_invoker = on) AS
SELECT id, student_id, diary_date, meal_time, mood_before, public.decrypt_server(what_i_ate) AS what_i_ate, mood_after, created_at, updated_at
FROM public.food_diary_entries_table;

CREATE OR REPLACE VIEW public.student_clinical_records WITH (security_invoker = on) AS
SELECT id, student_id, primary_psychologist_id, primary_nutritionist_id, known_conditions, consent_given, public.decrypt_server(additional_notes) AS additional_notes, updated_at
FROM public.student_clinical_records_table;

-- =========================================================================================
-- 5. CREAR DISPARADORES INSTEAD OF PARA CADA VISTA
-- =========================================================================================

-- CHATS TRIGGER
CREATE OR REPLACE FUNCTION public.trg_chats_view_modify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.chats_table (id, student_id, title, status, highest_urgency_score, created_at, updated_at)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            public.encrypt_server(NEW.title),
            COALESCE(NEW.status, 'active'),
            COALESCE(NEW.highest_urgency_score, 0.00),
            COALESCE(NEW.created_at, now()),
            COALESCE(NEW.updated_at, now())
        )
        RETURNING id, student_id, public.decrypt_server(title), status, highest_urgency_score, created_at, updated_at INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.chats_table
        SET student_id = NEW.student_id,
            title = public.encrypt_server(NEW.title),
            status = NEW.status,
            highest_urgency_score = NEW.highest_urgency_score,
            updated_at = COALESCE(NEW.updated_at, now())
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.chats_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_chats_modify
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.trg_chats_view_modify();


-- MESSAGES TRIGGER
CREATE OR REPLACE FUNCTION public.trg_messages_view_modify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.messages_table (id, chat_id, sender_type, content, urgency_score, timestamp)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.chat_id,
            NEW.sender_type,
            public.encrypt_server(NEW.content),
            NEW.urgency_score,
            COALESCE(NEW.timestamp, now())
        )
        RETURNING id, chat_id, sender_type, public.decrypt_server(content), urgency_score, timestamp INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.messages_table
        SET chat_id = NEW.chat_id,
            sender_type = NEW.sender_type,
            content = public.encrypt_server(NEW.content),
            urgency_score = NEW.urgency_score,
            timestamp = NEW.timestamp
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.messages_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_messages_modify
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_messages_view_modify();


-- DIARY ENTRIES TRIGGER
CREATE OR REPLACE FUNCTION public.trg_diary_entries_view_modify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.diary_entries_table (id, student_id, content, moods, high_risk, created_at)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            public.encrypt_server(NEW.content),
            NEW.moods,
            COALESCE(NEW.high_risk, FALSE),
            COALESCE(NEW.created_at, now())
        )
        RETURNING id, student_id, public.decrypt_server(content), moods, high_risk, created_at INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.diary_entries_table
        SET student_id = NEW.student_id,
            content = public.encrypt_server(NEW.content),
            moods = NEW.moods,
            high_risk = NEW.high_risk,
            created_at = NEW.created_at
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.diary_entries_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_diary_entries_modify
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.diary_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_diary_entries_view_modify();


-- FOOD DIARY ENTRIES TRIGGER
CREATE OR REPLACE FUNCTION public.trg_food_diary_entries_view_modify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.food_diary_entries_table (id, student_id, diary_date, meal_time, mood_before, what_i_ate, mood_after, created_at, updated_at)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            COALESCE(NEW.diary_date, CURRENT_DATE),
            NEW.meal_time,
            NEW.mood_before,
            public.encrypt_server(NEW.what_i_ate),
            NEW.mood_after,
            COALESCE(NEW.created_at, now()),
            COALESCE(NEW.updated_at, now())
        )
        RETURNING id, student_id, diary_date, meal_time, mood_before, public.decrypt_server(what_i_ate), mood_after, created_at, updated_at INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.food_diary_entries_table
        SET student_id = NEW.student_id,
            diary_date = NEW.diary_date,
            meal_time = NEW.meal_time,
            mood_before = NEW.mood_before,
            what_i_ate = public.encrypt_server(NEW.what_i_ate),
            mood_after = NEW.mood_after,
            updated_at = COALESCE(NEW.updated_at, now())
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.food_diary_entries_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_food_diary_entries_modify
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.food_diary_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_food_diary_entries_view_modify();


-- STUDENT CLINICAL RECORDS TRIGGER
CREATE OR REPLACE FUNCTION public.trg_student_clinical_records_view_modify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.student_clinical_records_table (id, student_id, primary_psychologist_id, primary_nutritionist_id, known_conditions, consent_given, additional_notes, updated_at)
        VALUES (
            COALESCE(NEW.id, uuid_generate_v4()),
            NEW.student_id,
            NEW.primary_psychologist_id,
            NEW.primary_nutritionist_id,
            NEW.known_conditions,
            COALESCE(NEW.consent_given, FALSE),
            public.encrypt_server(NEW.additional_notes),
            COALESCE(NEW.updated_at, now())
        )
        RETURNING id, student_id, primary_psychologist_id, primary_nutritionist_id, known_conditions, consent_given, public.decrypt_server(additional_notes), updated_at INTO NEW;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.student_clinical_records_table
        SET student_id = NEW.student_id,
            primary_psychologist_id = NEW.primary_psychologist_id,
            primary_nutritionist_id = NEW.primary_nutritionist_id,
            known_conditions = NEW.known_conditions,
            consent_given = NEW.consent_given,
            additional_notes = public.encrypt_server(NEW.additional_notes),
            updated_at = COALESCE(NEW.updated_at, now())
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.student_clinical_records_table WHERE id = OLD.id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_student_clinical_records_modify
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.student_clinical_records
FOR EACH ROW EXECUTE FUNCTION public.trg_student_clinical_records_view_modify();


-- =========================================================================================
-- 6. PROCEDIMIENTO DE ROTACIÓN DE LLAVES DE RESPALDO (SECURITY DEFINER)
-- =========================================================================================
CREATE OR REPLACE FUNCTION public.rotate_encryption_keys(p_old_version int, p_new_version int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_msg RECORD;
    r_chat RECORD;
    r_diary RECORD;
    r_food_diary RECORD;
    r_clinical RECORD;
    v_old_key TEXT;
    v_new_key TEXT;
    v_decrypted TEXT;
    v_encrypted TEXT;
BEGIN
    -- Validar que el ejecutor sea Administrador (role_id = 1)
    IF public.get_auth_role() != 1 THEN
        RAISE EXCEPTION 'Acceso denegado. Solo el Administrador puede rotar llaves.';
    END IF;

    SELECT key_value INTO v_old_key FROM public.encryption_keys WHERE version = p_old_version;
    SELECT key_value INTO v_new_key FROM public.encryption_keys WHERE version = p_new_version;

    IF v_old_key IS NULL OR v_new_key IS NULL THEN
        RAISE EXCEPTION 'Llaves de versión % o % no encontradas.', p_old_version, p_new_version;
    END IF;

    -- 1. Actualizar chats_table
    FOR r_chat IN SELECT id, title FROM public.chats_table WHERE title LIKE 'v' || p_old_version || '#%' LOOP
        v_decrypted := public.decrypt_server(r_chat.title);
        v_encrypted := public.encrypt_server(v_decrypted, p_new_version);
        UPDATE public.chats_table SET title = v_encrypted WHERE id = r_chat.id;
    END LOOP;

    -- 2. Actualizar messages_table
    FOR r_msg IN SELECT id, content FROM public.messages_table WHERE content LIKE 'v' || p_old_version || '#%' LOOP
        v_decrypted := public.decrypt_server(r_msg.content);
        v_encrypted := public.encrypt_server(v_decrypted, p_new_version);
        UPDATE public.messages_table SET content = v_encrypted WHERE id = r_msg.id;
    END LOOP;

    -- 3. Actualizar diary_entries_table
    FOR r_diary IN SELECT id, content FROM public.diary_entries_table WHERE content LIKE 'v' || p_old_version || '#%' LOOP
        v_decrypted := public.decrypt_server(r_diary.content);
        v_encrypted := public.encrypt_server(v_decrypted, p_new_version);
        UPDATE public.diary_entries_table SET content = v_encrypted WHERE id = r_diary.id;
    END LOOP;

    -- 4. Actualizar food_diary_entries_table
    FOR r_food_diary IN SELECT id, what_i_ate FROM public.food_diary_entries_table WHERE what_i_ate LIKE 'v' || p_old_version || '#%' LOOP
        v_decrypted := public.decrypt_server(r_food_diary.what_i_ate);
        v_encrypted := public.encrypt_server(v_decrypted, p_new_version);
        UPDATE public.food_diary_entries_table SET what_i_ate = v_encrypted WHERE id = r_food_diary.id;
    END LOOP;

    -- 5. Actualizar student_clinical_records_table
    FOR r_clinical IN SELECT id, additional_notes FROM public.student_clinical_records_table WHERE additional_notes LIKE 'v' || p_old_version || '#%' LOOP
        v_decrypted := public.decrypt_server(r_clinical.additional_notes);
        v_encrypted := public.encrypt_server(v_decrypted, p_new_version);
        UPDATE public.student_clinical_records_table SET additional_notes = v_encrypted WHERE id = r_clinical.id;
    END LOOP;

    -- Cambiar la llave activa en el almacén
    UPDATE public.encryption_keys SET active = FALSE WHERE version = p_old_version;
    UPDATE public.encryption_keys SET active = TRUE WHERE version = p_new_version;

    -- Registrar auditoría del cambio
    INSERT INTO public.audit_logs (user_id, event_type, description)
    VALUES (auth.uid(), 'KEY_ROTATION', 'Rotación de llave exitosa. De versión ' || p_old_version || ' a versión ' || p_new_version);
END;
$$;
