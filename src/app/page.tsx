/**
 * Homepage — Server Component
 * Fetch costumes từ Supabase thay vì mock-data tĩnh.
 * Fallback về mock-data nếu Supabase chưa được cấu hình.
 */
import React from 'react'
import { getCostumes, getUniqueSeries } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { MOCK_COSTUMES } from '@/lib/mock-data'
import { NavbarWithCart } from '@/components/layout/NavbarWithCart'
import { CatalogClient } from '@/components/products/CatalogClient'

export default async function Home() {
  const supabase = await createClient()

  // Kiểm tra quyền Admin của user hiện tại
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = Boolean(profile?.is_admin)
  }

  // Fetch real data; fallback to mock if Supabase not configured
  let costumes = await getCostumes()
  let seriesList = await getUniqueSeries()

  if (costumes.length === 0) {
    // Supabase chưa seed hoặc chưa config → dùng mock-data
    costumes = MOCK_COSTUMES
    seriesList = Array.from(new Set(MOCK_COSTUMES.map((c) => c.series)))
  }

  return (
    <div className="min-h-screen bg-rose-50/40 dark:bg-[#120f17] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans pb-20 sm:pb-8 selection:bg-pink-500 selection:text-white">
      {/* Navigation + Cart Drawer */}
      <NavbarWithCart />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 w-full flex-1 space-y-6 pt-4">
        {/* Hero Banner Cute Girly & Eye-pleasing */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-600 via-purple-700 to-indigo-900 dark:from-pink-950/80 dark:via-purple-950/80 dark:to-zinc-950 p-6 sm:p-10 text-white shadow-xl border border-pink-400/30 dark:border-pink-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-400/20 dark:bg-pink-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/20 dark:bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-black text-pink-100 border border-white/20 shadow-sm">
              <span>🌸</span>
              <span>Tiệm Cosplay Dễ Thương • Thuê Đồ Siêu Xinh</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Hóa thân thành waifu / husbando trong mơ của nàng ✨
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-semibold">
              Trang phục gấm dệt cao cấp, phụ kiện và tóc giả tạo kiểu sẵn. Kiểm tra lịch trống
              trực tuyến không lo trùng ngày, bảo chứng hoàn cọc 100% minh bạch.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Chống trùng lịch</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Buffer ngày giặt sấy</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Cổng VNPay bảo mật</span>
              </div>
            </div>
          </div>
        </section>

        {/* Catalog: Search, Filter, Grid — Client-side interactivity */}
        <CatalogClient costumes={costumes} seriesList={seriesList} />

        {/* Admin Quick Link (chỉ hiển thị khi là Admin) */}
        {isAdmin && (
          <div id="admin-preview" className="p-4 rounded bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Tài khoản Quản trị viên
              </span>
            </div>
            <a
              href="/dashboard"
              className="py-2 px-4 rounded bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              Truy cập Bảng Điều Khiển Quản Trị ➔
            </a>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 py-8 px-4 text-center text-xs text-zinc-500 max-w-5xl mx-auto w-full space-y-2">
        <p className="font-black text-zinc-700 dark:text-zinc-300">
          CosRent • Nền tảng Cho Thuê Trang Phục Cosplay Chuyên Nghiệp
        </p>
        <p className="font-semibold">
          Tuân thủ nguyên tắc chống trùng lịch (Double Booking Prevention), tách biệt tiền cọc và
          tiền thuê minh bạch.
        </p>
      </footer>
    </div>
  )
}
