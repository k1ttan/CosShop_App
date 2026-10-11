'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { formatVND } from '@/lib/utils/helpers'
import type { BookingWithDetails } from '@/lib/supabase/queries'
import { POPULAR_CARRIERS } from '@/lib/constants/carriers'

interface OrderDetailModalProps {
  booking: BookingWithDetails | null
  onClose: () => void
  onStatusTransition: (bookingId: string, newStatus: string) => Promise<void>
  onShipBooking: (bookingId: string, carrierName: string, trackingNumber: string, trackingUrl?: string) => Promise<void>
  onToggleArchive: (bookingId: string, archive: boolean) => Promise<void>
}

const STEPPER_STAGES = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'renting', label: 'Đang thuê' },
  { key: 'returned', label: 'Đã trả đồ' },
  { key: 'inspecting', label: 'Kiểm tra' },
  { key: 'finished', label: 'Hoàn tất' },
]

function getStageIndex(status: string) {
  switch (status) {
    case 'pending': return 0
    case 'confirmed': return 1
    case 'shipping': return 2
    case 'renting': return 3
    case 'returned': return 4
    case 'inspecting': return 5
    case 'deposit_refunded':
    case 'deposit_withheld':
    case 'cancelled': return 6
    case 'overdue': return 3
    default: return 0
  }
}

