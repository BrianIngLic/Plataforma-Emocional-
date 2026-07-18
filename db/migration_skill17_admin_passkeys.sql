-- Migration for Skill 17: Admin Passkeys
-- Adds passkey_only column to public.users and marks role_id = 1 (Admin) as passkey_only.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS passkey_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark admin users (role_id = 1)
UPDATE public.users
  SET passkey_only = TRUE
  WHERE role_id = 1;

-- Function to check role and passkey status by email (safe, security definer)
CREATE OR REPLACE FUNCTION public.check_user_auth_method(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id INTEGER;
    v_passkey_only BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT u.role_id, u.passkey_only INTO v_role_id, v_passkey_only
    FROM public.users u
    JOIN auth.users au ON u.id = au.id
    WHERE au.email = p_email;

    v_result := jsonb_build_object(
        'role_id', v_role_id,
        'passkey_only', COALESCE(v_passkey_only, FALSE)
    );
    RETURN v_result;
END;
$$;
