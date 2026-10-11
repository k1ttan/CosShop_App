-- =============================================================
-- MIGRATION 009: Support Guest Bookings (Khách Vãng Lai Không Cần Login)
-- =============================================================

-- 1. Cho phép user_id trong bảng bookings có thể NULL (đối với khách vãng lai)
ALTER TABLE public.bookings
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Thêm các cột lưu thông tin khách vãng lai trực tiếp vào bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 3. Cập nhật Policy RLS cho phép Guest (anon) tạo đơn đặt thuê
DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_all" ON public.bookings;

-- Cả user đã đăng nhập (authenticated) và khách vãng lai (anon) đều có thể tạo đơn đặt thuê
CREATE POLICY "bookings_insert_all"
  ON public.bookings FOR INSERT
  WITH CHECK (
    -- Hoặc là user đã đăng nhập và user_id khớp auth.uid()
    (auth.role() = 'authenticated' AND (SELECT auth.uid()) = user_id)
    OR
    -- Hoặc là khách vãng lai (user_id IS NULL và có guest_name, guest_phone)
    (user_id IS NULL AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
  );

-- Khách vãng lai cũng có thể xem đơn hàng nếu cần (hoặc Admin xem tất cả)
-- Admin vẫn toàn quyền xem và cập nhật qua policy bookings_admin_all
