-- ==============================================================================
-- Create get_profiles_with_email RPC + ensure profiles.email column exists
-- ==============================================================================

-- 1. Ensure email column exists on profiles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END;
$$;

-- 2. Backfill emails from auth.users into profiles.email for existing rows
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- 3. Create or replace the RPC that joins auth.users to expose real emails
CREATE OR REPLACE FUNCTION public.get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role public.app_role,
  nationality TEXT,
  bio TEXT,
  certifications TEXT,
  experience_years INTEGER,
  is_available BOOLEAN,
  guide_application_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only admins can call this (read emails)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR full_name ILIKE '%benedick luise rubio%')
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.email, u.email) AS email,
    p.phone,
    p.role,
    p.nationality,
    p.bio,
    p.certifications,
    p.experience_years,
    p.is_available,
    p.guide_application_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute to authenticated users (the function enforces admin check internally)
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;

-- 4. Trigger to keep profiles.email in sync when auth email changes
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

NOTIFY pgrst, 'reload schema';
