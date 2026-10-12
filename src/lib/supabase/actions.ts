'use server'

/**
 * Server Actions — mutations thay đổi database
 * Được gọi từ Client Components qua form actions hoặc event handlers
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkBookingOverlap, checkUserActiveBookingLimit, checkKycStatus } from '@/lib/utils/booking-logic'
import type { CreateBookingPayload, Notification, BookingWithDetails } from '@/types/database'
import { evaluatePasswordStrength } from '@/lib/validations/password'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────
// AUTH ACTIONS
// ──────────────────────────────────────────────

export async function signIn(formData: { email: string; password: string }): Promise<{
  success: boolean
  error?: string
  isAdmin?: boolean
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error || !data.user) {
    // Map common Supabase Auth errors to Vietnamese messages
    let msg = 'Đăng nhập thất bại'
    if (error?.message?.includes('Invalid login credentials')) {
      msg = 'Email hoặc mật khẩu không chính xác.'
    } else if (error?.message?.includes('Email not confirmed')) {
      msg = 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.'
    } else if (error?.message?.includes('Database error')) {
      msg = 'Lỗi máy chủ cơ sở dữ liệu. Vui lòng thử lại sau.'
    } else if (error?.message) {
      msg = error.message
    }
    return { success: false, error: msg }
  }

  // Check admin role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .maybeSingle()

  revalidatePath('/', 'layout')
  return { success: true, isAdmin: Boolean(profile?.is_admin) }
}

export async function signUp(formData: {
  email: string
  password: string
  full_name: string
  phone: string
  default_address?: string
}): Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }> {
  const supabase = await createClient()

  const strength = evaluatePasswordStrength(formData.password || '')
  if (!strength.isValid) {
    return { success: false, error: strength.errorMessage || 'Mật khẩu chưa đáp ứng tiêu chuẩn an toàn' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.full_name,
        phone: formData.phone,
        default_address: formData.default_address || null,
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=/login?confirmed=true`,
    },
  })

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Đăng ký thất bại' }
  }

  // Cập nhật bổ sung vào profile đề phòng trigger chạy không đầy đủ
  await supabase
    .from('profiles')
    .update({
      full_name: formData.full_name,
      phone: formData.phone,
      default_address: formData.default_address || null,
    })
    .eq('id', data.user.id)

  revalidatePath('/', 'layout')
  const needsEmailConfirmation = !data.session
  return { success: true, needsEmailConfirmation }
}

export async function signOut(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return { success: true }
}

// ──────────────────────────────────────────────
// BOOKING ACTIONS
// ──────────────────────────────────────────────

export interface CreateBookingResult {
  success: boolean
  bookingId?: string
  error?: string
  vnpayUrl?: string
}

import { calcChargeableRentalDays } from '@/lib/utils/helpers'

/**
 * Tạo đơn đặt thuê mới sau khi xác nhận checkout
 * Hỗ trợ cả User đăng nhập và Khách vãng lai (Guest):
 * - Nếu đã đăng nhập: Kiểm tra KYC (nếu bắt buộc) & giới hạn 3 đơn active.
 * - Nếu là khách vãng lai: Yêu cầu bắt buộc Họ tên & Số điện thoại, không cần KYC.
 * - Logic tính tiền thuê: Loại trừ ngày nhận và ngày trả đồ (calcChargeableRentalDays).
 */
