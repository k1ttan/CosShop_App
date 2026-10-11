import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: Lấy thông tin profile + pending request của user hiện tại
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, default_address, avatar_url, kyc_status, is_admin, created_at')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[api/profile GET] Error loading profile:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Lấy pending request gần nhất
    const { data: pendingRequest } = await supabase
      .from('profile_change_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      profile,
      email: user.email,
      pendingRequest: pendingRequest ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[api/profile GET] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Gửi yêu cầu thay đổi thông tin (chờ Admin duyệt)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Kiểm tra xem đã có pending request chưa
    const { data: existingPending } = await supabase
      .from('profile_change_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPending) {
      return NextResponse.json(
        {
          error:
            'Bạn đang có yêu cầu thay đổi thông tin chờ Admin duyệt. Vui lòng đợi kết quả trước khi gửi yêu cầu mới.',
        },
        { status: 409 }
      )
    }

    const body = await req.json()
    const { full_name, phone, default_address, avatar_url } = body

    // Phải có ít nhất 1 trường thay đổi
    if (!full_name && !phone && !default_address && !avatar_url) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp ít nhất một trường thông tin cần thay đổi' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('profile_change_requests')
      .insert({
        user_id: user.id,
        requested_full_name: full_name || null,
        requested_phone: phone || null,
        requested_default_address: default_address || null,
        requested_avatar_url: avatar_url || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[api/profile POST] Error inserting change request:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, request: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[api/profile POST] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