export function OrderDetailModal({
  booking,
  onClose,
  onStatusTransition,
  onShipBooking,
  onToggleArchive,
}: OrderDetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false)
  const [showShippingForm, setShowShippingForm] = useState(false)
  const [carrierId, setCarrierId] = useState('ghn')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  if (!booking) return null

  const isClosed = ['deposit_refunded', 'deposit_withheld', 'cancelled'].includes(booking.status)
  const isArchived = Boolean(booking.is_archived || (isClosed && booking.is_archived !== false))
  const isSelfPickup = booking.shipping_method === 'self_pickup'
  const stageIdx = getStageIndex(booking.status)

  const handleTransition = async (newStatus: string) => {
    setActionLoading(true)
    try {
      await onStatusTransition(booking.id, newStatus)
    } finally {
      setActionLoading(false)
    }
  }

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackingNumber.trim()) {
      alert('Vui lòng nhập mã vận đơn')
      return
    }

    const carrierObj = POPULAR_CARRIERS.find((c) => c.id === carrierId)
    const carrierName = carrierObj ? carrierObj.name : 'Đơn vị khác'
    const finalUrl = carrierObj ? carrierObj.getUrl(trackingNumber) : undefined

    setActionLoading(true)
    try {
      await onShipBooking(booking.id, carrierName, trackingNumber.trim(), finalUrl)
      setShowShippingForm(false)
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchiveToggle = async (targetArchive: boolean) => {
    setActionLoading(true)
    try {
      await onToggleArchive(booking.id, targetArchive)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900/60 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER MODAL */}
          <div className="flex items-start justify-between border-b pb-4 border-rose-100 dark:border-pink-950/80">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-black text-sm text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2.5 py-0.5 rounded-lg border border-pink-200 dark:border-pink-900/50">
                  #{booking.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">
                  Tạo ngày: {new Date(booking.created_at).toLocaleString('vi-VN')}
                </span>
                {isArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    📦 Đã lưu trữ
                  </span>
                )}
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
                Chi Tiết Đơn Hàng & Thao Tác Trạng Thái
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-rose-50 dark:bg-pink-950/60 text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300 flex items-center justify-center font-black transition-colors shrink-0"
              title="Đóng (Esc)"
            >
              ✕
            </button>
          </div>

          {/* STEPPER TIẾN TRÌNH ĐƠN HÀNG */}
          <div className="bg-rose-50/50 dark:bg-pink-950/20 p-3 sm:p-4 rounded-2xl border border-rose-100 dark:border-pink-900/40">
            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-2">
              Tiến trình xử lý đơn hàng:
            </span>
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
              {STEPPER_STAGES.map((st, idx) => {
                const isPassed = idx < stageIdx
                const isCurrent = idx === stageIdx
                return (
                  <div key={st.key} className="flex items-center gap-1 shrink-0">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black transition-all ${
                        isCurrent
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm ring-2 ring-pink-400/40 scale-105'
                          : isPassed
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400'
                      }`}
                    >
                      <span>{isPassed ? '✓' : idx + 1}</span>
                      <span>{st.label}</span>
                    </div>
                    {idx < STEPPER_STAGES.length - 1 && (
                      <span className="text-zinc-300 dark:text-zinc-700 text-xs px-0.5">➔</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* NỘI DUNG 2 CỘT: KHÁCH HÀNG & TRANG PHỤC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CỘT 1: THÔNG TIN KHÁCH HÀNG & GIAO HÀNG */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <span>👤</span> Thông tin Khách hàng
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  {booking.profile ? 'Thành viên' : 'Khách vãng lai'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-zinc-400 font-semibold block text-[11px]">Họ và tên:</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100 text-sm">
                    {booking.profile?.full_name || booking.guest_name || 'Khách vãng lai'}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 font-semibold block text-[11px]">Số điện thoại:</span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-sm">
                    {booking.profile?.phone || booking.guest_phone || 'Chưa cập nhật'}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 font-semibold block text-[11px]">Phương thức nhận đồ:</span>
                  <span className="font-black text-zinc-800 dark:text-zinc-200">
                    {booking.shipping_method === 'self_pickup'
                      ? '🏪 Tự đến Shop lấy đồ'
                      : booking.shipping_method === 'shop_delivery'
                      ? '🛵 Shop giao tận nơi'
                      : '📦 Bưu điện chuyển phát (GHN / GHTK...)'}
                  </span>
                </div>

                {booking.shipping_address && (
                  <div>
                    <span className="text-zinc-400 font-semibold block text-[11px]">Địa chỉ giao nhận:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {booking.shipping_address}
                    </span>
                  </div>
                )}
              </div>

              {/* THÔNG TIN VẬN CHUYỂN / MÃ VẬN ĐƠN */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                {isSelfPickup ? (
                  <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
                    <span className="text-xl">🏪</span>
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                        Khách đặt lấy tại quầy Shop (Self-pickup)
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Đơn hàng nhận trực tiếp tại shop — không yêu cầu đơn vị vận chuyển hay mã vận đơn. Admin có thể bấm nút bàn giao ngay tại quầy.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-sky-600 dark:text-sky-400">
                        🚚 Vận đơn bên thứ 3:
                      </span>
                      {!showShippingForm && (
                        <button
                          type="button"
                          onClick={() => setShowShippingForm(true)}
                          className="text-[10px] font-black text-pink-600 dark:text-pink-400 hover:underline"
                        >
                          {booking.tracking_number ? 'Sửa mã ✎' : '+ Nhập mã vận đơn'}
                        </button>
                      )}
                    </div>

                    {booking.carrier_name && booking.tracking_number ? (
                      <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-xs space-y-1">
                        <div className="font-black text-sky-800 dark:text-sky-200">
                          {booking.carrier_name}
                        </div>
                        <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          Mã: {booking.tracking_number}
                        </div>
                        {booking.tracking_url && (
                          <a
                            href={booking.tracking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-pink-600 dark:text-pink-400 font-black hover:underline inline-flex items-center gap-1 text-[11px]"
                          >
                            Tra cứu hành trình đơn ↗
                          </a>
                        )}
                      </div>
                    ) : !showShippingForm ? (
                      <p className="text-[11px] text-zinc-400 italic font-semibold">
                        Chưa có mã vận đơn bên thứ 3.
                      </p>
                    ) : null}

                    {/* FORM NHẬP / SỬA MÃ VẬN ĐƠN */}
                    {showShippingForm && (
                      <form onSubmit={handleShipSubmit} className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] font-black text-sky-800 dark:text-sky-300 block mb-1">
                            Đơn vị vận chuyển:
                          </label>
                          <select
                            value={carrierId}
                            onChange={(e) => setCarrierId(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 text-xs font-semibold"
                          >
                            {POPULAR_CARRIERS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-sky-800 dark:text-sky-300 block mb-1">
                            Mã vận đơn:
                          </label>
                          <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Nhập mã vận đơn (VD: GHN123456...)"
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 text-xs font-semibold"
                          />
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowShippingForm(false)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black text-[11px]"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px]"
                          >
                            {actionLoading ? 'Đang lưu...' : 'Lưu & Cập nhật'}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>

              {/* BẰNG CHỨNG NHẬN HÀNG (RECEIVED IMAGES) */}
              {booking.received_images && booking.received_images.length > 0 && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                    📸 Ảnh unbox / nhận hàng của khách ({booking.received_images.length}):
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {booking.received_images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setZoomImage(img)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-800 shrink-0 cursor-zoom-in group"
                      >
                        <Image src={img} alt="Received proof" fill className="object-cover group-hover:scale-110 transition-transform" />
                      </div>
                    ))}
                  </div>
                  {booking.received_note && (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold italic">
                      &quot;{booking.received_note}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* CỘT 2: THÔNG TIN TRANG PHỤC & BẢNG TÀI CHÍNH */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-black uppercase text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                  <span>👗</span> Trang Phục Thuê
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                  {booking.rental_type === 'test' ? '🏠 Gói Mặc Test' : '🎪 Gói Đi Fes'}
                </span>
              </div>

              {/* Thông tin bộ đồ */}
              <div className="flex gap-3 items-start">
                <div className="relative w-16 h-20 rounded-xl overflow-hidden shrink-0 border border-pink-200 dark:border-pink-900/60 bg-zinc-950">
                  <Image
                    src={booking.costume?.image_urls?.[0] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'}
                    alt={booking.costume?.name || 'Trang phục'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                    {booking.costume?.character}
                  </h4>
                  <p className="text-xs text-pink-600 dark:text-pink-400 font-bold truncate">
                    {booking.costume?.series}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-semibold truncate">
                    {booking.costume?.name}
                  </p>
                  {booking.costume?.brand && (
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 mt-0.5">
                      🏷️ {booking.costume.brand}
                    </span>
                  )}
                </div>
              </div>

              {/* Khoảng ngày */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs space-y-0.5">
                <span className="text-zinc-400 font-semibold block text-[10px]">Lịch thuê:</span>
                <div className="font-mono font-black text-zinc-900 dark:text-zinc-100">
                  {booking.start_date} ➔ {booking.end_date}
                </div>
              </div>

              {/* Bảng kê tài chính */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                  <span>Tiền thuê trang phục:</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">
                    {formatVND(booking.total_rent_fee)}
                  </span>
                </div>

                <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <span>Tiền cọc bảo chứng:</span>
                    <span className="text-[10px] text-emerald-500 font-black">(Hoàn 100%)</span>
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatVND(booking.deposit_fee)}
                  </span>
                </div>

                {booking.shipping_fee > 0 && (
                  <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                    <span>Phí vận chuyển:</span>
                    <span className="font-black text-zinc-900 dark:text-zinc-100">
                      {formatVND(booking.shipping_fee)}
                    </span>
                  </div>
                )}

                {booking.late_fee > 0 && (
                  <div className="flex justify-between font-black text-rose-600">
                    <span>Phạt quá hạn trả đồ:</span>
                    <span>+{formatVND(booking.late_fee)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200 dark:border-zinc-800 text-sm font-black">
                  <span>Tổng thanh toán:</span>
                  <span className="text-base text-pink-600 dark:text-pink-400 font-sans">
                    {formatVND(booking.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BAR: CHUYỂN TRẠNG THÁI & KHO LƯU TRỮ */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50/60 to-purple-50/60 dark:from-pink-950/30 dark:to-purple-950/30 border-2 border-rose-200 dark:border-pink-900/60 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                <span>⚡</span> Thao tác trạng thái đơn hàng:
              </span>
              <span className="text-[11px] font-bold text-zinc-500">
                Trạng thái hiện tại: <b className="text-purple-600 dark:text-purple-400">{booking.status}</b>
              </span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              {/* Nút hành động theo từng bước */}
              <div className="flex items-center gap-2 flex-wrap">
                {booking.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleTransition('confirmed')}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      ✓ Xác nhận đơn hàng
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleTransition('cancelled')}
                      className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-black text-xs transition-all disabled:opacity-50"
                    >
                      ✕ Hủy đơn
                    </button>
                  </>
                )}

                {booking.status === 'confirmed' && (
                  <>
                    {isSelfPickup ? (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition('shipping')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                          title="Bàn giao trang phục trực tiếp tại quầy"
                        >
                          <span>🏪 Bàn giao tại Shop (1-Click) ➔</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition('renting')}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                          title="Khách đã nhận đồ trực tiếp tại shop, chuyển sang trạng thái Đang thuê"
                        >
                          <span>📦 Khách đã nhận đồ (Đang thuê) ➔</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          if (!booking.tracking_number) {
                            setShowShippingForm(true)
                          } else {
                            handleTransition('shipping')
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                      >
                        🚚 Bàn giao cho ĐVVC ➔
                      </button>
                    )}
                  </>
                )}

                {booking.status === 'shipping' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleTransition('renting')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {isSelfPickup
                      ? '📦 Khách đã nhận đồ (Chuyển sang Đang thuê) ➔'
                      : '📦 Khách đã nhận đồ từ shipper (Đang thuê) ➔'}
                  </button>
                )}

                {booking.status === 'renting' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleTransition('returned')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    ↩ Khách đã gửi trả đồ về shop ➔
                  </button>
                )}

                {booking.status === 'returned' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleTransition('inspecting')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    🔍 Bắt đầu kiểm tra phụ kiện & vải ➔
                  </button>
                )}

                {booking.status === 'inspecting' && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleTransition('deposit_refunded')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      💰 Hoàn cọc 100% cho khách (Đóng đơn)
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleTransition('deposit_withheld')}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      ⚠️ Giữ cọc (Hư tổn / mất đồ)
                    </button>
                  </>
                )}

                {booking.status === 'overdue' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleTransition('returned')}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    🚨 Đã thu hồi đồ trễ hạn ➔
                  </button>
                )}

                {isClosed && (
                  <span className="text-xs font-bold text-zinc-500 italic">
                    ✓ Đơn hàng đã kết thúc chu trình
                  </span>
                )}
              </div>

              {/* Nút Kho Lưu Trữ */}
              <div className="flex items-center gap-2">
                {isArchived ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleArchiveToggle(false)}
                    className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black text-xs transition-all flex items-center gap-1.5"
                    title="Khôi phục đơn ra khỏi kho lưu trữ"
                  >
                    <span>↩</span>
                    <span>Khôi phục đơn</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleArchiveToggle(true)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white font-black text-xs transition-all flex items-center gap-1.5 shadow-sm"
                    title="Đưa đơn vào kho lưu trữ"
                  >
                    <span>📦</span>
                    <span>Đưa vào lưu trữ</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-black text-xs hover:bg-rose-50 transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP PHÓNG TO ẢNH UNBOX NẾU CLICK */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in select-none"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={zoomImage} alt="Zoomed proof" className="max-w-[85vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center font-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
