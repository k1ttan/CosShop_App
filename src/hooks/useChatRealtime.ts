'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/types/chat'

/**
 * Phát âm thanh 'ting' nhẹ nhàng kiểu Messenger bằng Web Audio API
 */
export function playChimeSound() {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // Tần số nốt ting nhẹ: 587.33Hz (D5) -> 880Hz (A5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // Trình duyệt có thể chặn autoplay audio nếu chưa có user gesture
  }
}

interface UseChatRealtimeOptions {
  conversationId: string | null
  onNewMessage: (msg: ChatMessage) => void
  currentUserId?: string | null
  enableSound?: boolean
}

export function useChatRealtime({
  conversationId,
  onNewMessage,
  currentUserId,
  enableSound = true,
}: UseChatRealtimeOptions) {
  const onNewMessageRef = useRef(onNewMessage)
  onNewMessageRef.current = onNewMessage

  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()
    const channelName = `chat_room_${conversationId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          onNewMessageRef.current(newMsg)

          // Nếu tin nhắn từ đối phương (không phải từ chính mình gửi), phát âm thanh nhẹ
          if (enableSound && newMsg.sender_id !== currentUserId) {
            playChimeSound()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Kết nối thành công
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, enableSound])
}
