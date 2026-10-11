'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCartStore } from '@/store/useCartStore'
import { useChatStore } from '@/store/useChatStore'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/supabase/actions'
import type { User } from '@supabase/supabase-js'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { ProfileDropdown } from './ProfileDropdown'
import { NotificationBell } from './NotificationBell'

export function Navbar({ onOpenCart }: { onOpenCart: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const cartCount = useCartStore((state) => state.items.length)

  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState<{
    full_name?: string | null
    avatar_url?: string | null
    is_admin?: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const setCurrentUser = useCartStore((state) => state.setCurrentUser)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        setUser(currentUser)
        setCurrentUser(currentUser?.id ?? null)

        if (currentUser) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, is_admin')
            .eq('id', currentUser.id)
            .maybeSingle()

          setProfile(profileData)
          setIsAdmin(Boolean(profileData?.is_admin))
        } else {
          setProfile(null)
          setIsAdmin(false)
        }
      } catch (err) {
        console.error('Error fetching user:', err)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null, { resetGuestCart: true })
      } else {
        setCurrentUser(newUser?.id ?? null)
      }

      if (newUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, is_admin')
          .eq('id', newUser.id)
          .maybeSingle()
        setProfile(profileData)
        setIsAdmin(Boolean(profileData?.is_admin))
      } else {
        setProfile(null)
        setIsAdmin(false)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setCurrentUser])

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
    setProfile(null)
    setIsAdmin(false)
    setCurrentUser(null, { resetGuestCart: true })
    useChatStore.getState().resetChatState()
    router.refresh()
  }

  return (
    <>
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 dark:bg-[#1a1522]/95 border-b-2 border-rose-200/80 dark:border-pink-950/80 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-500/25 group-hover:scale-105 group-hover:rotate-3 transition-transform">
              <span className="text-xl font-bold">🌸</span>
            </div>
            <div>
              <span className="font-serif font-black text-xl tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 dark:from-pink-300 dark:to-purple-300 bg-clip-text text-transparent">
                CosRent
              </span>
              <span className="block text-[10px] font-black tracking-wider text-pink-500 dark:text-pink-400 uppercase -mt-1 flex items-center gap-1">
                Cosplay Rental ✨
              </span>
            </div>
          </Link>

          {/* Quick Search Tagline / Badges */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-rose-900/80 dark:text-pink-200 bg-rose-50/80 dark:bg-pink-950/40 px-3.5 py-1.5 rounded-full border border-rose-200 dark:border-pink-900/60 shadow-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
            <span className="font-bold">✨ Đặt cọc an tâm • Giữ lịch chuẩn 100% 💖</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Admin Badge link if admin */}
            {isAdmin && (
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
              >
                <span>⚙️ Quản trị</span>
              </Link>
            )}

            {/* Auth Buttons */}
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <NotificationBell userId={user.id} />
                    <ProfileDropdown
                      user={user}
                      profile={profile}
                      onSignOut={handleSignOut}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Link
                      href="/tracking"
                      className="hidden sm:inline-flex px-3 py-1.5 rounded-full border border-rose-200 dark:border-pink-900 hover:bg-rose-50 dark:hover:bg-pink-950/40 text-xs font-black text-rose-600 dark:text-pink-400 transition-colors"
                    >
                      🔍 Tra cứu
                    </Link>
                    <Link
                      href="/login"
                      className="px-3 py-1.5 rounded-full border-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      href="/register"
                      className="hidden sm:inline-flex px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                    >
                      Đăng ký
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Cart Trigger */}
            <button
              onClick={onOpenCart}
              className="relative p-2.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 transition-colors"
              aria-label="Giỏ hàng"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[11px] font-black w-5 h-5 rounded flex items-center justify-center shadow-md animate-bounce">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed bottom for mobile-first) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1a1522]/95 backdrop-blur-lg border-t-2 border-rose-200 dark:border-pink-950/80 py-2.5 px-6 flex items-center justify-around shadow-2xl safe-area-pb">
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 text-[11px] font-black transition-colors ${
            pathname === '/'
              ? 'text-pink-600 dark:text-pink-400'
              : 'text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Trang chủ</span>
        </Link>

        <button
          onClick={onOpenCart}
          className="relative flex flex-col items-center gap-1 text-[11px] font-black text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded flex items-center justify-center">
              {cartCount}
            </span>
          )}
          <span>Giỏ đồ</span>
        </button>

        {isAdmin ? (
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 text-[11px] font-black transition-colors ${
              pathname.startsWith('/dashboard')
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Admin</span>
          </Link>
        ) : user ? (
          <>
            <Link
              href="/profile/bookings"
              className={`flex flex-col items-center gap-1 text-[11px] font-black transition-colors ${
                pathname.startsWith('/profile/bookings')
                  ? 'text-pink-600 dark:text-pink-400'
                  : 'text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Đơn hàng</span>
            </Link>
            <Link
              href="/profile"
              className={`flex flex-col items-center gap-1 text-[11px] font-black transition-colors ${
                pathname === '/profile'
                  ? 'text-pink-600 dark:text-pink-400'
                  : 'text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Hồ Sơ</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/tracking"
              className={`flex flex-col items-center gap-1 text-[11px] font-black transition-colors ${
                pathname.startsWith('/tracking')
                  ? 'text-pink-600 dark:text-pink-400'
                  : 'text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Tra cứu</span>
            </Link>
            <Link
              href="/login"
              className="flex flex-col items-center gap-1 text-[11px] font-black text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Đăng nhập</span>
            </Link>
          </>
        )}

        <div className="flex flex-col items-center gap-0.5">
          <ThemeToggle className="!w-7 !h-7 !p-1" />
          <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400">Giao diện</span>
        </div>
      </nav>
    </>
  )
}
