-- Migration 007: Cho phép tất cả người dùng (authenticated & anon) xem thông tin lịch bận của trang phục
-- Chỉ cấp quyền SELECT các trường không nhạy cảm thông qua policy riêng biệt hoặc RLS công khai cho lịch đặt

DROP POLICY IF EXISTS "Anyone can view costume availability bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_public_schedule" ON public.bookings;

-- Policy cho phép mọi người (kể cả khách vãng lai và user khác) xem các booking đã được xác nhận/đang thuê
-- để hiển thị lên Schedule View mà không bị ẩn bởi RLS
CREATE POLICY "bookings_select_public_schedule"
  ON public.bookings FOR SELECT
  TO public
  USING (
    status IN ('confirmed', 'shipping', 'renting', 'overdue', 'returned', 'inspecting')
  );
