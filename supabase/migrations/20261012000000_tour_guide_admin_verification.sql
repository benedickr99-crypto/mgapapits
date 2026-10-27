-- ==============================================================================
-- Migration: 20261012000000_tour_guide_admin_verification.sql
-- Description: Complete tour guide registration and admin verification workflow
--              - Adds address, email, guide_id_url, rejection_reason to profiles
--              - Sets up guide-documents storage bucket with public access policies
--              - Ensures handle_new_user captures all guide registration fields
--              - Ensures notifications and realtime updates trigger automatically
-- ==============================================================================

-- 1. Ensure columns exist on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_id_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_application_status TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Populate email on profiles from auth.users where currently missing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Storage bucket for guide ID / accreditation certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-documents', 'guide-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies for guide-documents bucket
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public view guide documents" ON storage.objects;
  DROP POLICY IF EXISTS "Public insert guide documents" ON storage.objects;
  DROP POLICY IF EXISTS "Public update guide documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated insert guide documents" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public view guide documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'guide-documents');

CREATE POLICY "Public insert guide documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'guide-documents');

CREATE POLICY "Public update guide documents"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'guide-documents');

-- 4. Update handle_new_user function to safely record all submitted registration metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_role TEXT;
  v_role app_role := 'trekker'::app_role;
  v_guide_status TEXT := 'none';
  v_is_avail BOOLEAN := true;
BEGIN
  -- Safely extract and sanitize role from raw_user_meta_data
  v_raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  
  IF v_raw_role = 'guide' THEN
    v_role := 'guide'::app_role;
    v_guide_status := 'pending';
    v_is_avail := false;
  ELSIF v_raw_role = 'admin' THEN
    v_role := 'admin'::app_role;
    v_guide_status := 'approved';
    v_is_avail := true;
  ELSIF v_raw_role = 'user' THEN
    v_role := 'user'::app_role;
    v_guide_status := 'none';
    v_is_avail := true;
  ELSE
    v_role := 'trekker'::app_role;
    v_guide_status := 'none';
    v_is_avail := true;
  END IF;

  INSERT INTO public.profiles (
    id, 
    full_name, 
    phone, 
    address,
    email,
    nationality,
    role, 
    guide_application_status, 
    guide_id_url,
    is_available
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    COALESCE(NEW.raw_user_meta_data->>'address',''),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'nationality','Filipino'),
    v_role,
    v_guide_status,
    COALESCE(NEW.raw_user_meta_data->>'guide_id_url', NULL),
    v_is_avail
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    phone = CASE WHEN profiles.phone IS NULL OR profiles.phone = '' THEN EXCLUDED.phone ELSE profiles.phone END,
    address = CASE WHEN profiles.address IS NULL OR profiles.address = '' THEN EXCLUDED.address ELSE profiles.address END,
    email = CASE WHEN profiles.email IS NULL OR profiles.email = '' THEN EXCLUDED.email ELSE profiles.email END,
    guide_id_url = CASE WHEN profiles.guide_id_url IS NULL OR profiles.guide_id_url = '' THEN EXCLUDED.guide_id_url ELSE profiles.guide_id_url END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 5. Trigger to notify admins on tour guide application
CREATE OR REPLACE FUNCTION public.notify_admin_on_guide_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.role = 'guide'::public.app_role OR NEW.guide_application_status = 'pending') THEN
      v_should_notify := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.guide_application_status = 'pending' AND (OLD.guide_application_status IS DISTINCT FROM 'pending') THEN
      v_should_notify := true;
    END IF;
  END IF;

  IF v_should_notify THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, entity_id)
    SELECT 
      id,
      '📋 New Tour Guide Application',
      COALESCE(NEW.full_name, 'A new applicant') || ' has submitted credentials for Tour Guide accreditation and is waiting for your review.',
      'guide_application',
      '/admin?tab=guides',
      NEW.id
    FROM public.profiles
    WHERE role = 'admin'::public.app_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_guide_application ON public.profiles;
CREATE TRIGGER trg_notify_admin_on_guide_application
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_guide_application();

-- 6. Ensure publication contains profiles for real-time changes
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
