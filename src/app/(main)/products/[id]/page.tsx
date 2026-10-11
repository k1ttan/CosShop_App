import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCostumeById, getCostumeBookings, getReviewsByCostumeId, checkUserCanReview } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { MOCK_COSTUMES } from '@/lib/mock-data'
import { NavbarWithCart } from '@/components/layout/NavbarWithCart'
import { ProductDetailView } from '@/components/products/ProductDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  let costume = await getCostumeById(id)
  if (!costume) {
    costume = MOCK_COSTUMES.find((c) => c.id === id) || null
  }

  if (!costume) {
    return {
      title: 'Không tìm thấy trang phục | CosRent',
    }
  }

  return {
    title: `${costume.character} - ${costume.name} | CosRent Cosplay`,
    description: `Thuê trang phục cosplay ${costume.character} (${costume.series}). Giá thuê minh bạch, cam kết chống trùng lịch, hoàn cọc 100%.`,
    openGraph: {
      images: costume.image_urls.length > 0 ? [costume.image_urls[0]] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params

  // 1. Lấy thông tin trang phục
  let costume = await getCostumeById(id)
  if (!costume) {
    costume = MOCK_COSTUMES.find((c) => c.id === id) || null
  }

  if (!costume) {
    notFound()
  }

  // 2. Lấy dữ liệu bookings, reviews, và user hiện tại
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [bookings, reviews, reviewEligibility] = await Promise.all([
    getCostumeBookings(costume.id),
    getReviewsByCostumeId(costume.id),
    checkUserCanReview(costume.id, user?.id),
  ])

  return (
    <div className="min-h-screen bg-rose-50/40 dark:bg-[#120f17] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Header & Cart */}
      <NavbarWithCart />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 w-full flex-1 pt-4">
        <ProductDetailView
          costume={costume}
          initialBookings={bookings}
          initialReviews={reviews}
          canReview={reviewEligibility.canReview}
          reviewReason={reviewEligibility.reason}
          isLoggedIn={Boolean(user)}
        />
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 py-8 px-4 text-center text-xs text-zinc-500 max-w-5xl mx-auto w-full space-y-2">
        <p className="font-black text-zinc-700 dark:text-zinc-300">
          CosRent • Nền tảng Cho Thuê Trang Phục Cosplay Chuyên Nghiệp
        </p>
        <p className="font-semibold">
          Tuân thủ nguyên tắc chống trùng lịch (Double Booking Prevention), tách biệt tiền cọc và tiền thuê minh bạch.
        </p>
      </footer>
    </div>
  )
}
