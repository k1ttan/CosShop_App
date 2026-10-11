-- =============================================================
-- MIGRATION 011: Tối ưu quy trình giao hàng, Mã vận đơn bên thứ 3,
-- Tra cứu thời gian thực, Bằng chứng nhận hàng và Thông báo In-App
-- =============================================================

-- 1. Thêm các trường vận chuyển và bằng chứng nhận hàng vào bảng bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS received_note TEXT;

-- 2. Tạo bảng notifications (Hệ thống thông báo In-App)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'delivery',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tra cứu thông báo theo user_id và thời gian
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (user_id, is_read);

-- 3. Cấu hình Row Level Security (RLS) cho bảng notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- User xem thông báo của chính mình
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- User cập nhật trạng thái đã đọc thông báo của chính mình
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin và Server (qua triggers hoặc service role) có toàn quyền
CREATE POLICY "notifications_admin_all"
  ON public.notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Cho phép authenticated user hoặc server insert thông báo
CREATE POLICY "notifications_insert_all"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 4. Tạo Storage Bucket "booking-proofs" để lưu ảnh unbox lúc nhận hàng (nếu chưa có)
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-proofs', 'booking-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy Storage cho booking-proofs: Mọi người có thể xem ảnh
CREATE POLICY "booking_proofs_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-proofs');

-- Policy Storage cho booking-proofs: User đã đăng nhập hoặc anon có thể upload ảnh
CREATE POLICY "booking_proofs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'booking-proofs');
