'use client'

import React, { useEffect } from 'react'

interface ChatLightboxProps {
  images: string[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

export function ChatLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ChatLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  // Lắng nghe phím ESC và Mũi tên trái/phải
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, images.length, onClose])

  if (!isOpen || images.length === 0) return null

  const currentImage = images[currentIndex] || images[0]

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Nút Đóng */}
      <button
        onClick={onClose}
        aria-label="Đóng ảnh"
        className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Điều hướng Trước (Previous) */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          aria-label="Ảnh trước"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Điều hướng Tiếp theo (Next) */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          aria-label="Ảnh kế tiếp"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Ảnh chính */}
      <div
        className="relative max-w-4xl max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage}
          alt="Ảnh phóng to"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
        />

        {/* Số thứ tự ảnh */}
        {images.length > 1 && (
          <div className="absolute bottom-[-32px] left-1/2 -translate-x-1/2 text-white/70 text-xs font-semibold px-3 py-1 rounded-full bg-black/40">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  )
}
