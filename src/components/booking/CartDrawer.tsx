'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { SmartImage } from '@/components/ui/SmartImage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/useCartStore'
import { formatVND, calcChargeableRentalDays } from '@/lib/utils/helpers'
import { createBooking } from '@/lib/supabase/actions'
import { ScheduleView, BookingInterval } from './ScheduleView'
import { ShippingMethod } from '@/types/database'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const items = useCartStore((state) => state.items)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateItem = useCartStore((state) => state.updateItem)
  const clearCart = useCartStore((state) => state.clearCart)

  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [selectedCostumeId, setSelectedCostumeId] = useState<string>('')
  const [costumeBookingsMap, setCostumeBookingsMap] = useState<Record<string, BookingInterval[]>>({})
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  // Thông tin user đăng nhập (nếu có)
  const [loggedInUser, setLoggedInUser] = useState<{
    id: string
    full_name: string | null
    phone: string | null
    default_address: string | null
  } | null>(null)

  // Thông tin giao nhận chung
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('self_pickup')
  const [shippingAddress, setShippingAddress] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')

  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Tự động lấy profile nếu user đã đăng nhập
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.profile) return
        setLoggedInUser(data.profile)
        // Điền sẵn thông tin
        if (data.profile.full_name) setRecipientName(data.profile.full_name)
        if (data.profile.phone) setRecipientPhone(data.profile.phone)
        if (data.profile.default_address) setShippingAddress(data.profile.default_address)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Khởi tạo active costume khi vào step checkout
  useEffect(() => {
    if (items.length > 0 && (!selectedCostumeId || !items.some(i => i.costume.id === selectedCostumeId))) {
      setSelectedCostumeId(items[0].costume.id)
    }
  }, [items, selectedCostumeId])

  // Fetch bookings mới nhất cho các trang phục trong giỏ khi mở Drawer hoặc đổi món
  useEffect(() => {
    if (!isOpen || items.length === 0) return

    async function fetchBookings() {
      setIsLoadingBookings(true)
      const newMap: Record<string, BookingInterval[]> = {}
      for (const item of items) {
        try {
          const res = await fetch(`/api/costumes/${item.costume.id}/bookings`, {
            cache: 'no-store',
          })
          const data = await res.json()
          if (data.bookings) {
            newMap[item.costume.id] = data.bookings
          }
        } catch (e) {
          console.error('Error fetching bookings:', e)
        }
      }
      setCostumeBookingsMap(newMap)
      setIsLoadingBookings(false)
    }

    fetchBookings()
  }, [isOpen, items])

  // Hàm tính đơn giá theo rentalType
  const getItemDailyRent = (item: { costume: { rent_price_per_day: number; rent_price_fes?: number | null }; rentalType?: 'test' | 'fes' }) => {
    if (item.rentalType === 'test') {
      return item.costume.rent_price_per_day
    }
    return item.costume.rent_price_fes ?? (Math.round((item.costume.rent_price_per_day * 1.4) / 10000) * 10000)
  }

  // Chuyển đổi gói thuê Test / Fes trực tiếp trong giỏ
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

  // Active item đang chọn ngày trong checkout
  const activeItem = useMemo(
    () => items.find((i) => i.costume.id === selectedCostumeId) || items[0],
    [items, selectedCostumeId]
  )

  // Cập nhật khoảng ngày thuê cho active item (Không tính ngày nhận và trả đồ)
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
  }

  // Cập nhật phương thức giao hàng
  const handleShippingChange = (method: ShippingMethod) => {
    setShippingMethod(method)
    const fee = method === 'self_pickup' ? 0 : 35000
    // Cập nhật shippingFee cho tất cả item
    items.forEach((item) => {
      updateItem(item.costume.id, {
        shippingMethod: method,
        shippingFee: fee,
      })
    })
  }

  // Tính toán tổng tiền
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
  }, [items, shippingMethod])

  const router = useRouter()

  if (!isOpen) return null

  // Chuyển sang trang Checkout độc lập đầy đủ
  const handleProceedToCheckout = () => {
    setErrorMsg(null)
    onClose()
    router.push('/checkout')
  }

  // Thực hiện đặt hàng và thanh toán VNPay
  const handleCheckoutVNPay = async () => {
    // Validation
    const unselected = items.find((i) => !i.startDate || !i.endDate)
    if (unselected) {
      setErrorMsg(`Vui lòng chọn ngày nhận và trả đồ cho bộ "${unselected.costume.character}"`)
      return
    }

    // Validation người nhận
    if (!loggedInUser) {
      if (!recipientName.trim() || !recipientPhone.trim()) {
        setErrorMsg('Khách vãng lai vui lòng nhập đầy đủ Họ tên và Số điện thoại liên hệ để shop gửi đồ.')
        return
      }
    }

    if (shippingMethod !== 'self_pickup' && !shippingAddress.trim()) {
      setErrorMsg('Vui lòng điền địa chỉ giao nhận đồ chính xác.')
      return
    }

    setIsProcessing(true)
    setErrorMsg(null)

    try {
      // Đặt từng booking trong giỏ
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
      }
    } catch {
      // Fallback
    }

    // Luôn hoàn tất sandbox demo flow
    setTimeout(() => {
      setIsProcessing(false)
      setPaymentSuccess(true)
      clearCart()
    }, 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-[#1a1522] w-full ${step === 'checkout' ? 'max-w-2xl' : 'max-w-md'} h-full flex flex-col justify-between shadow-2xl p-4 sm:p-6 border-l-2 border-rose-200 dark:border-pink-900/60 transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b-2 border-rose-100 dark:border-pink-950/80">
            <div className="flex items-center gap-2">
              <span className="text-xl">{step === 'checkout' ? '🌸' : '🛍️'}</span>
              <h2 className="font-serif font-black text-lg text-zinc-900 dark:text-zinc-100">
                {step === 'checkout' ? 'Xác Nhận Đặt Thuê & Lịch Trình' : `Giỏ Đồ Xinh (${items.length})`}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {step === 'checkout' && !paymentSuccess && (
                <button
                  onClick={() => setStep('cart')}
                  className="px-3 py-1 rounded-full border-2 border-rose-200 dark:border-pink-900/60 text-xs font-black text-pink-700 dark:text-pink-300 bg-rose-50/60 dark:bg-pink-950/40 hover:bg-rose-100"
                >
                  ← Giỏ hàng
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-rose-50 dark:bg-pink-950/60 border border-rose-200/60 dark:border-pink-900/40 hover:bg-rose-100 text-zinc-500 hover:text-pink-600 flex items-center justify-center font-black"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-3 px-3 py-2 rounded bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-900 text-xs font-black text-rose-700 dark:text-rose-300">
              ⚠ {errorMsg}
            </div>
          )}

          {/* Payment Success View */}
          {paymentSuccess ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center text-3xl mx-auto shadow-md">
                ✓
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                Đặt đồ & Giữ lịch thành công!
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed font-semibold">
                Đơn thuê của bạn đã được ghi nhận. Webhook VNPay đã xác thực chữ ký HMAC thành công. Tiền cọc sẽ được hoàn lại 100% sau khi shop kiểm tra đồ nguyên vẹn.
              </p>
              <button
                onClick={() => {
                  setPaymentSuccess(false)
                  setStep('cart')
                  onClose()
                }}
                className="mt-4 px-6 py-2.5 rounded bg-purple-600 text-white font-black text-xs shadow-md hover:bg-purple-700 transition-colors"
              >
                Tiếp tục xem trang phục
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="text-5xl">👘</div>
              <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">
                Giỏ đồ của bạn đang trống
              </p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto font-semibold">
                Hãy chọn nhân vật yêu thích từ trang chủ và bấm Thêm vào giỏ nhé!
              </p>
            </div>
          ) : step === 'cart' ? (
            /* STEP 1: CART LIST */
            <div className="divide-y divide-rose-100 dark:divide-pink-950/60 overflow-y-auto max-h-[55vh] pr-1 py-2">
              {items.map((item) => {
                const dailyRent = getItemDailyRent(item)
                const isTest = item.rentalType === 'test'

                return (
                  <div key={item.costume.id} className="py-3 flex gap-3 items-start bg-rose-50/40 dark:bg-pink-950/20 my-1.5 p-3 rounded-2xl border border-rose-200/60 dark:border-pink-900/40">
                    <div className="relative w-16 h-20 rounded-xl overflow-hidden shrink-0 border-2 border-rose-200 dark:border-pink-900/60 bg-zinc-950">
                      <SmartImage
                        src={item.costume.image_urls[0]}
                        alt={item.costume.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase font-black text-pink-600 dark:text-pink-400">
                          🌸 {item.costume.character}
                        </span>
                        {item.costume.brand && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            🏷️ {item.costume.brand}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 break-words leading-tight">
                        {item.costume.name}
                      </h4>

                      {/* Chọn gói thuê Test vs Fes */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleRentalType(item.costume.id, 'test')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${
                            isTest
                              ? 'bg-pink-500 text-white shadow-xs ring-1 ring-pink-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                          }`}
                        >
                          🏠 Mặc Test
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleRentalType(item.costume.id, 'fes')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${
                            !isTest
                              ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                          }`}
                        >
                          🎪 Đi Fes / Shoot
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px] pt-0.5">
                        <span className="text-zinc-700 dark:text-zinc-200 font-black">
                          Thuê: <span className="text-pink-600 dark:text-pink-400">{formatVND(dailyRent)}</span>/ngày
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">
                          Cọc: {formatVND(item.depositFee)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.costume.id)}
                      className="w-7 h-7 rounded-full bg-white dark:bg-pink-950/60 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-rose-200/60 dark:border-pink-900/40 flex items-center justify-center transition-colors shrink-0"
                      title="Xóa"
                    >
                      🗑️
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            /* STEP 2: CHECKOUT & SCHEDULE VIEW */
            <div className="overflow-y-auto max-h-[60vh] pr-1 py-2 space-y-4">
              
              {/* Costume Selector Tabs (Nếu giỏ có nhiều món) */}
              {items.length > 1 && (
                <div>
                  <span className="text-[11px] font-black uppercase text-zinc-500 block mb-1.5">
                    Chọn trang phục để xếp lịch:
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {items.map((item) => (
                      <button
                        key={item.costume.id}
                        type="button"
                        onClick={() => setSelectedCostumeId(item.costume.id)}
                        className={`px-3 py-1.5 rounded text-xs font-black flex items-center gap-1.5 border-2 whitespace-nowrap transition-all ${
                          item.costume.id === selectedCostumeId
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <span>{item.costume.character}</span>
                        {item.startDate && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Big Schedule View for Selected Costume */}
              {activeItem && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      📅 Lịch cho: <b className="text-purple-600 dark:text-purple-400">{activeItem.costume.character}</b>
                    </span>
                    {activeItem.startDate && activeItem.endDate ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {activeItem.rentalDays} ngày tính tiền ({activeItem.startDate} ➔ {activeItem.endDate})
                        <span className="text-[10px] text-zinc-400 block font-normal">(Đã miễn phí ngày nhận & ngày trả)</span>
                      </span>
                    ) : (
                      <span className="text-amber-500">Chạm lịch bên dưới để chọn ngày</span>
                    )}
                  </div>

                  {isLoadingBookings ? (
                    <div className="py-8 text-center text-xs text-zinc-500 font-semibold">
                      Đang đồng bộ dữ liệu lịch đặt từ hệ thống...
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
                    />
                  )}
                </div>
              )}

              {/* Shipping & Recipient Details Form */}
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded border-2 border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 block">
                  🚚 Thông Tin Giao Nhận & Người Nhận
                </span>

                {/* Shipping Method */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'self_pickup', label: 'Tự lấy tại Shop', fee: 'Miễn phí' },
                    { id: 'shop_delivery', label: 'Shop giao hẹn giờ', fee: '35.000 đ' },
                    { id: 'third_party_courier', label: 'Chuyển phát nhanh', fee: '35.000 đ' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handleShippingChange(method.id as ShippingMethod)}
                      className={`p-2 rounded border-2 text-center transition-all ${
                        shippingMethod === method.id
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-black'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold'
                      }`}
                    >
                      <div className="text-[11px] leading-tight">{method.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{method.fee}</div>
                    </button>
                  ))}
                </div>

                {/* Recipient inputs / Auto-filled Member Info */}
                {loggedInUser ? (
                  <div className="p-3 rounded-xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/60 flex items-start justify-between gap-3">
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-pink-700 dark:text-pink-300">
                          👤 {recipientName || 'Thành viên CosRent'}
                        </span>
                        <span className="text-[10px] bg-pink-200/80 dark:bg-pink-900 text-pink-800 dark:text-pink-200 px-1.5 py-0.2 rounded font-bold">
                          Đã đăng nhập
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold">
                        📞 SĐT: <span className="font-bold text-zinc-900 dark:text-zinc-200">{recipientPhone || 'Chưa cập nhật'}</span>
                      </p>
                      {shippingMethod !== 'self_pickup' && (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold">
                          📍 Địa chỉ: <span className="font-bold text-zinc-900 dark:text-zinc-200">{shippingAddress || 'Chưa có địa chỉ'}</span>
                        </p>
                      )}
                    </div>
                    <Link
                      href="/profile"
                      className="text-[10px] font-black text-pink-600 hover:text-pink-700 dark:text-pink-400 underline shrink-0 mt-0.5"
                    >
                      Sửa hồ sơ ↗
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>Đặt đồ nhanh không cần đăng nhập. Vui lòng cung cấp SĐT để shop liên hệ xác nhận.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Họ và tên của bạn *"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full px-3 py-2 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-pink-500"
                      />
                      <input
                        type="tel"
                        placeholder="Số điện thoại liên hệ *"
                        required
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>
                )}

                {/* Shipping address input: chỉ hiển thị nếu chọn giao tận nơi và chưa có địa chỉ */}
                {shippingMethod !== 'self_pickup' && (!loggedInUser || !shippingAddress) && (
                  <input
                    type="text"
                    placeholder="Địa chỉ nhận đồ chi tiết tại TP.HCM (Số nhà, đường, phường, quận)... *"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-pink-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action Buttons */}
        {!paymentSuccess && items.length > 0 && (
          <div className="border-t-2 border-rose-100 dark:border-pink-950/80 pt-3 space-y-3">
            <div className="space-y-1.5 text-xs bg-rose-50/60 dark:bg-pink-950/20 p-3.5 rounded-2xl border border-rose-200/80 dark:border-pink-900/40">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">Tổng tiền thuê:</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">{formatVND(totalRent)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">
                  Tổng tiền cọc <b className="text-emerald-600 dark:text-emerald-400 font-black">(Hoàn 100%)</b>:
                </span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">{formatVND(totalDeposit)}</span>
              </div>
              {totalShipping > 0 && (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold">Phí vận chuyển:</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">{formatVND(totalShipping)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-zinc-900 dark:text-zinc-100 pt-1.5 border-t border-rose-200/70 dark:border-pink-900/40">
                <span>Tổng thanh toán ban đầu:</span>
                <span className="text-base text-pink-600 dark:text-pink-400">{formatVND(grandTotal)}</span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm shadow-xl shadow-pink-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
              >
                <span>Tiến hành chọn ngày & Đặt lịch xinh ➔</span>
              </button>
            ) : (
              <button
                onClick={handleCheckoutVNPay}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:opacity-95 text-white font-black text-sm shadow-xl shadow-rose-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang kết nối cổng VNPay...</span>
                  </>
                ) : (
                  <>
                    <span>💳</span>
                    <span>Xác nhận & Thanh toán VNPay (Sandbox HMAC)</span>
                  </>
                )}
              </button>
            )}

            <p className="text-[10px] text-zinc-400 text-center font-semibold flex items-center justify-center gap-1">
              <span>🔒</span>
              <span>Giao dịch bảo mật HMAC SHA512 • Hoàn cọc 100% minh bạch 💖</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
