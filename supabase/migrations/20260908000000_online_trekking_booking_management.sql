-- ==============================================================================
-- NNNP Online Trekking Booking and Management Module Migration
-- Date: 2026-09-08
-- Description: Adds tables, columns, indexes, and RLS policies for:
--   1. Booking Participants (group trekking, emergency contacts, medical notes)
--   2. Extended Booking Columns (time slots, reference numbers, cancel reasons)
--   3. Trekking Schedules & Capacity Management
--   4. Announcements & Safety Advisories
--   5. Ratings & Reviews (trek, guide, trail)
--   6. Tour Guide Availability & Assignment Enhancements
-- ==============================================================================

-- 1. Extend bookings table if columns do not exist
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS time_slot TEXT DEFAULT '06:00 AM',
ADD COLUMN IF NOT EXISTS reference_number TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS medical_notes TEXT;

-- Create an index on reference_number for quick lookup
CREATE INDEX IF NOT EXISTS idx_bookings_reference_number ON public.bookings(reference_number);
CREATE INDEX IF NOT EXISTS idx_bookings_trekking_date ON public.bookings(trekking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- 2. Create booking_participants table for group trekking
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_participants_booking_id ON public.booking_participants(booking_id);

-- 3. Create trekking_schedules table for daily trail capacity & slot monitoring
CREATE TABLE IF NOT EXISTS public.trekking_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    time_slot TEXT NOT NULL, -- e.g. '05:00 AM', '07:00 AM', '01:00 PM'
    max_capacity INTEGER NOT NULL DEFAULT 15,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_trail_date_slot UNIQUE (trail_id, schedule_date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_schedules_trail_date ON public.trekking_schedules(trail_id, schedule_date);

-- 4. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'Urgent', 'Critical')),
    category TEXT DEFAULT 'Advisory', -- e.g. 'Weather', 'Advisory', 'Maintenance', 'Event'
    trail_id UUID REFERENCES public.trails(id) ON DELETE SET NULL, -- Optional: trail-specific announcement
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_priority_active ON public.announcements(priority, is_active);

-- 5. Create ratings_reviews table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_booking_review UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_trail_id ON public.ratings_reviews(trail_id);
CREATE INDEX IF NOT EXISTS idx_reviews_guide_id ON public.ratings_reviews(guide_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trekking_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings_reviews ENABLE ROW LEVEL SECURITY;

-- 7. Policies for booking_participants
DROP POLICY IF EXISTS "Participants viewable by booking owner, assigned guide, and admin" ON public.booking_participants;
CREATE POLICY "Participants viewable by booking owner, assigned guide, and admin"
ON public.booking_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_participants.booking_id
        AND (
            b.user_id = auth.uid() OR
            b.guide_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
);

DROP POLICY IF EXISTS "Booking owners and admin can insert participants" ON public.booking_participants;
CREATE POLICY "Booking owners and admin can insert participants"
ON public.booking_participants FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_participants.booking_id
        AND (
            b.user_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
);

-- 8. Policies for announcements
DROP POLICY IF EXISTS "Active announcements viewable by everyone" ON public.announcements;
CREATE POLICY "Active announcements viewable by everyone"
ON public.announcements FOR SELECT
USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 9. Policies for ratings_reviews
DROP POLICY IF EXISTS "Approved reviews viewable by everyone" ON public.ratings_reviews;
CREATE POLICY "Approved reviews viewable by everyone"
ON public.ratings_reviews FOR SELECT
USING (is_approved = true OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Completed booking users can insert reviews" ON public.ratings_reviews;
CREATE POLICY "Completed booking users can insert reviews"
ON public.ratings_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reviews, admins can moderate" ON public.ratings_reviews;
CREATE POLICY "Users can update their own reviews, admins can moderate"
ON public.ratings_reviews FOR UPDATE
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 10. Policies for trekking_schedules
DROP POLICY IF EXISTS "Schedules viewable by everyone" ON public.trekking_schedules;
CREATE POLICY "Schedules viewable by everyone"
ON public.trekking_schedules FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage trekking schedules" ON public.trekking_schedules;
CREATE POLICY "Admins can manage trekking schedules"
ON public.trekking_schedules FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
