-- ==============================================================================
-- Migration: 20260928100000_notify_admin_on_guide_application.sql
-- Description: Automatically notify all admin users whenever a new tour guide
--              application is submitted (upon registration or trekker upgrade).
-- ==============================================================================

-- 1. Ensure handle_new_user populates guide status & availability appropriately
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
  v_guide_status TEXT;
  v_is_avail BOOLEAN;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'trekker'::app_role);
  
  IF v_role = 'guide'::app_role THEN
    v_guide_status := 'pending';
    v_is_avail := false;
  ELSE
    v_guide_status := 'none';
    v_is_avail := true;
  END IF;

  INSERT INTO public.profiles (
    id, 
    full_name, 
    phone, 
    nationality,
    role, 
    guide_application_status, 
    is_available
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    COALESCE(NEW.raw_user_meta_data->>'nationality','Filipino'),
    v_role,
    v_guide_status,
    v_is_avail
  );
  RETURN NEW;
END;
$$;

-- 2. Create trigger function to notify admins on tour guide application
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

-- 3. Attach trigger to profiles
DROP TRIGGER IF EXISTS trg_notify_admin_on_guide_application ON public.profiles;
CREATE TRIGGER trg_notify_admin_on_guide_application
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_guide_application();
