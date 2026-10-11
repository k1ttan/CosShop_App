import { create } from 'zustand'
import type { ChatActiveContext, QuotedMessagePreview } from '@/types/chat'

interface ChatStoreState {
  isOpen: boolean
  isMinimized: boolean
  activeContext: ChatActiveContext | null
  replyingTo: QuotedMessagePreview | null
  unreadCount: number

  // Actions
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  minimizeChat: () => void
  maximizeChat: () => void
  openWithContext: (context: ChatActiveContext) => void
  clearContext: () => void
  setReplyingTo: (msg: QuotedMessagePreview | null) => void
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  resetUnreadCount: () => void
  resetChatState: () => void
}

export const useChatStore = create<ChatStoreState>((set) => ({
  isOpen: false,
  isMinimized: false,
  activeContext: null,
  replyingTo: null,
  unreadCount: 0,

  openChat: () => set({ isOpen: true, isMinimized: false }),
  closeChat: () => set({ isOpen: false, isMinimized: false }),
  toggleChat: () =>
    set((state) => ({
      isOpen: !state.isOpen,
      isMinimized: false,
    })),
  minimizeChat: () => set({ isMinimized: true }),
  maximizeChat: () => set({ isMinimized: false, isOpen: true }),

  openWithContext: (context: ChatActiveContext) =>
    set({
      isOpen: true,
      isMinimized: false,
      activeContext: context,
    }),

  clearContext: () => set({ activeContext: null }),

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  setUnreadCount: (count: number) => set({ unreadCount: Math.max(0, count) }),

  incrementUnreadCount: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  resetUnreadCount: () => set({ unreadCount: 0 }),

  resetChatState: () =>
    set({
      isOpen: false,
      isMinimized: false,
      activeContext: null,
      replyingTo: null,
      unreadCount: 0,
    }),
}))
