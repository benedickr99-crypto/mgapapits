-- 1. Add cancelled_at column
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Update notifications check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('booking_created', 'booking_approved', 'booking_rejected', 'booking_cancelled'));

-- 3. Create function to cancel booking
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Get booking and check ownership
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not owned by user';
  END IF;
  
  -- Check status
  IF v_booking.status NOT IN ('pending'::public.booking_status, 'approved'::public.booking_status) THEN
    RAISE EXCEPTION 'Only pending or approved bookings can be cancelled';
  END IF;
  
  -- Check time window rule: cannot cancel if within 24 hours of climb_date
  -- (i.e., if climb_date is tomorrow or earlier)
  IF v_booking.climb_date <= (current_date + INTERVAL '1 day') THEN
    RAISE EXCEPTION 'Bookings cannot be cancelled within 24 hours of the climb date';
  END IF;

  -- Update booking
  UPDATE public.bookings 
  SET status = 'cancelled'::public.booking_status, 
      cancelled_at = now()
  WHERE id = p_booking_id;

  -- Notify admin
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT id, 'Booking Cancelled', 'A booking for ' || v_booking.climb_date || ' has been cancelled by the trekker.', 'booking_cancelled'
  FROM public.profiles
  WHERE role = 'admin'::public.app_role;

END;
$$;
