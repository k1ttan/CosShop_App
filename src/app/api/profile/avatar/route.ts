import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST: Upload avatar tạm lên bucket 'avatars'
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Không có file được gửi lên' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Chỉ chấp nhận file JPG, PNG hoặc WebP' },
        { status: 400 }
      )
    }

    const maxSizeMB = 5
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File quá lớn. Giới hạn ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const fileName = `${user.id}/avatar-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[avatar upload] Error uploading to storage:', uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(uploadData.path)

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống'
    console.error('[avatar upload] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
