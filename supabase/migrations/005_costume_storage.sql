-- ==============================================================================
-- MIGRATION 005: SETUP SUPABASE STORAGE FOR COSTUME IMAGES
-- ==============================================================================

-- 1. Create storage bucket 'costumes' if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'costumes',
  'costumes',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 2. Drop existing policies on costumes bucket to ensure idempotent setup
DROP POLICY IF EXISTS "Public view costume images" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload costume images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update costume images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete costume images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all upload costumes fallback" ON storage.objects;

-- 3. Policy: Public can read/view costume images
CREATE POLICY "Public view costume images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'costumes');

-- 4. Policy: Authenticated Admins can upload/manage costume images
-- Using the safe helper function is_current_user_admin() created in 004
CREATE POLICY "Admin upload costume images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'costumes'
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = TRUE
      )
    )
  );

CREATE POLICY "Admin update costume images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'costumes'
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = TRUE
      )
    )
  );

CREATE POLICY "Admin delete costume images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'costumes'
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = TRUE
      )
    )
  );