export async function createBooking(
  payload: CreateBookingPayload & { shippingFee: number }
): Promise<CreateBookingResult> {
  const supabase = await createClient()

  // Kiểm tra user hiện tại
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isGuest = !user

  if (isGuest) {
    if (!payload.guest_name?.trim() || !payload.guest_phone?.trim()) {
      return {
        success: false,
        error: 'Khách chưa đăng nhập vui lòng nhập đầy đủ Họ tên và Số điện thoại liên hệ.',
      }
    }
  } else {
    // Với User đã đăng nhập: Rule 4 KYC check
    const kyc = await checkKycStatus(user.id)
    if (!kyc.verified) {
      return {
        success: false,
        error: `KYC chưa được xác minh (trạng thái: ${kyc.status}). Vui lòng upload CCCD và chờ Admin duyệt.`,
      }
    }

    // Rule 4: Active bookings limit
    const limitCheck = await checkUserActiveBookingLimit(user.id)
    if (limitCheck.exceeded) {
      return {
        success: false,
        error: `Bạn đang có ${limitCheck.count} đơn active. Tối đa 3 đơn cùng lúc.`,
      }
    }
  }

  // Rule 1 + 2: Overlap check
  const overlap = await checkBookingOverlap({
    costume_id: payload.costume_id,
    start_date: payload.start_date,
    end_date: payload.end_date,
  })

  if (overlap.hasOverlap) {
    return { success: false, error: overlap.error ?? 'Ngày này đã có người thuê' }
  }

  // Lấy thông tin trang phục để tính giá
  const { data: costume } = await supabase
    .from('costumes')
    .select('rent_price_per_day, rent_price_fes, deposit_price')
    .eq('id', payload.costume_id)
    .single()

  if (!costume) {
    return { success: false, error: 'Không tìm thấy trang phục' }
  }

  // Xác định đơn giá theo gói thuê: 'fes' (Fes/Shoot) hoặc 'test' (Mặc trong nhà)
  const isFes = payload.rental_type !== 'test'
  const unitPrice = isFes
    ? Number(costume.rent_price_fes || costume.rent_price_per_day * 1.4)
    : Number(costume.rent_price_per_day)

  // Logic tiền thuê: Không tính ngày nhận và trả đồ (calcChargeableRentalDays)
  const rentalDays = calcChargeableRentalDays(payload.start_date, payload.end_date)
  const totalRentFee = rentalDays * unitPrice
  const depositFee = costume.deposit_price
  const totalAmount = totalRentFee + depositFee + payload.shippingFee

  // Tạo booking (dùng Admin Client nếu là khách vãng lai để tránh xung đột RLS ở tầng database)
  const dbClient = isGuest ? createAdminClient() : supabase

  const { data: booking, error: insertError } = await dbClient
    .from('bookings')
    .insert({
      user_id: user ? user.id : null,
      guest_name: isGuest ? payload.guest_name?.trim() : null,
      guest_phone: isGuest ? payload.guest_phone?.trim() : null,
      costume_id: payload.costume_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      rental_type: isFes ? 'fes' : 'test',
      status: 'pending',
      total_rent_fee: totalRentFee,
      deposit_fee: depositFee,
      shipping_fee: payload.shippingFee,
      late_fee: 0,
      total_amount: totalAmount,
      payment_status: 'unpaid',
      shipping_method: payload.shipping_method,
      shipping_address: payload.shipping_address ?? null,
    })
    .select('id')
    .single()

  if (insertError || !booking) {
    console.error('[createBooking] insert error:', insertError?.message)
    return { success: false, error: 'Không thể tạo đơn đặt thuê. Vui lòng thử lại.' }
  }

  revalidatePath('/')
  return { success: true, bookingId: booking.id }
}

// ──────────────────────────────────────────────
// ADMIN ACTIONS
// ──────────────────────────────────────────────

/**
 * Admin: Cập nhật trạng thái KYC của một user
 */
