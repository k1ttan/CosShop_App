'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/supabase/actions'
import type { Notification } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (err) {
      console.warn('Failed to fetch notifications:', err)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    fetchNotifs()

    // Định kỳ refresh thông báo mỗi 20 giây
    const interval = setInterval(fetchNotifs, 20000)
    return () => clearInterval(interval)
  }, [userId, fetchNotifs])

  // Đóng khi click ngoài
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

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    await markNotificationAsRead(id)
  }

  const handleMarkAllRead = async () => {
    setLoading(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await markAllNotificationsAsRead()
    setLoading(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) fetchNotifs()
        }}
        className="relative p-2 rounded-full hover:bg-rose-50 dark:hover:bg-pink-950/40 text-zinc-600 dark:text-zinc-300 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900/60 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-pink-950/60 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🔔</span>
              <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Thông báo {unreadCount > 0 && `(${unreadCount} mới)`}
              </h4>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] font-black text-pink-600 dark:text-pink-400 hover:underline disabled:opacity-50"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-rose-50 dark:divide-pink-950/30 my-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs">
                <span className="text-2xl block mb-1">🌸</span>
                Chưa có thông báo nào
              </div>
            ) : (
              notifications.map((notif) => {
                let timeStr = ''
                try {
                  timeStr = formatDistanceToNow(new Date(notif.created_at), {
                    addSuffix: true,
                    locale: vi,
                  })
                } catch {
                  timeStr = 'Gần đây'
                }

                const content = (
                  <div
                    className={`p-2.5 rounded-xl transition-colors cursor-pointer flex gap-3 ${
                      notif.is_read
                        ? 'opacity-70 hover:opacity-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                        : 'bg-rose-50/70 dark:bg-pink-950/40 hover:bg-rose-100/70'
                    }`}
                    onClick={() => handleMarkAsRead(notif.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300 flex items-center justify-center flex-shrink-0 text-sm">
                      {notif.type === 'delivery'
                        ? '🚚'
                        : notif.type === 'booking_status'
                        ? '💖'
                        : '🌸'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate">
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5 line-clamp-2 leading-relaxed font-medium">
                        {notif.message}
                      </p>
                      <span className="text-[9px] text-zinc-400 font-semibold block mt-1">
                        {timeStr}
                      </span>
                    </div>
                  </div>
                )

                return (
                  <div key={notif.id} className="py-0.5">
                    {notif.link ? (
                      <Link
                        href={notif.link}
                        onClick={() => {
                          handleMarkAsRead(notif.id)
                          setIsOpen(false)
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-rose-100 dark:border-pink-950/60 text-center">
            <Link
              href="/profile/bookings"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-black text-zinc-500 hover:text-pink-600 dark:hover:text-pink-300 transition-colors"
            >
              Xem tất cả đơn hàng ➔
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
