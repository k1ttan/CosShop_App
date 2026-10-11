-- =============================================================
-- MIGRATION 010: Hãng đồ (brand) & Hai mức giá thuê (Test vs Fes/Shoot)
-- =============================================================

-- 1. Thêm cột brand (Hãng sản xuất/Studio, text nullable)
ALTER TABLE public.costumes
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- 2. Thêm cột rent_price_fes (Giá thuê đi Fes/Shoot)
-- Mặc định tính cao hơn rent_price_per_day (giá test) khoảng 40% (làm tròn hàng chục nghìn)
ALTER TABLE public.costumes
  ADD COLUMN IF NOT EXISTS rent_price_fes NUMERIC(12, 0);

-- Cập nhật giá Fes cho các trang phục hiện có:
-- Giá fes = ROUND((rent_price_per_day * 1.4) / 10000) * 10000
UPDATE public.costumes
SET rent_price_fes = ROUND((rent_price_per_day * 1.4) / 10000) * 10000
WHERE rent_price_fes IS NULL;

-- Đặt giá trị mặc định cho các trang phục thêm mới sau này
ALTER TABLE public.costumes
  ALTER COLUMN rent_price_fes SET DEFAULT 210000;

-- 3. Cập nhật bảng bookings lưu loại thuê (rental_type: 'test' hoặc 'fes')
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rental_type TEXT DEFAULT 'fes'
    CHECK (rental_type IN ('test', 'fes'));
 