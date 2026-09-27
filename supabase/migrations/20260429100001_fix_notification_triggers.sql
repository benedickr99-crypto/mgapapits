-- Update triggers with explicit casting to avoid PL/pgSQL enum type errors

CREATE OR REPLACE FUNCTION public.notify_admin_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT id, 'New Booking Request', 'A new booking has been submitted.', 'booking_created'
  FROM public.profiles
  WHERE role = 'admin'::public.app_role;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_user_on_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'::public.booking_status AND OLD.status != 'approved'::public.booking_status THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Booking Approved', 'Your booking has been approved.', 'booking_approved');
  ELSIF NEW.status = 'rejected'::public.booking_status AND OLD.status != 'rejected'::public.booking_status THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Booking Rejected', 'Your booking has been rejected.', 'booking_rejected');
  END IF;
  RETURN NEW;
END;
$$;
