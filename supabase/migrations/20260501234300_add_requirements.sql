-- Create requirements bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('requirements', 'requirements', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated uploads to requirements bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'requirements');

-- Policy to allow public read of requirements
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'requirements');

-- Policy to allow authenticated updates
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'requirements');

-- Add requirement url columns to bookings
ALTER TABLE public.bookings
ADD COLUMN valid_id_url text,
ADD COLUMN waiver_url text,
ADD COLUMN medical_cert_url text;
