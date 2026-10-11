'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Costume, ReviewWithAuthor } from '@/types/database'
import { formatVND } from '@/lib/utils/helpers'
import { useCartStore } from '@/store/useCartStore'
import { useChatStore } from '@/store/useChatStore'
import { ScheduleView, BookingInterval } from '@/components/booking/ScheduleView'
import { ProductReviews } from './ProductReviews'

interface ProductDetailViewProps {
  costume: Costume
  initialBookings: BookingInterval[]
  initialReviews: ReviewWithAuthor[]
  canReview: boolean
  reviewReason?: string
  isLoggedIn: boolean
}

export function ProductDetailView({
  costume,
  initialBookings,
  initialReviews,
  canReview,
  reviewReason,
  isLoggedIn,
}: ProductDetailViewProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)

  const [activeImgIndex, setActiveImgIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [selectedRentalType, setSelectedRentalType] = useState<'test' | 'fes'>('fes')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(true)

  const images = costume.image_urls && costume.image_urls.length > 0
    ? costume.image_urls
    : ['https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800']

  const testPrice = costume.rent_price_per_day
  const fesPrice = costume.rent_price_fes ?? (Math.round((testPrice * 1.4) / 10000) * 10000)
  const currentDailyPrice = selectedRentalType === 'test' ? testPrice : fesPrice
  const effectiveBufferDays = Math.max(3, costume.buffer_days ?? 3)

  // Lightbox key controls
  const handleNextImage = useCallback(() => {
    setActiveImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  const handlePrevImage = useCallback(() => {
    setActiveImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  useEffect(() => {
    if (!isLightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
      if (e.key === 'ArrowRight') handleNextImage()
      if (e.key === 'ArrowLeft') handlePrevImage()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLightboxOpen, handleNextImage, handlePrevImage])

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Thêm vào giỏ hàng
  const handleAddToCart = () => {
    addItem({
      costume,
      rentalType: selectedRentalType,
      startDate: '',
      endDate: '',
      rentalDays: 1,
      totalRentFee: currentDailyPrice,
      depositFee: costume.deposit_price,
      shippingMethod: 'self_pickup',
      shippingFee: 0,
    })
    triggerToast('Đã thêm trang phục vào giỏ hàng thành công! 🌸')
  }

  // Đặt thuê ngay (chuyển sang trang /checkout)
  const handleRentNow = () => {
    // Đảm bảo item có trong giỏ hàng
    addItem({
      costume,
      rentalType: selectedRentalType,
      startDate: '',
      endDate: '',
      rentalDays: 1,
      totalRentFee: currentDailyPrice,
      depositFee: costume.deposit_price,
      shippingMethod: 'self_pickup',
      shippingFee: 0,
    })
    router.push(`/checkout?costumeId=${costume.id}&rentalType=${selectedRentalType}`)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-top duration-300">
          <span className="text-emerald-400">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-zinc-500 pt-2">
        <Link href="/" className="hover:text-pink-600 transition-colors flex items-center gap-1">
          <span>🏠</span>
          <span>Trang chủ</span>
        </Link>
        <span>/</span>
        <span className="text-pink-600 dark:text-pink-400 font-bold">{costume.series}</span>
        <span>/</span>
        <span className="text-zinc-800 dark:text-zinc-200 font-bold truncate max-w-[200px]">
          {costume.character}
        </span>
      </nav>

      {/* MAIN TOP SECTION: 2 COLUMNS (GALLERY & DETAILS/BUY) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CỘT TRÁI (5/12): GALLERY ẢNH */}
        <div className="lg:col-span-6 space-y-3">
          {/* Main big preview */}
          <div
            onClick={() => setIsLightboxOpen(true)}
            className="relative aspect-[4/3] sm:aspect-[1/1] w-full rounded-3xl overflow-hidden bg-rose-50 dark:bg-zinc-950 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md cursor-zoom-in group"
            title="Bấm để phóng to ảnh xem chi tiết"
          >
            <Image
              src={images[activeImgIndex]}
              alt={costume.name}
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none" />

            {/* Badges on top */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
              {costume.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-black/60 backdrop-blur-md text-white text-[11px] font-black px-3 py-1 rounded-full border border-white/20"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Indicator Phóng to */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md text-xs font-black text-white pointer-events-none">
              <span>🔍 Phóng to</span>
              <span className="text-white/60">
                ({activeImgIndex + 1}/{images.length})
              </span>
            </div>

            {/* Mũi tên qua lại */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevImage()
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-pink-600 text-white flex items-center justify-center text-xl font-black transition-all"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNextImage()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-pink-600 text-white flex items-center justify-center text-xl font-black transition-all"
                >
                  ›
                </button>
              </>
            )}
          </div>

          {/* Dải thumbnail */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto p-1.5 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-200/60 dark:border-pink-900/30 scrollbar-none">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImgIndex(idx)}
                  className={`relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden border-2 transition-all ${
                    idx === activeImgIndex
                      ? 'border-pink-500 ring-2 ring-pink-400/50 scale-105 shadow-md'
                      : 'border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100 hover:border-pink-300'
                  }`}
                >
                  <Image src={imgUrl} alt={`Thumb ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CỘT PHẢI (6/12): THÔNG TIN GIÁ & ĐẶT HÀNG */}
        <div className="lg:col-span-6 space-y-5">
          {/* Header Info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider bg-pink-50 dark:bg-pink-950/50 px-3 py-1 rounded-full border border-pink-200 dark:border-pink-900/50">
                🌸 {costume.series}
              </span>
              {costume.brand ? (
                <span className="text-xs font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                  🏷️ Hãng: {costume.brand}
                </span>
              ) : null}
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-tight">
              {costume.character}
            </h1>
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {costume.name}
            </p>
          </div>

          {/* CHỌN GÓI THUÊ: TEST VS FES */}
          <div className="bg-rose-50/70 dark:bg-pink-950/25 p-5 rounded-3xl border-2 border-rose-200/80 dark:border-pink-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                <span>✨</span> Chọn Mục Đích Thuê (Giá linh hoạt):
              </span>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                Giá test tiết kiệm ~40%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gói Test */}
              <button
                type="button"
                onClick={() => setSelectedRentalType('test')}
                className={`p-4 rounded-2xl text-left border-2 transition-all relative ${
                  selectedRentalType === 'test'
                    ? 'bg-white dark:bg-[#201828] border-pink-500 shadow-md ring-2 ring-pink-400/40'
                    : 'bg-white/70 dark:bg-[#1a1522] border-zinc-200 dark:border-zinc-800 hover:border-pink-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                    🏠 Mặc Test Trong Nhà
                  </span>
                  {selectedRentalType === 'test' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500 text-white">
                      ✓ Đang chọn
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-pink-600 dark:text-pink-400">
                  {formatVND(testPrice)}
                  <span className="text-xs font-semibold text-zinc-400 ml-1">/ngày</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                  Thử size, chụp test tại gia, không ra ngoài
                </p>
              </button>

              {/* Gói Fes */}
              <button
                type="button"
                onClick={() => setSelectedRentalType('fes')}
                className={`p-4 rounded-2xl text-left border-2 transition-all relative ${
                  selectedRentalType === 'fes'
                    ? 'bg-white dark:bg-[#201828] border-purple-500 shadow-md ring-2 ring-purple-400/40'
                    : 'bg-white/70 dark:bg-[#1a1522] border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                    🎪 Đi Fes / Shoot Ngoại Cảnh
                  </span>
                  {selectedRentalType === 'fes' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-600 text-white">
                      ✓ Đang chọn
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                  {formatVND(fesPrice)}
                  <span className="text-xs font-semibold text-zinc-400 ml-1">/ngày</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                  Festival sự kiện, chụp Studio, ngoại cảnh
                </p>
              </button>
            </div>

            {/* Chi tiết cọc & Kho */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#181320] border border-rose-200/80 dark:border-pink-900/40">
                <span className="text-[11px] font-bold text-zinc-400 block">
                  Tiền cọc bảo chứng:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(costume.deposit_price)}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  (Hoàn lại 100% khi trả đồ)
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-[#181320] border border-rose-200/80 dark:border-pink-900/40">
                <span className="text-[11px] font-bold text-zinc-400 block">
                  Tình trạng kho:
                </span>
                <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 block mt-0.5">
                  {costume.quantity} bộ sẵn sàng ✨
                </span>
                <span className="text-[10px] text-pink-500 font-bold block mt-0.5">
                  Buffer giặt sấy: {effectiveBufferDays} ngày
                </span>
              </div>
            </div>

            {/* CẶP NÚT HÀNH ĐỘNG: THÊM VÀO GIỎ HÀNG & THUÊ NGAY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                className="py-3.5 px-4 rounded-2xl border-2 border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>Thêm vào giỏ hàng</span>
              </button>

              <button
                type="button"
                onClick={handleRentNow}
                className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
              >
                <span>Thuê ngay ➔</span>
              </button>
            </div>

            {/* NÚT TRÒ CHUYỆN THÊM VỀ SẢN PHẨM TRƯỚC KHI ĐẶT */}
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn) {
                  triggerToast('Vui lòng đăng nhập để trò chuyện cùng Shop nhé! 🌸')
                  router.push('/login?redirect=' + encodeURIComponent(window.location.pathname))
                  return
                }
                useChatStore.getState().openWithContext({
                  type: 'costume',
                  id: costume.id,
                  title: `${costume.character} - ${costume.name}`,
                  subtitle: costume.series,
                  image: images[0],
                  price: currentDailyPrice,
                })
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 border border-pink-200 dark:border-pink-900/60 text-pink-600 dark:text-pink-400 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <span>💬</span>
              <span>Trò chuyện thêm về trang phục này trước khi đặt</span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center font-semibold">
              💡 Bạn có thể chọn ngày nhận và trả đồ trực tiếp tại trang Đặt đồ (Checkout)
            </p>
          </div>
        </div>
      </div>

      {/* MÔ TẢ CHI TIẾT & LƯU Ý PHỤ KIỆN */}
      <section className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-7 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-pink-950/80">
          <span className="text-xl">📜</span>
          <h3 className="font-serif font-black text-lg sm:text-xl text-zinc-900 dark:text-zinc-100">
            Mô Tả Bộ Trang Phục & Phụ Kiện Đi Kèm
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold whitespace-pre-line">
          {costume.description ||
            'Bộ trang phục được shop chăm sóc tỉ mỉ, giặt hấp diệt khuẩn và kiểm tra phụ kiện đầy đủ trước khi gửi tới khách hàng.'}
        </p>

        {/* Thông số kỹ thuật nhanh */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/40">
            <span className="text-zinc-400 font-bold block text-[11px]">Hãng sản xuất:</span>
            <span className="font-black text-zinc-800 dark:text-zinc-200 mt-0.5 block">
              {costume.brand || 'Tiêu chuẩn'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/40">
            <span className="text-zinc-400 font-bold block text-[11px]">Trọng lượng ước tính:</span>
            <span className="font-black text-zinc-800 dark:text-zinc-200 mt-0.5 block">
              {costume.weight_kg ? `${costume.weight_kg} kg` : '1.5 - 2.0 kg'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/40">
            <span className="text-zinc-400 font-bold block text-[11px]">Thời gian giặt sấy:</span>
            <span className="font-black text-pink-600 dark:text-pink-400 mt-0.5 block">
              {effectiveBufferDays} ngày đệm (Buffer)
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/40">
            <span className="text-zinc-400 font-bold block text-[11px]">Chính sách hoàn cọc:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              100% trong 24h
            </span>
          </div>
        </div>
      </section>

      {/* SCHEDULE VIEW: LỊCH ĐẶT THUÊ TRỰC QUAN */}
      <section className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-7 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-pink-950/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <div>
              <h3 className="font-serif font-black text-lg sm:text-xl text-zinc-900 dark:text-zinc-100">
                Lịch Đặt Thuê Trực Quan (Schedule View)
              </h3>
              <p className="text-xs text-zinc-500 font-semibold mt-0.5">
                Xem trước các ngày trống và ngày đã kín lịch của bộ trang phục này
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-xs font-black text-pink-600 dark:text-pink-400 hover:underline"
          >
            {showSchedule ? 'Thu gọn ▲' : 'Mở xem ▼'}
          </button>
        </div>

        {showSchedule && (
          <div className="pt-2">
            <ScheduleView
              costumeName={costume.name}
              quantity={costume.quantity}
              bufferDays={effectiveBufferDays}
              bookings={initialBookings}
              readOnly={true}
            />
          </div>
        )}
      </section>

      {/* REVIEWS & FEEDBACK SECTION */}
      <ProductReviews
        costumeId={costume.id}
        initialReviews={initialReviews}
        canReview={canReview}
        reviewReason={reviewReason}
        isLoggedIn={isLoggedIn}
      />

      {/* LIGHTBOX MODAL */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm text-xs font-black">
              <span>🌸 {costume.character}</span>
              <span className="text-white/60">•</span>
              <span>
                {activeImgIndex + 1} / {images.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-xl font-black transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Vùng hiển thị ảnh */}
          <div
            className="relative max-w-[92vw] max-h-[85vh] w-auto h-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[activeImgIndex]}
              alt={costume.name}
              className="max-w-[90vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl"
            />

            {images.length > 1 && (
              <>
                <div
                  onClick={handlePrevImage}
                  className="absolute left-0 top-0 bottom-0 w-1/2 cursor-w-resize flex items-center justify-start pl-3 group"
                >
                  <div className="w-11 h-11 rounded-full bg-black/60 group-hover:bg-pink-600 text-white flex items-center justify-center text-2xl font-black shadow-lg transition-all opacity-70 group-hover:opacity-100">
                    ‹
                  </div>
                </div>
                <div
                  onClick={handleNextImage}
                  className="absolute right-0 top-0 bottom-0 w-1/2 cursor-e-resize flex items-center justify-end pr-3 group"
                >
                  <div className="w-11 h-11 rounded-full bg-black/60 group-hover:bg-pink-600 text-white flex items-center justify-center text-2xl font-black shadow-lg transition-all opacity-70 group-hover:opacity-100">
                    ›
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
