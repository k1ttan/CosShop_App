-- =============================================================
-- MIGRATION 014: Fix profile_change_requests Foreign Key to public.profiles
-- =============================================================

-- Ensure foreign key references public.profiles(id) so PostgREST schema cache and relationships are recognized
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'profile_change_requests_profiles_fk'
      AND table_name = 'profile_change_requests'
  ) THEN
    ALTER TABLE public.profile_change_requests
      ADD CONSTRAINT profile_change_requests_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
