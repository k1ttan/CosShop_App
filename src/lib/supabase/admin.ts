import { createClient } from '@supabase/supabase-js'

/**
 * Service Role Supabase Client
 * Chỉ dùng trong Server Actions / API Routes cần bypass RLS (ví dụ: tạo booking cho guest, gửi webhook thanh toán)
 * KHÔNG BAO GIỜ import client này vào Client Component
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Thiếu cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
