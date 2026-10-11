import { NextRequest, NextResponse } from 'next/server'
import { getCostumeBookings } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing costume ID' }, { status: 400 })
    }

    const bookings = await getCostumeBookings(id)
    return NextResponse.json({ bookings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
