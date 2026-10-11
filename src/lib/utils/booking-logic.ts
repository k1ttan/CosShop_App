import { createClient } from '@/lib/supabase/server'
import type { CheckOverlapParams } from '@/types/database'

const MAX_ACTIVE_BOOKINGS_PER_USER = 3

/**
 * Rule 1 + Rule 2: Kiểm tra overlap ngày có tính buffer_days
 */
export async function checkBookingOverlap({
  costume_id,
  start_date,
  end_date,
  exclude_booking_id,
}: CheckOverlapParams): Promise<{ hasOverlap: boolean; error?: string }> {
  const supabase = await createClient()

  // Lấy thông tin costume để biết quantity và buffer_days
  const { data: costume, error: costumeError } = await supabase
    .from('costumes')
    .select('quantity, buffer_days')
    .eq('id', costume_id)
    .single()

  if (costumeError || !costume) {
    return { hasOverlap: true, error: 'Không tìm thấy sản phẩm' }
  }

  const overlapQuery = () => {
    let query = supabase
      .from('bookings')
      .select('id')
      .eq('costume_id', costume_id)
      .in('status', ['confirmed', 'shipping', 'renting', 'overdue'])
      .lte('start_date', end_date)
      .gte('end_date', start_date)

    if (exclude_booking_id) {
      query = query.neq('id', exclude_booking_id)
    }

    return query
  }

  const { data: overlapping, error } = await overlapQuery().limit(Math.max(1, costume.quantity))
  if (error) {
    return { hasOverlap: true, error: 'Lỗi kiểm tra lịch' }
  }
  const activeCount = overlapping?.length ?? 0

  if (costume.quantity > 1) {
    // Rule 2 (quantity > 1): check if active bookings < quantity
    if (activeCount >= costume.quantity) {
      return {
        hasOverlap: true,
        error: `Tất cả ${costume.quantity} bộ trang phục này đã được đặt trong khoảng thời gian này`,
      }
    }
    return { hasOverlap: false }
  }

  const bufferDays = Math.max(3, costume.buffer_days ?? 3)

  // quantity = 1: check buffer_days
  if (activeCount > 0) {
    return {
      hasOverlap: true,
      error: 'Ngày này đã có người thuê, vui lòng chọn ngày khác',
    }
  }

  // 1. Kiểm tra đơn trước: từ ngày trả của đơn trước đến ngày nhận đồ của đơn này phải >= bufferDays
  const { data: previousConflict, error: prevError } = await supabase
    .from('bookings')
    .select('id, end_date')
    .eq('costume_id', costume_id)
    .in('status', ['confirmed', 'shipping', 'renting', 'returned', 'inspecting'])
    .lt('end_date', start_date)
    .gte(
      'end_date',
      new Date(
        new Date(start_date).getTime() - bufferDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0]
    )
    .limit(1)

  if (prevError) {
    return { hasOverlap: true, error: 'Lỗi kiểm tra thời gian vệ sinh' }
  }

  if (previousConflict && previousConflict.length > 0) {
    return {
      hasOverlap: true,
      error: `Cần khoảng cách ít nhất ${bufferDays} ngày từ ngày trả đơn trước đến ngày nhận để shop vệ sinh & chuẩn bị.`,
    }
  }

  // 2. Kiểm tra đơn sau: từ ngày trả của đơn này đến ngày nhận đồ của đơn sau cũng phải >= bufferDays
  const { data: nextConflict, error: nextError } = await supabase
    .from('bookings')
    .select('id, start_date')
    .eq('costume_id', costume_id)
    .in('status', ['confirmed', 'shipping', 'renting'])
    .gt('start_date', end_date)
    .lte(
      'start_date',
      new Date(
        new Date(end_date).getTime() + bufferDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0]
    )
    .limit(1)

  if (nextError) {
    return { hasOverlap: true, error: 'Lỗi kiểm tra lịch đơn tiếp theo' }
  }

  if (nextConflict && nextConflict.length > 0) {
    return {
      hasOverlap: true,
      error: `Đã có đơn đặt ngay sau đó. Cần cách ít nhất ${bufferDays} ngày sau ngày trả để shop xử lý đồ.`,
    }
  }

  return { hasOverlap: false }
}

/**
 * Rule 4: Kiểm tra số đơn active của user (tối đa 3)
 */
export async function checkUserActiveBookingLimit(
  user_id: string
): Promise<{ exceeded: boolean; count: number }> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .in('status', ['confirmed', 'shipping', 'renting'])

  const activeCount = count ?? 0
  return {
    exceeded: activeCount >= MAX_ACTIVE_BOOKINGS_PER_USER,
    count: activeCount,
  }
}

/**
 * Kiểm tra KYC trước khi cho phép booking
 */
export async function checkKycStatus(
  user_id: string
): Promise<{ verified: boolean; status: string }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('kyc_status')
    .eq('id', user_id)
    .single()

  return {
    verified: profile?.kyc_status === 'verified',
    status: profile?.kyc_status ?? 'unsubmitted',
  }
}
