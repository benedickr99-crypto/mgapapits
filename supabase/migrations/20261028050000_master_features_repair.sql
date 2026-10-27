-- Master migration for all 3 account types (Trekker, Guide, Admin)
-- Drops restrictive check constraints, ensures RLS delete policies, incident reports, and reviews

-- 1. Ensure columns exist on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guide_application_status TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- 2. Drop restrictive notifications constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 3. Delete policies on notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users delete own notifications'
  ) THEN
    CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- 4. Delete policies on bookings
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users delete own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Users update own bookings" ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users delete own bookings" ON public.bookings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- 5. Delete booking RPC
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

-- 6. Incident reports table & policies
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

-- 7. Ratings and reviews table & policies
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

NOTIFY pgrst, 'reload schema';
