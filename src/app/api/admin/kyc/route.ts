import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/kyc — Danh sách KYC chờ duyệt
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('kyc_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/kyc]', error.message)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/admin/kyc]', err)
    return NextResponse.json([], { status: 200 })
  }
}

// PATCH /api/admin/kyc — Duyệt hoặc từ chối KYC
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json() as {
      profileId: string
      status: 'verified' | 'rejected'
      rejectionReason?: string
    }

    const { profileId, status, rejectionReason } = body

    if (!profileId || !status) {
      return NextResponse.json({ error: 'profileId và status là bắt buộc' }, { status: 400 })
    }

    const updatePayload: Record<string, string | null> = { kyc_status: status }
    if (status === 'rejected' && rejectionReason) {
      updatePayload.kyc_rejection_reason = rejectionReason
    } else {
      updatePayload.kyc_rejection_reason = null
    }

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileId)
      .select('id, kyc_status, kyc_rejection_reason')
      .single()

    if (error) {
      console.error('[PATCH /api/admin/kyc]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: updatedProfile })
  } catch (err) {
    console.error('[PATCH /api/admin/kyc]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
