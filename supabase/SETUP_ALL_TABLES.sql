-- ==============================================================================
-- NNNP SUPABASE COMPLETE DATABASE SETUP & REPAIR SCRIPT
-- Project: kmmgtcyegvbrgsdbdtsh
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kmmgtcyegvbrgsdbdtsh/sql
-- ==============================================================================

-- 1. Ensure Enum types exist
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'trekker', 'guide', 'user');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add 'guide' and 'user' to app_role if already created with fewer values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guide';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 3. Ensure profiles table has all necessary columns
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    nationality TEXT DEFAULT 'Filipino',
    role app_role NOT NULL DEFAULT 'trekker',
    experience_years INT DEFAULT 0,
    certifications TEXT,
    bio TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    guide_application_status TEXT DEFAULT 'none',
    guide_id_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role app_role NOT NULL DEFAULT 'trekker';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_application_status TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_id_url TEXT;

-- Existing guides should default to approved
UPDATE public.profiles 
SET guide_application_status = 'approved' 
WHERE role = 'guide' AND (guide_application_status IS NULL OR guide_application_status = 'none');

-- Ensure benedickluiser@gmail.com is set as admin in profiles
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE LOWER(email) = 'benedickluiser@gmail.com'
);

-- Ensure all other accounts with admin role are demoted to trekker
UPDATE public.profiles
SET role = 'trekker'
WHERE role = 'admin'
AND id NOT IN (
    SELECT id FROM auth.users WHERE LOWER(email) = 'benedickluiser@gmail.com'
);

-- 4. Ensure trails table exists
CREATE TABLE IF NOT EXISTS public.trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    barangay TEXT NOT NULL,
    city TEXT NOT NULL,
    description TEXT,
    difficulty TEXT,
    weekly_slots INT NOT NULL DEFAULT 30,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed trails if empty
INSERT INTO public.trails (name, barangay, city, description, difficulty, weekly_slots)
SELECT 'Patag Trail', 'Brgy. Patag', 'Silay City', 'Popular traverse route with lush forest canopy and river crossings.', 'Moderate', 30
WHERE NOT EXISTS (SELECT 1 FROM public.trails WHERE name = 'Patag Trail');

INSERT INTO public.trails (name, barangay, city, description, difficulty, weekly_slots)
SELECT 'Cabatangan Trail', 'Brgy. Cabatangan', 'Talisay City', 'Scenic ridge trail offering panoramic views of the western Negros coast.', 'Moderate-Hard', 30
WHERE NOT EXISTS (SELECT 1 FROM public.trails WHERE name = 'Cabatangan Trail');

INSERT INTO public.trails (name, barangay, city, description, difficulty, weekly_slots)
SELECT 'Canlandog Trail', 'Brgy. Canlandog', 'Murcia', 'Challenging ascent through dense mossy forest to the NNNP peaks.', 'Hard', 30
WHERE NOT EXISTS (SELECT 1 FROM public.trails WHERE name = 'Canlandog Trail');

INSERT INTO public.trails (name, barangay, city, description, difficulty, weekly_slots)
SELECT 'Kumalisikis Trail', 'Brgy. Kumalisikis', 'Don Salvador Benedicto', 'Accessible year-round; ideal for first-time trekkers and day hikes.', 'Easy-Moderate', 30
WHERE NOT EXISTS (SELECT 1 FROM public.trails WHERE name = 'Kumalisikis Trail');

-- 5. Extend bookings table with all columns
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS time_slot TEXT DEFAULT '06:00 AM',
ADD COLUMN IF NOT EXISTS reference_number TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS medical_notes TEXT,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS guide_notes TEXT,
ADD COLUMN IF NOT EXISTS valid_id_url TEXT,
ADD COLUMN IF NOT EXISTS waiver_url TEXT,
ADD COLUMN IF NOT EXISTS medical_cert_url TEXT;

-- Create indexes on bookings
CREATE INDEX IF NOT EXISTS idx_bookings_permit_number ON public.bookings(permit_number);
CREATE INDEX IF NOT EXISTS idx_bookings_reference_number ON public.bookings(reference_number);
CREATE INDEX IF NOT EXISTS idx_bookings_climb_date ON public.bookings(climb_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guide_id ON public.bookings(guide_id);

-- 6. Create booking_participants table
CREATE TABLE IF NOT EXISTS public.booking_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    contact_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_booking_participants_booking_id ON public.booking_participants(booking_id);

-- 7. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'Urgent', 'Critical')),
    category TEXT DEFAULT 'Advisory',
    trail_id UUID REFERENCES public.trails(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_priority_active ON public.announcements(priority, is_active);

-- Seed default announcements if table is empty
INSERT INTO public.announcements (title, content, priority, category, is_active)
SELECT 'Typhoon Season Advisory', 'Please monitor PAGASA weather advisories prior to scheduled treks. Trails may be closed with short notice for safety.', 'Urgent', 'Weather', true
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'Typhoon Season Advisory');

