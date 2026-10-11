-- ============================================================
-- MIGRATION: 004_fix_schema_and_auth.sql (REVISED & TESTED)
-- Sửa triệt để lỗi GoTrue:
-- "Scan error on column index 3, name \"confirmation_token\": converting NULL to string is unsupported"
-- GoTrue yêu cầu các trường token (confirmation_token, recovery_token, email_change_token_new, email_change)
-- phải là chuỗi rỗng '' (hoặc token hợp lệ), KHÔNG ĐƯỢC PHÉP LÀ NULL.
-- ============================================================

-- ─── 0. ĐẢM BẢO CÁC EXTENSION CẦN THIẾT ──────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. TẠM GỠ TRIGGER TRÊN AUTH.USERS ĐỂ TRÁNH XUNG ĐỘT ────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ─── 2. HÀM XỬ LÝ USER MỚI (DEFENSIVE & CHUẨN POSTGRES) ──────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_full_name TEXT;
  v_phone TEXT;
  v_default_address TEXT;
BEGIN
  IF NEW.raw_app_meta_data IS NOT NULL AND (NEW.raw_app_meta_data->>'is_admin') IS NOT NULL THEN
    v_is_admin := (NEW.raw_app_meta_data->>'is_admin')::boolean;
  ELSIF NEW.raw_user_meta_data IS NOT NULL AND (NEW.raw_user_meta_data->>'is_admin') IS NOT NULL THEN
    v_is_admin := (NEW.raw_user_meta_data->>'is_admin')::boolean;
  END IF;

  IF NEW.raw_user_meta_data IS NOT NULL THEN
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_default_address := NEW.raw_user_meta_data->>'default_address';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    default_address,
    is_admin,
    kyc_status
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    v_default_address,
    v_is_admin,
    CASE WHEN v_is_admin THEN 'verified'::kyc_status ELSE 'unsubmitted'::kyc_status END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name       = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone           = COALESCE(EXCLUDED.phone, public.profiles.phone),
    default_address = COALESCE(EXCLUDED.default_address, public.profiles.default_address),
    is_admin        = EXCLUDED.is_admin,
    kyc_status      = CASE WHEN EXCLUDED.is_admin THEN 'verified'::kyc_status ELSE public.profiles.kyc_status END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Gắn lại trigger an toàn
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 3. HELPER FUNCTION CHO ADMIN (TRÁNH RLS RECURSION) ─────
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ─── 4. SỬA CỘT total_amount CỦA BẢNG BOOKINGS ───────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'total_amount'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE public.bookings DROP COLUMN total_amount;
    ALTER TABLE public.bookings ADD COLUMN total_amount NUMERIC(12, 0) NOT NULL DEFAULT 0;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN total_amount NUMERIC(12, 0) NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE public.bookings
SET total_amount = total_rent_fee + deposit_fee + shipping_fee + late_fee
WHERE total_amount = 0;

-- ─── 5. THIẾT LẬP RLS CHUẨN XÁC ──────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_current_user_admin());

-- Costumes Policies
DROP POLICY IF EXISTS "Anyone can view available costumes" ON public.costumes;
DROP POLICY IF EXISTS "Only admins can manage costumes" ON public.costumes;
DROP POLICY IF EXISTS "costumes_select_available" ON public.costumes;
DROP POLICY IF EXISTS "costumes_admin_all" ON public.costumes;

CREATE POLICY "costumes_select_available"
  ON public.costumes FOR SELECT
  USING (status != 'hidden');

CREATE POLICY "costumes_admin_all"
  ON public.costumes FOR ALL
  TO authenticated
  USING (public.is_current_user_admin());

-- Bookings Policies
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can cancel own pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins have full booking access" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own_pending" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;

CREATE POLICY "bookings_select_own"
  ON public.bookings FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "bookings_insert_own"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "bookings_update_own_pending"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND status = 'pending')
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "bookings_admin_all"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.is_current_user_admin());

