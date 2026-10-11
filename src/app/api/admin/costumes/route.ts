import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCostume, updateCostume, deleteCostume } from '@/lib/supabase/actions'

export const dynamic = 'force-dynamic'

// GET /api/admin/costumes — Lấy tất cả costumes bao gồm cả hidden để quản trị
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

    const { data: costumes, error } = await supabase
      .from('costumes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(costumes ?? [])
  } catch (err) {
    console.error('[GET /api/admin/costumes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/costumes — Tạo costume mới
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await createCostume(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, costumeId: result.costumeId })
  } catch (err) {
    console.error('[POST /api/admin/costumes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/costumes — Sửa costume
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...data } = body
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID trang phục' }, { status: 400 })
    }
    const result = await updateCostume(id, data)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/admin/costumes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/costumes?id=... — Xoá cứng costume
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID trang phục' }, { status: 400 })
    }
    const result = await deleteCostume(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/costumes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
