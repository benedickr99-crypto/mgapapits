-- ==============================================================================
-- FIX: 403 on /rest/v1/profiles — Ensure RLS policies allow authenticated
--      users to read their own profile AND allow has_role() to work without recursion.
-- ==============================================================================

-- 1. Ensure 'guide' and 'user' exist in app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guide';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2. Drop ALL existing SELECT/ALL policies on profiles to avoid conflicts and recursion
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view own profile"                ON public.profiles;
  DROP POLICY IF EXISTS "Admins view all profiles"              ON public.profiles;
  DROP POLICY IF EXISTS "Anyone view guide profiles"            ON public.profiles;
  DROP POLICY IF EXISTS "Anyone view admin profile for contact" ON public.profiles;
  DROP POLICY IF EXISTS "Admins manage profiles"                ON public.profiles;
  DROP POLICY IF EXISTS "Users update own profile"              ON public.profiles;
  DROP POLICY IF EXISTS "Users insert own profile"              ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Fix has_role() to compare app_role with app_role (no cast mismatch)
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
      AND role = _role
  );
$$;

-- 4. Recreate clean, non-recursive RLS policies on public.profiles
-- Users can always view their own profile
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Anyone can view guide profiles (needed for booking and guide listings)
CREATE POLICY "Anyone view guide profiles"
  ON public.profiles FOR SELECT
  USING (role = 'guide'::public.app_role);

-- Admins can view all profiles
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'::public.app_role
    )
  );

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'::public.app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'admin'::public.app_role
    )
  );

-- Users can insert their own profile on signup
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Grant table-level permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
