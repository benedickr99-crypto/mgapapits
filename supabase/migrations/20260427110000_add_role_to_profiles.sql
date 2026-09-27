-- 1. Add `role` column to `profiles`
ALTER TABLE public.profiles ADD COLUMN role app_role NOT NULL DEFAULT 'trekker';

-- 2. Migrate existing roles
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE p.id = ur.user_id;

-- 3. Update `has_role` function to check `profiles`
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

-- 4. Update `handle_new_user` to insert role into `profiles` and remove `user_roles` insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    'trekker'
  );
  RETURN NEW;
END;
$$;

-- 5. Drop user_roles table (and its policies)
DROP TABLE public.user_roles;
