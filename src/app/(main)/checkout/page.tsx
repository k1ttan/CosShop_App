import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { NavbarWithCart } from '@/components/layout/NavbarWithCart'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'

export const metadata: Metadata = {
  title: 'Đặt Thuê & Thanh Toán | CosRent Cosplay',
  description: 'Xác nhận khoảng ngày thuê trên Schedule View, điền thông tin nhận đồ và thanh toán đặt cọc bảo chứng.',
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-rose-50/40 dark:bg-[#120f17] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Navigation */}
      <NavbarWithCart />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 w-full flex-1 pt-4">
        <Suspense
          fallback={
            <div className="py-20 text-center text-xs font-black text-zinc-400 animate-pulse">
              Đang tải thông tin đặt đồ...
            </div>
          }
        >
          <CheckoutClient />
        </Suspense>
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
