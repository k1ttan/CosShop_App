'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ReviewWithAuthor } from '@/types/database'

interface ProductReviewsProps {
  costumeId: string
  initialReviews: ReviewWithAuthor[]
  canReview: boolean
  reviewReason?: string
  isLoggedIn: boolean
}

export function ProductReviews({
  costumeId,
  initialReviews,
  canReview,
  reviewReason,
  isLoggedIn,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>(initialReviews)
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [rentalType, setRentalType] = useState<'test' | 'fes'>('fes')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [userCanReview, setUserCanReview] = useState(canReview)

  // Tính điểm đánh giá trung bình
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0'

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return
    setImages((prev) => [...prev, imageUrlInput.trim()])
    setImageUrlInput('')
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) {
      setErrorMessage('Vui lòng viết nhận xét đánh giá của bạn.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/costumes/${costumeId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          images,
          rental_type: rentalType,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Có lỗi xảy ra khi gửi đánh giá')
        setIsSubmitting(false)
        return
      }

      // Thêm review mới vào danh sách hiển thị
      const newReview: ReviewWithAuthor = {
        id: 'new-' + Date.now(),
        costume_id: costumeId,
        user_id: 'current-user',
        author_name: 'Bạn (Người đánh giá)',
        author_avatar: null,
        rating,
        comment: comment.trim(),
        images,
        rental_type: rentalType,
        created_at: new Date().toISOString(),
      }

      setReviews((prev) => [newReview, ...prev])
      setComment('')
      setImages([])
      setUserCanReview(false)
      setSuccessMessage('Cảm ơn bạn! Đánh giá và feedback của bạn đã được đăng thành công ✨')
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-7 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md space-y-6">
      {/* Header Đánh Giá & Điểm số */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-rose-100 dark:border-pink-950/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <h3 className="font-serif font-black text-xl text-zinc-900 dark:text-zinc-100">
              Đánh Giá & Feedback Từ Khách Hàng
            </h3>
          </div>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            Hình ảnh unbox và trải nghiệm thực tế từ các cosplayer đã hoàn thành đơn thuê
          </p>
        </div>

        {/* Khối Điểm số trung bình */}
        <div className="flex items-center gap-3 bg-rose-50/80 dark:bg-pink-950/30 px-4 py-2.5 rounded-2xl border border-rose-200/80 dark:border-pink-900/40 shrink-0">
          <div className="text-center">
            <span className="text-2xl font-black text-pink-600 dark:text-pink-400 font-sans">
              {avgRating}
            </span>
            <span className="text-xs text-zinc-400 block font-bold">/ 5.0</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex text-amber-400 text-sm">
              {'★'.repeat(Math.round(Number(avgRating)))}
              {'☆'.repeat(5 - Math.round(Number(avgRating)))}
            </div>
            <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-300">
              {reviews.length} lượt đánh giá
            </span>
          </div>
        </div>
      </div>

      {/* KHU VỰC GỬI FEEDBACK */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-pink-50/50 via-purple-50/30 to-indigo-50/20 dark:from-pink-950/20 dark:via-purple-950/15 dark:to-zinc-900 border-2 border-dashed border-rose-200 dark:border-pink-900/60">
        {successMessage ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-2">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
        ) : !isLoggedIn ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200">
                  Bạn đã từng thuê bộ trang phục này?
                </p>
                <p className="text-[11px] text-zinc-500 font-semibold">
                  Đăng nhập tài khoản để chia sẻ đánh giá và ảnh feedback cho cộng đồng cosplayer.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-black bg-pink-600 hover:bg-pink-700 text-white shadow-md shadow-pink-600/20 transition-all shrink-0"
            >
              Đăng nhập ngay ➔
            </Link>
          </div>
        ) : !userCanReview ? (
          <div className="flex items-start gap-3 p-2">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                Xác thực người thuê thực tế (Verified Renter):
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5 leading-relaxed">
                {reviewReason ||
                  'Bạn chỉ có thể gửi đánh giá sau khi đã hoàn thành một đơn thuê bộ trang phục này (đã nhận và trả đồ về shop). Điều này giúp các đánh giá luôn chân thực và hữu ích nhất ✨'}
              </p>
            </div>
          </div>
        ) : (
          /* FORM VIẾT ĐÁNH GIÁ KHI ĐỦ ĐIỀU KIỆN */
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>✨</span> Viết đánh giá của bạn:
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                ✓ Đã xác thực đơn thuê thành công
              </span>
            </div>

            {/* Chọn số sao */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                Mức độ hài lòng:
              </span>
              <div className="flex items-center gap-1 text-2xl cursor-pointer">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-125 focus:outline-none"
                  >
                    <span
                      className={
                        (hoverRating || rating) >= star ? 'text-amber-400' : 'text-zinc-300 dark:text-zinc-700'
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-xs font-black text-amber-500">
                {rating === 5 && 'Tuyệt vời, cực kỳ hài lòng!'}
                {rating === 4 && 'Rất tốt, đồ xinh'}
                {rating === 3 && 'Bình thường'}
                {rating === 2 && 'Chưa hài lòng'}
                {rating === 1 && 'Kém'}
              </span>
            </div>

            {/* Chọn gói thuê đã trải nghiệm */}
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-zinc-600 dark:text-zinc-300">Gói đã thuê:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRentalType('fes')}
                  className={`px-3 py-1 rounded-full font-black border transition-all ${
                    rentalType === 'fes'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  🎪 Đi Fes / Shoot
                </button>
                <button
                  type="button"
                  onClick={() => setRentalType('test')}
                  className={`px-3 py-1 rounded-full font-black border transition-all ${
                    rentalType === 'test'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  🏠 Mặc Test trong nhà
                </button>
              </div>
            </div>

            {/* Nội dung nhận xét */}
            <div>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn (Form đồ mặc vừa vặn không, chất liệu gấm dệt thế nào, wig và phụ kiện kèm theo ra sao...)"
                className="w-full p-3 rounded-2xl bg-white dark:bg-[#15111b] border-2 border-rose-200 dark:border-pink-900/60 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
              />
            </div>

            {/* Đính kèm link ảnh feedback */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Dán URL ảnh feedback khi mặc hoặc unbox đồ (tùy chọn)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#15111b] border border-rose-200 dark:border-pink-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-rose-100 dark:bg-pink-950 text-pink-600 dark:text-pink-300 hover:bg-pink-200 transition-colors"
                >
                  + Thêm ảnh
                </button>
              </div>

              {/* Danh sách ảnh đã đính kèm */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-pink-300">
                      <Image src={imgUrl} alt={`Feedback ${idx + 1}`} fill className="object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] font-black"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMessage && (
              <p className="text-xs font-bold text-rose-500">{errorMessage}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-pink-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? 'Đang gửi...' : 'Gửi Đánh Giá & Feedback ✨'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* DANH SÁCH FEEDBACK TỪ KHÁCH */}
      <div className="space-y-4 pt-2">
        {reviews.length === 0 ? (
          <div className="text-center py-8 bg-rose-50/30 dark:bg-zinc-900/30 rounded-2xl border border-rose-100 dark:border-zinc-800">
            <span className="text-3xl block mb-2">🌸</span>
            <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">
              Chưa có đánh giá nào cho bộ trang phục này
            </p>
            <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
              Hãy là người đầu tiên trải nghiệm và chia sẻ feedback xinh nhé!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-rose-100 dark:divide-pink-950/60">
            {reviews.map((rev) => (
              <div key={rev.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                {/* Người đánh giá & Sao */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {rev.author_avatar ? (
                      <div className="relative w-9 h-9 rounded-full overflow-hidden border border-pink-300">
                        <Image src={rev.author_avatar} alt={rev.author_name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        {rev.author_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100">
                          {rev.author_name}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ✓ Đã thuê thực tế
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-semibold mt-0.5">
                        <span>{new Date(rev.created_at).toLocaleDateString('vi-VN')}</span>
                        {rev.rental_type && (
                          <>
                            <span>•</span>
                            <span className="text-pink-600 dark:text-pink-400 font-bold">
                              {rev.rental_type === 'test' ? 'Mặc Test trong nhà' : 'Đi Fes / Shoot'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sao */}
                  <div className="text-amber-400 text-sm font-bold flex">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </div>
                </div>

                {/* Bình luận */}
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold pl-1">
                  {rev.comment}
                </p>

                {/* Ảnh feedback thực tế */}
                {rev.images && rev.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 pl-1">
                    {rev.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-rose-200/80 dark:border-pink-900/40 shadow-xs cursor-pointer group"
                      >
                        <Image
                          src={img}
                          alt="Feedback photo"
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
