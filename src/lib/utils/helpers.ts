import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format tiền tệ VND
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export const formatVND = formatCurrency


/**
 * Format ngày tháng kiểu Việt Nam
 */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

/**
 * Tính số ngày giữa 2 ngày (bao gồm cả ngày đầu và ngày cuối)
 */
export function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Tính số ngày thuê tính tiền (Chargeable Rental Days):
 * Logic: Không tính ngày nhận và trả đồ.
 * - Tổng ngày chiếm lịch = differenceInDays(end, start) + 1
 * - Nếu khoảng chiếm lịch >= 3 ngày: Số ngày tính tiền = (Ngày trả - Ngày nhận - 1)
 *   (Ví dụ: Nhận ngày 1, Trả ngày 5 -> chiếm 5 ngày -> trừ ngày 1 và ngày 5 còn 3 ngày tính tiền: 5 - 1 - 1 = 3 ngày)
 * - Nếu khoảng chiếm lịch là 1 ngày (nhận & trả cùng ngày) hoặc 2 ngày (nhận ngày 1, trả ngày 2): Tính tối thiểu 1 ngày thuê.
 */
export function calcChargeableRentalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 1) {
    return 1 // Thuê cùng ngày hoặc 2 ngày liên tiếp -> tính tối thiểu 1 ngày
  }
  // Loại trừ ngày nhận và trả đồ
  return diffDays - 1
}

/**
 * Tính tổng tiền thuê (áp dụng công thức không tính ngày nhận và trả)
 */
export function calcTotalRentFee(pricePerDay: number, startDate: string, endDate: string): number {
  const chargeableDays = calcChargeableRentalDays(startDate, endDate)
  return chargeableDays * pricePerDay
}

/**
 * Tính late fee
 * Rule 3: late_fee = số_ngày_trễ × rent_price_per_day × late_fee_multiplier
 */
export function calcLateFee(
  pricePerDay: number,
  endDate: string,
  multiplier: number = 1.5
): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  if (today <= end) return 0
  const overdueDays = getDaysBetween(endDate, today.toISOString().split('T')[0])
  return overdueDays * pricePerDay * multiplier
}

/**
 * Tính refund amount theo Rule 5
 */
export function calcRefundAmount(
  depositFee: number,
  cancelledBy: 'user' | 'admin',
  startDate: string
): number {
  if (cancelledBy === 'admin') return depositFee // 100% refund

  const start = new Date(startDate)
  const now = new Date()
  const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursUntilStart >= 48) return depositFee * 0.8 // 80% refund
  return 0 // 0% refund within 48h
}

/**
 * Map booking status sang label tiếng Việt
 */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  renting: 'Đang thuê',
  returned: 'Đã trả',
  inspecting: 'Đang kiểm tra',
  deposit_refunded: 'Đã hoàn cọc',
  deposit_withheld: 'Giữ cọc',
  cancelled: 'Đã huỷ',
  overdue: 'Quá hạn',
}

export const KYC_STATUS_LABELS: Record<string, string> = {
  unsubmitted: 'Chưa xác minh',
  pending: 'Đang chờ duyệt',
  verified: 'Đã xác minh',
  rejected: 'Bị từ chối',
}
