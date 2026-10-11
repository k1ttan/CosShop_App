-- ============================================================
-- MIGRATION: 003_seed_users_and_fix_profile_trigger.sql
-- Sửa trigger handle_new_user để tự động lấy metadata từ raw_user_meta_data
-- Seed tài khoản mẫu: Admin và Khách hàng (User)
-- ============================================================

-- 1. CẬP NHẬT FUNCTION handle_new_user:
-- Khi auth.users được insert từ signUp (hoặc admin create),
-- hàm sẽ tự động trích xuất full_name, phone, default_address từ raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'default_address', NULL),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, FALSE),
    CASE 
      WHEN (NEW.raw_user_meta_data->>'is_admin')::boolean = TRUE THEN 'verified'::kyc_status
      ELSE 'unsubmitted'::kyc_status
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    default_address = EXCLUDED.default_address,
    is_admin = EXCLUDED.is_admin;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Đảm bảo trigger gắn đúng vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cho phép INSERT policy trên profiles nếu user đã đăng nhập
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- ============================================================
-- 2. TẠO TÀI KHOẢN MẪU SẴN (ADMIN & USERS)
-- Mật khẩu mặc định cho tất cả tài khoản mẫu: 123456
-- Mã băm pgcrypto tương thích Supabase Auth:
-- '$2a$10$Y1y5P2oJ8P2.F9v8w0B0Iu/M.1HqvWkU9V5M9d2p3Y4n5L6r7s8t9'
-- ============================================================

-- Bật extension pgcrypto nếu chưa có
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user1_id UUID := '00000000-0000-0000-0000-000000000002';
  v_user2_id UUID := '00000000-0000-0000-0000-000000000003';
  v_encrypted_pw TEXT := crypt('123456', gen_salt('bf'));
BEGIN

  -- ─── 1. TÀI KHOẢN ADMIN ───
  -- Email: admin@cosrent.vn / Pass: 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@cosrent.vn') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Quản Trị Viên CosRent","phone":"0909000001","is_admin":true}'::jsonb,
      NOW(),
      NOW()
    );

    INSERT INTO public.profiles (
      id, full_name, phone, default_address, is_admin, kyc_status
    ) VALUES (
      v_admin_id,
      'Quản Trị Viên CosRent',
      '0909000001',
      '72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      TRUE,
      'verified'
    ) ON CONFLICT (id) DO UPDATE SET is_admin = TRUE, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;
  ELSE
    -- Cập nhật admin nếu đã tồn tại
    UPDATE public.profiles 
    SET is_admin = TRUE, kyc_status = 'verified'
    WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@cosrent.vn');
  END IF;

  -- ─── 2. TÀI KHOẢN USER 1 (ĐÃ KYC) ───
  -- Email: user1@cosrent.vn / Pass: 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user1@cosrent.vn') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_user1_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'user1@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Nguyễn Hà My (Cosplayer)","phone":"0918123456","is_admin":false}'::jsonb,
      NOW(),
      NOW()
    );

    INSERT INTO public.profiles (
      id, full_name, phone, default_address, is_admin, kyc_status, cccd_image_url
    ) VALUES (
      v_user1_id,
      'Nguyễn Hà My (Cosplayer)',
      '0918123456',
      '123 Nguyễn Thị Minh Khai, Phường 6, Quận 3, TP. Hồ Chí Minh',
      FALSE,
      'verified',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'
    ) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, kyc_status = 'verified';
  END IF;

  -- ─── 3. TÀI KHOẢN USER 2 (CHỜ DUYỆT KYC) ───
  -- Email: user2@cosrent.vn / Pass: 123456
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user2@cosrent.vn') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_user2_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'user2@cosrent.vn',
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Trần Minh Tuấn","phone":"0987654321","is_admin":false}'::jsonb,
      NOW(),
      NOW()
    );

    INSERT INTO public.profiles (
      id, full_name, phone, default_address, is_admin, kyc_status, cccd_image_url
    ) VALUES (
      v_user2_id,
      'Trần Minh Tuấn',
      '0987654321',
      '45 Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      FALSE,
      'pending',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
    ) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, kyc_status = 'pending';
  END IF;

END $$;
