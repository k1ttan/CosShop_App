/**
 * Supabase Data Access Layer (Server-side)
 * Tất cả queries đều chạy server-side, sử dụng createClient() từ server.ts
 */
import { createClient } from '@/lib/supabase/server'
import type { Costume, Profile, BookingWithDetails, ReviewWithAuthor } from '@/types/database'
import { MOCK_REVIEWS } from '@/lib/mock-data'

// Re-export for components that import from queries
export type { BookingWithDetails, Profile, ReviewWithAuthor }

// ──────────────────────────────────────────────
// COSTUMES
// ──────────────────────────────────────────────

/**
 * Lấy tất cả trang phục công khai (status != 'hidden')
 * Dùng cho trang chủ và tìm kiếm.
 */
export async function getCostumes(opts?: {
  series?: string
  search?: string
  limit?: number
}): Promise<Costume[]> {
  const supabase = await createClient()

  let query = supabase
    .from('costumes')
    .select('*')
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })

  if (opts?.series && opts.series !== 'all') {
    query = query.eq('series', opts.series)
  }

  if (opts?.search) {
    query = query.or(
      `name.ilike.%${opts.search}%,series.ilike.%${opts.search}%,character.ilike.%${opts.search}%`
    )
  }

  if (opts?.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getCostumes] error:', error.message)
    return []
  }

  return data as Costume[]
}

/**
 * Lấy một trang phục theo ID
 */
export async function getCostumeById(id: string): Promise<Costume | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('costumes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getCostumeById] error:', error.message)
    return null
  }

  return data as Costume
}

/**
 * Lấy danh sách booking đã được xác nhận/đang thuê của một trang phục
 * Dùng để vẽ Schedule View / Calendar và kiểm tra ngày trống
 */
export async function getCostumeBookings(costumeId: string): Promise<Array<{ id: string; start_date: string; end_date: string; status: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_date, end_date, status')
    .eq('costume_id', costumeId)
    .in('status', ['confirmed', 'shipping', 'renting', 'overdue', 'returned', 'inspecting'])
    .order('start_date', { ascending: true })

  if (error) {
    console.error('[getCostumeBookings] error:', error.message)
    return []
  }

  return data ?? []
}

/**
 * Lấy danh sách series duy nhất để hiển thị bộ lọc
 */
export async function getUniqueSeries(): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('costumes')
    .select('series')
    .neq('status', 'hidden')
    .order('series')

  if (error) return []

  const seriesSet = new Set(data?.map((d) => d.series as string) ?? [])
  return Array.from(seriesSet)
}

// ──────────────────────────────────────────────
// BOOKINGS (Admin only — cần is_admin = true)
// ──────────────────────────────────────────────

/**
 * Lấy tất cả bookings với thông tin trang phục và hồ sơ khách (admin)
 */
export async function getAllBookings(opts?: {
  status?: string
  limit?: number
}): Promise<BookingWithDetails[]> {
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select(
      `
      *,
      costume:costumes (id, name, character, series, brand, image_urls, rent_price_per_day, rent_price_fes)
    `
    )
    .order('created_at', { ascending: false })

  if (opts?.status) {
    query = query.eq('status', opts.status)
  }

  if (opts?.limit) {
    query = query.limit(opts.limit)
  }

  const { data: bookingsData, error } = await query

  if (error || !bookingsData) {
    console.error('[getAllBookings] error:', error?.message)
    return []
  }

  // Fetch profiles for the users in these bookings
  const userIds = Array.from(new Set(bookingsData.map((b) => b.user_id as string).filter(Boolean)))
  let profileMap: Record<string, { id: string; full_name: string | null; phone: string | null }> = {}

  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds)

    if (profilesData) {
      profileMap = Object.fromEntries(
        profilesData.map((p) => [p.id, { id: p.id, full_name: p.full_name, phone: p.phone }])
      )
    }
  }

  return bookingsData.map((b) => {
    const isGuest = !b.user_id
    const customerProfile = isGuest
      ? {
          id: 'guest',
          full_name: b.guest_name ? `Khách vãng lai: ${b.guest_name}` : 'Khách vãng lai',
          phone: b.guest_phone || 'Chưa cập nhật SĐT',
        }
      : profileMap[b.user_id] ?? { id: b.user_id, full_name: 'Khách hàng', phone: '' }

    return {
      ...b,
      costume: b.costume,
      profile: customerProfile,
    }
  }) as unknown as BookingWithDetails[]
}

