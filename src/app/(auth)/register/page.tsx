'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/supabase/actions'

import { evaluatePasswordStrength } from '@/lib/validations/password'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

export default function RegisterPage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    defaultAddress: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Kiểm tra quy chuẩn mật khẩu an toàn
    const strength = evaluatePasswordStrength(formData.password)
    if (!strength.isValid) {
      setError(strength.errorMessage || 'Mật khẩu chưa đáp ứng tiêu chuẩn an toàn')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)

    try {
      const res = await signUp({
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        phone: formData.phone,
        default_address: formData.defaultAddress,
      })

      if (!res.success) {
        setError(res.error || 'Đăng ký không thành công. Vui lòng thử lại.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } catch {
      setError('Đã xảy ra lỗi kết nối, vui lòng thử lại sau.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Link href="/" className="flex items-center justify-center gap-2 group mb-6">
          <div className="w-12 h-12 rounded bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <span className="text-2xl font-bold">👘</span>
          </div>
          <div>
            <span className="font-serif font-black text-2xl tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
              CosRent
            </span>
            <span className="block text-[11px] font-black tracking-wider text-purple-600 dark:text-purple-400 uppercase -mt-1">
              Cosplay Rental
            </span>
          </div>
        </Link>
        <h2 className="text-center text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
          Tạo tài khoản mới
        </h2>
        <p className="mt-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="font-black text-purple-600 hover:text-purple-500 dark:text-purple-400 underline underline-offset-4"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-xl border-2 border-zinc-200 dark:border-zinc-800 rounded">
          {error && (
            <div className="mb-6 p-4 rounded bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Đăng ký thành công! Đang chuyển hướng sang trang đăng nhập...</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Họ và tên
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Số điện thoại
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="0912345678"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="defaultAddress"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Địa chỉ nhận đồ
              </label>
              <input
                id="defaultAddress"
                name="defaultAddress"
                type="text"
                value={formData.defaultAddress}
                onChange={handleChange}
                placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Ít nhất 8 ký tự, gồm Hoa, Thường, Số"
                  className="w-full px-3.5 py-2.5 pr-10 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100 transition-opacity"
                  title={showPassword ? 'Ẩn' : 'Hiện'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Password strength & criteria checklist */}
              <PasswordStrengthMeter password={formData.password} />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full px-3.5 py-2.5 pr-10 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100 transition-opacity"
                  title={showConfirmPassword ? 'Ẩn' : 'Hiện'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-[11px] font-bold text-rose-500">Mật khẩu xác nhận không khớp</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider shadow-md hover:shadow-purple-500/20 active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Đang đăng ký...</span>
                  </>
                ) : (
                  <span>Tạo tài khoản</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <Link
              href="/"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
            >
              <span>← Quay lại trang chủ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
