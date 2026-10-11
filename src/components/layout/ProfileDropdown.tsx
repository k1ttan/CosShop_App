'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'

interface ProfileDropdownProps {
  user: User
  profile: {
    full_name?: string | null
    avatar_url?: string | null
    is_admin?: boolean
  } | null
  onSignOut: () => void
}

export function ProfileDropdown({ user, profile, onSignOut }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Đóng khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const displayName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Cosplayer'
  const email = user.email || ''
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
  const isAdmin = Boolean(profile?.is_admin)

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border-2 border-pink-200 dark:border-pink-900/70 hover:border-pink-400 dark:hover:border-pink-500 bg-rose-50/70 dark:bg-pink-950/40 hover:bg-rose-100/60 transition-all shadow-xs group"
        aria-label="Tài khoản cá nhân"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-tr from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-black ring-2 ring-white dark:ring-zinc-900 shadow-xs flex-shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={28}
              height={28}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span>{displayName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <span className="text-xs font-black text-rose-700 dark:text-pink-300 max-w-[100px] truncate hidden md:inline">
          {displayName}
        </span>

        <svg
          className={`w-3.5 h-3.5 text-rose-400 group-hover:text-rose-600 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900/60 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          {/* User Info Header */}
          <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-rose-50 to-pink-50/50 dark:from-pink-950/40 dark:to-purple-950/20 rounded-xl border border-rose-100 dark:border-pink-900/40 mb-2">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-base font-black ring-2 ring-pink-300 dark:ring-pink-700 shadow-md flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span>{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate">
                  {displayName}
                </p>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-semibold">
                {email}
              </p>
              <div className="mt-1">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                    🛡️ Quản trị viên
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300">
                    ✨ Thành viên
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="space-y-1">
            <Link
              href="/profile/bookings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black text-zinc-700 dark:text-zinc-200 hover:bg-rose-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 transition-colors group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">📦</span>
              <div className="flex-1">
                <div>Đơn hàng của tôi</div>
                <div className="text-[10px] text-zinc-400 font-semibold">
                  Xem & theo dõi trạng thái đơn hàng
                </div>
              </div>
              <span className="text-pink-400 text-xs">➔</span>
            </Link>

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black text-zinc-700 dark:text-zinc-200 hover:bg-rose-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 transition-colors group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">✏️</span>
              <div className="flex-1">
                <div>Chỉnh sửa thông tin</div>
                <div className="text-[10px] text-zinc-400 font-semibold">
                  Hồ sơ cá nhân & đổi mật khẩu
                </div>
              </div>
              <span className="text-pink-400 text-xs">➔</span>
            </Link>

            <Link
              href="/tracking"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-zinc-700 dark:text-zinc-200 hover:bg-rose-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 transition-colors group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🔍</span>
              <div className="flex-1">
                <div>Tra cứu nhanh mã vận đơn</div>
              </div>
            </Link>

            {isAdmin && (
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">⚙️</span>
                <div className="flex-1">
                  <div>Bảng Quản trị (Admin)</div>
                </div>
              </Link>
            )}
          </div>

          <div className="my-2 border-t border-rose-100 dark:border-pink-950/60" />

          {/* Sign Out Button */}
          <button
            onClick={() => {
              setIsOpen(false)
              onSignOut()
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  )
}
