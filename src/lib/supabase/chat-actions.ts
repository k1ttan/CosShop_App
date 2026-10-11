'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Conversation,
  ChatMessage,
  SendMessagePayload,
  QuotedMessagePreview,
  ContextCardData,
} from '@/types/chat'
import { revalidatePath } from 'next/cache'

/**
 * 1. Lấy hoặc Khởi tạo Cuộc trò chuyện đang hoạt động của Khách hàng
 */
export async function getOrCreateUserConversation(): Promise<{
  conversation: Conversation | null
  messages: ChatMessage[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { conversation: null, messages: [], error: 'UNAUTHORIZED' }
  }

  try {
    // 1. Tìm cuộc trò chuyện 'active' gần nhất của user
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversation = existingConv as Conversation | null

    // 2. Nếu chưa có cuộc trò chuyện active, kiểm tra xem có cuộc trò chuyện closed cũ không
    if (!conversation) {
      const { data: latestConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestConv) {
        conversation = latestConv as Conversation
      } else {
        // Tạo mới cuộc hội thoại tinh khôi
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            status: 'active',
            last_message_at: new Date().toISOString(),
            last_message_preview: 'Bắt đầu cuộc trò chuyện',
          })
          .select()
          .single()

        if (createError) {
          console.warn('Lỗi tạo conversation mới:', createError)
        } else {
          conversation = newConv as Conversation
        }
      }
    }

    if (!conversation) {
      return { conversation: null, messages: [] }
    }

    // 3. Tải tin nhắn trong cuộc hội thoại
    const messages = await fetchConversationMessages(conversation.id)

    return { conversation, messages }
  } catch (err: unknown) {
    console.warn('Lỗi getOrCreateUserConversation:', err)
    return { conversation: null, messages: [], error: 'Lỗi nạp tin nhắn' }
  }
}

/**
 * 2. Lấy toàn bộ danh sách tin nhắn của 1 hội thoại (kèm thông tin reply & ngữ cảnh)
 */
export async function fetchConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()

  const { data: rawMessages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error || !rawMessages) {
    return []
  }

  // Thu thập danh sách reply_to_id và context_id để lấy chi tiết hiển thị
  const replyMap = new Map<string, QuotedMessagePreview>()
  const rawMap = new Map<string, (typeof rawMessages)[0]>()
  const costumeIds = new Set<string>()
  const bookingIds = new Set<string>()

  for (const m of rawMessages) {
    rawMap.set(m.id, m)
    if (m.context_type === 'costume' && m.context_id) {
      costumeIds.add(m.context_id)
    } else if (m.context_type === 'booking' && m.context_id) {
      bookingIds.add(m.context_id)
    }
  }

  // Tạo map reply_to
  for (const m of rawMessages) {
    if (m.reply_to_id && rawMap.has(m.reply_to_id)) {
      const orig = rawMap.get(m.reply_to_id)!
      replyMap.set(m.reply_to_id, {
        id: orig.id,
        sender_role: orig.sender_role,
        content: orig.content,
        image_urls: orig.image_urls,
      })
    }
  }

  // Lấy ngữ cảnh Trang phục
  const costumeMap = new Map<string, ContextCardData>()
  if (costumeIds.size > 0) {
    const { data: costumes } = await supabase
      .from('costumes')
      .select('id, name, character, series, rent_price_per_day, image_urls')
      .in('id', Array.from(costumeIds))

    if (costumes) {
      for (const c of costumes) {
        costumeMap.set(c.id, {
          type: 'costume',
          id: c.id,
          title: `${c.character} - ${c.name}`,
          subtitle: c.series,
          image: c.image_urls?.[0] || '',
          price: c.rent_price_per_day,
        })
      }
    }
  }

  // Lấy ngữ cảnh Đơn hàng
  const bookingMap = new Map<string, ContextCardData>()
  if (bookingIds.size > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status, total_amount, start_date, end_date')
      .in('id', Array.from(bookingIds))

    if (bookings) {
      for (const b of bookings) {
        bookingMap.set(b.id, {
          type: 'booking',
          id: b.id,
          title: `Đơn thuê #${b.id.slice(0, 8).toUpperCase()}`,
          subtitle: `Từ ${b.start_date} đến ${b.end_date}`,
          price: b.total_amount,
          status: b.status,
        })
      }
    }
  }

  return rawMessages.map((m) => {
    let contextData: ContextCardData | null = null
    if (m.context_type === 'costume' && m.context_id) {
      contextData = costumeMap.get(m.context_id) || null
    } else if (m.context_type === 'booking' && m.context_id) {
      contextData = bookingMap.get(m.context_id) || null
    }

    return {
      ...m,
      reply_to: m.reply_to_id ? replyMap.get(m.reply_to_id) || null : null,
      context_data: contextData,
    } as ChatMessage
  })
}

/**
 * 3. Gửi tin nhắn mới (Khách hàng hoặc Admin)
 */
