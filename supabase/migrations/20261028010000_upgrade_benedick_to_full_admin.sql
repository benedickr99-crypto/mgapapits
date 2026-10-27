-- ==============================================================================
-- Upgrade Benedick Luise Rubio's account to full Admin access
-- ==============================================================================

-- 1. Upgrade in public.profiles table
UPDATE public.profiles
SET role = 'admin'::public.app_role
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick luise rubio%';

-- 2. Upgrade in auth.users user_metadata if present
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email ILIKE '%benedick%'
   OR (raw_user_meta_data->>'full_name') ILIKE '%benedick luise rubio%';

-- 3. Enhance public.has_role() to recognize Benedick as Admin in all RLS policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If checking admin, also verify if user is Benedick Luise Rubio
  IF _role = 'admin'::public.app_role THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
        AND (role = 'admin'::public.app_role 
             OR email ILIKE '%benedick%'
             OR full_name ILIKE '%benedick luise rubio%')
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role
  );
END;
$$;

-- 4. Ensure handle_new_user assigns Benedick to admin
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

  IF NEW.email ILIKE '%benedick%' OR raw_full_name ILIKE '%benedick luise rubio%' THEN
    default_role := 'admin'::public.app_role;
  ELSIF raw_role IN ('admin', 'guide', 'trekker') THEN
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
    COALESCE(NULLIF(raw_full_name, ''), 'User'),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NEW.email,
    default_role,
    NULLIF(NEW.raw_user_meta_data->>'guide_id_url', ''),
    CASE WHEN default_role = 'guide' THEN 'pending' ELSE 'none' END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE 
      WHEN NEW.email ILIKE '%benedick%' OR raw_full_name ILIKE '%benedick luise rubio%' THEN 'admin'::public.app_role
      ELSE EXCLUDED.role
    END,
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    updated_at = now();

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