export async function updateKycStatus(
  profileId: string,
  status: 'verified' | 'rejected',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!callerProfile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  const updatePayload: Record<string, string | null> = { kyc_status: status }
  if (status === 'rejected' && rejectionReason) {
    updatePayload.kyc_rejection_reason = rejectionReason
  } else {
    updatePayload.kyc_rejection_reason = null
  }

  const { error } = await supabase.from('profiles').update(updatePayload).eq('id', profileId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}

/**
 * Admin: Cập nhật trạng thái booking (state machine transitions)
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: string,
  opts?: { conditionOnReturn?: string; refundStatus?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  const updatePayload: Record<string, string | null | number> = { status: newStatus }

  if (opts?.conditionOnReturn) {
    updatePayload.condition_on_return = opts.conditionOnReturn
  }

  if (newStatus === 'deposit_refunded') {
    updatePayload.refund_status = 'refunded'
    updatePayload.payment_status = 'refunded'
  }

  if (newStatus === 'deposit_withheld') {
    updatePayload.refund_status = 'not_applicable'
  }

  if (newStatus === 'cancelled') {
    updatePayload.cancelled_by = opts?.refundStatus === 'admin' ? 'admin' : 'user'
  }

  const { error } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId)

  if (error) {
    console.error('[updateBookingStatus] error:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}

/**
 * Admin: Cập nhật đơn hàng sang 'shipping' kèm Đơn vị vận chuyển & Mã vận đơn
 */
export async function shipBooking(data: {
  bookingId: string
  carrierName: string
  trackingNumber: string
  trackingUrl?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  // Lấy thông tin booking trước khi update
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, user_id')
    .eq('id', data.bookingId)
    .single()

  if (fetchErr || !booking) {
    return { success: false, error: 'Không tìm thấy đơn hàng' }
  }

  const updatePayload = {
    status: 'shipping',
    carrier_name: data.carrierName,
    tracking_number: data.trackingNumber.trim(),
    tracking_url: data.trackingUrl?.trim() || null,
    shipped_at: new Date().toISOString(),
  }

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', data.bookingId)

  if (updateErr) {
    console.error('[shipBooking] error:', updateErr.message)
    return { success: false, error: updateErr.message }
  }

  // Nếu đơn hàng thuộc về user đã đăng ký, tạo thông báo In-App
  if (booking.user_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        booking_id: data.bookingId,
        title: 'Đơn hàng đang trên đường giao 🚚',
        message: `Đơn hàng #${data.bookingId.slice(0, 8).toUpperCase()} đã được gửi qua ${data.carrierName}. Mã vận đơn: ${data.trackingNumber.trim()}`,
        type: 'delivery',
        link: '/profile/bookings',
      })
    } catch (notifErr) {
      console.warn('[shipBooking] notification error:', notifErr)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/profile/bookings')
  revalidatePath('/tracking')
  revalidatePath('/')
  return { success: true }
}

/**
 * Admin: Đưa đơn hàng vào kho lưu trữ hoặc khôi phục
 */
export async function toggleArchiveBooking(
  bookingId: string,
  isArchived: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ is_archived: isArchived })
    .eq('id', bookingId)

  if (error) {
    console.error('[toggleArchiveBooking] error:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * User / Guest: Xác nhận đã nhận được đồ (kèm ảnh bằng chứng lúc nhận hàng)
 */
export async function confirmBookingReceived(data: {
  bookingId: string
  receivedImages?: string[]
  receivedNote?: string
  phone?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Lấy thông tin booking
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, user_id, guest_phone, status')
    .eq('id', data.bookingId)
    .single()

  if (fetchErr || !booking) {
    return { success: false, error: 'Không tìm thấy đơn hàng' }
  }

  if (booking.status !== 'shipping') {
    return { success: false, error: 'Đơn hàng không ở trạng thái đang giao hàng' }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Kiểm tra quyền: Hoặc là chính user sở hữu, hoặc là Admin, hoặc là Guest với số điện thoại khớp
  if (booking.user_id) {
    if (!user || user.id !== booking.user_id) {
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user?.id || '').maybeSingle()
      if (!prof?.is_admin) {
        return { success: false, error: 'Bạn không có quyền cập nhật đơn hàng này' }
      }
    }
  } else {
    // Guest booking: phone check
    const cleanGuestPhone = (booking.guest_phone || '').replace(/\D/g, '')
    const cleanInputPhone = (data.phone || '').replace(/\D/g, '')
    if (!cleanGuestPhone || !cleanInputPhone || !cleanGuestPhone.endsWith(cleanInputPhone.slice(-9))) {
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user?.id || '').maybeSingle()
      if (!prof?.is_admin) {
        return { success: false, error: 'Số điện thoại xác thực không khớp với đơn hàng' }
      }
    }
  }

  const updatePayload = {
    status: 'renting',
    received_at: new Date().toISOString(),
    received_images: data.receivedImages || [],
    received_note: data.receivedNote?.trim() || null,
  }

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', data.bookingId)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  // Tạo thông báo xác nhận thành công nếu là user
  if (booking.user_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        booking_id: data.bookingId,
        title: 'Xác nhận nhận đồ thành công 💖',
        message: `Đơn hàng #${data.bookingId.slice(0, 8).toUpperCase()} đã chuyển sang trạng thái Đang thuê. Chúc bạn có buổi hóa thân thật rực rỡ!`,
        type: 'booking_status',
        link: '/profile/bookings',
      })
    } catch (notifErr) {
      console.warn('[confirmBookingReceived] notification error:', notifErr)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/profile/bookings')
  revalidatePath('/tracking')
  revalidatePath('/')
  return { success: true }
}

/**
 * User: Lấy danh sách thông báo của user hiện tại
 */
export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.warn('[getNotifications] error:', error.message)
      return []
    }
    return (data as Notification[]) || []
  } catch {
    return []
  }
}

