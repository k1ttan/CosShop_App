'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Costume } from '@/types/database'
import { formatVND } from '@/lib/utils/helpers'

interface ProductQuickModalProps {
  costume: Costume | null
  onClose: () => void
}

export function ProductQuickModal({ costume, onClose }: ProductQuickModalProps) {
  const [activeImgIndex, setActiveImgIndex] = useState(0)

  if (!costume) return null

  const images = costume.image_urls && costume.image_urls.length > 0
    ? costume.image_urls
    : ['https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800']

  const testPrice = costume.rent_price_per_day
  const fesPrice = costume.rent_price_fes ?? (Math.round((testPrice * 1.4) / 10000) * 10000)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1522] border-2 border-rose-200/90 dark:border-pink-900/60 rounded-3xl max-w-md w-full shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-sm font-black transition-colors backdrop-blur-sm"
          title="Đóng (Esc)"
        >
          ✕
        </button>

        {/* Khung ảnh gọn gàng + Mini thumb nếu có nhiều ảnh */}
        <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-rose-50 dark:bg-zinc-900 border border-rose-200/60 dark:border-pink-900/40">
          <Image
            src={images[activeImgIndex] || images[0]}
            alt={costume.name}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Badges trên ảnh */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            <span className="bg-pink-600/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
              🌸 {costume.series}
            </span>
            {costume.brand && (
              <span className="bg-purple-900/80 backdrop-blur-md text-purple-200 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-400/30">
                🏷️ {costume.brand}
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h3 className="font-serif font-black text-lg leading-tight drop-shadow-md">
              {costume.character}
            </h3>
            <p className="text-xs text-rose-100 font-semibold truncate drop-shadow-sm mt-0.5">
              {costume.name}
            </p>
          </div>

          {/* Mini slider dots nếu có nhiều ảnh */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-2 py-1 rounded-full z-10">
              {images.slice(0, 4).map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveImgIndex(idx)
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeImgIndex ? 'bg-pink-400 w-4' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bảng tóm tắt giá & kho vừa vặn */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Giá Test */}
            <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-pink-950/25 border border-rose-200/70 dark:border-pink-900/40">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
                🏠 Mặc Test (trong nhà):
              </span>
              <span className="text-sm font-black text-pink-600 dark:text-pink-400">
                {formatVND(testPrice)}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold">/ngày</span>
            </div>

            {/* Giá Fes */}
            <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200/70 dark:border-purple-900/40">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">
                🎪 Đi Fes / Shoot:
              </span>
              <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                {formatVND(fesPrice)}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold">/ngày</span>
            </div>
          </div>

          {/* Thông tin Cọc và Tình trạng kho */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500">🛡️</span>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold block">Cọc bảo chứng:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(costume.deposit_price)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-zinc-400 font-bold block">Tình trạng kho:</span>
              <span className="font-black text-zinc-800 dark:text-zinc-200">
                {costume.quantity > 0 ? `Sẵn sàng (${costume.quantity} bộ)` : 'Hết đồ'}
              </span>
            </div>
          </div>
        </div>

        {/* Nút hành động duy nhất: Xem chi tiết & Đặt thuê ➔ */}
        <div className="pt-1">
          <Link
            href={`/products/${costume.id}`}
            onClick={onClose}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-black text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
          >
            <span>Xem chi tiết & Đặt thuê</span>
            <span className="text-base">➔</span>
          </Link>
          <p className="text-[11px] text-zinc-400 text-center font-semibold mt-2">
            ✨ Xem mô tả, phụ kiện, lịch trống và đánh giá tại trang chi tiết
          </p>
        </div>
      </div>
    </div>
  )
}
