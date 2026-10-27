-- Migration to allow trekkers and admins to delete bookings

-- 1. Create function to delete booking securely with owner/admin check
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

-- 2. Add RLS policies for DELETE on public.bookings
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users delete own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users delete own bookings" ON public.bookings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
