import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: Đổi mật khẩu (áp dụng ngay, không cần Admin duyệt)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await req.json()
    const { newPassword } = body

    const { evaluatePasswordStrength } = await import('@/lib/validations/password')
    const strength = evaluatePasswordStrength(newPassword || '')

    if (!strength.isValid) {
      return NextResponse.json(
        { error: strength.errorMessage || 'Mật khẩu chưa đáp ứng tiêu chuẩn an toàn' },
        { status: 400 }
      )
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      console.error('[change-password] Error updating password:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[change-password] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
