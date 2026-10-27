-- Allow users to delete their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users delete own notifications'
  ) THEN
    CREATE POLICY "Users delete own notifications"
      ON public.notifications
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;
