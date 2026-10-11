import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return null
  return user
}

// GET: Lấy danh sách tất cả profile change requests (pending)
export async function GET() {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Bước 1: Lấy danh sách profile_change_requests
    const { data: requests, error: reqError } = await supabase
      .from('profile_change_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (reqError) {
      console.error('[profile-changes] Error fetching requests:', reqError.message)
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json([])
    }

    // Bước 2: Lấy thông tin profiles của các user tương ứng để tránh phụ thuộc quan hệ PostgREST FK
    const userIds = Array.from(new Set(requests.map((r) => r.user_id)))
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, default_address, avatar_url, kyc_status')
      .in('id', userIds)

    if (profError) {
      console.error('[profile-changes] Error fetching user profiles:', profError.message)
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    const combined = requests.map((req) => ({
      ...req,
      profiles: profileMap.get(req.user_id) ?? null,
    }))

    return NextResponse.json(combined)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[profile-changes] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
