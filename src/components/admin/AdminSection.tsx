'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { formatVND } from '@/lib/utils/helpers'
import {
  updateKycStatus,
  updateBookingStatus,
  shipBooking,
  toggleArchiveBooking,
  createCostume,
  updateCostume,
  deleteCostume,
} from '@/lib/supabase/actions'
import type { BookingWithDetails, Profile, AdminStats } from '@/lib/supabase/queries'
import { POPULAR_CARRIERS } from '@/lib/constants/carriers'
import type { Costume } from '@/types/database'
import { ImageCropperModal } from './ImageCropperModal'
import { BookingCardList } from './BookingCardList'
import { AdminChatStudio } from './AdminChatStudio'
import { getCroppedImg } from '@/lib/utils/cropImage'
import type { Area } from 'react-easy-crop'

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

export type { AdminStats }

interface ProfileChangeRequest {
  id: string
  user_id: string
  requested_full_name: string | null
  requested_phone: string | null
  requested_default_address: string | null
  requested_avatar_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    phone: string | null
    default_address: string | null
    avatar_url: string | null
    kyc_status: string
  } | null
}

interface AdminSectionProps {
  initialBookings?: BookingWithDetails[]
  initialKycProfiles?: Profile[]
  initialStats?: AdminStats
}

interface CostumeFormData {
  name: string
  series: string
  character: string
  brand: string
  description: string
  rent_price_per_day: number
  rent_price_fes: number
  deposit_price: number
  quantity: number
  buffer_days: number
  late_fee_multiplier: number
  weight_kg: number
  image_urls_raw: string
  tags_raw: string
  status: 'available' | 'rented' | 'cleaning' | 'broken' | 'hidden'
}

