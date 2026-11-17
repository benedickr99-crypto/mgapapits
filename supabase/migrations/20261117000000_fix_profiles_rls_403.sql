-- ==============================================================================
-- FIX: Infinite recursion on relation "profiles" (HTTP 500 error)
-- ==============================================================================

-- 1. Ensure enum has all values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guide';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2. Drop ALL existing policies on profiles
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. Replace has_role() with a pure SECURITY DEFINER function that bypasses RLS
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

-- 4. Create simple, NON-RECURSIVE policies for profiles
-- Policy 1: Users can ALWAYS SELECT their own profile
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Anyone can view guide profiles
CREATE POLICY "Anyone view guide profiles"
  ON public.profiles FOR SELECT
  USING (role = 'guide'::public.app_role);

-- Policy 3: Admins can view all profiles (using has_role which is SECURITY DEFINER)
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Policy 4: Users update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy 5: Admins manage all profiles (using has_role)
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Policy 6: Users insert their own profile on signup
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
