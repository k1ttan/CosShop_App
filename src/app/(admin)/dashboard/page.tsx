import React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminSection } from '@/components/admin/AdminSection'

import { getAllBookings, getPendingKycProfiles, getAdminStats } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard')
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border-2 border-red-500 p-6 rounded shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950 text-red-600 mx-auto rounded flex items-center justify-center text-3xl font-black">
            🚫
          </div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
            Truy cập bị từ chối
          </h1>
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Tài khoản của bạn ({user.email}) không có quyền Quản trị viên (Admin). Vui lòng liên hệ chủ hệ thống để được cấp quyền.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block py-2.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-black text-xs uppercase tracking-wider rounded transition-colors"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Pre-fetch server-side for instant load
  const [initialBookings, initialKycProfiles, initialStats] = await Promise.all([
    getAllBookings({ limit: 100 }),
    getPendingKycProfiles(),
    getAdminStats(),
  ])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px] uppercase border border-purple-300 dark:border-purple-800">
                Admin Panel
              </span>
              <span className="text-xs text-zinc-500 font-bold">{user.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mt-1">
              Bảng Quản Trị Hệ Thống CosRent
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="py-2 px-4 rounded border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-black uppercase tracking-wider transition-colors"
            >
              Xem Cửa hàng
            </Link>
          </div>
        </div>

        {/* Full Admin Management Section with server-prefetched data */}
        <AdminSection
          initialBookings={initialBookings}
          initialKycProfiles={initialKycProfiles}
          initialStats={initialStats}
        />
      </div>
    </div>
  )
}
