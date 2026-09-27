-- 1. Add 'guide' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guide';

-- 2. Add guide-specific columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- 3. Update bookings to handle guide acceptance
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guide_notes TEXT;

-- 4. Update bookings.guide_id to reference profiles(id)
-- First drop the old reference if it exists
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_guide_id_fkey;
-- Change guide_id type to UUID if it wasn't already (it should be)
-- Add the new foreign key constraint
ALTER TABLE public.bookings ADD CONSTRAINT bookings_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.profiles(id);

-- 5. Create guide_availability table
CREATE TABLE IF NOT EXISTS public.guide_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  status TEXT DEFAULT 'available', -- available, busy, off
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(guide_id, available_date)
);

-- Enable RLS on guide_availability
ALTER TABLE public.guide_availability ENABLE ROW LEVEL SECURITY;

-- Policies for guide_availability
CREATE POLICY "Anyone can view guide availability" ON public.guide_availability FOR SELECT USING (true);
CREATE POLICY "Guides can manage their own availability" ON public.guide_availability FOR ALL USING (auth.uid() = guide_id);

-- 6. Update get_available_guides function to use profiles table
CREATE OR REPLACE FUNCTION public.get_available_guides(p_date DATE)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  experience_years INT,
  bio TEXT,
  image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.experience_years, p.bio, p.image_url
  FROM public.profiles p
  WHERE p.role = 'guide'
  AND p.is_available = true
  AND NOT EXISTS (
    SELECT 1 
    FROM public.bookings b 
    WHERE b.guide_id = p.id 
    AND b.climb_date = p_date 
    AND b.status IN ('approved', 'pending')
    AND b.declined_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.guide_availability ga
    WHERE ga.guide_id = p.id
    AND ga.available_date = p_date
    AND ga.status = 'off'
  );
END;
$$;

-- 7. Update handle_new_user to handle role from metadata
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
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'trekker'::app_role)
  );
  RETURN NEW;
END;
$$;

-- 8. Add notification triggers for guide assignment
CREATE OR REPLACE FUNCTION public.notify_guide_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.guide_id IS NOT NULL) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.guide_id,
      'New Booking Assignment',
      'You have been assigned to a new trekking booking for ' || NEW.climb_date || '. Please review and accept/decline.',
      'booking_assignment'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_assigned ON public.bookings;
CREATE TRIGGER on_booking_assigned
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_guide_on_booking();

-- 9. Add notification triggers for guide acceptance
CREATE OR REPLACE FUNCTION public.notify_trekker_on_guide_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guide_name TEXT;
BEGIN
  SELECT full_name INTO v_guide_name FROM public.profiles WHERE id = NEW.guide_id;
  
  IF (NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Guide Accepted',
      v_guide_name || ' has accepted your booking request for ' || NEW.climb_date || '.',
      'guide_acceptance'
    );
  ELSIF (NEW.declined_at IS NOT NULL AND OLD.declined_at IS NULL) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Guide Declined',
      v_guide_name || ' has declined your booking request for ' || NEW.climb_date || '. Please update your booking to select another guide.',
      'guide_rejection'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_guide_decision ON public.bookings;
CREATE TRIGGER on_guide_decision
  AFTER UPDATE OF accepted_at, declined_at ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_trekker_on_guide_decision();
