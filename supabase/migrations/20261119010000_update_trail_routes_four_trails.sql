-- Migration: Support 4 trails and updated route publication status workflow

-- 1. Ensure columns exist on trails table
ALTER TABLE public.trails
ADD COLUMN IF NOT EXISTS route_geojson JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS route_status TEXT NOT NULL DEFAULT 'draft';

-- 2. Update route_status constraint to support full publication workflow:
-- draft, pending_verification, published, inactive, archived
DO $$
BEGIN
  -- Drop existing check constraint if any
  ALTER TABLE public.trails DROP CONSTRAINT IF EXISTS trails_route_status_check;
  
  -- Add updated check constraint
  ALTER TABLE public.trails 
  ADD CONSTRAINT trails_route_status_check 
  CHECK (route_status IN ('draft', 'pending_verification', 'published', 'inactive', 'archived'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Ensure the 4 trails are properly seeded/updated
-- 1) Mt. Mandalagan (Patag Trail)
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Mt. Mandalagan (Patag Trail)',
  'Challenging',
  'A high-altitude rainforest trail ascending from Old Hospital, Brgy. Patag, Silay City to Mt. Mandalagan Summit (1,885 MASL), passing through the Tinagong Dagat high caldera lakebed.',
  true,
  'Patag',
  'Silay City',
  14.5,
  'published'
)
ON CONFLICT DO NOTHING;

-- 2) Mt. Silay (Cabatangan Trail)
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Mt. Silay (Cabatangan Trail)',
  'Moderate',
  'An authentic forest trek from Sitio Campuestohan / Cabatangan Ranger Station to Mt. Silay Summit (1,535 MASL), featuring the historic WWII bomber wreckage site.',
  true,
  'Cabatangan',
  'Talisay City',
  12.0,
  'published'
)
ON CONFLICT DO NOTHING;

-- 3) Mt. Marapara (Canlandog Trail)
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Mt. Marapara (Canlandog Trail)',
  'Moderate',
  'Scenic highland trek starting from Barangay Canlandog, Murcia, crossing mountain springs and pine ridges toward Mt. Marapara Summit (1,200 MASL).',
  true,
  'Canlandog',
  'Murcia',
  9.2,
  'published'
)
ON CONFLICT DO NOTHING;

-- 4) Malatan-og Falls Trail (Kumalisikis Trail)
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Kumalisikis Trail',
  'Easy',
  'Malatan-og Viewing Deck (10.58755 N, 123.23221 E) to Malatan-og Falls (10.59391 N, 123.22771 E), Brgy. Kumaliskis, Don Salvador Benedicto.',
  true,
  'Kumaliskis',
  'Don Salvador Benedicto',
  5.5,
  'published'
)
ON CONFLICT DO NOTHING;