-- ─── 6. HÀM TÍNH PHÍ QUÁ HẠN ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_overdue_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings b
  SET
    status    = 'overdue',
    late_fee  = (CURRENT_DATE - b.end_date)
                  * c.rent_price_per_day
                  * c.late_fee_multiplier,
    total_amount = b.total_rent_fee + b.deposit_fee + b.shipping_fee
                    + (CURRENT_DATE - b.end_date)
                    * c.rent_price_per_day
                    * c.late_fee_multiplier
  FROM public.costumes c
  WHERE b.costume_id = c.id
    AND b.status = 'renting'
    AND b.end_date < CURRENT_DATE;
END;
$$;

-- ─── 7. SỬA LỖI TOKEN NULL TRONG auth.users VÀ SEED DỮ LIỆU ──
-- GoTrue Go scanner không chấp nhận NULL cho các cột token string
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL;

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user1_id UUID := '00000000-0000-0000-0000-000000000002';
  v_user2_id UUID := '00000000-0000-0000-0000-000000000003';
  v_encrypted_pw TEXT;
BEGIN
  -- Hash mật khẩu '123456'
  v_encrypted_pw := crypt('123456', gen_salt('bf'));

  -- 7.1 SEED / UPDATE ADMIN: admin@cosrent.vn / 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@cosrent.vn') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"is_admin":true}'::jsonb,
      '{"full_name":"Quản Trị Viên CosRent","phone":"0909000001","is_admin":true}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_admin":true}'::jsonb,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin":true}'::jsonb,
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, '')
    WHERE email = 'admin@cosrent.vn';

    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@cosrent.vn';
  END IF;

  -- BẢO ĐẢM PROFILE ADMIN TỒN TẠI
  INSERT INTO public.profiles (
    id, full_name, phone, default_address, is_admin, kyc_status
  ) VALUES (
    v_admin_id,
    'Quản Trị Viên CosRent',
    '0909000001',
    '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. HCM',
    TRUE,
    'verified'::kyc_status
  ) ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    is_admin = TRUE,
    kyc_status = 'verified'::kyc_status;

  -- 7.2 SEED / UPDATE USER 1 (ĐÃ KYC): user1@cosrent.vn / 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user1@cosrent.vn') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_user1_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'user1@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Nguyễn Hà My","phone":"0918123456"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, '')
    WHERE email = 'user1@cosrent.vn';

    SELECT id INTO v_user1_id FROM auth.users WHERE email = 'user1@cosrent.vn';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, phone, default_address, is_admin, kyc_status
  ) VALUES (
    v_user1_id,
    'Nguyễn Hà My',
    '0918123456',
    '123 Nguyễn Thị Minh Khai, Quận 3, TP. HCM',
    FALSE,
    'verified'::kyc_status
  ) ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    kyc_status = 'verified'::kyc_status;

  -- 7.3 SEED / UPDATE USER 2 (CHỜ KYC): user2@cosrent.vn / 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user2@cosrent.vn') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_user2_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'user2@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Trần Minh Quân","phone":"0987654321"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, '')
    WHERE email = 'user2@cosrent.vn';

    SELECT id INTO v_user2_id FROM auth.users WHERE email = 'user2@cosrent.vn';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, phone, default_address, is_admin, kyc_status
  ) VALUES (
    v_user2_id,
    'Trần Minh Quân',
    '0987654321',
    '456 Lê Văn Sỹ, Quận Tân Bình, TP. HCM',
    FALSE,
    'pending'::kyc_status
  ) ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    kyc_status = 'pending'::kyc_status;

  -- 7.4 ĐỒNG BỘ TẤT CẢ USER HIỆN CÓ SANG PROFILES
  INSERT INTO public.profiles (id, full_name, is_admin, kyc_status)
  SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE((u.raw_app_meta_data->>'is_admin')::boolean, (u.raw_user_meta_data->>'is_admin')::boolean, FALSE),
    CASE 
      WHEN COALESCE((u.raw_app_meta_data->>'is_admin')::boolean, (u.raw_user_meta_data->>'is_admin')::boolean, FALSE) THEN 'verified'::kyc_status
      ELSE 'unsubmitted'::kyc_status
    END
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  ON CONFLICT (id) DO NOTHING;

END $$;
