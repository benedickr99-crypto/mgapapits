-- 1. Create guides table
CREATE TABLE public.guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  experience_years INT NOT NULL DEFAULT 0,
  contact_info TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

-- Policies for guides
CREATE POLICY "Anyone view active guides" ON public.guides 
FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage guides" ON public.guides 
FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Add guide_id to bookings
ALTER TABLE public.bookings ADD COLUMN guide_id UUID REFERENCES public.guides(id);

-- 3. Create function to get available guides for a specific date
CREATE OR REPLACE FUNCTION public.get_available_guides(p_date DATE)
RETURNS SETOF public.guides
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.* 
  FROM public.guides g
  WHERE g.active = true 
  AND NOT EXISTS (
    SELECT 1 
    FROM public.bookings b 
    WHERE b.guide_id = g.id 
    AND b.climb_date = p_date 
    AND b.status IN ('pending', 'approved')
  );
$$;

-- 4. Seed some guides
INSERT INTO public.guides (name, experience_years, contact_info, bio) VALUES
('Juan Dela Cruz', 5, '09171234567', 'Expert in flora and fauna of NNNP.'),
('Maria Clara', 3, '09181234567', 'Friendly guide, great for beginner trekkers.'),
('Andres Bonifacio', 10, '09191234567', 'Veteran guide for difficult trails.');
