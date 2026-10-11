'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Costume } from '@/types/database'
import { formatVND } from '@/lib/utils/helpers'
import { useCartStore } from '@/store/useCartStore'
import { ScheduleView, BookingInterval } from './ScheduleView'

interface BookingModalProps {
  costume: Costume | null
  onClose: () => void
  onSuccess: () => void
}

export function BookingModal({ costume, onClose, onSuccess }: BookingModalProps) {
  const addItem = useCartStore((state) => state.addItem)
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [selectedRentalType, setSelectedRentalType] = useState<'test' | 'fes'>('fes')
  const [bookings, setBookings] = useState<BookingInterval[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  // Fetch bookings data for Schedule View
  useEffect(() => {
    if (!costume?.id) return
    let isMounted = true
    setIsLoadingBookings(true)

    fetch(`/api/costumes/${costume.id}/bookings`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.bookings) {
          setBookings(data.bookings)
        }
      })
      .catch((err) => {
        console.error('Lỗi tải lịch trang phục:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoadingBookings(false)
      })

    return () => {
      isMounted = false
    }
  }, [costume?.id])

  // Giá Test và Giá Fes / Shoot
  const testPrice = costume?.rent_price_per_day ?? 0
  const fesPrice = costume?.rent_price_fes ?? (Math.round((testPrice * 1.4) / 10000) * 10000)
  const currentDailyRent = selectedRentalType === 'test' ? testPrice : fesPrice

  const images = costume?.image_urls && costume.image_urls.length > 0
    ? costume.image_urls
    : ['https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800']

  // Điều hướng ảnh kế / trước
  const handleNextImage = useCallback(() => {
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  // Lắng nghe bàn phím khi lightbox mở
  useEffect(() => {
    if (!isLightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
      if (e.key === 'ArrowRight') handleNextImage()
      if (e.key === 'ArrowLeft') handlePrevImage()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLightboxOpen, handleNextImage, handlePrevImage])

  if (!costume) return null

  const handleAddToCart = () => {
    addItem({
      costume,
      rentalType: selectedRentalType,
      startDate: '',
      endDate: '',
      rentalDays: 1,
      totalRentFee: currentDailyRent,
      depositFee: costume.deposit_price,
      shippingMethod: 'self_pickup',
      shippingFee: 0,
    })
    onSuccess()
    onClose()
  }

  const effectiveBufferDays = Math.max(3, costume.buffer_days ?? 3)

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#1a1522] border-2 border-rose-200/90 dark:border-pink-900/60 rounded-3xl max-w-2xl w-full max-h-[94vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header: Series, Brand, Character & Nút Đóng */}
          <div className="flex items-start justify-between border-b pb-3 border-rose-100 dark:border-pink-950/80">
            <div className="space-y-1 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1">
                  🌸 {costume.series}
                </span>
                {costume.brand ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                    🏷️ Hãng: {costume.brand}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                    🏷️ Hãng: Đang cập nhật
                  </span>
                )}
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                {costume.character}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-rose-50 dark:bg-pink-950/60 text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300 flex items-center justify-center font-black transition-colors border border-rose-200/60 dark:border-pink-900/40 shrink-0"
              title="Đóng"
            >
              ✕
            </button>
          </div>

          {/* KHUNG DANH SÁCH ẢNH & PREVIEW */}
          <div className="space-y-2">
            {/* Ảnh xem trước lớn - click vào mở popup kích cỡ đầy đủ */}
            <div
              onClick={() => setIsLightboxOpen(true)}
              className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-950 border-2 border-rose-200/80 dark:border-pink-900/40 cursor-zoom-in group shadow-inner"
              title="Bấm để xem ảnh kích cỡ đầy đủ"
            >
              <Image
                src={images[activeImageIndex]}
                alt={costume.name}
                fill
                priority
                className="object-contain sm:object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Nút mũi tên lướt ảnh trái / phải trên preview */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrevImage()
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-pink-600 text-white flex items-center justify-center text-lg font-black shadow-lg transition-all"
                    title="Ảnh trước"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNextImage()
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-pink-600 text-white flex items-center justify-center text-lg font-black shadow-lg transition-all"
                    title="Ảnh sau"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Huy hiệu hướng dẫn zoom */}
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-[11px] font-black text-white/90 pointer-events-none">
                <span>🔍 Phóng to</span>
                <span className="text-white/60">({activeImageIndex + 1}/{images.length})</span>
              </div>
            </div>

            {/* Khung List Danh Sách Thumbnail Các Ảnh */}
            {images.length > 1 && (
              <div className="p-2 rounded-xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-200/60 dark:border-pink-900/40">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {images.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                        idx === activeImageIndex
                          ? 'border-pink-500 dark:border-pink-400 ring-2 ring-pink-400/50 scale-105 shadow-md'
                          : 'border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100 hover:border-pink-300'
                      }`}
                    >
                      <Image
                        src={imgUrl}
                        alt={`Ảnh ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BẢNG THÔNG TIN CHI TIẾT & GIÁ TIỀN NỔI BẬT */}
          <div className="bg-rose-50/70 dark:bg-pink-950/25 p-4 rounded-2xl border-2 border-rose-200/80 dark:border-pink-900/40 space-y-3.5">
            {/* Hiển thị đầy đủ tên đồ không bị cắt */}
            <div className="border-b pb-2.5 border-rose-200/60 dark:border-pink-900/40">
              <span className="text-[11px] font-black uppercase text-pink-600 dark:text-pink-400 block mb-1">
                Tên bộ trang phục:
              </span>
              <p className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 break-words leading-snug">
                {costume.name}
              </p>
            </div>

            {/* KHỐI LỰA CHỌN GIÁ THUÊ NỔI BẬT: TEST VS FES/SHOOT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
                  ✨ Chọn mục đích thuê (Giá thuê linh hoạt):
                </span>
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  Giá test rẻ hơn ~40%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gói 1: Thuê Test trong nhà */}
                <button
                  type="button"
                  onClick={() => setSelectedRentalType('test')}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all relative ${
                    selectedRentalType === 'test'
                      ? 'bg-gradient-to-br from-pink-500/10 to-rose-500/20 border-pink-500 dark:border-pink-400 shadow-md ring-2 ring-pink-400/40'
                      : 'bg-white dark:bg-[#221c2d] border-zinc-200 dark:border-zinc-800 hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                      🏠 Mặc Test Trong Nhà
                    </span>
                    {selectedRentalType === 'test' && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500 text-white">
                        ✓ Đang chọn
                      </span>
                    )}
                  </div>
                  <div className="text-lg sm:text-xl font-black text-pink-600 dark:text-pink-400">
                    {formatVND(testPrice)}
                    <span className="text-xs font-semibold text-zinc-500 ml-1">/ngày</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                    Thử size, chụp test tại gia, không đi ra ngoài
                  </p>
                </button>

                {/* Gói 2: Thuê Fes / Shoot */}
                <button
                  type="button"
                  onClick={() => setSelectedRentalType('fes')}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all relative ${
                    selectedRentalType === 'fes'
                      ? 'bg-gradient-to-br from-purple-500/10 to-indigo-500/20 border-purple-500 dark:border-purple-400 shadow-md ring-2 ring-purple-400/40'
                      : 'bg-white dark:bg-[#221c2d] border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                      🎪 Đi Fes / Đi Shoot
                    </span>
                    {selectedRentalType === 'fes' && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-600 text-white">
                        ✓ Đang chọn
                      </span>
                    )}
                  </div>
                  <div className="text-lg sm:text-xl font-black text-purple-600 dark:text-purple-400">
                    {formatVND(fesPrice)}
                    <span className="text-xs font-semibold text-zinc-500 ml-1">/ngày</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                    Tham gia Festival sự kiện, chụp Studio, ngoại cảnh
                  </p>
                </button>
              </div>
            </div>

            {/* Các thông số khác: Tiền cọc & Số lượng kho */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-white dark:bg-[#221c2d] border border-rose-200 dark:border-pink-900/60 shadow-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-semibold block text-[11px]">
                  Tiền cọc bảo chứng:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(costume.deposit_price)}
                </span>
                <span className="block text-[10px] text-zinc-400 font-bold mt-0.5">
                  (Hoàn lại 100% khi trả đồ nguyên vẹn)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#221c2d] border border-rose-200 dark:border-pink-900/60 shadow-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-semibold block text-[11px]">
                  Tình trạng kho:
                </span>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 block mt-0.5">
                  {costume.quantity} bộ sẵn sàng ✨
                </span>
                <span className="block text-[10px] text-pink-600 dark:text-pink-400 font-bold mt-0.5">
                  Hãng đồ: {costume.brand || 'Tiêu chuẩn'}
                </span>
              </div>
            </div>

            {/* Mô tả chi tiết (Description) */}
            {costume.description && (
              <div className="pt-2 border-t border-rose-200/60 dark:border-pink-900/40">
                <span className="text-[11px] font-black uppercase text-pink-600 dark:text-pink-400 block mb-1">
                  Mô tả chi tiết:
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold whitespace-pre-line">
                  {costume.description}
                </p>
              </div>
            )}
          </div>

          {/* Schedule View Toggle (Xem lịch trống trước khi thêm vào giỏ) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full py-2.5 px-3 rounded-xl border-2 border-rose-200 dark:border-pink-900/60 hover:border-pink-500 flex items-center justify-between text-xs font-black text-zinc-800 dark:text-zinc-200 transition-colors bg-rose-50/50 dark:bg-pink-950/20"
            >
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span>{showSchedule ? 'Thu gọn Lịch Đặt Thuê (Schedule View)' : 'Xem Lịch Đặt Thuê (Schedule View) của bộ này'}</span>
              </div>
              <span className="text-pink-600 dark:text-pink-400 font-black">{showSchedule ? '▲ Đóng' : '▼ Mở xem'}</span>
            </button>

            {showSchedule && (
              <div className="pt-2">
                {isLoadingBookings ? (
                  <div className="text-center py-6 text-xs text-zinc-500 font-semibold">
                    Đang tải lịch thuê...
                  </div>
                ) : (
                  <ScheduleView
                    costumeName={costume.name}
                    quantity={costume.quantity}
                    bufferDays={effectiveBufferDays}
                    bookings={bookings}
                    readOnly={true}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer Action: Add to Cart & Note */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleAddToCart}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-black text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>
                Thêm vào giỏ hàng • {formatVND(currentDailyRent)}/ngày ({selectedRentalType === 'test' ? 'Mặc Test' : 'Đi Fes'})
              </span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center font-semibold">
              💡 Khoảng ngày thuê, địa chỉ nhận hàng và tổng tiền sẽ được hoàn tất tại trang Thanh toán sau khi bấm Đặt hàng từ giỏ.
            </p>
          </div>
        </div>
      </div>

      {/* ── POPUP LIGHTBOX HIỂN THỊ ĐẦY ĐỦ KÍCH CỠ ẢNH ── */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header Lightbox */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm text-xs font-black">
              <span>🌸 {costume.character}</span>
              <span className="text-white/60">•</span>
              <span>{activeImageIndex + 1} / {images.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-xl font-black transition-colors"
              title="Đóng (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Vùng hiển thị ảnh chính & Click Trái / Phải để chuyển ảnh */}
          <div
            className="relative max-w-[92vw] max-h-[85vh] w-auto h-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[activeImageIndex]}
              alt={costume.name}
              className="max-w-[90vw] max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />

            {/* Click nửa trái tấm ảnh để về ảnh trước */}
            {images.length > 1 && (
              <div
                onClick={handlePrevImage}
                className="absolute left-0 top-0 bottom-0 w-1/2 cursor-w-resize flex items-center justify-start pl-3 group"
                title="Bấm nửa trái để xem ảnh trước"
              >
                <div className="w-11 h-11 rounded-full bg-black/60 group-hover:bg-pink-600 text-white flex items-center justify-center text-2xl font-black shadow-lg transition-all opacity-70 group-hover:opacity-100">
                  ‹
                </div>
              </div>
            )}

            {/* Click nửa phải tấm ảnh để sang ảnh sau */}
            {images.length > 1 && (
              <div
                onClick={handleNextImage}
                className="absolute right-0 top-0 bottom-0 w-1/2 cursor-e-resize flex items-center justify-end pr-3 group"
                title="Bấm nửa phải để xem ảnh sau"
              >
                <div className="w-11 h-11 rounded-full bg-black/60 group-hover:bg-pink-600 text-white flex items-center justify-center text-2xl font-black shadow-lg transition-all opacity-70 group-hover:opacity-100">
                  ›
                </div>
              </div>
            )}
          </div>

          {/* Dải thumbnail dưới cùng của Lightbox */}
          {images.length > 1 && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-md rounded-2xl max-w-[90vw] overflow-x-auto scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    idx === activeImageIndex
                      ? 'border-pink-500 scale-110 ring-2 ring-pink-400'
                      : 'border-white/30 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

