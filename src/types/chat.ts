// ============================================================
// CHAT TYPES — Hộp Chat Thời Gian Thực (Messenger Style)
// ============================================================

export type ConversationStatus = 'active' | 'closed'
export type SenderRole = 'user' | 'admin'
export type ChatContextType = 'costume' | 'booking'

export interface Conversation {
  id: string
  user_id: string
  status: ConversationStatus
  last_message_at: string
  last_message_preview: string | null
  user_unread_count: number
  admin_unread_count: number
  created_at: string
  updated_at: string
  user_profile?: {
    id: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
    kyc_status?: string
  } | null
}

export interface QuotedMessagePreview {
  id: string
  sender_role: SenderRole
  content: string | null
  image_urls?: string[]
}

export interface ContextCardData {
  type: ChatContextType
  id: string
  title: string
  subtitle?: string
  image?: string
  price?: number
  status?: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: SenderRole
  content: string | null
  image_urls: string[]
  reply_to_id: string | null
  reply_to?: QuotedMessagePreview | null
  context_type: ChatContextType | null
  context_id: string | null
  context_data?: ContextCardData | null
  is_read: boolean
  created_at: string
}

export interface SendMessagePayload {
  conversation_id: string
  content?: string
  image_urls?: string[]
  reply_to_id?: string | null
  context_type?: ChatContextType | null
  context_id?: string | null
}

export interface ChatActiveContext {
  type: ChatContextType
  id: string
  title: string
  subtitle?: string
  image?: string
  price?: number
  status?: string
}
