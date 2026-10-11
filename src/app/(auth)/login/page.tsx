'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/supabase/actions'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await signIn({ email, password })
      if (!res.success) {
        setError(res.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.')
        setLoading(false)
        return
      }

      if (res.isAdmin && redirect === '/') {
        router.push('/dashboard')
      } else {
        router.push(redirect)
      }
      router.refresh()
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
          Đăng nhập hệ thống
        </h2>
        <p className="mt-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          Chưa có tài khoản?{' '}
          <Link
            href="/register"
            className="font-black text-purple-600 hover:text-purple-500 dark:text-purple-400 underline underline-offset-4"
          >
            Đăng ký ngay
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

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 transition-colors"
              />
            </div>

            <div>
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
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <span>Đăng nhập</span>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white text-xs font-black">Đang tải trang đăng nhập...</div>}>
      <LoginForm />
    </Suspense>
  )
}
