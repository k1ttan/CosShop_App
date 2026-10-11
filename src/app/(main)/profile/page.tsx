'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { evaluatePasswordStrength } from '@/lib/validations/password'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  default_address: string | null
  avatar_url: string | null
  kyc_status: 'unsubmitted' | 'pending' | 'verified' | 'rejected'
  is_admin: boolean
  created_at: string
}

interface PendingRequest {
  id: string
  requested_full_name: string | null
  requested_phone: string | null
  requested_default_address: string | null
  requested_avatar_url: string | null
  status: 'pending'
  created_at: string
}

type ActiveTab = 'info' | 'password'

const KYC_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  unsubmitted: {
    label: 'Chưa xác minh',
    color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    icon: '⬜',
  },
  pending: {
    label: 'Đang chờ duyệt',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    icon: '⏳',
  },
  verified: {
    label: 'Đã xác minh ✓',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    icon: '✅',
  },
  rejected: {
    label: 'Bị từ chối',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
    icon: '❌',
  },
}

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string>('')
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('info')

  // Form state for editing
  const [formFullName, setFormFullName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Submission states
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error)
        return
      }
      setProfile(data.profile)
      setEmail(data.email ?? '')
      setPendingRequest(data.pendingRequest)

      // Điền form từ profile hiện tại
      setFormFullName(data.profile?.full_name ?? '')
      setFormPhone(data.profile?.phone ?? '')
      setFormAddress(data.profile?.default_address ?? '')
      setFormAvatarUrl(data.profile?.avatar_url ?? null)
    } catch {
      setErrorMsg('Không thể tải thông tin hồ sơ')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to storage
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi upload ảnh')
      }
      setFormAvatarUrl(data.url)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi upload ảnh đại diện')
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSubmitInfoChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const currentProfile = profile
      const payload: Record<string, string | null> = {}

      if (formFullName !== (currentProfile?.full_name ?? '')) {
        payload.full_name = formFullName || null
      }
      if (formPhone !== (currentProfile?.phone ?? '')) {
        payload.phone = formPhone || null
      }
      if (formAddress !== (currentProfile?.default_address ?? '')) {
        payload.default_address = formAddress || null
      }
      if (formAvatarUrl !== (currentProfile?.avatar_url ?? null)) {
        payload.avatar_url = formAvatarUrl
      }

      if (Object.keys(payload).length === 0) {
        setErrorMsg('Bạn chưa thay đổi thông tin nào')
        return
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Lỗi gửi yêu cầu')
        return
      }

      setSuccessMsg('✨ Yêu cầu thay đổi đã được gửi! Admin sẽ duyệt và cập nhật hồ sơ của bạn sớm nhất có thể.')
      await fetchProfile()
    } catch {
      setErrorMsg('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)

    const strength = evaluatePasswordStrength(newPassword)
    if (!strength.isValid) {
      setPasswordMsg({ type: 'error', text: strength.errorMessage || 'Mật khẩu chưa đáp ứng tiêu chuẩn an toàn' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPasswordMsg({ type: 'error', text: data.error ?? 'Lỗi đổi mật khẩu' })
        return
      }

      setPasswordMsg({ type: 'success', text: '🔒 Đổi mật khẩu thành công!' })
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordMsg({ type: 'error', text: 'Lỗi kết nối. Vui lòng thử lại.' })
    } finally {
      setSubmitting(false)
    }
  }

  const currentAvatar = avatarPreview ?? formAvatarUrl ?? profile?.avatar_url
  const kycBadge = KYC_BADGE[profile?.kyc_status ?? 'unsubmitted']

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-pink-300 border-t-pink-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-zinc-500">Đang tải hồ sơ...</p>
        </div>
      </div>
    )
  }

  const handleGoBack = () => {
    // Nếu có lịch sử trình duyệt trước đó, quay về; nếu mở tab mới hoặc không có lịch sử thì về trang chủ
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <main className="min-h-screen pb-28 sm:pb-12 pt-4 sm:pt-6 px-4 max-w-2xl mx-auto space-y-4">
      {/* ── Nút quay về (Back Button) ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1f1a24] border-2 border-rose-200/80 dark:border-pink-900/60 text-xs font-black text-zinc-700 dark:text-zinc-200 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-300 transition-all shadow-xs group cursor-pointer"
          title="Quay lại trang trước"
        >
          <span className="text-sm transition-transform group-hover:-translate-x-0.5">←</span>
          <span>Quay lại</span>
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition-colors"
        >
          <span>🌸</span>
          <span>Về Trang Chủ</span>
        </Link>
      </div>

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 p-6 shadow-xl shadow-pink-500/20">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />

        <div className="relative flex items-center gap-5">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-3 border-white/50 shadow-lg bg-white/20 flex-shrink-0">
              {currentAvatar ? (
                <Image
                  src={currentAvatar}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  🌸
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!!pendingRequest || uploadingAvatar}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white text-pink-600 rounded-full flex items-center justify-center shadow-md text-xs font-black hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Đổi ảnh đại diện"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-serif font-black text-xl text-white truncate">
              {profile?.full_name ?? 'Chưa cập nhật tên'}
            </h1>
            <p className="text-pink-100 text-sm font-semibold truncate">{email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${kycBadge.color}`}>
                {kycBadge.icon} {kycBadge.label}
              </span>
              {profile?.is_admin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                  🛡️ Quản trị viên
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Request Banner ── */}
      {pendingRequest && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800/60 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">⏳</span>
            <div>
              <p className="font-black text-amber-800 dark:text-amber-300">
                Bạn đang có yêu cầu thay đổi thông tin đang chờ Admin duyệt
              </p>
              <p className="text-amber-700/70 dark:text-amber-400/70 text-xs mt-1 font-semibold">
                Gửi lúc: {new Date(pendingRequest.created_at).toLocaleString('vi-VN')}
              </p>
              <div className="mt-2 text-xs space-y-0.5 font-semibold text-amber-800 dark:text-amber-400">
                {pendingRequest.requested_full_name && (
                  <p>• Tên mới: <span className="font-black">{pendingRequest.requested_full_name}</span></p>
                )}
                {pendingRequest.requested_phone && (
                  <p>• SĐT mới: <span className="font-black">{pendingRequest.requested_phone}</span></p>
                )}
                {pendingRequest.requested_default_address && (
                  <p>• Địa chỉ mới: <span className="font-black">{pendingRequest.requested_default_address}</span></p>
                )}
                {pendingRequest.requested_avatar_url && (
                  <p>• Ảnh đại diện mới đang chờ duyệt</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC CTA (nếu chưa submit) ── */}
      {(profile?.kyc_status === 'unsubmitted' || profile?.kyc_status === 'rejected') && (
        <Link
          href="/profile/kyc"
          className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-2 border-purple-200 dark:border-purple-800/50 hover:border-purple-400 dark:hover:border-purple-600 transition-colors group"
        >
          <span className="text-2xl">🪪</span>
          <div className="flex-1">
            <p className="font-black text-purple-800 dark:text-purple-300 text-sm group-hover:text-purple-600 dark:group-hover:text-purple-200 transition-colors">
              {profile?.kyc_status === 'rejected' ? '⚠️ KYC bị từ chối — Nộp lại ngay' : 'Xác minh danh tính (KYC) để thuê đồ'}
            </p>
            <p className="text-xs text-purple-600/70 dark:text-purple-400/70 font-semibold mt-0.5">
              Tải ảnh CCCD lên để được Admin xác minh và bắt đầu đặt thuê trang phục
            </p>
          </div>
          <span className="text-purple-400 group-hover:translate-x-1 transition-transform">›</span>
        </Link>
      )}

      {/* ── Tab Switcher ── */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl mb-5 text-xs font-black gap-1">
        {[
          { id: 'info' as const, label: '👤 Thông Tin Cá Nhân' },
          { id: 'password' as const, label: '🔒 Đổi Mật Khẩu' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSuccessMsg(null)
              setErrorMsg(null)
              setPasswordMsg(null)
            }}
            className={`flex-1 py-2.5 px-3 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-sm border border-rose-200 dark:border-pink-950'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: THÔNG TIN CÁ NHÂN ── */}
      {activeTab === 'info' && (
        <form onSubmit={handleSubmitInfoChange} className="space-y-4">
          <div className="bg-white dark:bg-[#1f1a24] border-2 border-rose-100 dark:border-pink-950/60 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-pink-950/40">
              <span className="text-base">✨</span>
              <h2 className="font-black text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Thông Tin Cá Nhân
              </h2>
            </div>

            {/* Email (readonly) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Email (không thể thay đổi)
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm font-semibold text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              />
            </div>

            {/* Họ tên */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Họ và Tên
              </label>
              <input
                type="text"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                disabled={!!pendingRequest}
                placeholder="Nhập họ tên đầy đủ"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-pink-400 dark:focus:border-pink-600 bg-white dark:bg-zinc-800/50 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Số điện thoại */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Số Điện Thoại
              </label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                disabled={!!pendingRequest}
                placeholder="VD: 0912 345 678"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-pink-400 dark:focus:border-pink-600 bg-white dark:bg-zinc-800/50 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Địa chỉ nhận hàng */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Địa Chỉ Nhận Hàng Mặc Định
              </label>
              <textarea
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                disabled={!!pendingRequest}
                rows={3}
                placeholder="VD: 123 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-pink-400 dark:focus:border-pink-600 bg-white dark:bg-zinc-800/50 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-600 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Avatar preview info */}
            {formAvatarUrl && formAvatarUrl !== profile?.avatar_url && (
              <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/50 text-xs text-pink-700 dark:text-pink-400 font-semibold">
                📷 Đã chọn ảnh đại diện mới — sẽ được cập nhật khi Admin duyệt
              </div>
            )}

            {/* Messages */}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-400">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Submit note */}
          {!pendingRequest && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500 font-semibold text-center px-2">
              ⚠️ Thay đổi thông tin sẽ cần Admin duyệt trước khi có hiệu lực
            </p>
          )}

          <button
            type="submit"
            disabled={!!pendingRequest || submitting || uploadingAvatar}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-pink-500/25 transition-all hover:scale-[1.01] hover:shadow-pink-500/35 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
          >
            {submitting
              ? '⏳ Đang gửi...'
              : pendingRequest
              ? '🔒 Đang chờ Admin duyệt'
              : '✨ Gửi Yêu Cầu Thay Đổi'}
          </button>
        </form>
      )}

      {/* ── TAB 2: ĐỔI MẬT KHẨU ── */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="bg-white dark:bg-[#1f1a24] border-2 border-rose-100 dark:border-pink-950/60 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-pink-950/40">
              <span className="text-base">🔒</span>
              <h2 className="font-black text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Đổi Mật Khẩu
              </h2>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold text-blue-700 dark:text-blue-400">
              ℹ️ Đổi mật khẩu được áp dụng ngay lập tức, không cần Admin duyệt.
            </div>

            {/* Mật khẩu mới */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Mật Khẩu Mới
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-pink-400 dark:focus:border-pink-600 bg-white dark:bg-zinc-800/50 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showNewPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Xác Nhận Mật Khẩu Mới
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-pink-400 dark:focus:border-pink-600 bg-white dark:bg-zinc-800/50 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-rose-500 font-semibold">Mật khẩu không khớp</p>
              )}
            </div>

            {/* Password strength indicator */}
            <PasswordStrengthMeter password={newPassword} />

            {/* Message */}
            {passwordMsg && (
              <div
                className={`p-3 rounded-xl border-2 text-xs font-semibold ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !newPassword || !confirmPassword}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
          >
            {submitting ? '⏳ Đang cập nhật...' : '🔒 Đổi Mật Khẩu Ngay'}
          </button>
        </form>
      )}

      {/* ── Quick Links ── */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/profile/bookings"
          className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#1f1a24] border-2 border-zinc-100 dark:border-zinc-800 hover:border-pink-300 dark:hover:border-pink-800 transition-colors group"
        >
          <span className="text-2xl">📦</span>
          <div>
            <p className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">Đơn Thuê</p>
            <p className="text-[11px] text-zinc-500 font-semibold">Xem lịch sử thuê đồ</p>
          </div>
        </Link>
        <Link
          href="/profile/kyc"
          className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#1f1a24] border-2 border-zinc-100 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-800 transition-colors group"
        >
          <span className="text-2xl">🪪</span>
          <div>
            <p className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Xác Minh KYC</p>
            <p className="text-[11px] text-zinc-500 font-semibold">Xem trạng thái CCCD</p>
          </div>
        </Link>
      </div>
    </main>
  )
}
