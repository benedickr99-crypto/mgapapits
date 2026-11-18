-- Add route_geojson, distance_km, and status to trails table for Strava-style GPS trail mapping

ALTER TABLE public.trails
ADD COLUMN IF NOT EXISTS route_geojson JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS route_status TEXT NOT NULL DEFAULT 'draft' CHECK (route_status IN ('draft', 'published', 'archived'));

-- Ensure RLS is active on public.trails
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;

-- Allow public / all users to read active & published trails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trails' AND policyname = 'Public read trails'
  ) THEN
    CREATE POLICY "Public read trails"
      ON public.trails
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Allow DENR Admins to insert, update, delete trails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trails' AND policyname = 'Admins manage trails'
  ) THEN
    CREATE POLICY "Admins manage trails"
      ON public.trails
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
        )
      );
  END IF;
END $$;
