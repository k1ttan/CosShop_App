-- Migration 006: Cập nhật mặc định buffer_days thành 3 ngày và đảm bảo mọi trang phục có tối thiểu 3 ngày đệm
ALTER TABLE public.costumes 
ALTER COLUMN buffer_days SET DEFAULT 3;

UPDATE public.costumes 
SET buffer_days = 3 
WHERE buffer_days < 3;
