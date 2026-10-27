-- ==============================================================================
-- TAKAZZ NNNP - MASTER DATABASE SETUP & REPAIR SCRIPT
-- Run this in your Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/kmmgtcyegvbrgsdbdtsh/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure email, bio, experience_years, certifications on public.profiles
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'experience_years'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN experience_years INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'certifications'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN certifications TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'guide_application_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN guide_application_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_available BOOLEAN DEFAULT true;
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
-- 3. Create or replace get_profiles_with_email() RPC for Admin Users Table
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
-- 8. Fix Notifications: Drop restrictive type check constraint & add Delete Policy
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users delete own notifications'
  ) THEN
    CREATE POLICY "Users delete own notifications"
      ON public.notifications
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Fix Bookings Permissions & Delete RPC for Trekkers and Admins
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_booking(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bookings
  WHERE id = p_booking_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not owned by user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_booking(UUID) TO authenticated;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users delete own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Users update own bookings" ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users delete own bookings" ON public.bookings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 10. Ensure incident_reports Table & Policies for Tour Guides & Admins
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trail_id UUID,
  trail_name TEXT,
  booking_id UUID,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  location_details TEXT,
  description TEXT NOT NULL,
  action_taken TEXT,
  requires_assistance BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone view incidents" ON public.incident_reports;
  DROP POLICY IF EXISTS "Guides create incidents" ON public.incident_reports;
  DROP POLICY IF EXISTS "Admins update incidents" ON public.incident_reports;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Anyone view incidents" ON public.incident_reports FOR SELECT USING (true);
CREATE POLICY "Guides create incidents" ON public.incident_reports FOR INSERT WITH CHECK (auth.uid() = guide_id);
CREATE POLICY "Admins update incidents" ON public.incident_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------------------------
-- 11. Ensure ratings_reviews Table & Policies for Trekkers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ratings_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guide_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trail_id UUID,
  trail_rating INT DEFAULT 5,
  guide_rating INT DEFAULT 5,
  overall_rating INT DEFAULT 5,
  feedback_text TEXT,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ratings_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone view reviews" ON public.ratings_reviews;
  DROP POLICY IF EXISTS "Users create reviews" ON public.ratings_reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Anyone view reviews" ON public.ratings_reviews FOR SELECT USING (true);
CREATE POLICY "Users create reviews" ON public.ratings_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 12. Refresh PostgREST schema cache
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- 13. Verification queries: Confirm roles and profiles
-- ------------------------------------------------------------------------------
SELECT id, full_name, email, role, guide_application_status
FROM public.profiles
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick%';

SELECT id, full_name, email, role
FROM public.get_profiles_with_email()
LIMIT 5;