INSERT INTO public.announcements (title, content, priority, category, is_active)
SELECT 'Leave No Trace Clean-up Drive', 'All trekkers are strictly required to pack out all trash and food containers. Violators face fines.', 'Normal', 'Advisory', true
WHERE NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'Leave No Trace Clean-up Drive');

-- 8. Create ratings_reviews table
CREATE TABLE IF NOT EXISTS public.ratings_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    guide_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    trail_id UUID NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
    trail_rating INTEGER NOT NULL CHECK (trail_rating BETWEEN 1 AND 5),
    guide_rating INTEGER CHECK (guide_rating BETWEEN 1 AND 5),
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_booking_review UNIQUE (booking_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_trail_id ON public.ratings_reviews(trail_id);
CREATE INDEX IF NOT EXISTS idx_reviews_guide_id ON public.ratings_reviews(guide_id);

-- 9. Create trekking_schedules table
CREATE TABLE IF NOT EXISTS public.trekking_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 15,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_trail_date_slot UNIQUE (trail_id, schedule_date, time_slot)
);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trekking_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 11. Helper function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  );
$$;

-- 12. Policies for profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone view guide profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone view guide profiles" ON public.profiles FOR SELECT USING (role = 'guide');
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 13. Policies for trails
DROP POLICY IF EXISTS "Anyone view active trails" ON public.trails;
DROP POLICY IF EXISTS "Admins manage trails" ON public.trails;
CREATE POLICY "Anyone view active trails" ON public.trails FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage trails" ON public.trails FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 14. Policies for bookings
DROP POLICY IF EXISTS "Users view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users create own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users update own pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Guides view assigned bookings" ON public.bookings;

CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pending bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Guides view assigned bookings" ON public.bookings FOR SELECT USING (guide_id = auth.uid());
CREATE POLICY "Admins view all bookings" ON public.bookings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 15. Policies for booking_participants
DROP POLICY IF EXISTS "Participants viewable by booking owner, assigned guide, and admin" ON public.booking_participants;
CREATE POLICY "Participants viewable by booking owner, assigned guide, and admin" ON public.booking_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_participants.booking_id
        AND (
            b.user_id = auth.uid() OR
            b.guide_id = auth.uid() OR
            public.has_role(auth.uid(), 'admin')
        )
    )
);

DROP POLICY IF EXISTS "Booking owners and admin can insert participants" ON public.booking_participants;
CREATE POLICY "Booking owners and admin can insert participants" ON public.booking_participants FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_participants.booking_id
        AND (
            b.user_id = auth.uid() OR
            public.has_role(auth.uid(), 'admin')
        )
    )
);

-- 16. Policies for announcements
DROP POLICY IF EXISTS "Active announcements viewable by everyone" ON public.announcements;
CREATE POLICY "Active announcements viewable by everyone" ON public.announcements FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 17. Policies for ratings_reviews
DROP POLICY IF EXISTS "Approved reviews viewable by everyone" ON public.ratings_reviews;
CREATE POLICY "Approved reviews viewable by everyone" ON public.ratings_reviews FOR SELECT
USING (is_approved = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Completed booking users can insert reviews" ON public.ratings_reviews;
CREATE POLICY "Completed booking users can insert reviews" ON public.ratings_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and admin update reviews" ON public.ratings_reviews;
CREATE POLICY "Users and admin update reviews" ON public.ratings_reviews FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 18. Policies for notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 19. Table: incident_reports (Guides report to Admin)
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

DROP POLICY IF EXISTS "Guides view own incident reports" ON public.incident_reports;
CREATE POLICY "Guides view own incident reports" ON public.incident_reports FOR SELECT
USING (guide_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Guides insert incident reports" ON public.incident_reports;
CREATE POLICY "Guides insert incident reports" ON public.incident_reports FOR INSERT
WITH CHECK (guide_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update incident reports" ON public.incident_reports;
CREATE POLICY "Admins update incident reports" ON public.incident_reports FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR guide_id = auth.uid());

-- Allow all authenticated users to read admin profiles so guides & trekkers can address notifications to admin
DROP POLICY IF EXISTS "Anyone view admin profile for contact" ON public.profiles;
CREATE POLICY "Anyone view admin profile for contact" ON public.profiles FOR SELECT
USING (role = 'admin');

-- 20. Notification Trigger for Tour Guide Applications
CREATE OR REPLACE FUNCTION public.notify_admin_on_guide_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trigger when:
  -- 1) A new profile is inserted with role 'guide' or guide_application_status = 'pending'
  -- 2) An existing profile is updated to guide_application_status = 'pending' from something else
  IF (TG_OP = 'INSERT' AND (NEW.role = 'guide'::public.app_role OR NEW.guide_application_status = 'pending'))
     OR (TG_OP = 'UPDATE' AND NEW.guide_application_status = 'pending' AND (OLD.guide_application_status IS DISTINCT FROM 'pending')) THEN
     
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