/**
 * User: Đánh dấu một thông báo đã đọc
 */
export async function markNotificationAsRead(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
    return { success: true }
  } catch {
    return { success: false }
  }
}

/**
 * User: Đánh dấu tất cả thông báo đã đọc
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    return { success: true }
  } catch {
    return { success: false }
  }
}

/**
 * Public: Tra cứu đơn hàng bằng Mã đơn hàng (UUID hoặc 8 ký tự đầu) + Số điện thoại
 */
export async function lookupBooking(
  codeOrId: string,
  phone: string
): Promise<{ success: boolean; booking?: BookingWithDetails; error?: string }> {
  const supabase = await createClient()
  const cleanPhone = phone.replace(/\D/g, '')
  const cleanCode = codeOrId.trim().toLowerCase().replace('#', '')

  if (!cleanCode || !cleanPhone) {
    return { success: false, error: 'Vui lòng nhập đầy đủ Mã đơn hàng và Số điện thoại' }
  }

  // Tra cứu theo ID (hỗ trợ cả UUID đầy đủ hoặc 8 ký tự đầu)
  let query = supabase
    .from('bookings')
    .select(`
      *,
      costume:costumes (id, name, character, series, brand, image_urls, rent_price_per_day, rent_price_fes)
    `)

  if (cleanCode.length === 36) {
    query = query.eq('id', cleanCode)
  } else {
    query = query.filter('id::text', 'ilike', `${cleanCode}%`)
  }

  const { data: bookingsData, error } = await query

  if (error || !bookingsData || bookingsData.length === 0) {
    return { success: false, error: 'Không tìm thấy đơn hàng với mã này' }
  }

  const booking = bookingsData[0] as unknown as BookingWithDetails

  let isPhoneMatched = false
  if (booking.guest_phone) {
    if (booking.guest_phone.replace(/\D/g, '').endsWith(cleanPhone.slice(-9))) {
      isPhoneMatched = true
    }
  }

  if (!isPhoneMatched && booking.user_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', booking.user_id)
      .maybeSingle()

    if (prof?.phone && prof.phone.replace(/\D/g, '').endsWith(cleanPhone.slice(-9))) {
      isPhoneMatched = true
      booking.profile = {
        id: booking.user_id,
        full_name: prof.full_name,
        phone: prof.phone,
      }
    }
  }

  if (!isPhoneMatched) {
    return { success: false, error: 'Số điện thoại không khớp với thông tin đơn hàng' }
  }

  if (!booking.profile) {
    booking.profile = {
      id: booking.user_id || 'guest',
      full_name: booking.guest_name || 'Khách vãng lai',
      phone: booking.guest_phone || phone,
    }
  }

  return { success: true, booking }
}

/**
 * User: Lấy danh sách đơn thuê của user hiện tại
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

/**
 * Admin: Thêm trang phục mới vào kho
 */
export async function createCostume(data: {
  name: string
  series: string
  character: string
  brand?: string
  description?: string
  rent_price_per_day: number
  rent_price_fes?: number
  deposit_price: number
  quantity: number
  buffer_days: number
  late_fee_multiplier: number
  weight_kg?: number
  image_urls: string[]
  tags: string[]
}): Promise<{ success: boolean; error?: string; costumeId?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  const { data: newCostume, error } = await supabase
    .from('costumes')
    .insert({
      ...data,
      rent_price_fes: data.rent_price_fes || Math.round((data.rent_price_per_day * 1.4) / 10000) * 10000,
      status: 'available',
    })
    .select('id')
    .single()

  if (error || !newCostume) {
    return { success: false, error: error?.message ?? 'Lỗi thêm trang phục' }
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true, costumeId: newCostume.id }
}

