'use client'

import React, { useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { lookupBooking, confirmBookingReceived } from '@/lib/supabase/actions'
import type { BookingWithDetails } from '@/types/database'
import { formatVND } from '@/lib/utils/helpers'
import { useChatStore } from '@/store/useChatStore'

const STEPS = [
  { key: 'pending', title: 'Đặt đơn', desc: 'Chờ shop duyệt' },
  { key: 'confirmed', title: 'Đã xác nhận', desc: 'Đã cọc & giữ lịch' },
  { key: 'shipping', title: 'Đang giao hàng', desc: 'Có mã vận đơn' },
  { key: 'renting', title: 'Đang thuê', desc: 'Khách đang giữ đồ' },
  { key: 'inspecting', title: 'Kiểm tra', desc: 'Shop nhận lại & kiểm tra' },
  { key: 'deposit_refunded', title: 'Hoàn tất', desc: 'Đã hoàn cọc' },
]

function getStepIndex(status: string): number {
  switch (status) {
    case 'pending':
      return 0
    case 'confirmed':
      return 1
    case 'shipping':
      return 2
    case 'renting':
      return 3
    case 'returned':
    case 'inspecting':
    case 'overdue':
      return 4
    case 'deposit_refunded':
    case 'deposit_withheld':
      return 5
    case 'cancelled':
      return -1
    default:
      return 0
  }
}

function TrackingContent() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code') || ''

  const [bookingCode, setBookingCode] = useState(initialCode)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [booking, setBooking] = useState<BookingWithDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Proof Modal state
  const [showProofModal, setShowProofModal] = useState(false)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [proofPreviews, setProofPreviews] = useState<string[]>([])
  const [proofNote, setProofNote] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!bookingCode.trim() || !phone.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Mã đơn hàng và Số điện thoại')
      return
    }

    setLoading(true)
    setErrorMessage(null)
    setSearched(true)

    try {
      const res = await lookupBooking(bookingCode, phone)
      if (res.success && res.booking) {
        setBooking(res.booking)
      } else {
        setBooking(null)
        setErrorMessage(res.error || 'Không tìm thấy đơn hàng phù hợp')
      }
    } catch (err: unknown) {
      setBooking(null)
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  // Chọn ảnh bằng chứng nhận đồ
  const handleSelectProofFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = 5 - proofFiles.length
    if (remainingSlots <= 0) {
      alert('Bạn chỉ có thể tải lên tối đa 5 hình ảnh')
      return
    }

    const selected = files.slice(0, remainingSlots)
    const newFiles = [...proofFiles, ...selected]
    setProofFiles(newFiles)

    const newPreviews = selected.map((f) => URL.createObjectURL(f))
    setProofPreviews((prev) => [...prev, ...newPreviews])

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveProofFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index))
    setProofPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConfirmReceived = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!booking) return

    if (proofFiles.length === 0) {
      setProofError('Vui lòng tải lên ít nhất 1 ảnh tình trạng đồ khi nhận hàng')
      return
    }

    setSubmittingProof(true)
    setProofError(null)

    try {
      const uploadedUrls: string[] = []
      for (const file of proofFiles) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bookingId', booking.id)

        const res = await fetch('/api/bookings/upload-proof', {
          method: 'POST',
          body: fd,
        })
        const data = await res.json()
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Lỗi tải ảnh lên')
        }
        uploadedUrls.push(data.url)
      }

      const result = await confirmBookingReceived({
        bookingId: booking.id,
        receivedImages: uploadedUrls,
        receivedNote: proofNote,
        phone,
      })

      if (!result.success) {
        throw new Error(result.error || 'Lỗi cập nhật trạng thái')
      }

      setShowProofModal(false)
      setProofFiles([])
      setProofPreviews([])
      setProofNote('')
      // Tải lại dữ liệu đơn hàng
      handleLookup()
    } catch (err: unknown) {
      setProofError(err instanceof Error ? err.message : 'Lỗi xử lý')
    } finally {
      setSubmittingProof(false)
    }
  }

  const currentStep = booking ? getStepIndex(booking.status) : 0
  const costumeImg = booking?.costume?.image_urls?.[0] || '/placeholder.png'

  return (
    <div className="min-h-screen bg-rose-50/30 dark:bg-[#141118] text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black text-zinc-500 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
          >
            <span>← Quay lại Trang Chủ</span>
          </Link>

          <Link
            href="/profile/bookings"
            className="text-xs font-black text-rose-600 dark:text-pink-400 hover:underline flex items-center gap-1"
          >
            <span>📦 Xem đơn của tôi</span>
          </Link>
        </div>

        {/* Lookup Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1a1522] border-2 border-rose-200/80 dark:border-pink-950/80 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-pink-400/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-pink-950 text-rose-700 dark:text-pink-300 text-[11px] font-black uppercase tracking-wider">
              <span>🔍 Tra Cứu Trực Tuyến</span>
            </div>

            <div>
              <h1 className="font-serif font-black text-2xl text-zinc-900 dark:text-zinc-100">
                Tra Cứu Tình Trạng Đơn Hàng
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">
                Dành cho cả khách vãng lai và thành viên. Nhập mã đơn hàng và số điện thoại để xem hành trình vận chuyển thời gian thực.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLookup} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    Mã đơn hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bookingCode}
                    onChange={(e) => setBookingCode(e.target.value)}
                    placeholder="Ví dụ: A1B2C3D4 hoặc d7f6..."
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-xs focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    Số điện thoại đặt đơn <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-xs focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold">
                  ⚠ {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-101 transition-all disabled:opacity-50"
              >
                {loading ? 'Đang tra cứu...' : 'Tra Cứu Tiến Trình Đơn Hàng 🔍'}
              </button>
            </form>
          </div>
        </div>

        {/* Search Result */}
        {searched && booking && (
          <div className="bg-white dark:bg-[#1a1522] border-2 border-rose-200/80 dark:border-pink-950/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 dark:border-pink-950/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-black text-purple-600 dark:text-purple-400">
                  #{booking.id.slice(0, 8).toUpperCase()}
                </span>
                {booking.rental_type && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    {booking.rental_type === 'test' ? '🏠 Gói Test Nhà' : '🎪 Gói Đi Fes/Shoot'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 font-semibold">
                Khách: <strong className="text-zinc-700 dark:text-zinc-300">{booking.profile?.full_name}</strong>
              </div>
            </div>

            {/* Costume Summary & Price */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative w-20 h-24 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 border border-rose-200 dark:border-pink-900/60">
                <Image
                  src={costumeImg}
                  alt={booking.costume?.name || 'Costume'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[11px] font-bold text-pink-600 dark:text-pink-400">
                  {booking.costume?.series}
                </div>
                <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100 truncate">
                  {booking.costume?.character}
                </h3>
                <div className="text-xs text-zinc-500 font-medium">
                  Lịch thuê: <span className="font-bold text-zinc-800 dark:text-zinc-200">{booking.start_date}</span> ➔{' '}
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{booking.end_date}</span>
                </div>
              </div>

              <div className="sm:text-right bg-rose-50/70 dark:bg-pink-950/30 p-3 rounded-2xl border border-rose-100 dark:border-pink-900/40">
                <div className="text-xs text-zinc-500">
                  Tiền thuê: <span className="font-bold">{formatVND(booking.total_rent_fee)}</span>
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  Cọc: {formatVND(booking.deposit_fee)}
                </div>
                <div className="text-xs font-black text-purple-600 dark:text-purple-400 mt-0.5">
                  Tổng thanh toán: {formatVND(booking.total_amount)}
                </div>
              </div>
            </div>

            {/* 🚚 DELIVERY & CARRIER CARD */}
            {booking.status === 'shipping' && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50/50 to-indigo-50/30 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/20 border-2 border-sky-200 dark:border-sky-800 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl animate-bounce">🚚</span>
                    <div>
                      <span className="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider block">
                        Đang Được Giao Qua Bên Thứ 3
                      </span>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Đơn vị vận chuyển: <strong className="text-zinc-900 dark:text-zinc-100">{booking.carrier_name || 'Đơn vị vận chuyển'}</strong>
                      </p>
                    </div>
                  </div>

                  {booking.tracking_url && (
                    <a
                      href={booking.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-colors shadow-xs"
                    >
                      <span>Tra cứu trực tiếp trên ĐVVC ↗</span>
                    </a>
                  )}
                </div>

                {booking.tracking_number && (
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900 text-xs">
                    <span className="text-zinc-500 font-semibold">Mã vận đơn:</span>
                    <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm tracking-wider">
                      {booking.tracking_number}
                    </span>
                  </div>
                )}

                {/* Confirm receive button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-sky-200/60 dark:border-sky-900/60">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    📦 Shipper đã giao đồ cho bạn? Bấm nút để xác nhận nhận hàng:
                  </p>
                  <button
                    onClick={() => {
                      setShowProofModal(true)
                      setProofFiles([])
                      setProofPreviews([])
                      setProofNote('')
                      setProofError(null)
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-black shadow-md hover:scale-102 transition-transform flex items-center justify-center gap-1.5"
                  >
                    <span>📸 Xác Nhận Đã Nhận Đồ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Proof images preview if already received */}
            {booking.received_images && booking.received_images.length > 0 && (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <span>✅ Đã xác nhận nhận đồ</span>
                    {booking.received_at && (
                      <span className="text-[10px] text-zinc-500 font-normal">
                        ({new Date(booking.received_at).toLocaleString('vi-VN')})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-bold">
                    {booking.received_images.length} ảnh kiểm tra
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {booking.received_images.map((img, i) => (
                    <a
                      key={i}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="relative w-16 h-20 rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-700 flex-shrink-0 group"
                    >
                      <img src={img} alt={`Proof ${i}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold">
                        Phóng to
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Stepper */}
            <div className="pt-2">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                {STEPS.map((step, idx) => {
                  const isDone = currentStep >= idx
                  const isCurrent = currentStep === idx

                  return (
                    <div
                      key={step.key}
                      className={`p-2 rounded-xl transition-all ${
                        isCurrent
                          ? 'bg-pink-100/80 dark:bg-pink-950/80 border-2 border-pink-500 text-pink-700 dark:text-pink-300 shadow-sm'
                          : isDone
                          ? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                          : 'opacity-40 text-zinc-400'
                      }`}
                    >
                      <div className="text-base mb-0.5">
                        {isDone ? (idx === 5 ? '💖' : '✅') : '⚪'}
                      </div>
                      <div className="text-[11px] font-black truncate">{step.title}</div>
                      <div className="text-[9px] text-zinc-400 font-medium hidden sm:block truncate">
                        {step.desc}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 💬 NÚT HỎI SHOP VỀ ĐƠN HÀNG */}
            <div className="pt-3 border-t border-rose-100 dark:border-pink-950/40 flex items-center justify-between text-xs">
              <span className="text-[11px] text-zinc-400 font-semibold">
                Mã đơn: #{booking.id.slice(0, 8).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => {
                  useChatStore.getState().openWithContext({
                    type: 'booking',
                    id: booking.id,
                    title: `Đơn thuê #${booking.id.slice(0, 8).toUpperCase()}`,
                    subtitle: `${booking.costume?.character || 'Trang phục'} (${booking.start_date} - ${booking.end_date})`,
                    image: costumeImg,
                    price: booking.total_amount,
                    status: booking.status,
                  })
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/50 dark:hover:bg-pink-900/60 text-pink-600 dark:text-pink-400 font-bold transition-colors shadow-2xs"
              >
                <span>💬</span>
                <span>Trò chuyện cùng shop về đơn này</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL XÁC NHẬN ĐÃ NHẬN HÀNG ── */}
      {showProofModal && booking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowProofModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-rose-100 dark:border-pink-950/60 bg-rose-50/70 dark:bg-pink-950/40">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100">
                    Xác Nhận Đã Nhận Hàng
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-bold">
                    Đơn: #{booking.id.slice(0, 8).toUpperCase()} • SĐT: {phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProofModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReceived} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                💡 <strong>Mẹo nhỏ:</strong> Bạn vui lòng chụp từ 1 đến 5 ảnh tổng thể gói hàng, phụ kiện và tình trạng đồ lúc mở hộp để bảo vệ quyền lợi hoàn cọc 100% của bạn nhé!
              </div>

              {/* Upload Input & Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">
                    📸 Ảnh tình trạng đồ lúc nhận ({proofFiles.length}/5 ảnh) <span className="text-red-500">*</span>
                  </label>
                  {proofFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-black text-pink-600 dark:text-pink-400 hover:underline"
                    >
                      + Chọn thêm ảnh
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSelectProofFiles}
                  className="hidden"
                />

                {proofPreviews.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-rose-300 dark:border-pink-800 rounded-2xl p-6 text-center cursor-pointer hover:bg-rose-50/50 dark:hover:bg-pink-950/30 transition-colors"
                  >
                    <span className="text-3xl block mb-1">📷</span>
                    <p className="font-bold text-zinc-700 dark:text-zinc-300">
                      Bấm vào đây để chọn ảnh chụp gói đồ
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Hỗ trợ tối đa 5 ảnh (JPG, PNG, WebP)
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {proofPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-rose-200 dark:border-pink-800 group"
                      >
                        <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveProofFile(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black shadow"
                          title="Xóa ảnh này"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {proofPreviews.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[3/4] rounded-xl border-2 border-dashed border-rose-300 dark:border-pink-800 flex flex-col items-center justify-center text-zinc-400 hover:text-pink-600 transition-colors"
                      >
                        <span className="text-xl">+</span>
                        <span className="text-[10px] font-bold">Thêm ảnh</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Note input */}
              <div className="space-y-1">
                <label className="font-black text-zinc-700 dark:text-zinc-300">
                  Ghi chú thêm về đồ lúc nhận (không bắt buộc)
                </label>
                <textarea
                  rows={2}
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Ví dụ: Đã nhận đủ đồ, phụ kiện nguyên vẹn..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>

              {proofError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold">
                  ⚠ {proofError}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-rose-100 dark:border-pink-950/60">
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-black uppercase tracking-wider transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={submittingProof || proofFiles.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-md"
                >
                  {submittingProof ? 'Đang gửi...' : 'Hoàn Tất Nhận Hàng 💖'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen py-16 text-center text-xs text-zinc-500">
          Đang tải trang tra cứu...
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  )
}
