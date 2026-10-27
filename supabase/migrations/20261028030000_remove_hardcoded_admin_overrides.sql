-- ==============================================================================
-- Remove hardcoded "benedick" admin overrides & restore purely DB-driven roles
-- ==============================================================================

-- 1. Restore has_role() to pure data-driven logic
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

-- 2. Restore handle_new_user() without benedick override
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

-- 3. Reset Benedick account role from admin to trekker
UPDATE public.profiles
SET role = 'trekker'::public.app_role
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick%';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "trekker"}'::jsonb
WHERE email ILIKE '%benedick%'
   OR (raw_user_meta_data->>'full_name') ILIKE '%benedick%';

NOTIFY pgrst, 'reload schema';
