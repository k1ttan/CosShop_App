'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { formatVND } from '@/lib/utils/helpers'
import type { BookingWithDetails } from '@/lib/supabase/queries'
import { OrderDetailModal } from './OrderDetailModal'

interface BookingCardListProps {
  bookings: BookingWithDetails[]
  loading: boolean
  onRefresh: () => void
  onStatusTransition: (bookingId: string, newStatus: string) => Promise<void>
  onShipBooking: (bookingId: string, carrierName: string, trackingNumber: string, trackingUrl?: string) => Promise<void>
  onToggleArchive: (bookingId: string, archive: boolean) => Promise<void>
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  renting: 'Đang thuê',
  returned: 'Đã trả đồ',
  inspecting: 'Đang kiểm tra',
  deposit_refunded: 'Đã hoàn cọc',
  deposit_withheld: 'Giữ cọc',
  cancelled: 'Đã hủy',
  overdue: '⚠ Trễ hạn',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300',
  shipping: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300',
  renting: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300',
  returned: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300',
  inspecting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-300',
  deposit_refunded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
  deposit_withheld: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300',
  overdue: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 animate-pulse',
}

export function BookingCardList({
  bookings,
  loading,
  onRefresh,
  onStatusTransition,
  onShipBooking,
  onToggleArchive,
}: BookingCardListProps) {
  const [subTab, setSubTab] = useState<'active' | 'archived'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)

  // Phân loại đơn: Đang xử lý vs Kho lưu trữ
  const { activeList, archivedList } = useMemo(() => {
    const active: BookingWithDetails[] = []
    const archived: BookingWithDetails[] = []

    bookings.forEach((b) => {
      const isClosed = ['deposit_refunded', 'deposit_withheld', 'cancelled'].includes(b.status)
      // Nếu có đánh dấu is_archived = true HOẶC (đã đóng và không bị force unarchive)
      if (b.is_archived === true || (isClosed && b.is_archived !== false)) {
        archived.push(b)
      } else {
        active.push(b)
      }
    })

    return { activeList: active, archivedList: archived }
  }, [bookings])

  // Lọc theo subTab hiện tại, từ khoá và bộ lọc trạng thái
  const currentSource = subTab === 'active' ? activeList : archivedList

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return currentSource.filter((b) => {
      // Lọc trạng thái
      if (statusFilter !== 'all' && b.status !== statusFilter) {
        return false
      }

      // Lọc từ khoá
      if (!q) return true
      const idMatch = b.id.toLowerCase().includes(q)
      const customerMatch =
        (b.profile?.full_name?.toLowerCase() || '').includes(q) ||
        (b.guest_name?.toLowerCase() || '').includes(q) ||
        (b.profile?.phone?.toLowerCase() || '').includes(q) ||
        (b.guest_phone?.toLowerCase() || '').includes(q)
      const costumeMatch =
        (b.costume?.character?.toLowerCase() || '').includes(q) ||
        (b.costume?.series?.toLowerCase() || '').includes(q) ||
        (b.costume?.name?.toLowerCase() || '').includes(q)

      return idMatch || customerMatch || costumeMatch
    })
  }, [currentSource, searchQuery, statusFilter])

  return (
    <div className="space-y-4">
      {/* THANH ĐIỀU HƯỚNG SUB-TAB: ĐANG XỬ LÝ VS KHO LƯU TRỮ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Tab Đang xử lý */}
          <button
            type="button"
            onClick={() => setSubTab('active')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              subTab === 'active'
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25 scale-102'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span>⚡ Đang xử lý</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                subTab === 'active' ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              {activeList.length}
            </span>
          </button>

          {/* Tab Kho lưu trữ */}
          <button
            type="button"
            onClick={() => setSubTab('archived')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              subTab === 'archived'
                ? 'bg-gradient-to-r from-zinc-700 to-zinc-900 text-white shadow-md scale-102'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span>📦 Kho lưu trữ đơn</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                subTab === 'archived' ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              {archivedList.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-black text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 self-end sm:self-auto"
        >
          <span>🔄</span>
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* THANH TÌM KIẾM VÀ LỌC TRẠNG THÁI */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đơn, tên khách, SĐT hoặc tên nhân vật..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-pink-500 shrink-0"
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* TRẠNG THÁI LOADING / EMPTY */}
      {loading && (
        <div className="text-center py-12 text-xs font-bold text-zinc-400 animate-pulse">
          Đang tải danh sách đơn thuê...
        </div>
      )}

      {!loading && filteredBookings.length === 0 && (
        <div className="text-center py-14 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
          <span className="text-4xl block mb-1">📋</span>
          <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">
            {subTab === 'active'
              ? 'Không có đơn nào đang chờ xử lý'
              : 'Kho lưu trữ đơn hàng đang trống'}
          </p>
          <p className="text-xs text-zinc-400 font-semibold">
            {searchQuery
              ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái phía trên.'
              : subTab === 'active'
              ? 'Tất cả các đơn đã hoàn thành sẽ được đưa vào Kho lưu trữ.'
              : 'Các đơn sau khi hoàn cọc / giữ cọc sẽ hiển thị tại đây.'}
          </p>
        </div>
      )}

      {/* LƯỚI THẺ ĐƠN HÀNG (GRID CARD 1-3 CỘT) */}
      {!loading && filteredBookings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((b) => {
            const statusLabel = STATUS_LABELS[b.status] || b.status
            const statusColor = STATUS_COLORS[b.status] || 'bg-zinc-100 text-zinc-700'
            const isClosed = ['deposit_refunded', 'deposit_withheld', 'cancelled'].includes(b.status)

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className="group cursor-pointer bg-white dark:bg-[#1a1522] rounded-3xl p-4 sm:p-5 border-2 border-rose-100 dark:border-pink-950 hover:border-pink-400 dark:hover:border-pink-500/80 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Top Bar: Mã đơn + Status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                      #{b.id.slice(0, 8).toUpperCase()}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Body: Ảnh thu nhỏ + Tên nhân vật & Khách */}
                  <div className="flex gap-3 items-start">
                    <div className="relative w-16 h-20 rounded-2xl overflow-hidden shrink-0 border-2 border-rose-100 dark:border-pink-900/60 bg-zinc-950">
                      <Image
                        src={
                          b.costume?.image_urls?.[0] ||
                          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'
                        }
                        alt={b.costume?.name || 'Costume'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-black text-pink-600 dark:text-pink-400 truncate max-w-[120px]">
                          🌸 {b.costume?.series || 'Series'}
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-300">
                          {b.rental_type === 'test' ? '🏠 Test' : '🎪 Fes'}
                        </span>
                      </div>

                      <h4 className="font-serif font-black text-sm text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                        {b.costume?.character || 'Trang phục'}
                      </h4>

                      {/* Khách hàng */}
                      <div className="pt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <div className="font-black truncate flex items-center gap-1">
                          <span>👤</span>
                          <span>{b.profile?.full_name || b.guest_name || 'Khách vãng lai'}</span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 truncate">
                          📞 {b.profile?.phone || b.guest_phone || 'Chưa cập nhật'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lịch thuê & Vận chuyển */}
                  <div className="p-2.5 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/30 text-xs space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400 font-bold">Lịch thuê:</span>
                      <span className="font-mono font-black text-zinc-800 dark:text-zinc-200">
                        {b.start_date} ➔ {b.end_date}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400 font-bold">Vận chuyển:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                        {b.shipping_method === 'self_pickup'
                          ? '🏪 Tự lấy tại shop'
                          : b.carrier_name
                          ? `🚚 ${b.carrier_name}`
                          : '🛵 Shop giao'}
                      </span>
                    </div>
                  </div>

                  {/* Chi phí tóm tắt */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold">Tiền thuê:</span>
                      <span className="font-black text-pink-600 dark:text-pink-400">
                        {formatVND(b.total_rent_fee)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block font-bold">Tiền cọc:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {formatVND(b.deposit_fee)}
                      </span>
                    </div>
                  </div>

                  {/* Badges đặc biệt (Mã vận đơn, Ảnh unbox) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {b.tracking_number && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        Mã: {b.tracking_number}
                      </span>
                    )}

                    {b.received_images && b.received_images.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        📸 {b.received_images.length} ảnh nhận
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="pt-3 border-t border-rose-100 dark:border-pink-950/80 mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400">
                    {isClosed ? 'Đã đóng đơn' : 'Cần xử lý'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBooking(b)
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-pink-500/20 transition-all flex items-center gap-1.5 group-hover:scale-102"
                  >
                    <span>Xem & Xử lý</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CHI TIẾT & THAO TÁC TRẠNG THÁI */}
      {selectedBooking && (
        <OrderDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusTransition={async (bId, status) => {
            await onStatusTransition(bId, status)
            // Cập nhật selected booking state
            setSelectedBooking((prev) => (prev ? { ...prev, status: status as BookingWithDetails['status'] } : null))
          }}
          onShipBooking={async (bId, carrier, trkNum, trkUrl) => {
            await onShipBooking(bId, carrier, trkNum, trkUrl)
            setSelectedBooking((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'shipping',
                    carrier_name: carrier,
                    tracking_number: trkNum,
                    tracking_url: trkUrl ?? null,
                  }
                : null
            )
          }}
          onToggleArchive={async (bId, archive) => {
            await onToggleArchive(bId, archive)
            setSelectedBooking((prev) =>
              prev ? { ...prev, is_archived: archive } : null
            )
          }}
        />
      )}
    </div>
  )
}