const DEFAULT_COSTUME_FORM: CostumeFormData = {
  name: '',
  series: '',
  character: '',
  brand: '',
  description: '',
  rent_price_per_day: 150000,
  rent_price_fes: 210000,
  deposit_price: 500000,
  quantity: 1,
  buffer_days: 3,
  late_fee_multiplier: 1.5,
  weight_kg: 1.5,
  image_urls_raw: '',
  tags_raw: '',
  status: 'available',
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export function AdminSection({
  initialBookings = [],
  initialKycProfiles = [],
  initialStats,
}: AdminSectionProps) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'inventory' | 'kyc' | 'profiles' | 'chat'>('bookings')

  // ── Profile Change Requests state ──
  const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [profileAction, setProfileAction] = useState<Record<string, 'loading' | 'done'>>({})
  const [profileAdminNote, setProfileAdminNote] = useState<Record<string, string>>({})
  const [profileRejectTarget, setProfileRejectTarget] = useState<string | null>(null)

  // ── Bookings state ──
  const [bookings, setBookings] = useState<BookingWithDetails[]>(initialBookings)
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [shippingTarget, setShippingTarget] = useState<BookingWithDetails | null>(null)
  const [shippingCarrier, setShippingCarrier] = useState<string>('ghn')
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState<string>('')
  const [shippingTrackingUrl, setShippingTrackingUrl] = useState<string>('')
  const [shippingLoading, setShippingLoading] = useState(false)
  const [viewProofBooking, setViewProofBooking] = useState<BookingWithDetails | null>(null)

  // ── KYC state ──
  const [kycProfiles, setKycProfiles] = useState<Profile[]>(initialKycProfiles)
  const [loadingKyc, setLoadingKyc] = useState(false)
  const [kycAction, setKycAction] = useState<Record<string, 'loading' | 'done'>>({})
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)

  // ── Costumes Inventory state ──
  const [costumes, setCostumes] = useState<Costume[]>([])
  const [loadingCostumes, setLoadingCostumes] = useState(false)
  const [showCostumeModal, setShowCostumeModal] = useState(false)
  const [editingCostumeId, setEditingCostumeId] = useState<string | null>(null)
  const [costumeForm, setCostumeForm] = useState<CostumeFormData>(DEFAULT_COSTUME_FORM)
  const [costumeActionLoading, setCostumeActionLoading] = useState(false)
  const [costumeError, setCostumeError] = useState<string | null>(null)

  // ── Image Upload & Crop states ──
  const [uploadingImages, setUploadingImages] = useState(false)
  const [pendingCropQueue, setPendingCropQueue] = useState<Array<{ file: File; dataUrl: string }>>([])
  const [currentCroppingItem, setCurrentCroppingItem] = useState<{ file: File; dataUrl: string } | null>(null)

  // Fetch dữ liệu từ API
  const refreshBookings = useCallback(() => {
    setLoadingBookings(true)
    fetch('/api/admin/bookings')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBookings(data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingBookings(false))
  }, [])

  const refreshKyc = useCallback(() => {
    setLoadingKyc(true)
    fetch('/api/admin/kyc')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setKycProfiles(data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingKyc(false))
  }, [])

  const refreshCostumes = useCallback(() => {
    setLoadingCostumes(true)
    fetch('/api/admin/costumes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCostumes(data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingCostumes(false))
  }, [])

  const refreshProfileRequests = useCallback(() => {
    setLoadingProfiles(true)
    fetch('/api/admin/profile-changes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProfileRequests(data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingProfiles(false))
  }, [])

  useEffect(() => {
    refreshBookings()
    refreshKyc()
    refreshCostumes()
    refreshProfileRequests()
  }, [refreshBookings, refreshKyc, refreshCostumes, refreshProfileRequests])

  // ── KYC Actions ──
  const handleKycVerify = useCallback(async (profileId: string) => {
    setKycAction((p) => ({ ...p, [profileId]: 'loading' }))
    await updateKycStatus(profileId, 'verified')
    setKycProfiles((prev) => prev.filter((p) => p.id !== profileId))
    setKycAction((p) => ({ ...p, [profileId]: 'done' }))
  }, [])

  const handleKycReject = useCallback(async (profileId: string, reason: string) => {
    if (!reason.trim()) return
    setKycAction((p) => ({ ...p, [profileId]: 'loading' }))
    await updateKycStatus(profileId, 'rejected', reason)
    setKycProfiles((prev) => prev.filter((p) => p.id !== profileId))
    setKycAction((p) => ({ ...p, [profileId]: 'done' }))
    setRejectTarget(null)
    setRejectReason('')
  }, [])

  // ── Booking Actions (State Machine Transition) ──
  const handleBookingTransition = useCallback(async (bookingId: string, newStatus: string) => {
    const res = await updateBookingStatus(bookingId, newStatus)
    if (res.success) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: newStatus as BookingWithDetails['status'] } : b
        )
      )
    } else {
      alert(res.error ?? 'Lỗi cập nhật trạng thái đơn')
    }
  }, [])

  const handleToggleArchive = useCallback(async (bookingId: string, archive: boolean) => {
    const res = await toggleArchiveBooking(bookingId, archive)
    if (res.success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, is_archived: archive } : b))
      )
    } else {
      alert(res.error || 'Lỗi cập nhật kho lưu trữ')
    }
  }, [])

  const handleShipBooking = useCallback(
    async (bookingId: string, carrierName: string, trackingNumber: string, trackingUrl?: string) => {
      const res = await shipBooking({
        bookingId,
        carrierName,
        trackingNumber,
        trackingUrl,
      })
      if (res.success) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: 'shipping',
                  carrier_name: carrierName,
                  tracking_number: trackingNumber,
                  tracking_url: trackingUrl ?? null,
                }
              : b
          )
        )
      } else {
        alert(res.error || 'Lỗi cập nhật mã vận đơn')
      }
    },
    []
  )

  const handleCarrierChange = (carrierId: string) => {
    setShippingCarrier(carrierId)
    const carrier = POPULAR_CARRIERS.find((c) => c.id === carrierId)
    if (carrier && shippingTrackingNumber.trim()) {
      setShippingTrackingUrl(carrier.getUrl(shippingTrackingNumber))
    }
  }

  const handleTrackingNumberChange = (code: string) => {
    setShippingTrackingNumber(code)
    const carrier = POPULAR_CARRIERS.find((c) => c.id === shippingCarrier)
    if (carrier && carrier.id !== 'other' && carrier.id !== 'express') {
      setShippingTrackingUrl(carrier.getUrl(code))
    }
  }

  const handleConfirmShip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shippingTarget) return
    if (!shippingTrackingNumber.trim()) {
      alert('Vui lòng nhập Mã vận đơn của bên đơn vị vận chuyển')
      return
    }

    setShippingLoading(true)
    try {
      const carrierName =
        POPULAR_CARRIERS.find((c) => c.id === shippingCarrier)?.name || shippingCarrier
      const res = await shipBooking({
        bookingId: shippingTarget.id,
        carrierName,
        trackingNumber: shippingTrackingNumber,
        trackingUrl: shippingTrackingUrl,
      })

      if (!res.success) {
        alert(res.error || 'Lỗi cập nhật giao hàng')
        return
      }

      setShippingTarget(null)
      refreshBookings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setShippingLoading(false)
    }
  }

  // ── Costume CRUD Handlers ──
  const openCreateModal = () => {
    setEditingCostumeId(null)
    setCostumeForm(DEFAULT_COSTUME_FORM)
    setCostumeError(null)
    setShowCostumeModal(true)
  }

  const openEditModal = (cos: Costume) => {
    setEditingCostumeId(cos.id)
    setCostumeForm({
      name: cos.name,
      series: cos.series,
      character: cos.character,
      brand: cos.brand ?? '',
      description: cos.description ?? '',
      rent_price_per_day: cos.rent_price_per_day,
      rent_price_fes: cos.rent_price_fes ?? (Math.round((cos.rent_price_per_day * 1.4) / 10000) * 10000),
      deposit_price: cos.deposit_price,
      quantity: cos.quantity,
      buffer_days: cos.buffer_days,
      late_fee_multiplier: cos.late_fee_multiplier,
      weight_kg: cos.weight_kg ?? 1.5,
      image_urls_raw: (cos.image_urls ?? []).join('\n'),
      tags_raw: (cos.tags ?? []).join(', '),
      status: cos.status,
    })
    setCostumeError(null)
    setShowCostumeModal(true)
  }

  // ── Image Upload & Crop Handlers ──
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newQueue: Array<{ file: File; dataUrl: string }> = []
    let loadedCount = 0

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        newQueue.push({ file, dataUrl: reader.result as string })
        loadedCount++
        if (loadedCount === files.length) {
          // Bắt đầu crop từ file đầu tiên trong hàng đợi
          setCurrentCroppingItem(newQueue[0])
          setPendingCropQueue(newQueue.slice(1))
        }
      }
      reader.readAsDataURL(file)
    })

    // Reset input để có thể chọn lại cùng 1 file nếu muốn
    e.target.value = ''
  }

  const handleCropComplete = async (croppedAreaPixels: Area) => {
    if (!currentCroppingItem) return

    try {
      setUploadingImages(true)
      // Cắt ảnh bằng canvas -> ra Blob WebP
      const croppedBlob = await getCroppedImg(
        currentCroppingItem.dataUrl,
        croppedAreaPixels,
        'image/webp',
        0.92
      )

      const croppedFile = new File(
        [croppedBlob],
        currentCroppingItem.file.name.replace(/\.[^/.]+$/, '') + '.webp',
        { type: 'image/webp' }
      )

      // Upload file đã crop lên Supabase Storage qua API route
      const formData = new FormData()
      formData.append('files', croppedFile)

      const res = await fetch('/api/admin/costumes/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi upload ảnh lên hệ thống')
      }

      const uploadedUrl = data.urls[0]

      // Thêm URL ảnh mới vào form
      setCostumeForm((prev) => {
        const currentUrls = prev.image_urls_raw
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean)
        return {
          ...prev,
          image_urls_raw: [...currentUrls, uploadedUrl].join('\n'),
        }
      })
    } catch (err: unknown) {
      console.error('Lỗi cắt/upload ảnh:', err)
      alert(err instanceof Error ? err.message : 'Lỗi xử lý ảnh')
    } finally {
      setUploadingImages(false)
      // Kiểm tra xem còn ảnh nào trong hàng đợi cần crop tiếp không
      if (pendingCropQueue.length > 0) {
        setCurrentCroppingItem(pendingCropQueue[0])
        setPendingCropQueue((prev) => prev.slice(1))
      } else {
        setCurrentCroppingItem(null)
      }
    }
  }

  const handleRemoveImage = (indexToRemove: number) => {
    setCostumeForm((prev) => {
      const urls = prev.image_urls_raw
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
      const updated = urls.filter((_, idx) => idx !== indexToRemove)
      return {
        ...prev,
        image_urls_raw: updated.join('\n'),
      }
    })
  }

  const handleSaveCostume = async (e: React.FormEvent) => {
    e.preventDefault()
    setCostumeActionLoading(true)
    setCostumeError(null)

    const imageUrls = costumeForm.image_urls_raw
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    const tags = costumeForm.tags_raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    try {
      if (editingCostumeId) {
        // Cập nhật
        const res = await updateCostume(editingCostumeId, {
          name: costumeForm.name,
          series: costumeForm.series,
          character: costumeForm.character,
          brand: costumeForm.brand.trim() || undefined,
          description: costumeForm.description,
          rent_price_per_day: Number(costumeForm.rent_price_per_day),
          rent_price_fes: Number(costumeForm.rent_price_fes),
          deposit_price: Number(costumeForm.deposit_price),
          quantity: Number(costumeForm.quantity),
          buffer_days: Number(costumeForm.buffer_days),
          late_fee_multiplier: Number(costumeForm.late_fee_multiplier),
          weight_kg: Number(costumeForm.weight_kg),
          image_urls: imageUrls,
          tags,
          status: costumeForm.status,
        })
        if (!res.success) {
          setCostumeError(res.error ?? 'Lỗi cập nhật trang phục')
          return
        }
      } else {
        // Tạo mới
        const res = await createCostume({
          name: costumeForm.name,
          series: costumeForm.series,
          character: costumeForm.character,
          brand: costumeForm.brand.trim() || undefined,
          description: costumeForm.description,
          rent_price_per_day: Number(costumeForm.rent_price_per_day),
          rent_price_fes: Number(costumeForm.rent_price_fes),
          deposit_price: Number(costumeForm.deposit_price),
          quantity: Number(costumeForm.quantity),
          buffer_days: Number(costumeForm.buffer_days),
          late_fee_multiplier: Number(costumeForm.late_fee_multiplier),
          weight_kg: Number(costumeForm.weight_kg),
          image_urls: imageUrls,
          tags,
        })
        if (!res.success) {
          setCostumeError(res.error ?? 'Lỗi thêm trang phục')
          return
        }
      }

      setShowCostumeModal(false)
      refreshCostumes()
    } catch (err: unknown) {
      setCostumeError(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setCostumeActionLoading(false)
    }
  }

  const handleDeleteCostume = async (cos: Costume) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá vĩnh viễn bộ "${cos.character}" khỏi kho?`)) {
      return
    }

    const res = await deleteCostume(cos.id)
    if (!res.success) {
      alert(res.error)
    } else {
      refreshCostumes()
    }
  }

  // ── Profile Change Request Actions ──
  const handleProfileRequestAction = useCallback(
    async (requestId: string, action: 'approve' | 'reject') => {
      const note = profileAdminNote[requestId] ?? ''
      if (action === 'reject' && !note.trim()) {
        alert('Vui lòng nhập lý do từ chối')
        return
      }
      setProfileAction((p) => ({ ...p, [requestId]: 'loading' }))
      try {
        const res = await fetch('/api/admin/profile-changes/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, action, adminNote: note }),
        })
        if (res.ok) {
          setProfileRequests((prev) => prev.filter((r) => r.id !== requestId))
          setProfileRejectTarget(null)
        } else {
          const data = await res.json()
          alert(data.error ?? 'Lỗi xử lý yêu cầu')
        }
      } catch {
        alert('Lỗi kết nối')
      } finally {
        setProfileAction((p) => ({ ...p, [requestId]: 'done' }))
      }
    },
    [profileAdminNote]
  )

  // ── Stats ──
  const stats = initialStats ?? {
    totalCostumes: costumes.length,
    pendingKyc: kycProfiles.length,
    activeBookings: bookings.filter((b) =>
      ['pending', 'confirmed', 'shipping', 'renting'].includes(b.status)
    ).length,
    overdueBookings: bookings.filter((b) => b.status === 'overdue').length,
    pendingProfileChanges: profileRequests.length,
  }

  return (
    <section className="py-4 max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded p-6 shadow-xl space-y-6">
        {/* Header & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-200 dark:border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h2 className="font-serif font-black text-xl text-zinc-900 dark:text-zinc-100">
                Trung Tâm Điều Hành Quản Trị
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mt-1 font-semibold">
              Quản lý danh sách đơn thuê, phê duyệt KYC và thêm/sửa/xoá kho trang phục.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Tổng kho', value: stats.totalCostumes, color: 'text-purple-600' },
              { label: 'Đang xử lý', value: stats.activeBookings, color: 'text-blue-600' },
              { label: 'Chờ duyệt KYC', value: stats.pendingKyc, color: 'text-amber-600' },
              { label: 'Duyệt hồ sơ', value: stats.pendingProfileChanges ?? profileRequests.length, color: 'text-violet-600' },
              { label: 'Trễ hạn ⚠', value: stats.overdueBookings, color: 'text-red-600' },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center px-3 py-2 rounded border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 min-w-[70px]"
              >
                <div className={`text-base font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-500 font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-zinc-100 dark:bg-zinc-800 p-1 rounded text-xs font-black gap-1">
          {[
            { id: 'bookings', label: `📦 Đơn Thuê (${bookings.length})` },
            { id: 'inventory', label: `👘 Kho Trang Phục (${costumes.length})` },
            { id: 'kyc', label: `🪪 Duyệt KYC (${kycProfiles.length})` },
            { id: 'profiles', label: `👤 Duyệt Hồ Sơ (${profileRequests.length})` },
            { id: 'chat', label: `💬 Tin Nhắn & Tư Vấn` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: BOOKINGS MANAGEMENT (CARDS & ARCHIVE) ── */}
        {activeTab === 'bookings' && (
          <BookingCardList
            bookings={bookings}
            loading={loadingBookings}
            onRefresh={refreshBookings}
            onStatusTransition={handleBookingTransition}
            onShipBooking={handleShipBooking}
            onToggleArchive={handleToggleArchive}
          />
        )}

        {/* ── TAB 2: INVENTORY MANAGEMENT (CRUD) ── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Kho Trang Phục ({costumes.length} bộ)
                </h3>
                <p className="text-xs text-zinc-500 font-semibold">
                  Thêm, cập nhật số lượng, chỉnh sửa giá cọc/thuê hoặc xoá bộ trang phục.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>➕</span> Thêm Trang Phục Mới
              </button>
            </div>

            {loadingCostumes && (
              <div className="text-center py-10 text-xs font-semibold text-zinc-500">
                Đang tải danh sách kho đồ...
              </div>
            )}

            {!loadingCostumes && costumes.length === 0 && (
              <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/40 rounded border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <span className="text-3xl block mb-2">👘</span>
                <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">
                  Kho đồ hiện tại đang trống
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {costumes.map((cos) => (
                <div
                  key={cos.id}
                  className="p-4 rounded border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100">
                          {cos.character}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-zinc-500 text-[11px] font-semibold">{cos.series}</p>
                          {cos.brand && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                              🏷️ {cos.brand}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          cos.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : cos.status === 'hidden'
                            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {cos.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-zinc-900 p-2.5 rounded border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <span className="text-zinc-400 font-bold block">Kho:</span>
                        <b className="text-purple-600 font-black">{cos.quantity} bộ</b>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-bold block">Tiền cọc:</span>
                        <b className="text-emerald-600 font-black">
                          {formatVND(cos.deposit_price)}
                        </b>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-bold block">🏠 Giá Test (nhà):</span>
                        <b className="text-pink-600 dark:text-pink-400 font-black">
                          {formatVND(cos.rent_price_per_day)}/ngày
                        </b>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-bold block">🎪 Giá Fes/Shoot:</span>
                        <b className="text-purple-600 dark:text-purple-400 font-black">
                          {formatVND(cos.rent_price_fes ?? (Math.round((cos.rent_price_per_day * 1.4) / 10000) * 10000))}/ngày
                        </b>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={() => openEditModal(cos)}
                      className="flex-1 py-1.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 font-black text-xs transition-colors"
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCostume(cos)}
                      className="py-1.5 px-3 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-black text-xs transition-colors"
                      title="Xoá cứng khỏi database (nếu chưa có đơn thuê)"
                    >
                      🗑️ Xoá
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: KYC APPROVAL ── */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Hồ Sơ Xác Minh Danh Tính (KYC CCCD)
              </h3>
              <button
                onClick={refreshKyc}
                className="text-xs font-black text-purple-600 hover:text-purple-700 underline"
              >
                Làm mới
              </button>
            </div>

            {loadingKyc && (
              <div className="text-center py-10 text-xs font-semibold text-zinc-500">
                Đang tải hồ sơ KYC...
              </div>
            )}

            {!loadingKyc && kycProfiles.length === 0 && (
              <div className="text-center py-12 bg-emerald-50 dark:bg-emerald-950/20 rounded border-2 border-emerald-200 dark:border-emerald-900">
                <span className="text-3xl block mb-2">✅</span>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                  Không có hồ sơ KYC nào đang chờ duyệt
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-semibold">
                  Tất cả hồ sơ đã được xử lý hoặc chưa có khách nộp mới.
                </p>
              </div>
            )}

            {kycProfiles.map((profile) => (
              <div
                key={profile.id}
                className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded space-y-3"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300 block">
                      👤 {profile.full_name ?? 'Chưa cập nhật tên'} — {profile.phone ?? 'Chưa có SĐT'}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-semibold">
                      Địa chỉ: {profile.default_address ?? 'Chưa cung cấp'}
                    </span>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 uppercase">
                    Đang chờ duyệt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded p-4 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/40 text-center min-h-[120px]">
                    <span className="text-3xl mb-1">🪪</span>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                      Ảnh CCCD/Passport
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 font-semibold">
                      {profile.cccd_image_url ? 'Đã tải lên' : 'Chưa có ảnh'}
                    </span>
                  </div>

                  <div className="space-y-2 flex flex-col justify-center">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-black">
                      Quyết định của Admin:
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={kycAction[profile.id] === 'loading'}
                        onClick={() => handleKycVerify(profile.id)}
                        className="flex-1 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm disabled:opacity-50 transition-colors"
                      >
                        ✓ Duyệt hợp lệ
                      </button>
                      <button
                        disabled={kycAction[profile.id] === 'loading'}
                        onClick={() => setRejectTarget(profile.id)}
                        className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-sm disabled:opacity-50 transition-colors"
                      >
                        ✕ Từ chối
                      </button>
                    </div>
                    {rejectTarget === profile.id && (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Nhập lý do từ chối để gửi cho user..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full px-3 py-2 rounded border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-rose-500"
                        />
                        <button
                          onClick={() => handleKycReject(profile.id, rejectReason)}
                          className="w-full py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-black text-xs"
                        >
                          Xác nhận từ chối
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 4: PROFILE CHANGE REQUESTS ── */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Yêu Cầu Thay Đổi Thông Tin Hồ Sơ
                </h3>
                <p className="text-xs text-zinc-500 font-semibold">
                  Người dùng gửi yêu cầu thay đổi tên, SĐT, địa chỉ và ảnh đại diện — Admin cần duyệt trước khi áp dụng.
                </p>
              </div>
              <button
                onClick={refreshProfileRequests}
                className="text-xs font-black text-purple-600 hover:text-purple-700 underline"
              >
                Làm mới
              </button>
            </div>

            {loadingProfiles && (
              <div className="text-center py-10 text-xs font-semibold text-zinc-500">
                Đang tải yêu cầu thay đổi hồ sơ...
              </div>
            )}

            {!loadingProfiles && profileRequests.length === 0 && (
              <div className="text-center py-12 bg-emerald-50 dark:bg-emerald-950/20 rounded border-2 border-emerald-200 dark:border-emerald-900">
                <span className="text-3xl block mb-2">✅</span>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                  Không có yêu cầu thay đổi hồ sơ nào đang chờ duyệt
                </p>
              </div>
            )}

            {profileRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border-2 border-violet-200 dark:border-violet-800/60 rounded-xl space-y-3"
              >
                {/* User info header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-violet-200 dark:border-violet-700 bg-violet-100 dark:bg-violet-900/40 flex-shrink-0 flex items-center justify-center">
                    {req.profiles?.avatar_url ? (
                      <Image
                        src={req.profiles.avatar_url}
                        alt="Avatar"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">🌸</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-violet-800 dark:text-violet-300">
                      {req.profiles?.full_name ?? 'Chưa có tên'}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-semibold">
                      SĐT: {req.profiles?.phone ?? '—'} &nbsp;|&nbsp;
                      Gửi lúc: {new Date(req.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 uppercase flex-shrink-0">
                    Chờ duyệt
                  </span>
                </div>

                {/* Requested changes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left: changes requested */}
                  <div className="space-y-2 text-xs">
                    <p className="font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">Thay đổi yêu cầu:</p>
                    {req.requested_full_name && (
                      <div className="flex gap-2 items-start">
                        <span className="text-zinc-400 font-bold w-16 flex-shrink-0">Tên:</span>
                        <div>
                          <span className="line-through text-zinc-400">{req.profiles?.full_name ?? '—'}</span>
                          <span className="ml-1 text-violet-700 dark:text-violet-300 font-black">→ {req.requested_full_name}</span>
                        </div>
                      </div>
                    )}
                    {req.requested_phone && (
                      <div className="flex gap-2 items-start">
                        <span className="text-zinc-400 font-bold w-16 flex-shrink-0">SĐT:</span>
                        <div>
                          <span className="line-through text-zinc-400">{req.profiles?.phone ?? '—'}</span>
                          <span className="ml-1 text-violet-700 dark:text-violet-300 font-black">→ {req.requested_phone}</span>
                        </div>
                      </div>
                    )}
                    {req.requested_default_address && (
                      <div className="flex gap-2 items-start">
                        <span className="text-zinc-400 font-bold w-16 flex-shrink-0">Địa chỉ:</span>
                        <div>
                          <span className="line-through text-zinc-400 block">{req.profiles?.default_address ?? '—'}</span>
                          <span className="text-violet-700 dark:text-violet-300 font-black">→ {req.requested_default_address}</span>
                        </div>
                      </div>
                    )}
                    {req.requested_avatar_url && (
                      <div className="flex gap-2 items-start">
                        <span className="text-zinc-400 font-bold w-16 flex-shrink-0">Avatar:</span>
                        <div className="flex gap-2 items-center">
                          {req.profiles?.avatar_url && (
                            <div className="w-8 h-8 rounded overflow-hidden border border-zinc-300 dark:border-zinc-600">
                              <Image src={req.profiles.avatar_url} alt="Current" width={32} height={32} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <span className="text-zinc-400">→</span>
                          <div className="w-8 h-8 rounded overflow-hidden border-2 border-violet-400">
                            <Image src={req.requested_avatar_url} alt="New" width={32} height={32} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="space-y-2 flex flex-col justify-end">
                    {profileRejectTarget === req.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Lý do từ chối (bắt buộc)..."
                          value={profileAdminNote[req.id] ?? ''}
                          onChange={(e) =>
                            setProfileAdminNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-rose-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleProfileRequestAction(req.id, 'reject')}
                            disabled={profileAction[req.id] === 'loading'}
                            className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-black text-xs disabled:opacity-50 transition-colors"
                          >
                            Xác nhận từ chối
                          </button>
                          <button
                            onClick={() => setProfileRejectTarget(null)}
                            className="py-2 px-3 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-black text-xs"
                          >
                            Huỷ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProfileRequestAction(req.id, 'approve')}
                          disabled={profileAction[req.id] === 'loading'}
                          className="flex-1 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm disabled:opacity-50 transition-colors"
                        >
                          ✓ Duyệt & Áp dụng
                        </button>
                        <button
                          onClick={() => setProfileRejectTarget(req.id)}
                          disabled={profileAction[req.id] === 'loading'}
                          className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-sm disabled:opacity-50 transition-colors"
                        >
                          ✕ Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 5: CHAT & CONSULTATION STUDIO ── */}
        {activeTab === 'chat' && (
          <AdminChatStudio />
        )}
      </div>

      {/* ── COSTUME MODAL (CREATE / EDIT) ── */}
      {showCostumeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowCostumeModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded max-w-lg w-full p-6 shadow-2xl space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-serif font-black text-lg text-zinc-900 dark:text-zinc-100">
                {editingCostumeId ? '✏️ Chỉnh Sửa Trang Phục' : '➕ Thêm Trang Phục Mới'}
              </h3>
              <button
                onClick={() => setShowCostumeModal(false)}
                className="text-zinc-400 hover:text-zinc-600 font-black text-lg"
              >
                ✕
              </button>
            </div>

            {costumeError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-black rounded">
                {costumeError}
              </div>
            )}

            <form onSubmit={handleSaveCostume} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Tên nhân vật *</label>
                  <input
                    type="text"
                    required
                    value={costumeForm.character}
                    onChange={(e) => setCostumeForm({ ...costumeForm, character: e.target.value })}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VD: Raiden Shogun"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Series / Anime *</label>
                  <input
                    type="text"
                    required
                    value={costumeForm.series}
                    onChange={(e) => setCostumeForm({ ...costumeForm, series: e.target.value })}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VD: Genshin Impact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Tiêu đề bộ đồ *</label>
                  <input
                    type="text"
                    required
                    value={costumeForm.name}
                    onChange={(e) => setCostumeForm({ ...costumeForm, name: e.target.value })}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VD: Raiden Shogun - Lôi Thần Ei (Full Set)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Hãng đồ / Studio (Brand)</label>
                  <input
                    type="text"
                    value={costumeForm.brand}
                    onChange={(e) => setCostumeForm({ ...costumeForm, brand: e.target.value })}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VD: Uwowo, DokiDoki, Manmei..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Giá Test mặc nhà *</label>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={10000}
                    value={costumeForm.rent_price_per_day}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setCostumeForm({
                        ...costumeForm,
                        rent_price_per_day: val,
                        // Tự động gợi ý giá Fes tăng ~40% nếu chưa sửa
                        rent_price_fes: costumeForm.rent_price_fes ? costumeForm.rent_price_fes : Math.round((val * 1.4) / 10000) * 10000,
                      })
                    }}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VNĐ/ngày"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Giá Fes / Shoot *</label>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={10000}
                    value={costumeForm.rent_price_fes}
                    onChange={(e) =>
                      setCostumeForm({ ...costumeForm, rent_price_fes: Number(e.target.value) })
                    }
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    placeholder="VNĐ/ngày"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Tiền cọc (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={10000}
                    value={costumeForm.deposit_price}
                    onChange={(e) =>
                      setCostumeForm({ ...costumeForm, deposit_price: Number(e.target.value) })
                    }
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Số bộ sẵn có</label>
                  <input
                    type="number"
                    min={1}
                    value={costumeForm.quantity}
                    onChange={(e) => setCostumeForm({ ...costumeForm, quantity: Number(e.target.value) })}
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Ngày buffer</label>
                  <input
                    type="number"
                    min={0}
                    value={costumeForm.buffer_days}
                    onChange={(e) =>
                      setCostumeForm({ ...costumeForm, buffer_days: Number(e.target.value) })
                    }
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">Trạng thái</label>
                  <select
                    value={costumeForm.status}
                    onChange={(e) =>
                      setCostumeForm({
                        ...costumeForm,
                        status: e.target.value as CostumeFormData['status'],
                      })
                    }
                    className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  >
                    <option value="available">available (Hiện)</option>
                    <option value="hidden">hidden (Ẩn)</option>
                    <option value="cleaning">cleaning (Đang giặt)</option>
                    <option value="broken">broken (Hỏng)</option>
                  </select>
                </div>
              </div>

              {/* ── IMAGE UPLOAD & MANAGEMENT ── */}
              <div className="space-y-2 border-t border-b border-zinc-200 dark:border-zinc-800 py-3">
                <div className="flex items-center justify-between">
                  <label className="font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🖼️ Hình ảnh trang phục</span>
                    <span className="text-[10px] text-zinc-500 font-semibold">(Tỉ lệ chuẩn 3:4)</span>
                  </label>
                  {uploadingImages && (
                    <span className="text-[11px] font-black text-purple-600 animate-pulse">
                      ⏳ Đang xử lý & tải ảnh...
                    </span>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded border-2 border-dashed border-purple-400 dark:border-purple-600/70 hover:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-black cursor-pointer transition-all hover:bg-purple-100/50">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Chọn ảnh từ thiết bị (Hỗ trợ nhiều ảnh)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleSelectFiles}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                  </label>
                </div>

                {/* Thumbnails list */}
                {costumeForm.image_urls_raw.split('\n').filter(Boolean).length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {costumeForm.image_urls_raw
                      .split('\n')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((url, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-[3/4] rounded overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 group"
                        >
                          <img
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              Ảnh chính
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-[10px] font-black shadow transition-transform group-hover:scale-110"
                            title="Xóa ảnh này"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Direct URL text area fallback */}
                <details className="text-[11px] text-zinc-500">
                  <summary className="cursor-pointer font-bold hover:text-purple-600">
                    🔗 Hoặc dán đường link URL ảnh trực tiếp
                  </summary>
                  <textarea
                    rows={2}
                    value={costumeForm.image_urls_raw}
                    onChange={(e) => setCostumeForm({ ...costumeForm, image_urls_raw: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full mt-1.5 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  />
                </details>
              </div>

              <div className="space-y-1">
                <label className="font-black text-zinc-700 dark:text-zinc-300">Mô tả chi tiết</label>
                <textarea
                  rows={2}
                  value={costumeForm.description}
                  onChange={(e) => setCostumeForm({ ...costumeForm, description: e.target.value })}
                  placeholder="Gồm áo, quần, wig, vũ khí..."
                  className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCostumeModal(false)}
                  className="flex-1 py-2 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-black uppercase tracking-wider"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={costumeActionLoading}
                  className="flex-1 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {costumeActionLoading ? 'Đang lưu...' : 'Lưu Trang Phục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SHIPPING MODAL (NHẬP MÃ VẬN ĐƠN BÊN THỨ 3) ── */}
      {shippingTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShippingTarget(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <div>
                  <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100">
                    Cập Nhật Đang Giao Hàng
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-bold">
                    Mã đơn: #{shippingTarget.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShippingTarget(null)}
                className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmShip} className="p-5 space-y-4 text-xs">
              {/* Order Info Card */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Khách hàng:</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">
                    {shippingTarget.profile?.full_name ?? shippingTarget.guest_name ?? 'Khách vãng lai'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Trang phục:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {shippingTarget.costume?.character} ({shippingTarget.costume?.series})
                  </span>
                </div>
                {shippingTarget.shipping_address && (
                  <div className="flex justify-between text-zinc-500">
                    <span className="font-semibold">Địa chỉ giao:</span>
                    <span className="font-semibold text-right max-w-[240px] truncate text-zinc-700 dark:text-zinc-300">
                      {shippingTarget.shipping_address}
                    </span>
                  </div>
                )}
              </div>

              {/* Carrier Selector */}
              <div className="space-y-1.5">
                <label className="font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>🏢 Đơn vị vận chuyển bên thứ 3</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={shippingCarrier}
                  onChange={(e) => handleCarrierChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                >
                  {POPULAR_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tracking Number */}
              <div className="space-y-1.5">
                <label className="font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>🏷️ Mã vận đơn (Tracking Code)</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shippingTrackingNumber}
                  onChange={(e) => handleTrackingNumberChange(e.target.value)}
                  placeholder="Ví dụ: GHN12345678, GHTK8829..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>

              {/* Tracking URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-black text-zinc-700 dark:text-zinc-300">
                    🔗 Đường link tra cứu hành trình
                  </label>
                  {shippingTrackingUrl && (
                    <a
                      href={shippingTrackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-600 dark:text-pink-400 font-bold underline text-[11px]"
                    >
                      Kiểm tra link ↗
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  value={shippingTrackingUrl}
                  onChange={(e) => setShippingTrackingUrl(e.target.value)}
                  placeholder="https://donhang.ghn.vn/?order_code=..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] focus:ring-2 focus:ring-pink-500 outline-none"
                />
                <p className="text-[10px] text-zinc-400">
                  Link tra cứu sẽ tự động gửi kèm trong thông báo để khách hàng bấm xem ngay.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShippingTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-black uppercase tracking-wider transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={shippingLoading || !shippingTrackingNumber.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-sm"
                >
                  {shippingLoading ? 'Đang cập nhật...' : 'Xác Nhận Gửi Hàng ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW RECEIVED PROOF PHOTOS MODAL ── */}
      {viewProofBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setViewProofBooking(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">📸</span>
                <div>
                  <h3 className="font-serif font-black text-base text-zinc-900 dark:text-zinc-100">
                    Ảnh Bằng Chứng Khách Nhận Đồ Lúc Mở Hộp
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-bold">
                    Đơn: #{viewProofBooking.id.slice(0, 8).toUpperCase()} • {viewProofBooking.profile?.full_name ?? viewProofBooking.guest_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewProofBooking(null)}
                className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {viewProofBooking.received_at && (
                <div className="text-xs text-zinc-500 font-semibold flex items-center gap-2">
                  <span>🕒 Thời gian khách xác nhận:</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 font-bold">
                    {new Date(viewProofBooking.received_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}

              {viewProofBooking.received_note && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-0.5">
                    Ghi chú của khách:
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 italic">
                    &ldquo;{viewProofBooking.received_note}&rdquo;
                  </p>
                </div>
              )}

              {/* Photo grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(viewProofBooking.received_images ?? []).map((imgUrl, idx) => (
                  <a
                    key={idx}
                    href={imgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 group shadow-xs"
                  >
                    <img
                      src={imgUrl}
                      alt={`Proof ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                      Phóng to ↗
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-right bg-zinc-50 dark:bg-zinc-800/40">
              <button
                onClick={() => setViewProofBooking(null)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 text-xs font-black uppercase tracking-wider"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE CROPPER MODAL ── */}
      {currentCroppingItem && (
        <ImageCropperModal
          imageSrc={currentCroppingItem.dataUrl}
          aspectRatio={3 / 4}
          onComplete={handleCropComplete}
          onCancel={() => {
            // Nếu hủy crop ảnh hiện tại, chuyển sang ảnh tiếp theo nếu có
            if (pendingCropQueue.length > 0) {
              setCurrentCroppingItem(pendingCropQueue[0])
              setPendingCropQueue((prev) => prev.slice(1))
            } else {
              setCurrentCroppingItem(null)
            }
          }}
        />
      )}
    </section>
  )
}
