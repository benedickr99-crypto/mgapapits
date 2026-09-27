-- 1. Add link and entity_id to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 2. Update notify_admin_on_booking trigger to include link and entity_id
CREATE OR REPLACE FUNCTION public.notify_admin_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link, entity_id)
  SELECT id, 'New Booking Request', 'A new booking has been submitted.', 'booking_created', '/admin', NEW.id
  FROM public.profiles
  WHERE role = 'admin'::public.app_role;
  RETURN NEW;
END;
$$;

-- 3. Update notify_user_on_booking_status trigger to include link and entity_id
CREATE OR REPLACE FUNCTION public.notify_user_on_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'::public.booking_status AND OLD.status != 'approved'::public.booking_status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, entity_id)
    VALUES (NEW.user_id, 'Booking Approved', 'Your booking has been approved.', 'booking_approved', '/my-bookings', NEW.id);
  ELSIF NEW.status = 'rejected'::public.booking_status AND OLD.status != 'rejected'::public.booking_status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, entity_id)
    VALUES (NEW.user_id, 'Booking Rejected', 'Your booking has been rejected.', 'booking_rejected', '/my-bookings', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
