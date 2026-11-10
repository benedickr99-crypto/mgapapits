-- Ensure cascading delete from trails to bookings so deleting a trail never results in a 409 conflict
DO $$
BEGIN
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_trail_id_fkey;
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_trail_id_fkey 
        FOREIGN KEY (trail_id) REFERENCES public.trails(id) ON DELETE CASCADE;
EXCEPTION
    WHEN others THEN NULL;
END $$;
