-- =============================================================
-- MIGRATION 013: Kho lưu trữ đơn hàng (Archived Bookings)
-- =============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_is_archived ON public.bookings (is_archived, status);
