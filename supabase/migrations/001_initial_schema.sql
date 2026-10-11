-- =============================================================
-- COSPLAY RENTAL — Supabase Migration
-- Based on Claude.md schema spec (v2 — all logic gaps fixed)
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- ENUMS
-- =============================================================
CREATE TYPE kyc_status AS ENUM ('unsubmitted', 'pending', 'verified', 'rejected');
CREATE TYPE costume_status AS ENUM ('available', 'rented', 'cleaning', 'broken', 'hidden');
CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'shipping', 'renting',
  'returned', 'inspecting', 'deposit_refunded', 'deposit_withheld',
  'cancelled', 'overdue'
);
CREATE TYPE payment_status AS ENUM ('unpaid', 'deposit_paid', 'fully_paid', 'refunded');
CREATE TYPE shipping_method AS ENUM ('self_pickup', 'shop_delivery', 'third_party_courier');
CREATE TYPE cancelled_by AS ENUM ('user', 'admin');
CREATE TYPE refund_status AS ENUM ('not_applicable', 'pending_refund', 'refunded');

-- =============================================================
-- TABLE: profiles (extends auth.users)
-- =============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  default_address TEXT,
  cccd_image_url TEXT, -- private Storage bucket
  kyc_status kyc_status NOT NULL DEFAULT 'unsubmitted',
  kyc_rejection_reason TEXT, -- Admin fills on rejection
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- TABLE: costumes
-- =============================================================
CREATE TABLE public.costumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  series TEXT NOT NULL,
  character TEXT NOT NULL,
  description TEXT,
  status costume_status NOT NULL DEFAULT 'available',
  rent_price_per_day NUMERIC(12, 0) NOT NULL CHECK (rent_price_per_day > 0),
  deposit_price NUMERIC(12, 0) NOT NULL CHECK (deposit_price > 0), -- NOT combined with rent
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  buffer_days INTEGER NOT NULL DEFAULT 1 CHECK (buffer_days >= 0), -- only when quantity = 1
  late_fee_multiplier FLOAT NOT NULL DEFAULT 1.5 CHECK (late_fee_multiplier >= 1),
  weight_kg FLOAT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE: bookings
-- =============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  costume_id UUID NOT NULL REFERENCES public.costumes(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  total_rent_fee NUMERIC(12, 0) NOT NULL DEFAULT 0,
  deposit_fee NUMERIC(12, 0) NOT NULL DEFAULT 0, -- tách biệt với tiền thuê
  shipping_fee NUMERIC(12, 0) NOT NULL DEFAULT 0,
  late_fee NUMERIC(12, 0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 0) GENERATED ALWAYS AS
    (total_rent_fee + deposit_fee + shipping_fee + late_fee) STORED,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  shipping_method shipping_method NOT NULL,
  shipping_address TEXT,
  cancelled_by cancelled_by,
  refund_status refund_status,
  condition_on_return TEXT, -- Admin fills on inspection
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT end_after_start CHECK (end_date > start_date)
);

-- =============================================================
-- INDEX (Rule 1 — overlap query performance)
-- =============================================================
CREATE INDEX idx_bookings_overlap
  ON public.bookings (costume_id, start_date, end_date, status);

CREATE INDEX idx_bookings_user_id ON public.bookings (user_id);
CREATE INDEX idx_bookings_status ON public.bookings (status);

-- =============================================================
-- ROW LEVEL SECURITY (RLS) — Bắt buộc bật
-- =============================================================

-- profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins have full profile access"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- costumes RLS
ALTER TABLE public.costumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available costumes"
  ON public.costumes FOR SELECT
  USING (status != 'hidden');

CREATE POLICY "Only admins can manage costumes"
  ON public.costumes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- bookings RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own pending bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins have full booking access"
  ON public.bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- =============================================================
-- FUNCTION: Auto-update overdue bookings (for cron job)
-- Call via Supabase pg_cron or Edge Function scheduled task
-- =============================================================
CREATE OR REPLACE FUNCTION public.update_overdue_bookings()
RETURNS void AS $$
BEGIN
  UPDATE public.bookings
  SET
    status = 'overdue',
    late_fee = (
      SELECT
        (CURRENT_DATE - b.end_date) * c.rent_price_per_day * c.late_fee_multiplier
      FROM public.bookings b
      JOIN public.costumes c ON b.costume_id = c.id
      WHERE bookings.id = b.id
    )
  WHERE
    status = 'renting'
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
