-- 1. Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking_created', 'booking_approved', 'booking_rejected')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Trigger: Notify Admin on Booking Creation
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
  WHERE role = 'admin';
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_booking();

-- 3. Trigger: Notify User on Status Change
CREATE OR REPLACE FUNCTION public.notify_user_on_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Booking Approved', 'Your booking has been approved.', 'booking_approved');
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Booking Rejected', 'Your booking has been rejected.', 'booking_rejected');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_booking_status();

-- 4. Enable Realtime for notifications table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE notifications;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
