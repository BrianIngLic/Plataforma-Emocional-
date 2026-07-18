-- Migration for Skill 17 Phase 2: Admin Passkeys Lifecycle & Audit
-- Adds is_active column to public.users and creates admin_audit_log table.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN (
    'create', 'revoke', 'reenroll', 'disable', 'enable', 'update_email', 'login_success', 'login_failure'
  )),
  performed_by TEXT NOT NULL,
  details      JSONB DEFAULT '{}',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS to block all public access (only service_role / postgrest bypasses RLS by default)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_email ON public.admin_audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at);

-- Function to check role, passkey and active status by email (safe, security definer)
CREATE OR REPLACE FUNCTION public.check_user_auth_method(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id INTEGER;
    v_passkey_only BOOLEAN;
    v_is_active BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT u.role_id, u.passkey_only, u.is_active 
    INTO v_role_id, v_passkey_only, v_is_active
    FROM public.users u
    JOIN auth.users au ON u.id = au.id
    WHERE au.email = p_email;

    v_result := jsonb_build_object(
        'role_id', v_role_id,
        'passkey_only', COALESCE(v_passkey_only, FALSE),
        'is_active', COALESCE(v_is_active, TRUE)
    );
    RETURN v_result;
END;
$$;

-- Function to delete all sessions of a user (force logout/revocation from IT)
CREATE OR REPLACE FUNCTION public.delete_user_sessions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;
