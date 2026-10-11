import { NextRequest, NextResponse } from 'next/server'
import { getReviewsByCostumeId, checkUserCanReview } from '@/lib/supabase/queries'
import { submitReviewAction } from '@/lib/supabase/actions'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const [reviews, reviewEligibility] = await Promise.all([
      getReviewsByCostumeId(id),
      checkUserCanReview(id, user?.id),
    ])

    return NextResponse.json({
      reviews,
      canReview: reviewEligibility.canReview,
      reviewReason: reviewEligibility.reason,
      isLoggedIn: Boolean(user),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing costume ID' }, { status: 400 })
    }

    const body = await request.json()
    const result = await submitReviewAction({
      costume_id: id,
      rating: body.rating,
      comment: body.comment,
      images: body.images,
      rental_type: body.rental_type,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
