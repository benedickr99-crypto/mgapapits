-- ==============================================================================
-- TAKAZZ NNNP - Direct Email Confirmation RPC & Trigger
-- Resolves "Email not confirmed" and ensures OTP / Instant activation works.
-- ==============================================================================

-- 1. Direct function to confirm a user's email in auth.users
CREATE OR REPLACE FUNCTION public.confirm_user_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE lower(trim(email)) = lower(trim(p_email));

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- Grant execution to everyone (anon & authenticated) so newly registered users can confirm
GRANT EXECUTE ON FUNCTION public.confirm_user_email(TEXT) TO anon, authenticated;

-- 2. Auto-confirm any existing unconfirmed users (e.g. a04945518@gmail.com)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 3. Auto-confirm trigger for newly registered users to prevent "Email not confirmed" blocks
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_confirm_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_confirm_user();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

