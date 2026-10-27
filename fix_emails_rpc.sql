-- ==============================================================================
-- TAKAZZ NNNP - COMPLETE DATABASE FIX SCRIPT
-- Run this in your Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/kmmgtcyegvbrgsdbdtsh/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure email column exists on public.profiles
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. Backfill email addresses from auth.users into public.profiles
-- ------------------------------------------------------------------------------
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- ------------------------------------------------------------------------------
-- 3. Create or replace get_profiles_with_email() RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
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
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.email, u.email) AS email,
    p.phone,
    p.role::TEXT,
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

GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO anon;

-- ------------------------------------------------------------------------------
-- 4. Trigger to keep profiles.email synchronized on auth.users email update
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. Restore has_role() - Pure DB data-driven, NO hardcoded admin overrides
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Restore handle_new_user() - Standard user registration, NO forced admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role public.app_role := 'trekker';
  raw_role text;
  raw_full_name text;
BEGIN
  raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));
  raw_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  IF raw_role IN ('admin', 'guide', 'trekker') THEN
    default_role := raw_role::public.app_role;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    address,
    email,
    role,
    guide_id_url,
    guide_application_status
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(raw_full_name, ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NEW.email,
    default_role,
    NULLIF(NEW.raw_user_meta_data->>'guide_id_url', ''),
    CASE WHEN default_role = 'guide' THEN 'pending' ELSE 'none' END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Change Benedick account from admin back to regular trekker
-- ------------------------------------------------------------------------------
UPDATE public.profiles
SET role = 'trekker'::public.app_role
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick%';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "trekker"}'::jsonb
WHERE email ILIKE '%benedick%'
   OR (raw_user_meta_data->>'full_name') ILIKE '%benedick%';

-- ------------------------------------------------------------------------------
-- 8. Refresh PostgREST schema cache
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- 9. Verification queries: Confirm roles and profiles
-- ------------------------------------------------------------------------------
SELECT id, full_name, email, role, guide_application_status
FROM public.profiles
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick%';

SELECT id, full_name, email, role
FROM public.get_profiles_with_email()
LIMIT 5;
