// ============================================================
// DATABASE TYPES — Generated from Claude.md schema spec
// ============================================================

export type KycStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected'
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'renting'
  | 'returned'
  | 'inspecting'
  | 'deposit_refunded'
  | 'deposit_withheld'
  | 'cancelled'
  | 'overdue'
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid' | 'refunded'
export type CostumeStatus = 'available' | 'rented' | 'cleaning' | 'broken' | 'hidden'
export type ShippingMethod = 'self_pickup' | 'shop_delivery' | 'third_party_courier'
export type CancelledBy = 'user' | 'admin'
export type RefundStatus = 'not_applicable' | 'pending_refund' | 'refunded'

// -----------------------------------------------------------
// TABLE: profiles (extends Supabase Auth)
// -----------------------------------------------------------
export interface Profile {
  id: string // UUID, FK → auth.users
  full_name: string | null
  phone: string | null
  default_address: string | null
  cccd_image_url: string | null // private Storage bucket
  kyc_status: KycStatus
  kyc_rejection_reason: string | null
  is_admin: boolean
  created_at: string
}

// -----------------------------------------------------------
// TABLE: costumes
// -----------------------------------------------------------
export interface Costume {
  id: string
  name: string
  series: string
  character: string
  brand?: string | null // Hãng sản xuất (Uwowo, DokiDoki, Manmei...)
  description: string | null
  status: CostumeStatus
  rent_price_per_day: number // Giá thuê Test (mặc trong nhà)
  rent_price_fes?: number // Giá thuê đi Fes / Shoot (thường cao hơn ~40%)
  deposit_price: number // NOT combined with rent
  quantity: number // default 1
  buffer_days: number // default 1, only applies when quantity = 1
  late_fee_multiplier: number // default 1.5
  weight_kg: number | null
  image_urls: string[]
  tags: string[]
  created_at: string
}

// -----------------------------------------------------------
// TABLE: bookings
// -----------------------------------------------------------
export interface Booking {
  id: string
  user_id: string | null // FK → auth.users, NULL nếu là khách vãng lai (guest)
  guest_name?: string | null
  guest_phone?: string | null
  costume_id: string // FK → costumes, NOT NULL
  start_date: string // DATE
  end_date: string // DATE
  status: BookingStatus
  total_rent_fee: number
  deposit_fee: number // NOT combined with rent fee
  shipping_fee: number
  late_fee: number // default 0
  total_amount: number // = total_rent_fee + deposit_fee + shipping_fee + late_fee
  payment_status: PaymentStatus
  shipping_method: ShippingMethod
  shipping_address: string | null
  cancelled_by: CancelledBy | null
  refund_status: RefundStatus | null
  rental_type?: 'test' | 'fes'
  carrier_name?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipped_at?: string | null
  received_at?: string | null
  received_images?: string[]
  received_note?: string | null
  condition_on_return: string | null // Admin fills on inspection
  is_archived?: boolean // Admin đưa vào kho lưu trữ
  created_at: string
}

// -----------------------------------------------------------
// TABLE: notifications
// -----------------------------------------------------------
export interface Notification {
  id: string
  user_id: string
  booking_id?: string | null
  title: string
  message: string
  type: 'delivery' | 'booking_status' | 'general'
  link?: string | null
  is_read: boolean
  created_at: string
}

// -----------------------------------------------------------
// TABLE: reviews
// -----------------------------------------------------------
export interface Review {
  id: string
  costume_id: string
  user_id: string
  booking_id?: string | null
  rating: number // 1 to 5
  comment: string
  images: string[]
  rental_type?: 'test' | 'fes'
  created_at: string
}

export interface ReviewWithAuthor extends Review {
  author_name: string
  author_avatar?: string | null
}

export type { CarrierConfig } from '@/lib/constants/carriers'
export { POPULAR_CARRIERS } from '@/lib/constants/carriers'

// -----------------------------------------------------------
// JOIN TYPES (for queries with relations)
// -----------------------------------------------------------
export interface BookingWithDetails extends Booking {
  costume: Pick<Costume, 'id' | 'name' | 'character' | 'series' | 'brand' | 'image_urls' | 'rent_price_per_day' | 'rent_price_fes'>
  profile: Pick<Profile, 'id' | 'full_name' | 'phone'>
}

export interface CostumeWithAvailability extends Costume {
  booked_dates: Array<{ start_date: string; end_date: string }>
}

// -----------------------------------------------------------
// FORM / PAYLOAD TYPES
// -----------------------------------------------------------
export interface CreateBookingPayload {
  costume_id: string
  start_date: string
  end_date: string
  rental_type?: 'test' | 'fes'
  shipping_method: ShippingMethod
  shipping_address?: string
  guest_name?: string
  guest_phone?: string
}

export interface CheckOverlapParams {
  costume_id: string
  start_date: string
  end_date: string
  exclude_booking_id?: string
}
