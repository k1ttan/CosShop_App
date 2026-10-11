import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: Approve hoặc Reject một profile change request
// Body: { requestId, action: 'approve' | 'reject', adminNote?: string }
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Kiểm tra quyền admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Không có quyền thực hiện hành động này' }, { status: 403 })
    }

    const body = await req.json()
    const { requestId, action, adminNote } = body

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    // Lấy request cần duyệt
    const { data: changeRequest, error: fetchError } = await supabase
      .from('profile_change_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !changeRequest) {
      return NextResponse.json({ error: 'Không tìm thấy yêu cầu hoặc đã được xử lý' }, { status: 404 })
    }

    if (action === 'approve') {
      // Áp dụng thay đổi vào profiles
      const updates: Record<string, string | null> = {}
      if (changeRequest.requested_full_name !== null) {
        updates.full_name = changeRequest.requested_full_name
      }
      if (changeRequest.requested_phone !== null) {
        updates.phone = changeRequest.requested_phone
      }
      if (changeRequest.requested_default_address !== null) {
        updates.default_address = changeRequest.requested_default_address
      }
      if (changeRequest.requested_avatar_url !== null) {
        updates.avatar_url = changeRequest.requested_avatar_url
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', changeRequest.user_id)

        if (updateError) {
          console.error('[profile-changes/review] Error updating profile:', updateError.message)
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      }
    }

    // Cập nhật trạng thái request
    const { error: statusError } = await supabase
      .from('profile_change_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_note: adminNote || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (statusError) {
      console.error('[profile-changes/review] Error updating request status:', statusError.message)
      return NextResponse.json({ error: statusError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Đã duyệt và cập nhật thông tin hồ sơ' : 'Đã từ chối yêu cầu',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[profile-changes/review] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
