import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/login?confirmed=true'

  const redirectTo = new URL(next, request.url)

  const supabase = await createClient()

  // 1. Luồng PKCE Code Exchange (Authorization Code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
    console.error('Lỗi Supabase exchangeCodeForSession:', error.message)
  }

  // 2. Luồng Email OTP verify (token_hash)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
    console.error('Lỗi Supabase verifyOtp:', error.message)
  }

  // 3. Nếu không có code/token hoặc xác thực thất bại
  return NextResponse.redirect(new URL('/login?error=auth_confirmation_failed', request.url))
}
