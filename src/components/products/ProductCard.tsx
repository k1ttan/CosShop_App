'use client'

import React, { memo } from 'react'
import Image from 'next/image'
import type { Costume } from '@/types/database'
import { formatVND } from '@/lib/utils/helpers'

interface ProductCardProps {
  costume: Costume
  onSelect: (costume: Costume) => void
}

export const ProductCard = memo(function ProductCard({ costume, onSelect }: ProductCardProps) {
  const isAvailable = costume.status === 'available'

  return (
    <div
      onClick={() => onSelect(costume)}
      className="group cursor-pointer bg-white dark:bg-[#1d1825] rounded-2xl overflow-hidden border-2 border-rose-200/90 dark:border-pink-900/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1"
    >
      <div>
        {/* Costume Image with Tags */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-rose-50 dark:bg-zinc-900">
          <Image
            src={costume.image_urls[0] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'}
            alt={costume.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-75 transition-opacity" />

          {/* Badges on top */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
            {costume.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Quantity Badge on top right */}
          <div className="absolute top-2.5 right-2.5">
            <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
              Kho: {costume.quantity} bộ ✨
            </span>
          </div>

          {/* Series badge at bottom of photo */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <span className="text-[11px] font-black text-pink-200 tracking-wide block uppercase drop-shadow-md">
              {costume.series}
            </span>
            <h3 className="font-serif font-black text-white text-base leading-tight drop-shadow-md line-clamp-1">
              {costume.character}
            </h3>
          </div>
        </div>

        {/* Content details */}
        <div className="p-3.5 space-y-2.5">
          <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-1 font-semibold">
            {costume.name}
          </p>

          {/* Separated Price Structure: Rent Fee vs Deposit Fee */}
          <div className="bg-rose-50/70 dark:bg-pink-950/25 p-2.5 rounded-xl border border-rose-200/70 dark:border-pink-900/40 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-black">Giá thuê:</span>
              <span className="text-sm font-black text-pink-600 dark:text-pink-400 font-sans">
                {formatVND(costume.rent_price_per_day)}
                <span className="text-[10px] font-semibold text-zinc-500">/ngày</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between border-t border-rose-200/50 dark:border-pink-900/40 pt-1">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">Cọc (hoàn lại):</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {formatVND(costume.deposit_price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Action Button */}
      <div className="p-3.5 pt-0">
        <button
          disabled={!isAvailable}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            isAvailable
              ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-pink-500/20 hover:shadow-md hover:scale-[1.01]'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{isAvailable ? 'Chọn ngày & Thuê ngay' : 'Đang bận'}</span>
        </button>
      </div>
    </div>
  )
})
