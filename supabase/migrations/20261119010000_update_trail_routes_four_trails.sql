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
  'A high-altitude rainforest trail ascending from Old Hospital, Brgy. Patag, Silay City (10.6946 N, 123.1742 E) to Mt. Mandalagan Summit (1,885 MASL), with alternate jump-off at Sitio Campuestohan and intermediate camp at Tinagong Dagat (1,550 MASL).',
  true,
  'Patag',
  'Silay City',
  14.5,
  'published'
)
ON CONFLICT DO NOTHING;

-- 2) Mt. Silay Trail
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Mt. Silay Trail',
  'Moderate',
  'Starting at Sitio Campuestohan / Campuestohan Highland Resort area, Brgy. Cabatangan, Talisay City (10.600000 N, 123.133333 E, ~800m) ascending to Mt. Silay Summit (10.770319 N, 123.232801 E, 1,535 MASL) with WWII bomber plane historical site and intermediate reference vantage of Mt. Mandalagan / Tinagong Dagat Peak.',
  true,
  'Cabatangan',
  'Talisay City',
  12.0,
  'published'
)
ON CONFLICT DO NOTHING;

-- 3) Mt. Canlandog Trail
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Mt. Canlandog Trail',
  'Moderate',
  'Starting at Barangay Canlandog Center, Murcia (10.6074 N, 123.1365 E, 452m) to Mount Canlandog Peak (10.608238 N, 123.145951 E, 987m), with alternate jump-off via Lopez Jaena Route along Bacolod-Murcia-DSB Road.',
  true,
  'Canlandog',
  'Murcia',
  3.8,
  'published'
)
ON CONFLICT DO NOTHING;

-- 4) Malatan-og Viewing Deck to Malatan-og Falls
INSERT INTO public.trails (name, difficulty, description, active, barangay, city, distance_km, route_status)
VALUES (
  'Malatan-og Viewing Deck to Malatan-og Falls',
  'Easy',
  'Scenic descent from Malatan-og Viewing Deck along Eco-Tourism Highway (10.58755 N, 123.23221 E, Plus Code: H6QJ+2V2, 820m) to Malatan-og Falls natural pool (10.59391 N, 123.22771 E, Plus Code: 7Q25H6VH+H3, 650m), Brgy. Kumaliskis, Don Salvador Benedicto.',
  true,
  'Kumaliskis',
  'Don Salvador Benedicto',
  2.2,
  'published'
)
ON CONFLICT DO NOTHING;
