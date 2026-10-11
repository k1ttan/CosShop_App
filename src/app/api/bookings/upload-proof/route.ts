import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const bookingId = (formData.get('bookingId') as string) || 'common'

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Chỉ chấp nhận file hình ảnh (JPG, PNG, WebP)' },
        { status: 400 }
      )
    }

    const maxSizeMB = 10
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Kích thước file vượt quá ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    const ext = file.type.includes('png')
      ? 'png'
      : file.type.includes('webp')
      ? 'webp'
      : 'jpg'
    const fileName = `${bookingId}/proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Thử tải lên bucket booking-proofs trước, nếu lỗi thì fallback sang costumes
    let targetBucket = 'booking-proofs'
    let { data: uploadData, error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      // Fallback sang bucket costumes
      targetBucket = 'costumes'
      const fallback = await supabase.storage
        .from(targetBucket)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        })
      uploadData = fallback.data
      uploadError = fallback.error
    }

    if (uploadError || !uploadData) {
      return NextResponse.json(
        { error: uploadError?.message || 'Lỗi lưu trữ hình ảnh' },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(uploadData.path)

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: unknown) {
    console.error('[upload-proof] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý file' },
      { status: 500 }
    )
  }
}
