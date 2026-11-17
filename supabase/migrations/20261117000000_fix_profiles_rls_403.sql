-- ==============================================================================
-- FIX: 403 on /rest/v1/profiles — Ensure RLS policies allow authenticated
--      users to read their own profile AND allow has_role() to work without recursion.
-- ==============================================================================

-- 1. Ensure the `role` column exists (TEXT, not the old enum which breaks has_role lookups)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'trekker';

-- 2. Drop ALL existing SELECT policies on profiles to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view own profile"           ON public.profiles;
  DROP POLICY IF EXISTS "Admins view all profiles"         ON public.profiles;
  DROP POLICY IF EXISTS "Anyone view guide profiles"       ON public.profiles;
  DROP POLICY IF EXISTS "Anyone view admin profile for contact" ON public.profiles;
  DROP POLICY IF EXISTS "Admins manage profiles"           ON public.profiles;
  DROP POLICY IF EXISTS "Users update own profile"         ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Recreate clean, non-recursive RLS policies
-- Users can always read their own profile row (required for auth to work)
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can read guide profiles (for guide listing pages)
CREATE POLICY "Anyone view guide profiles"
  ON public.profiles FOR SELECT
  USING (role = 'guide');

-- Admins can view all profiles (uses a direct column check to avoid recursion)
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can do anything with profiles
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'
    )
  );

-- 4. Fix has_role() to be non-recursive (uses direct column check on profiles, not self-reference)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role::TEXT
  )
$$;

-- 5. Ensure INSERT policy exists so new signups can create their profile
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 6. Grant table-level permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