/**
 * Lấy booking của user hiện tại
 */
export async function getMyBookings(): Promise<BookingWithDetails[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      costume:costumes (id, name, character, series, brand, image_urls, rent_price_per_day, rent_price_fes)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getMyBookings] error:', error.message)
    return []
  }

  return (data as unknown as BookingWithDetails[]) ?? []
}

// ──────────────────────────────────────────────
// PROFILES (Admin: KYC queue)
// ──────────────────────────────────────────────

/**
 * Lấy danh sách user chờ duyệt KYC (admin)
 */
export async function getPendingKycProfiles(): Promise<Profile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('kyc_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getPendingKycProfiles] error:', error.message)
    return []
  }

  return data as Profile[]
}

/**
 * Lấy profile của user hiện tại
 */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[getMyProfile] error:', error.message)
    return null
  }

  return data as Profile
}

// ──────────────────────────────────────────────
// ADMIN STATS
// ──────────────────────────────────────────────

export interface AdminStats {
  totalCostumes: number
  pendingKyc: number
  activeBookings: number
  overdueBookings: number
  pendingProfileChanges: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient()

  const [costumesRes, kycRes, activeRes, overdueRes, profileChangesRes] = await Promise.all([
    supabase.from('costumes').select('id', { count: 'exact', head: true }).neq('status', 'hidden'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'shipping', 'renting']),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return {
    totalCostumes: costumesRes.count ?? 0,
    pendingKyc: kycRes.count ?? 0,
    activeBookings: activeRes.count ?? 0,
    overdueBookings: overdueRes.count ?? 0,
    pendingProfileChanges: profileChangesRes?.count ?? 0,
  }
}

// ──────────────────────────────────────────────
// REVIEWS / FEEDBACKS
// ──────────────────────────────────────────────

export async function getReviewsByCostumeId(costumeId: string): Promise<ReviewWithAuthor[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:user_id(full_name, cccd_image_url)')
      .eq('costume_id', costumeId)
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) {
      // Fallback về mock data
      const mockMatches = MOCK_REVIEWS.filter((r) => r.costume_id === costumeId)
      if (mockMatches.length > 0) return mockMatches
      // Nếu không có mock riêng cho costumeId, trả về 1 review mẫu chung
      return MOCK_REVIEWS.slice(0, 2)
    }

    interface ReviewRow {
      id: string
      costume_id: string
      user_id: string
      booking_id: string | null
      rating: number
      comment: string
      images: string[] | null
      rental_type: 'test' | 'fes' | null
      created_at: string
      profiles: { full_name: string | null; cccd_image_url: string | null } | null
    }

    return (data as unknown as ReviewRow[]).map((item) => ({
      id: item.id,
      costume_id: item.costume_id,
      user_id: item.user_id,
      booking_id: item.booking_id,
      rating: item.rating,
      comment: item.comment,
      images: item.images || [],
      rental_type: item.rental_type ?? 'fes',
      created_at: item.created_at,
      author_name: item.profiles?.full_name || 'Khách hàng CosRent',
      author_avatar: item.profiles?.cccd_image_url || null,
    }))
  } catch {
    const mockMatches = MOCK_REVIEWS.filter((r) => r.costume_id === costumeId)
    return mockMatches.length > 0 ? mockMatches : MOCK_REVIEWS.slice(0, 2)
  }
}

export async function checkUserCanReview(
  costumeId: string,
  userId?: string
): Promise<{ canReview: boolean; completedBookingId?: string; reason?: string }> {
  if (!userId) {
    return { canReview: false, reason: 'Chưa đăng nhập' }
  }

  try {
    const supabase = await createClient()

    // 1. Kiểm tra đã có review trước đó chưa
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('costume_id', costumeId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingReview) {
      return { canReview: false, reason: 'Bạn đã gửi đánh giá cho bộ trang phục này rồi ✨' }
    }

    // 2. Kiểm tra xem có đơn hàng hoàn tất chưa
    const { data: completedBooking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('costume_id', costumeId)
      .eq('user_id', userId)
      .in('status', ['returned', 'deposit_refunded', 'inspecting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (completedBooking) {
      return { canReview: true, completedBookingId: completedBooking.id }
    }

    return {
      canReview: false,
      reason: 'Bạn cần hoàn tất một đơn thuê bộ trang phục này (đã nhận và trả đồ) trước khi đăng đánh giá.',
    }
  } catch {
    return { canReview: false, reason: 'Lỗi kiểm tra quyền đánh giá' }
  }
}