/**
 * Admin: Chỉnh sửa thông tin trang phục trong kho
 */
export async function updateCostume(
  id: string,
  data: Partial<{
    name: string
    series: string
    character: string
    brand?: string
    description?: string
    status: 'available' | 'rented' | 'cleaning' | 'broken' | 'hidden'
    rent_price_per_day: number
    rent_price_fes: number
    deposit_price: number
    quantity: number
    buffer_days: number
    late_fee_multiplier: number
    weight_kg?: number
    image_urls: string[]
    tags: string[]
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  const { error } = await supabase
    .from('costumes')
    .update(data)
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Admin: Xoá cứng trang phục khỏi kho đồ (chỉ cho phép khi chưa có đơn nào liên quan)
 */
export async function deleteCostume(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Bạn không có quyền Admin' }
  }

  // Kiểm tra xem bộ trang phục có bất kỳ đơn thuê nào không
  const { count, error: countErr } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('costume_id', id)

  if (countErr) {
    return { success: false, error: 'Lỗi kiểm tra lịch sử đơn thuê: ' + countErr.message }
  }

  if (count && count > 0) {
    return {
      success: false,
      error: `Không thể xoá cứng vì bộ đồ này đã có ${count} đơn thuê trong hệ thống. Vui lòng chọn sửa trạng thái thành "Ẩn" (hidden).`,
    }
  }

  const { error } = await supabase
    .from('costumes')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  return { success: true }
}

// ──────────────────────────────────────────────
// PROFILE ACTIONS
// ──────────────────────────────────────────────

/**
 * User: Upload CCCD và yêu cầu xét duyệt KYC
 */
export async function submitKycRequest(
  cccdImageUrl: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { error } = await supabase
    .from('profiles')
    .update({
      cccd_image_url: cccdImageUrl,
      kyc_status: 'pending',
      kyc_rejection_reason: null,
    })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

/**
 * User: Cập nhật thông tin hồ sơ cá nhân
 */
export async function updateProfile(data: {
  full_name?: string
  phone?: string
  default_address?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { error } = await supabase.from('profiles').update(data).eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

// ──────────────────────────────────────────────
// REVIEW / FEEDBACK ACTIONS
// ──────────────────────────────────────────────

/**
 * User: Gửi feedback & đánh giá trang phục sau khi hoàn tất đơn
 */
export async function submitReviewAction(payload: {
  costume_id: string
  rating: number
  comment: string
  images?: string[]
  rental_type?: 'test' | 'fes'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Vui lòng đăng nhập để gửi đánh giá.' }
  }

  if (!payload.rating || payload.rating < 1 || payload.rating > 5) {
    return { success: false, error: 'Số sao đánh giá phải từ 1 đến 5 sao.' }
  }

  if (!payload.comment?.trim()) {
    return { success: false, error: 'Vui lòng nhập nội dung đánh giá của bạn.' }
  }

  // Kiểm tra điều kiện: Đã hoàn tất ít nhất 1 đơn thuê bộ đồ này
  const { data: completedBooking, error: checkError } = await supabase
    .from('bookings')
    .select('id, status, rental_type')
    .eq('costume_id', payload.costume_id)
    .eq('user_id', user.id)
    .in('status', ['returned', 'deposit_refunded', 'inspecting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (checkError) {
    console.error('Lỗi kiểm tra đơn hoàn thành:', checkError.message)
  }

  if (!completedBooking) {
    return {
      success: false,
      error: 'Bạn chỉ có thể đánh giá sau khi hoàn tất đơn thuê (đã nhận và trả đồ) cho bộ trang phục này.',
    }
  }

  // Insert review
  const { error: insertError } = await supabase.from('reviews').insert({
    costume_id: payload.costume_id,
    user_id: user.id,
    booking_id: completedBooking.id,
    rating: payload.rating,
    comment: payload.comment.trim(),
    images: payload.images || [],
    rental_type: payload.rental_type || completedBooking.rental_type || 'fes',
  })

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  revalidatePath(`/products/${payload.costume_id}`)
  revalidatePath('/')
  return { success: true }
}
