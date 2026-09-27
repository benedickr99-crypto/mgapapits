
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'trekker');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  nationality TEXT DEFAULT 'Filipino',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barangay TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT,
  difficulty TEXT,
  weekly_slots INT NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE public.booking_status AS ENUM ('pending','approved','rejected','completed','cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trail_id UUID NOT NULL REFERENCES public.trails(id),
  organization TEXT,
  group_size INT NOT NULL CHECK (group_size >= 1 AND group_size <= 15),
  foreign_count INT NOT NULL DEFAULT 0,
  climb_date DATE NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  notes TEXT,
  status booking_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  permit_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Role-check function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + trekker role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone','')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'trekker');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies: profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- Policies: user_roles
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins see all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Policies: trails
CREATE POLICY "Anyone view active trails" ON public.trails FOR SELECT USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage trails" ON public.trails FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Policies: bookings
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pending bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins view all bookings" ON public.bookings FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

-- Seed trails
INSERT INTO public.trails (name, barangay, city, description, difficulty, weekly_slots) VALUES
('Patag Trail','Brgy. Patag','Silay City','Popular traverse route with lush forest canopy and river crossings.','Moderate',30),
('Cabatangan Trail','Brgy. Cabatangan','Talisay City','Scenic ridge trail offering panoramic views of the western Negros coast.','Moderate-Hard',30),
('Canlandog Trail','Brgy. Canlandog','Murcia','Challenging ascent through dense mossy forest to the NNNP peaks.','Hard',30),
('Kumaliskis Trail','Brgy. Kumaliskis','Don Salvador Benedicto','Accessible year-round; ideal for first-time trekkers and day hikes.','Easy-Moderate',30);
