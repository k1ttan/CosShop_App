'use client'

import React, { useState, useMemo } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfToday,
  parseISO,
  isWithinInterval,
  addDays,
  subDays,
} from 'date-fns'

export interface BookingInterval {
  id: string
  start_date: string
  end_date: string
  status: string
}

interface ScheduleViewProps {
  costumeName: string
  quantity: number
  bufferDays?: number
  bookings: BookingInterval[]
  selectedStartDate?: string
  selectedEndDate?: string
  onSelectRange?: (start: string, end: string) => void
  readOnly?: boolean
}

export function ScheduleView({
  costumeName,
  quantity,
  bufferDays = 3,
  bookings,
  selectedStartDate,
  selectedEndDate,
  onSelectRange,
  readOnly = false,
}: ScheduleViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfToday())
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
  const [multiRangeStart, setMultiRangeStart] = useState<string | null>(null)
  const [validationWarning, setValidationWarning] = useState<string | null>(null)
  const today = useMemo(() => startOfToday(), [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [startDate, endDate])

  const dateInfoMap = useMemo(() => {
    const map = new Map<
      string,
      {
        bookedCount: number
        isBuffer: boolean
        isPast: boolean
        bookingList: BookingInterval[]
      }
    >()

    const effectiveBufferDays = Math.max(3, bufferDays)

    days.forEach((day) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const isPast = isBefore(day, today)

      let bookedCount = 0
      let isBuffer = false
      const matchedBookings: BookingInterval[] = []

      bookings.forEach((b) => {
        try {
          const bStart = parseISO(b.start_date)
          const bEnd = parseISO(b.end_date)

          if (isWithinInterval(day, { start: bStart, end: bEnd })) {
            bookedCount += 1
            matchedBookings.push(b)
          } else if (quantity === 1) {
            const bufferEnd = new Date(bEnd.getTime() + effectiveBufferDays * 24 * 60 * 60 * 1000)
            if (day > bEnd && day <= bufferEnd) {
              isBuffer = true
            }
          }
        } catch {}
      })

      map.set(dayStr, {
        bookedCount,
        isBuffer,
        isPast,
        bookingList: matchedBookings,
      })
    })

    return map
  }, [days, bookings, quantity, bufferDays, today])

  const parsedSelStart = selectedStartDate ? parseISO(selectedStartDate) : null
  const parsedSelEnd = selectedEndDate ? parseISO(selectedEndDate) : null

  // Ngày mặc thực tế (nằm giữa ngày nhận và ngày trả)
  const actualUsageStart = parsedSelStart && parsedSelEnd ? addDays(parsedSelStart, 1) : null
  const actualUsageEnd = parsedSelStart && parsedSelEnd ? subDays(parsedSelEnd, 1) : null

  // Kiểm tra 1 ngày cụ thể có khả dụng hay không
  const checkDayAvailability = (day: Date): { available: boolean; reason?: string } => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const info = dateInfoMap.get(dayStr)

    if (info?.isPast || isBefore(day, today)) {
      return { available: false, reason: `Ngày ${format(day, 'dd/MM/yyyy')} là ngày trong quá khứ.` }
    }
    if (info && info.bookedCount >= quantity) {
      return { available: false, reason: `Ngày ${format(day, 'dd/MM/yyyy')} đã kín lịch thuê.` }
    }
    if (info?.isBuffer) {
      return { available: false, reason: `Ngày ${format(day, 'dd/MM/yyyy')} thuộc vùng đệm 3 ngày giặt sấy của shop.` }
    }
    return { available: true }
  }

  // Xử lý click ngày để chọn khoảng
  const handleDayClick = (day: Date) => {
    if (readOnly || !onSelectRange) return

    setValidationWarning(null)

    // Kiểm tra ngày click
    const clickCheck = checkDayAvailability(day)
    if (!clickCheck.available) {
      setValidationWarning(clickCheck.reason || 'Ngày này không thể chọn.')
      return
    }

    if (selectionMode === 'single') {
      // ── CHẾ ĐỘ THUÊ 1 NGÀY: Tự động chọn 2 ngày kế bên làm ngày nhận và trả ──
      const pickupDay = subDays(day, 1)
      const returnDay = addDays(day, 1)

      const pickupCheck = checkDayAvailability(pickupDay)
      if (!pickupCheck.available) {
        setValidationWarning(
          `Không thể chọn mặc ngày ${format(day, 'dd/MM/yyyy')} vì ngày nhận đồ phía trước (${format(pickupDay, 'dd/MM/yyyy')}) ${
            pickupCheck.reason?.toLowerCase() || 'không khả dụng'
          }`
        )
        return
      }

      const returnCheck = checkDayAvailability(returnDay)
      if (!returnCheck.available) {
        setValidationWarning(
          `Không thể chọn mặc ngày ${format(day, 'dd/MM/yyyy')} vì ngày trả đồ phía sau (${format(returnDay, 'dd/MM/yyyy')}) ${
            returnCheck.reason?.toLowerCase() || 'không khả dụng'
          }`
        )
        return
      }

      const startStr = format(pickupDay, 'yyyy-MM-dd')
      const endStr = format(returnDay, 'yyyy-MM-dd')
      onSelectRange(startStr, endStr)
    } else {
      // ── CHẾ ĐỘ THUÊ NHIỀU NGÀY: Click ngày đầu và ngày cuối, tự động mở rộng 2 ngày ngoài cùng làm ngày nhận & trả ──
      if (!multiRangeStart) {
        // Click lần 1: Chọn ngày bắt đầu mặc
        setMultiRangeStart(format(day, 'yyyy-MM-dd'))
      } else {
        // Click lần 2: Đã có ngày đầu, click ngày cuối
        const d1 = parseISO(multiRangeStart)
        const d2 = day

        const startUseDay = isBefore(d2, d1) ? d2 : d1
        const endUseDay = isBefore(d2, d1) ? d1 : d2

        // Tự động mở rộng 2 ngày ngoài cùng làm ngày nhận & trả
        const pickupDay = subDays(startUseDay, 1)
        const returnDay = addDays(endUseDay, 1)

        // Kiểm tra toàn bộ chuỗi từ ngày nhận đến ngày trả
        const entireInterval = eachDayOfInterval({ start: pickupDay, end: returnDay })
        const conflictDay = entireInterval.find((d) => !checkDayAvailability(d).available)

        if (conflictDay) {
          const err = checkDayAvailability(conflictDay)
          setValidationWarning(
            `Khoảng ngày thuê từ ${format(startUseDay, 'dd/MM/yyyy')} đến ${format(endUseDay, 'dd/MM/yyyy')} không thể đặt vì ngày ${format(conflictDay, 'dd/MM/yyyy')} ${
              err.reason?.toLowerCase() || 'không khả dụng'
            }`
          )
          setMultiRangeStart(null)
          return
        }

        const startStr = format(pickupDay, 'yyyy-MM-dd')
        const endStr = format(returnDay, 'yyyy-MM-dd')
        onSelectRange(startStr, endStr)
        setMultiRangeStart(null)
      }
    }
  }

  return (
    <div className="bg-white dark:bg-[#1a1522] border-2 border-rose-200/90 dark:border-pink-900/50 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm select-none">
      {/* Schedule Header & Month/Year Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <span className="text-[11px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider block">
            🌸 Lịch Đặt Thuê (Schedule View) {costumeName ? `• ${costumeName}` : ''}
          </span>
          <div className="flex items-center gap-2 mt-1">
            {/* Dropdown chọn Tháng */}
            <select
              value={currentMonth.getMonth()}
              onChange={(e) => {
                const newMonthIndex = parseInt(e.target.value, 10)
                const updated = new Date(currentMonth.getFullYear(), newMonthIndex, 1)
                setCurrentMonth(updated)
              }}
              className="bg-rose-50/80 dark:bg-[#251e2f] text-zinc-900 dark:text-zinc-100 font-bold text-xs px-3 py-1.5 rounded-full border border-rose-200 dark:border-pink-900/60 outline-none focus:border-pink-500 cursor-pointer shadow-xs"
              title="Chọn tháng"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i} className="bg-white dark:bg-[#251e2f] text-zinc-900 dark:text-zinc-100">
                  Tháng {i + 1}
                </option>
              ))}
            </select>

            {/* Dropdown chọn Năm */}
            <select
              value={currentMonth.getFullYear()}
              onChange={(e) => {
                const newYear = parseInt(e.target.value, 10)
                const updated = new Date(newYear, currentMonth.getMonth(), 1)
                setCurrentMonth(updated)
              }}
              className="bg-rose-50/80 dark:bg-[#251e2f] text-zinc-900 dark:text-zinc-100 font-bold text-xs px-3 py-1.5 rounded-full border border-rose-200 dark:border-pink-900/60 outline-none focus:border-pink-500 cursor-pointer shadow-xs"
              title="Chọn năm"
            >
              {Array.from({ length: 7 }, (_, i) => {
                const yearVal = today.getFullYear() - 1 + i
                return (
                  <option key={yearVal} value={yearVal} className="bg-white dark:bg-[#251e2f] text-zinc-900 dark:text-zinc-100">
                    Năm {yearVal}
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            className="w-8 h-8 rounded-full border-2 border-rose-200 dark:border-pink-900/60 bg-rose-50/50 dark:bg-pink-950/40 hover:bg-rose-100 dark:hover:bg-pink-900/60 flex items-center justify-center text-xs font-black text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Tháng trước"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(startOfToday())}
            className="px-3 py-1 rounded-full border-2 border-rose-200 dark:border-pink-900/60 bg-rose-50/50 dark:bg-pink-950/40 hover:bg-rose-100 dark:hover:bg-pink-900/60 text-[11px] font-black text-pink-700 dark:text-pink-300 transition-colors"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            className="w-8 h-8 rounded-full border-2 border-rose-200 dark:border-pink-900/60 bg-rose-50/50 dark:bg-pink-950/40 hover:bg-rose-100 dark:hover:bg-pink-900/60 flex items-center justify-center text-xs font-black text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Tháng sau"
          >
            ›
          </button>
        </div>
      </div>

      {/* ── BỘ CHỌN CHẾ ĐỘ THUÊ: 1 NGÀY HOẶC NHIỀU NGÀY ── */}
      {!readOnly && (
        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-pink-950/30 border border-rose-200/80 dark:border-pink-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-pink-700 dark:text-pink-300">
              ⚡ Chế độ chọn lịch:
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-white dark:bg-[#201828] border border-rose-200 dark:border-pink-900/60">
              <button
                type="button"
                onClick={() => {
                  setSelectionMode('single')
                  setMultiRangeStart(null)
                  setValidationWarning(null)
                }}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all ${
                  selectionMode === 'single'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-pink-600'
                }`}
              >
                Thuê 1 ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionMode('multi')
                  setMultiRangeStart(null)
                  setValidationWarning(null)
                }}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all ${
                  selectionMode === 'multi'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-purple-600'
                }`}
              >
                Thuê nhiều ngày
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
            {selectionMode === 'single' ? (
              <span>
                💡 <b>Thuê 1 ngày:</b> Chạm vào đúng 1 ngày bạn muốn mặc đồ, hệ thống sẽ <b>tự động chọn thêm 2 ngày kế bên</b> làm ngày nhận (hôm trước) và ngày trả (hôm sau).
              </span>
            ) : (
              <span>
                💡 <b>Thuê nhiều ngày:</b> Chạm <b>ngày bắt đầu mặc</b> và <b>ngày kết thúc mặc</b>, hệ thống sẽ <b>tự động mở rộng 2 ngày ngoài cùng</b> làm ngày nhận và ngày trả đồ.
                {multiRangeStart && (
                  <span className="block mt-1 text-purple-600 dark:text-purple-300 font-black">
                    👉 Đã chọn ngày bắt đầu mặc: {format(parseISO(multiRangeStart), 'dd/MM/yyyy')}. Hãy bấm tiếp ngày kết thúc!
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Warning message nếu chọn chạm vùng cấm */}
      {validationWarning && (
        <div className="px-3 py-2 rounded bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-xs font-black text-amber-800 dark:text-amber-300 animate-in fade-in">
          ⚠ {validationWarning}
        </div>
      )}

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-zinc-500 uppercase pb-1 border-b border-zinc-200 dark:border-zinc-800">
        <div>T2</div>
        <div>T3</div>
        <div>T4</div>
        <div>T5</div>
        <div>T6</div>
        <div className="text-purple-600 dark:text-purple-400">T7</div>
        <div className="text-rose-600 dark:text-rose-400">CN</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const isCurrMonth = isSameMonth(day, currentMonth)
          const info = dateInfoMap.get(dayStr)
          const isDayToday = isToday(day)

          const isBooked = (info?.bookedCount ?? 0) >= quantity
          const isBuffer = Boolean(info?.isBuffer)
          const isPast = Boolean(info?.isPast)

          const isPickup = parsedSelStart ? isSameDay(day, parsedSelStart) : false
          const isReturn = parsedSelEnd ? isSameDay(day, parsedSelEnd) : false
          const isSelectedRange =
            parsedSelStart && parsedSelEnd && isWithinInterval(day, { start: parsedSelStart, end: parsedSelEnd })
          const isWearingDay =
            actualUsageStart && actualUsageEnd && isWithinInterval(day, { start: actualUsageStart, end: actualUsageEnd })

          const isPendingMultiStart = multiRangeStart ? isSameDay(day, parseISO(multiRangeStart)) : false

          let cellBg = 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-200/80 dark:border-emerald-800/40'

          if (!isCurrMonth) {
            cellBg = 'bg-transparent text-zinc-300 dark:text-zinc-700 opacity-25 border-transparent'
          } else if (isPast) {
            cellBg = 'bg-zinc-100/70 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-600 border-zinc-200/40 dark:border-zinc-800/40 cursor-not-allowed'
          } else if (isBooked) {
            cellBg = 'bg-rose-500 dark:bg-rose-900/70 text-white dark:text-rose-100 border-rose-600 dark:border-rose-700 cursor-not-allowed shadow-xs'
          } else if (isBuffer) {
            cellBg = 'bg-amber-300/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 font-black border-amber-400 dark:border-amber-800/60 cursor-not-allowed shadow-xs'
          }

          if (isSelectedRange && !isPast && !isBooked && !isBuffer) {
            if (isPickup || isReturn) {
              cellBg = 'bg-purple-700 text-white font-black shadow-md border-purple-800 ring-2 ring-purple-300/80'
            } else if (isWearingDay) {
              cellBg = 'bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black shadow-md border-pink-600 ring-2 ring-pink-300/80'
            }
          }

          if (isPendingMultiStart) {
            cellBg = 'bg-purple-600 text-white font-black animate-pulse border-purple-700 ring-2 ring-purple-300'
          }

          return (
            <div
              key={dayStr}
              onClick={() => handleDayClick(day)}
              className={`min-h-[48px] sm:min-h-[54px] p-1.5 rounded-xl border transition-all flex flex-col justify-between ${cellBg} ${
                !readOnly && !isPast && !isBooked && !isBuffer
                  ? 'hover:scale-[1.04] cursor-pointer hover:border-pink-400 hover:shadow-md'
                  : ''
              } ${isDayToday ? 'ring-2 ring-pink-500 ring-offset-1' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-black ${isBooked || isBuffer || isSelectedRange ? 'font-extrabold' : ''}`}>
                  {format(day, 'd')}
                </span>
                {isDayToday && !isSelectedRange && (
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" title="Hôm nay" />
                )}
              </div>

              <div className="flex justify-end">
                {isPendingMultiStart ? (
                  <span className="text-[9px] font-black uppercase text-white/90">Bắt đầu</span>
                ) : isSelectedRange ? (
                  <span className="text-[9px] font-black uppercase tracking-tight text-white">
                    {isPickup ? 'Nhận' : isReturn ? 'Trả' : 'Mặc'}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note nhỏ giải thích trực quan trạng thái màu sắc theo yêu cầu */}
      <div className="bg-rose-50/70 dark:bg-pink-950/20 p-3 rounded-xl border border-rose-200/80 dark:border-pink-900/40 text-[11px] space-y-1.5">
        <span className="font-black text-zinc-700 dark:text-zinc-300 block">
          📌 Trạng thái lịch:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-bold text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-500 dark:bg-rose-900/80 shrink-0 border border-rose-600 dark:border-rose-700" />
            <span>Kín lịch</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-300 dark:bg-amber-950/80 shrink-0 border border-amber-400 dark:border-amber-700" />
            <span>Giặt sấy (3 ngày)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 shrink-0 border border-emerald-300 dark:border-emerald-800" />
            <span>Trống lịch</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-r from-pink-500 to-purple-600 shrink-0 border border-pink-600" />
            <span>Đang chọn (Nhận/Mặc/Trả)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
