import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // 1. Kiểm tra xác thực Admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Bạn không có quyền Admin' }, { status: 403 })
    }

    // 2. Lấy dữ liệu file từ FormData
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy file nào được gửi lên' }, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      // Validate file size (< 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} vượt quá dung lượng tối đa cho phép (10MB)` },
          { status: 400 }
        )
      }

      // Tạo tên file độc nhất tránh trùng lặp
      const ext = file.name.split('.').pop() || 'webp'
      const sanitizedName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30)
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}.${ext}`
      const filePath = `costumes/${fileName}`

      // Convert File to ArrayBuffer -> Buffer/Uint8Array
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      const { error: uploadError } = await supabase.storage
        .from('costumes')
        .upload(filePath, buffer, {
          contentType: file.type || 'image/webp',
          upsert: false,
        })

      if (uploadError) {
        console.error('[Upload API Error]:', uploadError.message)
        return NextResponse.json(
          {
            error: `Lỗi upload lên Supabase Storage: ${uploadError.message}. Vui lòng đảm bảo bạn đã tạo bucket 'costumes' ở chế độ Public.`,
          },
          { status: 500 }
        )
      }

      // Lấy Public URL
      const { data: publicData } = supabase.storage.from('costumes').getPublicUrl(filePath)
      uploadedUrls.push(publicData.publicUrl)
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
    })
  } catch (error: unknown) {
    console.error('[Upload Exception]:', error)
    const message = error instanceof Error ? error.message : 'Lỗi xử lý upload ảnh'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
