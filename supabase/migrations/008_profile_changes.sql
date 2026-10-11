-- =============================================================
-- MIGRATION 008: Profile Self-Service Changes with Admin Approval
-- =============================================================

-- 1. Add avatar_url column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create storage bucket for avatars (public read)
-- NOTE: Run this in Supabase Dashboard > Storage or via MCP
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- 3. Create profile_change_requests table
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Requested new values (nullable = no change requested for that field)
  requested_full_name TEXT,
  requested_phone TEXT,
  requested_default_address TEXT,
  requested_avatar_url TEXT,  -- temp URL before approved
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by user and status
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_user_id
  ON public.profile_change_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_status
  ON public.profile_change_requests (status);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own change requests"
  ON public.profile_change_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own requests (only if no pending one exists - enforced in app)
CREATE POLICY "Users can create change requests"
  ON public.profile_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins have full access to all change requests
CREATE POLICY "Admins have full access to change requests"
  ON public.profile_change_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- =============================================================
-- Storage policies for avatars bucket (run after bucket creation)
-- =============================================================
-- Allow authenticated users to upload their own avatars
-- CREATE POLICY "Users can upload own avatar"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'avatars' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
-- 
-- CREATE POLICY "Avatar images are publicly viewable"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
--
-- CREATE POLICY "Users can update own avatar"
--   ON storage.objects FOR UPDATE
--   USING (
--     bucket_id = 'avatars' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
