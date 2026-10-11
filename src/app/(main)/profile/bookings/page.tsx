'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getMyBookings, confirmBookingReceived } from '@/lib/supabase/actions'
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

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'shipping' | 'renting' | 'completed'>('all')

  // Modal xác nhận nhận hàng
  const [receivingBooking, setReceivingBooking] = useState<BookingWithDetails | null>(null)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [proofPreviews, setProofPreviews] = useState<string[]>([])
  const [proofNote, setProofNote] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBookings = useCallback(async () => {
    try {
      const data = await getMyBookings()
      setBookings(data)
    } catch (err) {
      console.error('Failed to load bookings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()

    // Supabase Realtime Subscription cho trạng thái đơn hàng
    const supabase = createClient()
    const channel = supabase
      .channel('my-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBookings])

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

    // Tạo preview URLs
    const newPreviews = selected.map((f) => URL.createObjectURL(f))
    setProofPreviews((prev) => [...prev, ...newPreviews])

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveProofFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index))
    setProofPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  // Xác nhận đã nhận hàng
  const handleConfirmReceived = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receivingBooking) return

    if (proofFiles.length === 0) {
      setErrorMessage('Vui lòng chụp ít nhất 1 ảnh tình trạng đồ khi nhận hàng')
      return
    }

    setSubmittingProof(true)
    setErrorMessage(null)

    try {
      // 1. Upload từng ảnh lên API
      const uploadedUrls: string[] = []
      for (const file of proofFiles) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bookingId', receivingBooking.id)

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

      // 2. Gọi Server Action confirmBookingReceived
      const result = await confirmBookingReceived({
        bookingId: receivingBooking.id,
        receivedImages: uploadedUrls,
        receivedNote: proofNote,
      })

      if (!result.success) {
        throw new Error(result.error || 'Lỗi cập nhật trạng thái')
      }

      setReceivingBooking(null)
      setProofFiles([])
      setProofPreviews([])
      setProofNote('')
      fetchBookings()
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi xử lý')
    } finally {
      setSubmittingProof(false)
    }
  }

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'shipping') return b.status === 'shipping'
    if (activeTab === 'renting') return b.status === 'renting'
    if (activeTab === 'completed')
      return ['deposit_refunded', 'deposit_withheld', 'cancelled'].includes(b.status)
    return true
  })

  return (
    <div className="min-h-screen bg-rose-50/30 dark:bg-[#141118] text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black text-zinc-500 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
          >
            <span>← Quay lại Trang Chủ</span>
          </Link>

          <Link
            href="/tracking"
            className="text-xs font-black text-rose-600 dark:text-pink-400 hover:underline flex items-center gap-1"
          >
            <span>🔍 Tra cứu đơn bằng Mã</span>
          </Link>
        </div>

        {/* Title Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1a1522] border-2 border-rose-200/80 dark:border-pink-950/80 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-400/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-pink-950 text-rose-700 dark:text-pink-300 text-[11px] font-black uppercase tracking-wider mb-2">
                <span>📦 Quản Lý Đơn Đặt Thuê</span>
              </div>
              <h1 className="font-serif font-black text-2xl sm:text-3xl text-zinc-900 dark:text-zinc-100">
                Tình Trạng Đơn Hàng
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">
                Theo dõi tiến trình từ lúc đặt đơn, mã vận đơn bên thứ 3 và cập nhật nhận đồ thời gian thực.
              </p>
            </div>

            <button
              onClick={fetchBookings}
              className="self-start sm:self-auto px-4 py-2 rounded-xl border-2 border-pink-200 dark:border-pink-900 text-xs font-black text-pink-600 dark:text-pink-400 hover:bg-rose-50 dark:hover:bg-pink-950/40 transition-colors flex items-center gap-1.5"
            >
              <span>🔄 Làm mới</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none text-xs font-black">
            {[
              { id: 'all', label: `Tất cả (${bookings.length})` },
              {
                id: 'shipping',
                label: `Đang giao (${bookings.filter((b) => b.status === 'shipping').length})`,
              },
              {
                id: 'renting',
                label: `Đang thuê (${bookings.filter((b) => b.status === 'renting').length})`,
              },
              {
                id: 'completed',
                label: `Đã xong (${
                  bookings.filter((b) =>
                    ['deposit_refunded', 'deposit_withheld', 'cancelled'].includes(b.status)
                  ).length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <span className="text-3xl animate-spin block mb-2">🌸</span>
            <p className="text-xs text-zinc-500 font-semibold">Đang tải lịch sử đơn hàng...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredBookings.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-[#1a1522] rounded-3xl border-2 border-dashed border-rose-200 dark:border-pink-950/80 p-8 space-y-3">
            <span className="text-4xl block">👘</span>
            <h3 className="font-serif font-black text-lg text-zinc-800 dark:text-zinc-200">
              Chưa có đơn đặt thuê nào
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Hãy khám phá bộ sưu tập trang phục cosplay xinh xắn và chọn bộ đồ yêu thích ngay nhé!
            </p>
            <Link
              href="/"
              className="inline-flex px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-black shadow-md hover:scale-105 transition-transform"
            >
              🌸 Khám phá trang phục ngay
            </Link>
          </div>
        )}

        {/* Bookings List */}
        {!loading && filteredBookings.length > 0 && (
          <div className="space-y-6">
            {filteredBookings.map((b) => {
              const currentStep = getStepIndex(b.status)
              const costumeImg = b.costume?.image_urls?.[0] || '/placeholder.png'

              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-[#1a1522] border-2 border-rose-200/80 dark:border-pink-950/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 transition-all hover:border-pink-300 dark:hover:border-pink-800"
                >
                  {/* Top Bar: Order ID & Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 dark:border-pink-950/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-black text-purple-600 dark:text-purple-400">
                        #{b.id.slice(0, 8).toUpperCase()}
                      </span>
                      {b.rental_type && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          {b.rental_type === 'test' ? '🏠 Gói Test Nhà' : '🎪 Gói Đi Fes/Shoot'}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 font-semibold">
                      Ngày đặt: {new Date(b.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>

                  {/* Costume Summary & Price */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="relative w-20 h-24 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 border border-rose-200 dark:border-pink-900/60">
                      <Image
                        src={costumeImg}
                        alt={b.costume?.name || 'Costume'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400">
                          {b.costume?.series}
                        </span>
                        {b.costume?.brand && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold">
                            Hãng: {b.costume.brand}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100 truncate">
                        {b.costume?.character}
                      </h3>
                      <div className="text-xs text-zinc-500 font-medium">
                        Khoảng thuê: <span className="font-bold text-zinc-800 dark:text-zinc-200">{b.start_date}</span> ➔{' '}
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{b.end_date}</span>
                      </div>
                    </div>

                    {/* Pricing Pill */}
                    <div className="sm:text-right bg-rose-50/70 dark:bg-pink-950/30 p-3 rounded-2xl border border-rose-100 dark:border-pink-900/40">
                      <div className="text-xs text-zinc-500">
                        Tiền thuê: <span className="font-bold">{formatVND(b.total_rent_fee)}</span>
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        Cọc bảo chứng: {formatVND(b.deposit_fee)}
                      </div>
                      <div className="text-xs font-black text-purple-600 dark:text-purple-400 mt-0.5">
                        Tổng tiền: {formatVND(b.total_amount)}
                      </div>
                    </div>
                  </div>

                  {/* 🚚 DELIVERY & CARRIER TRACKING CARD (NỔI BẬT) */}
                  {b.status === 'shipping' && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50/50 to-indigo-50/30 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/20 border-2 border-sky-200 dark:border-sky-800 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl animate-bounce">🚚</span>
                          <div>
                            <span className="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider block">
                              Đơn Hàng Đang Được Vận Chuyển
                            </span>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              Đơn vị: <strong className="text-zinc-900 dark:text-zinc-100">{b.carrier_name || 'Bên thứ 3'}</strong>
                            </p>
                          </div>
                        </div>

                        {b.tracking_url && (
                          <a
                            href={b.tracking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-colors shadow-xs"
                          >
                            <span>Tra cứu hành trình đơn ↗</span>
                          </a>
                        )}
                      </div>

                      {b.tracking_number && (
                        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900 text-xs">
                          <span className="text-zinc-500 font-semibold">Mã vận đơn:</span>
                          <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm tracking-wider">
                            {b.tracking_number}
                          </span>
                        </div>
                      )}

                      {/* Action Button: ĐÃ NHẬN ĐỒ */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-sky-200/60 dark:border-sky-900/60">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          📦 Bạn đã nhận được gói đồ từ shipper? Hãy xác nhận kèm ảnh kiểm tra nhé:
                        </p>
                        <button
                          onClick={() => {
                            setReceivingBooking(b)
                            setProofFiles([])
                            setProofPreviews([])
                            setProofNote('')
                            setErrorMessage(null)
                          }}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-black shadow-md hover:scale-102 transition-transform flex items-center justify-center gap-1.5"
                        >
                          <span>📸 Xác Nhận Đã Nhận Hàng</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Khi khách đã nhận hàng (status: renting / returned / ...) */}
                  {b.received_images && b.received_images.length > 0 && (
                    <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                          <span>✅ Khách đã xác nhận nhận đồ</span>
                          {b.received_at && (
                            <span className="text-[10px] text-zinc-500 font-normal">
                              ({new Date(b.received_at).toLocaleString('vi-VN')})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-emerald-600 font-bold">
                          {b.received_images.length} ảnh kiểm tra
                        </span>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {b.received_images.map((img, i) => (
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

                  {/* 📍 REAL-TIME TIMELINE STEPPER (6 BƯỚC) */}
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

                  {/* 💬 NÚT HỎI SHOP VỀ ĐƠN NÀY */}
                  <div className="pt-3 border-t border-rose-100 dark:border-pink-950/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-400 font-semibold">
                      Mã đơn: #{b.id.slice(0, 8).toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        useChatStore.getState().openWithContext({
                          type: 'booking',
                          id: b.id,
                          title: `Đơn thuê #${b.id.slice(0, 8).toUpperCase()}`,
                          subtitle: `${b.costume?.character || 'Trang phục'} (${b.start_date} - ${b.end_date})`,
                          image: b.costume?.image_urls?.[0],
                          price: b.total_amount,
                          status: b.status,
                        })
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/50 dark:hover:bg-pink-900/60 text-pink-600 dark:text-pink-400 font-bold transition-colors shadow-2xs"
                    >
                      <span>💬</span>
                      <span>Hỏi shop về đơn này</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL XÁC NHẬN ĐÃ NHẬN HÀNG (UPLOAD ẢNH UNBOX) ── */}
      {receivingBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setReceivingBooking(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-rose-100 dark:border-pink-950/60 bg-rose-50/70 dark:bg-pink-950/40">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100">
                    Xác Nhận Đã Nhận Hàng
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-bold">
                    Đơn: #{receivingBooking.id.slice(0, 8).toUpperCase()} • {receivingBooking.costume?.character}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReceivingBooking(null)}
                className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmReceived} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                💡 <strong>Mẹo nhỏ:</strong> Bạn vui lòng chụp từ 1 đến 5 ảnh tổng thể gói hàng, phụ kiện và tình trạng vải lúc mở hộp. Đây là bằng chứng quan trọng giúp shop đối soát và hoàn cọc 100% nhanh chóng cho bạn khi trả đồ!
              </div>

              {/* Upload input & Preview Grid */}
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
                  placeholder="Ví dụ: Đã nhận đủ váy, tóc giả, nơ cổ; đồ sạch sẽ thơm tho..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold">
                  ⚠ {errorMessage}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-rose-100 dark:border-pink-950/60">
                <button
                  type="button"
                  onClick={() => setReceivingBooking(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-black uppercase tracking-wider transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={submittingProof || proofFiles.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-md"
                >
                  {submittingProof ? 'Đang tải ảnh lên...' : 'Hoàn Tất Nhận Hàng 💖'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