export async function sendChatMessage(payload: SendMessagePayload): Promise<{
  success: boolean
  message?: ChatMessage
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Vui lòng đăng nhập' }
  }

  try {
    // 1. Kiểm tra vai trò Admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = Boolean(profile?.is_admin)

    // 2. Kiểm tra trạng thái cuộc trò chuyện
    const { data: conv } = await supabase
      .from('conversations')
      .select('status, user_id')
      .eq('id', payload.conversation_id)
      .single()

    if (!conv) {
      return { success: false, error: 'Cuộc trò chuyện không tồn tại' }
    }

    if (conv.status === 'closed' && !isAdmin) {
      return {
        success: false,
        error: 'Phiên hỗ trợ này đã được lưu trữ. Vui lòng bấm Bắt đầu phiên mới để tiếp tục.',
      }
    }

    const senderRole = isAdmin ? 'admin' : 'user'

    // 3. Thêm tin nhắn
    const { data: newMsg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: payload.conversation_id,
        sender_id: user.id,
        sender_role: senderRole,
        content: payload.content?.trim() || null,
        image_urls: payload.image_urls || [],
        reply_to_id: payload.reply_to_id || null,
        context_type: payload.context_type || null,
        context_id: payload.context_id || null,
      })
      .select()
      .single()

    if (insertError || !newMsg) {
      return { success: false, error: insertError?.message || 'Lỗi gửi tin' }
    }

    // 4. Lấy chi tiết reply nếu có
    let replyPreview: QuotedMessagePreview | null = null
    if (newMsg.reply_to_id) {
      const { data: origMsg } = await supabase
        .from('chat_messages')
        .select('id, sender_role, content, image_urls')
        .eq('id', newMsg.reply_to_id)
        .maybeSingle()

      if (origMsg) {
        replyPreview = origMsg as QuotedMessagePreview
      }
    }

    const fullMessage: ChatMessage = {
      ...newMsg,
      reply_to: replyPreview,
      context_data: null,
    }

    return { success: true, message: fullMessage }
  } catch (err: unknown) {
    console.warn('Lỗi sendChatMessage:', err)
    return { success: false, error: 'Lỗi gửi tin nhắn' }
  }
}

/**
 * 4. Đánh dấu đã đọc toàn bộ tin nhắn trong hội thoại
 */
export async function markChatAsRead(
  conversationId: string,
  viewerRole: 'user' | 'admin'
): Promise<void> {
  const supabase = await createClient()

  try {
    if (viewerRole === 'user') {
      await supabase
        .from('conversations')
        .update({ user_unread_count: 0 })
        .eq('id', conversationId)
    } else {
      await supabase
        .from('conversations')
        .update({ admin_unread_count: 0 })
        .eq('id', conversationId)
    }

    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_role', viewerRole)
  } catch (err) {
    console.warn('Lỗi markChatAsRead:', err)
  }
}

/**
 * 5. Admin Lưu trữ Cuộc trò chuyện (Đóng phiên tư vấn)
 */
export async function archiveConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { success: false, error: 'Quyền hạn không hợp lệ' }
  }

  const { error } = await supabase
    .from('conversations')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin', 'layout')
  return { success: true }
}

/**
 * 6. Khách hàng Tạo Phiên Hội Thoại Mới (sau khi phiên cũ đã đóng)
 */
export async function startNewConversationSession(): Promise<{
  conversation: Conversation | null
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { conversation: null, error: 'Chưa đăng nhập' }

  // Đóng bất kỳ phiên cũ nào còn sót
  await supabase
    .from('conversations')
    .update({ status: 'closed' })
    .eq('user_id', user.id)
    .eq('status', 'active')

  // Tạo phiên mới
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      status: 'active',
      last_message_at: new Date().toISOString(),
      last_message_preview: 'Bắt đầu phiên hỗ trợ mới',
    })
    .select()
    .single()

  if (error || !newConv) {
    return { conversation: null, error: error?.message || 'Không thể tạo phiên mới' }
  }

  return { conversation: newConv as Conversation }
}

/**
 * 7. Lấy danh sách hội thoại cho Admin Chat Studio (có bộ lọc và thông tin user)
 */
export async function getAdminChatList(
  filterStatus?: 'active' | 'closed'
): Promise<Conversation[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Kiểm tra quyền admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) return []

  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }

  const { data: convs, error } = await query

  if (error || !convs) return []

  // Lấy thông tin user profiles tương ứng
  const userIds = Array.from(new Set(convs.map((c) => c.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, kyc_status')
    .in('id', userIds)

  const profileMap = new Map<string, NonNullable<Conversation['user_profile']>>()
  if (profiles) {
    for (const p of profiles) {
      profileMap.set(p.id, p)
    }
  }

  return convs.map((c) => ({
    ...c,
    user_profile: profileMap.get(c.user_id) || null,
  })) as Conversation[]
}

/**
 * 8. Tải ảnh lên Storage Bucket 'chat-attachments'
 */
export async function uploadChatImage(formData: FormData): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  const supabase = await createClient()
  const file = formData.get('file') as File | Blob | null

  if (!file) {
    return { success: false, error: 'Không tìm thấy tệp tải lên' }
  }

  try {
    const filename = `chat/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filename, file, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('chat-attachments').getPublicUrl(filename)

    return { success: true, url: publicUrl }
  } catch {
    return { success: false, error: 'Lỗi tải ảnh lên lưu trữ' }
  }
}
