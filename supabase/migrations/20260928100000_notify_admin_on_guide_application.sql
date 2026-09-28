-- ==============================================================================
-- Migration: 20260928100000_notify_admin_on_guide_application.sql
-- Description: Robust trigger to notify all admins on new tour guide application
--              and safe handle_new_user function handling metadata roles safely.
-- ==============================================================================

-- 1. Ensure handle_new_user safely parses role and initializes guide status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_role TEXT;
  v_role app_role := 'trekker'::app_role;
  v_guide_status TEXT := 'none';
  v_is_avail BOOLEAN := true;
BEGIN
  -- Safely extract and sanitize role from raw_user_meta_data
  v_raw_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  
  IF v_raw_role = 'guide' THEN
    v_role := 'guide'::app_role;
    v_guide_status := 'pending';
    v_is_avail := false;
  ELSIF v_raw_role = 'admin' THEN
    v_role := 'admin'::app_role;
    v_guide_status := 'approved';
    v_is_avail := true;
  ELSIF v_raw_role = 'user' THEN
    v_role := 'user'::app_role;
    v_guide_status := 'none';
    v_is_avail := true;
  ELSE
    v_role := 'trekker'::app_role;
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
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    phone = CASE WHEN profiles.phone IS NULL OR profiles.phone = '' THEN EXCLUDED.phone ELSE profiles.phone END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 2. Create trigger function to notify admins on tour guide application
-- Evaluates INSERT and UPDATE in separate branches so OLD is never touched on INSERT
CREATE OR REPLACE FUNCTION public.notify_admin_on_guide_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.role = 'guide'::public.app_role OR NEW.guide_application_status = 'pending') THEN
      v_should_notify := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.guide_application_status = 'pending' AND (OLD.guide_application_status IS DISTINCT FROM 'pending') THEN
      v_should_notify := true;
    END IF;
  END IF;

  IF v_should_notify THEN
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

-- 3. Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_notify_admin_on_guide_application ON public.profiles;
CREATE TRIGGER trg_notify_admin_on_guide_application
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_guide_application();

-- 4. Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_guide_status ON public.profiles(guide_application_status);
