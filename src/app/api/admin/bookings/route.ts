import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllBookings } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

// GET /api/admin/bookings — Lấy tất cả booking (admin only)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined
    const limit = parseInt(searchParams.get('limit') ?? '100')

    const bookings = await getAllBookings({ status, limit })
    return NextResponse.json(bookings)
  } catch (err) {
    console.error('[GET /api/admin/bookings]', err)
    return NextResponse.json([], { status: 200 })
  }
}

// PATCH /api/admin/bookings — Cập nhật trạng thái booking (admin only)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json() as {
      bookingId: string
      newStatus: string
      conditionOnReturn?: string
    }

    const { bookingId, newStatus, conditionOnReturn } = body

    if (!bookingId || !newStatus) {
      return NextResponse.json({ error: 'bookingId và newStatus là bắt buộc' }, { status: 400 })
    }

    const updatePayload: Record<string, string | null> = { status: newStatus }

    if (conditionOnReturn) {
      updatePayload.condition_on_return = conditionOnReturn
    }

    if (newStatus === 'deposit_refunded') {
      updatePayload.refund_status = 'refunded'
      updatePayload.payment_status = 'refunded'
    }

    if (newStatus === 'deposit_withheld') {
      updatePayload.refund_status = 'not_applicable'
    }

    if (newStatus === 'cancelled') {
      updatePayload.cancelled_by = 'admin'
    }

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('id, status, payment_status, refund_status, cancelled_by')
      .single()

    if (error) {
      console.error('[PATCH /api/admin/bookings]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, booking: updatedBooking })
  } catch (err) {
    console.error('[PATCH /api/admin/bookings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
