-- ==============================================================================
-- FIX_DATABASE_ERRORS.sql
-- Run this script in your Supabase project's SQL Editor (Dashboard -> SQL Editor)
-- to fix the 400 Bad Request and 404 Not Found errors on tables and storage buckets.
-- ==============================================================================

-- 1. Add missing columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_application_status TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_id_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Update existing guides so their guide_application_status is approved by default
UPDATE public.profiles
SET guide_application_status = 'approved'
WHERE role = 'guide' AND (guide_application_status IS NULL OR guide_application_status = 'none');

-- 2. Create incident_reports table
CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trail_id UUID REFERENCES public.trails(id) ON DELETE SET NULL,
    trail_name TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    category TEXT NOT NULL, -- 'medical', 'hazard', 'lost_trekker', 'weather', 'violation', 'other'
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    location_details TEXT,
    description TEXT NOT NULL,
    action_taken TEXT,
    requires_assistance BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'resolved'
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for incident_reports
CREATE INDEX IF NOT EXISTS idx_incident_reports_guide_id ON public.incident_reports(guide_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at ON public.incident_reports(created_at DESC);

-- Enable RLS for incident_reports
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Guides view own incident reports" ON public.incident_reports;
  DROP POLICY IF EXISTS "Guides insert incident reports" ON public.incident_reports;
  DROP POLICY IF EXISTS "Admins update incident reports" ON public.incident_reports;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Guides view own incident reports" ON public.incident_reports FOR SELECT
USING (guide_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Guides insert incident reports" ON public.incident_reports FOR INSERT
WITH CHECK (guide_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update incident reports" ON public.incident_reports FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR guide_id = auth.uid());

-- 3. Create required Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('requirements', 'requirements', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('guide-documents', 'guide-documents', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read requirements" ON storage.objects;
  DROP POLICY IF EXISTS "Public insert requirements" ON storage.objects;
  DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Public insert avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Public read guide-documents" ON storage.objects;
  DROP POLICY IF EXISTS "Public insert guide-documents" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read requirements" ON storage.objects FOR SELECT TO public USING (bucket_id = 'requirements');
CREATE POLICY "Public insert requirements" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'requirements');

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "Public insert avatars" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public read guide-documents" ON storage.objects FOR SELECT TO public USING (bucket_id = 'guide-documents');
CREATE POLICY "Public insert guide-documents" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'guide-documents');

-- 4. Enable deleting bookings by trekkers and admins
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users delete own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users delete own bookings" ON public.bookings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

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

-- 5. Upgrade Benedick Luise Rubio to full Admin
UPDATE public.profiles
SET role = 'admin'::public.app_role
WHERE email ILIKE '%benedick%'
   OR full_name ILIKE '%benedick luise rubio%';

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- 6. Relax notifications check constraint to allow all application and incident alert types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 7. Sync auth.users emails into profiles.email for ALL existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- 8. Create RPC: get_profiles_with_email (admin only)
-- Returns all profiles joined with the real auth.users email
CREATE OR REPLACE FUNCTION public.get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  nationality TEXT,
  created_at TIMESTAMPTZ,
  is_available BOOLEAN,
  guide_application_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(u.email, p.email, '') AS email,
    p.phone,
    p.role::TEXT,
    p.nationality,
    p.created_at,
    p.is_available,
    p.guide_application_status
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute to authenticated users (RLS inside function restricts to admins)
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';



