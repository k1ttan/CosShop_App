-- =============================================================
-- MIGRATION 012: Hệ thống Feedback & Đánh giá trang phục (Reviews)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  costume_id UUID NOT NULL REFERENCES public.costumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  rental_type TEXT DEFAULT 'fes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tăng tốc truy vấn feedback theo trang phục và người dùng
CREATE INDEX IF NOT EXISTS idx_reviews_costume_id ON public.reviews (costume_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews (user_id);

-- Cấu hình Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1. Ai cũng có thể xem đánh giá của trang phục (Public read)
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  USING (true);

-- 2. Chỉ người dùng đã đăng nhập và đã hoàn thành đơn thuê bộ này mới được tạo feedback
CREATE POLICY "reviews_insert_verified_renter"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = auth.uid()
        AND costume_id = reviews.costume_id
        AND status IN ('returned', 'deposit_refunded', 'inspecting')
    )
  );

-- 3. Người viết hoặc Admin có quyền xóa đánh giá
CREATE POLICY "reviews_delete_own_or_admin"
  ON public.reviews FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
