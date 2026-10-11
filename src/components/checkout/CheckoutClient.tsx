'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/store/useCartStore'
import { formatVND, calcChargeableRentalDays } from '@/lib/utils/helpers'
import { createBooking } from '@/lib/supabase/actions'
import { ScheduleView, BookingInterval } from '@/components/booking/ScheduleView'
import { ShippingMethod } from '@/types/database'
import { MOCK_COSTUMES } from '@/lib/mock-data'

export function CheckoutClient() {
  const searchParams = useSearchParams()
  const costumeIdParam = searchParams.get('costumeId')
  const rentalTypeParam = searchParams.get('rentalType') as 'test' | 'fes' | null

  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const updateItem = useCartStore((state) => state.updateItem)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clearCart)

  const [selectedCostumeId, setSelectedCostumeId] = useState<string>('')
  const [costumeBookingsMap, setCostumeBookingsMap] = useState<Record<string, BookingInterval[]>>({})
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  // Thông tin user
  const [loggedInUser, setLoggedInUser] = useState<{
    id: string
    full_name: string | null
    phone: string | null
    default_address: string | null
  } | null>(null)

  // Thông tin giao nhận
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('self_pickup')
  const [shippingAddress, setShippingAddress] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [orderNote, setOrderNote] = useState('')

  // Trạng thái xử lý
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 1. Tự động thêm sản phẩm từ URL nếu có param costumeId mà trong giỏ chưa có
  useEffect(() => {
    if (!costumeIdParam) return

    const exists = items.some((i) => i.costume.id === costumeIdParam)
    if (!exists) {
      // Tìm trong mock costumes hoặc fetch API
      const mock = MOCK_COSTUMES.find((c) => c.id === costumeIdParam)
      if (mock) {
        const type = rentalTypeParam || 'fes'
        const unitPrice = type === 'test'
          ? mock.rent_price_per_day
          : (mock.rent_price_fes ?? Math.round((mock.rent_price_per_day * 1.4) / 10000) * 10000)

        addItem({
          costume: mock,
          rentalType: type,
          startDate: '',
          endDate: '',
          rentalDays: 1,
          totalRentFee: unitPrice,
          depositFee: mock.deposit_price,
          shippingMethod: 'self_pickup',
          shippingFee: 0,
        })
      }
    }
    setSelectedCostumeId(costumeIdParam)
  }, [costumeIdParam, rentalTypeParam, items, addItem])

  // 2. Tự động lấy profile nếu user đã đăng nhập
  useEffect(() => {
    let isMounted = true
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.profile) return
        setLoggedInUser(data.profile)
        if (data.profile.full_name) setRecipientName(data.profile.full_name)
        if (data.profile.phone) setRecipientPhone(data.profile.phone)
        if (data.profile.default_address) setShippingAddress(data.profile.default_address)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  // 3. Khởi tạo active costume id
  useEffect(() => {
    if (items.length > 0 && (!selectedCostumeId || !items.some((i) => i.costume.id === selectedCostumeId))) {
      setSelectedCostumeId(items[0].costume.id)
    }
  }, [items, selectedCostumeId])

  // 4. Fetch bookings data cho các trang phục trong đơn
  useEffect(() => {
    if (items.length === 0) return

    async function fetchAllBookings() {
      setIsLoadingBookings(true)
      const map: Record<string, BookingInterval[]> = {}
      for (const item of items) {
        try {
          const res = await fetch(`/api/costumes/${item.costume.id}/bookings`, { cache: 'no-store' })
          const data = await res.json()
          if (data.bookings) {
            map[item.costume.id] = data.bookings
          }
        } catch (e) {
          console.error('Error fetching bookings:', e)
        }
      }
      setCostumeBookingsMap(map)
      setIsLoadingBookings(false)
    }

    fetchAllBookings()
  }, [items])

  // Active item đang chọn lịch
  const activeItem = useMemo(
    () => items.find((i) => i.costume.id === selectedCostumeId) || items[0],
    [items, selectedCostumeId]
  )

  const getItemDailyRent = useCallback((item: (typeof items)[0]) => {
    if (item.rentalType === 'test') {
      return item.costume.rent_price_per_day
    }
    return (
      item.costume.rent_price_fes ??
      Math.round((item.costume.rent_price_per_day * 1.4) / 10000) * 10000
    )
  }, [])

  // Chọn khoảng ngày thuê cho active item
  const handleSelectDateRange = (start: string, end: string) => {
    if (!activeItem) return

    const days = calcChargeableRentalDays(start, end)
    const dailyRate = getItemDailyRent(activeItem)
    const rentFee = days * dailyRate

    updateItem(activeItem.costume.id, {
      startDate: start,
      endDate: end,
      rentalDays: days,
      totalRentFee: rentFee,
    })
    setErrorMsg(null)
  }

  // Chuyển đổi phương thức giao hàng
  const handleShippingChange = (method: ShippingMethod) => {
    setShippingMethod(method)
    const fee = method === 'self_pickup' ? 0 : 35000
    items.forEach((item) => {
      updateItem(item.costume.id, {
        shippingMethod: method,
        shippingFee: fee,
      })
    })
  }

  // Đổi gói thuê test / fes trực tiếp tại checkout
  const handleToggleRentalType = (costumeId: string, type: 'test' | 'fes') => {
    const item = items.find((i) => i.costume.id === costumeId)
    if (!item) return
    const dailyRate = type === 'test'
      ? item.costume.rent_price_per_day
      : (item.costume.rent_price_fes ?? Math.round((item.costume.rent_price_per_day * 1.4) / 10000) * 10000)
    const days = item.rentalDays || 1
    updateItem(costumeId, {
      rentalType: type,
      totalRentFee: days * dailyRate,
    })
  }

  // Tính tổng tiền
  const { totalRent, totalDeposit, totalShipping, grandTotal } = useMemo(() => {
    const rent = items.reduce((sum, i) => {
      const dailyRate = getItemDailyRent(i)
      return sum + (i.startDate && i.endDate ? i.totalRentFee : dailyRate)
    }, 0)
    const deposit = items.reduce((sum, i) => sum + i.depositFee, 0)
    const shipping = shippingMethod === 'self_pickup' ? 0 : 35000
    return {
      totalRent: rent,
      totalDeposit: deposit,
      totalShipping: shipping,
      grandTotal: rent + deposit + shipping,
    }
  }, [items, shippingMethod, getItemDailyRent])

  // Xử lý submit đặt hàng
  const handleConfirmOrder = async () => {
    if (items.length === 0) {
      setErrorMsg('Giỏ đồ của bạn đang trống. Vui lòng chọn trang phục trước.')
      return
    }

    // Kiểm tra đã chọn ngày cho tất cả trang phục chưa
    const unselected = items.find((i) => !i.startDate || !i.endDate)
    if (unselected) {
      setErrorMsg(`Vui lòng chọn ngày nhận và trả đồ cho bộ "${unselected.costume.character}" trên lịch.`)
      setSelectedCostumeId(unselected.costume.id)
      return
    }

    // Kiểm tra thông tin người nhận
    if (!loggedInUser) {
      if (!recipientName.trim() || !recipientPhone.trim()) {
        setErrorMsg('Vui lòng nhập đầy đủ Họ tên và Số điện thoại liên hệ để shop gửi đồ.')
        return
      }
    }

    if (shippingMethod !== 'self_pickup' && !shippingAddress.trim()) {
      setErrorMsg('Vui lòng điền địa chỉ giao nhận đồ chính xác.')
      return
    }

    setIsProcessing(true)
    setErrorMsg(null)

    const newBookingIds: string[] = []

    try {
      for (const item of items) {
        const result = await createBooking({
          costume_id: item.costume.id,
          start_date: item.startDate,
          end_date: item.endDate,
          shipping_method: shippingMethod,
          shipping_address: shippingAddress.trim() || undefined,
          shippingFee: shippingMethod === 'self_pickup' ? 0 : 35000,
          guest_name: recipientName.trim() || undefined,
          guest_phone: recipientPhone.trim() || undefined,
          rental_type: item.rentalType || 'fes',
        })

        if (!result.success) {
          setErrorMsg(result.error ?? 'Lỗi tạo đơn đặt thuê')
          setIsProcessing(false)
          return
        }

        if (result.bookingId) {
          newBookingIds.push(result.bookingId)
        }
      }
    } catch {
      // Fallback
    }

    setTimeout(() => {
      setIsProcessing(false)
      setPaymentSuccess(true)
      clearCart()
    }, 1200)
  }

  // MÀN HÌNH THÀNH CÔNG SAU KHI ĐẶT HÀNG
  if (paymentSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center text-4xl shadow-lg border-2 border-emerald-300 dark:border-emerald-800 animate-in zoom-in-75 duration-300">
          ✓
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-950/60 px-3 py-1 rounded-full">
            🌸 Đặt thuê thành công
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
            Cảm ơn bạn đã lựa chọn CosRent!
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-semibold max-w-md mx-auto leading-relaxed">
            Đơn đặt thuê đã được ghi nhận. Shop đang kiểm tra phụ kiện, giặt hấp diệt khuẩn và chuẩn bị gửi đồ đúng hẹn cho bạn.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1522] border-2 border-rose-200 dark:border-pink-900/60 shadow-sm text-left space-y-2 text-xs">
          <div className="flex justify-between font-bold text-zinc-500">
            <span>Phương thức:</span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {shippingMethod === 'self_pickup' ? 'Tự đến shop lấy' : 'Giao hàng tận nơi'}
            </span>
          </div>
          <div className="flex justify-between font-bold text-zinc-500">
            <span>Người nhận:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-black">
              {recipientName || loggedInUser?.full_name || 'Khách hàng'} - {recipientPhone || loggedInUser?.phone}
            </span>
          </div>
          {shippingAddress && (
            <div className="flex justify-between font-bold text-zinc-500">
              <span>Địa chỉ:</span>
              <span className="text-zinc-800 dark:text-zinc-200 text-right max-w-[280px]">
                {shippingAddress}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-zinc-500 border-t pt-2 border-rose-100 dark:border-pink-950">
            <span>Tổng thanh toán:</span>
            <span className="text-sm font-black text-pink-600 dark:text-pink-400">
              {formatVND(grandTotal)}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {loggedInUser ? (
            <Link
              href="/profile/bookings"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition-all"
            >
              Xem đơn hàng của tôi ➔
            </Link>
          ) : (
            <Link
              href="/tracking"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition-all"
            >
              Tra cứu tiến trình đơn hàng ➔
            </Link>
          )}

          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-black text-xs hover:bg-rose-50 transition-all"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    )
  }

  // NẾU GIỎ HÀNG TRỐNG
  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <span className="text-5xl block mb-2">🛍️</span>
        <h2 className="font-serif text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
          Giỏ đồ của bạn đang trống
        </h2>
        <p className="text-xs text-zinc-500 font-semibold">
          Vui lòng dạo quanh cửa hàng và chọn những bộ trang phục cosplay xinh xắn bạn yêu thích nhé!
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs shadow-lg shadow-pink-600/25 hover:scale-105 transition-all"
          >
            <span>Khám phá trang phục ngay</span>
            <span>➔</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Tiêu đề & Stepper */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>✨</span>
            <span>Đặt Thuê Trang Phục</span>
          </h1>

          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
            <span className="text-pink-600 dark:text-pink-400">1. Chọn đồ</span>
            <span>➔</span>
            <span className="text-pink-600 dark:text-pink-400 font-black">2. Lịch & Vận chuyển</span>
            <span>➔</span>
            <span>3. Hoàn tất</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 font-semibold">
          Chọn ngày nhận và trả đồ trên lịch, điền thông tin người nhận và hoàn tất đơn thuê
        </p>
      </div>

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* LAYOUT 2 CỘT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CỘT TRÁI (7/12): SCHEDULE VIEW & THÔNG TIN GIAO HÀNG */}
        <div className="lg:col-span-7 space-y-6">
          {/* PHẦN 1: CHỌN NGÀY TRÊN LỊCH SCHEDULE VIEW */}
          <div className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-6 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-pink-950/80">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                    Chọn Ngày Thuê Trang Phục
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                    Không tính tiền ngày nhận và trả đồ (chỉ tính ngày thực tế mặc) ✨
                  </p>
                </div>
              </div>
            </div>

            {/* Selector nếu có nhiều trang phục trong giỏ */}
            {items.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase text-pink-600 dark:text-pink-400 block">
                  Đang chọn lịch cho bộ:
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {items.map((item) => {
                    const isSelected = item.costume.id === activeItem?.costume.id
                    const hasDate = Boolean(item.startDate && item.endDate)
                    return (
                      <button
                        key={item.costume.id}
                        type="button"
                        onClick={() => setSelectedCostumeId(item.costume.id)}
                        className={`px-3 py-2 rounded-2xl text-xs font-black whitespace-nowrap border-2 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-pink-300'
                        }`}
                      >
                        <span>{item.costume.character}</span>
                        {hasDate ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đã chọn ngày" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" title="Chưa chọn ngày" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trạng thái ngày đang chọn */}
            {activeItem && (
              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-pink-950/25 border border-rose-200/80 dark:border-pink-900/40 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 block text-[10px]">
                    Khoảng ngày của {activeItem.costume.character}:
                  </span>
                  {activeItem.startDate && activeItem.endDate ? (
                    <span className="font-black text-pink-600 dark:text-pink-400 text-sm">
                      {activeItem.startDate} ➔ {activeItem.endDate} ({activeItem.rentalDays} ngày tính tiền)
                    </span>
                  ) : (
                    <span className="font-black text-rose-500 text-xs">
                      👉 Hãy bấm chọn ngày bắt đầu & kết thúc trên lịch bên dưới
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400">Gói thuê:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleRentalType(
                        activeItem.costume.id,
                        activeItem.rentalType === 'test' ? 'fes' : 'test'
                      )
                    }
                    className="text-[11px] font-black px-2 py-0.5 rounded-full bg-pink-600 text-white shadow-xs"
                  >
                    {activeItem.rentalType === 'test' ? '🏠 Mặc Test' : '🎪 Đi Fes'} (Đổi)
                  </button>
                </div>
              </div>
            )}

            {/* Schedule View Calendar */}
            {activeItem && (
              <div className="pt-1">
                {isLoadingBookings ? (
                  <div className="text-center py-10 text-xs text-zinc-500 font-semibold">
                    Đang tải lịch thuê...
                  </div>
                ) : (
                  <ScheduleView
                    costumeName={activeItem.costume.name}
                    quantity={activeItem.costume.quantity}
                    bufferDays={Math.max(3, activeItem.costume.buffer_days ?? 3)}
                    bookings={costumeBookingsMap[activeItem.costume.id] || []}
                    selectedStartDate={activeItem.startDate}
                    selectedEndDate={activeItem.endDate}
                    onSelectRange={handleSelectDateRange}
                    readOnly={false}
                  />
                )}
              </div>
            )}
          </div>

          {/* PHẦN 2: FORM THÔNG TIN GIAO NHẬN */}
          <div className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-6 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-md space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-pink-950/80">
              <span className="text-xl">🛵</span>
              <h3 className="font-serif font-black text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                Thông Tin Nhận Đồ & Vận Chuyển
              </h3>
            </div>

            {/* Phương thức giao hàng */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-pink-600 dark:text-pink-400 block">
                Phương thức nhận hàng:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleShippingChange('self_pickup')}
                  className={`p-3 rounded-2xl text-left border-2 transition-all ${
                    shippingMethod === 'self_pickup'
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 font-black shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold hover:border-pink-300'
                  }`}
                >
                  <span className="text-sm block mb-0.5">🏪</span>
                  <span className="text-xs block">Tự lấy tại Shop</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Miễn phí (0đ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShippingChange('shop_delivery')}
                  className={`p-3 rounded-2xl text-left border-2 transition-all ${
                    shippingMethod === 'shop_delivery'
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 font-black shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold hover:border-pink-300'
                  }`}
                >
                  <span className="text-sm block mb-0.5">🛵</span>
                  <span className="text-xs block">Shop giao tận nơi</span>
                  <span className="text-[10px] text-zinc-500 font-bold">+35.000đ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShippingChange('third_party_courier')}
                  className={`p-3 rounded-2xl text-left border-2 transition-all ${
                    shippingMethod === 'third_party_courier'
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 font-black shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold hover:border-pink-300'
                  }`}
                >
                  <span className="text-sm block mb-0.5">📦</span>
                  <span className="text-xs block">Bưu điện GHN/GHTK</span>
                  <span className="text-[10px] text-zinc-500 font-bold">+35.000đ</span>
                </button>
              </div>
            </div>

            {/* Thông tin cá nhân người nhận */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Họ và tên người nhận: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Phương Linh"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#15111b] border-2 border-rose-200 dark:border-pink-900/60 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Số điện thoại liên hệ: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="Ví dụ: 0987654321"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#15111b] border-2 border-rose-200 dark:border-pink-900/60 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
                />
              </div>
            </div>

            {/* Địa chỉ giao hàng nếu không phải tự đến shop */}
            {shippingMethod !== 'self_pickup' && (
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Địa chỉ nhận đồ chi tiết: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#15111b] border-2 border-rose-200 dark:border-pink-900/60 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
                />
              </div>
            )}

            {/* Ghi chú thêm */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Ghi chú thêm cho shop (tùy chọn):
              </label>
              <textarea
                rows={2}
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Ví dụ: Giao trước 10h sáng, gửi kèm thêm kẹp tóc hoặc hướng dẫn mặc..."
                className="w-full p-3 rounded-xl bg-white dark:bg-[#15111b] border-2 border-rose-200 dark:border-pink-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-pink-500 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (5/12): TÓM TẮT ĐƠN HÀNG & NÚT THANH TOÁN (STICKY) */}
        <div className="lg:col-span-5 space-y-5 sticky top-20">
          <div className="bg-white dark:bg-[#1a1522] rounded-3xl p-5 sm:p-6 border-2 border-rose-200/90 dark:border-pink-900/50 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-pink-950/80">
              <h3 className="font-serif font-black text-base sm:text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🧾</span>
                <span>Tóm Tắt Đơn Đặt Thuê</span>
              </h3>
              <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                {items.length} món
              </span>
            </div>

            {/* Danh sách trang phục */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-none">
              {items.map((item) => {
                const dailyRent = getItemDailyRent(item)
                return (
                  <div
                    key={item.costume.id}
                    className="p-3 rounded-2xl bg-rose-50/50 dark:bg-pink-950/20 border border-rose-100 dark:border-pink-900/40 flex items-center gap-3 relative group"
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-pink-200">
                      <Image
                        src={item.costume.image_urls[0] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'}
                        alt={item.costume.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate">
                        {item.costume.character}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-semibold truncate">
                        {item.costume.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                        <span className="text-pink-600 dark:text-pink-400">
                          {item.rentalType === 'test' ? 'Mặc Test' : 'Đi Fes'}: {formatVND(dailyRent)}/ngày
                        </span>
                        {item.startDate && item.endDate && (
                          <span className="text-zinc-400">({item.rentalDays} ngày)</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.costume.id)}
                      className="absolute top-2 right-2 text-zinc-400 hover:text-rose-500 text-xs font-bold p-1"
                      title="Xóa khỏi đơn"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Bảng chi tiết chi phí */}
            <div className="space-y-2.5 pt-2 border-t border-rose-100 dark:border-pink-950/80 text-xs">
              <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                <span>Tổng tiền thuê trang phục:</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">
                  {formatVND(totalRent)}
                </span>
              </div>

              <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <span>Tiền cọc bảo chứng:</span>
                  <span className="text-[10px] text-emerald-500 font-black" title="Hoàn 100% khi trả đồ">
                    (Hoàn lại 100%)
                  </span>
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(totalDeposit)}
                </span>
              </div>

              <div className="flex justify-between font-semibold text-zinc-600 dark:text-zinc-400">
                <span>Phí vận chuyển:</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">
                  {shippingMethod === 'self_pickup' ? '0đ (Tự lấy)' : formatVND(totalShipping)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-rose-200/60 dark:border-pink-900/40 text-sm">
                <span className="font-black text-zinc-900 dark:text-zinc-100">Tổng thanh toán:</span>
                <span className="text-xl font-black text-pink-600 dark:text-pink-400 font-sans">
                  {formatVND(grandTotal)}
                </span>
              </div>
            </div>

            {/* Nút thanh toán */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isProcessing}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-black text-sm shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Đang xử lý tạo đơn...</span>
                ) : (
                  <>
                    <span>Xác nhận Đặt Thuê & Thanh Toán</span>
                    <span>➔</span>
                  </>
                )}
              </button>

              <div className="p-3 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/30 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 font-bold text-pink-700 dark:text-pink-300">
                  <span>🛡️</span>
                  <span>Cam kết bảo chứng từ CosRent:</span>
                </div>
                <p>• Tuyệt đối chống trùng lịch với thuật toán buffer ngày giặt sấy.</p>
                <p>• Hoàn cọc 100% trong 24h sau khi nhận lại đồ nguyên vẹn.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
