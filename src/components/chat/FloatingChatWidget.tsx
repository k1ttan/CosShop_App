'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/store/useChatStore'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import {
  getOrCreateUserConversation,
  sendChatMessage,
  markChatAsRead,
  startNewConversationSession,
  uploadChatImage,
} from '@/lib/supabase/chat-actions'
import { compressImageToWebP } from '@/lib/utils/image-compression'
import { ChatMessageItem } from './ChatMessageItem'
import { ChatLightbox } from './ChatLightbox'
import type { Conversation, ChatMessage } from '@/types/chat'

export function FloatingChatWidget() {
  const router = useRouter()
  const pathname = usePathname()
  const {
    isOpen,
    isMinimized,
    activeContext,
    replyingTo,
    unreadCount,
    toggleChat,
    closeChat,
    minimizeChat,
    clearContext,
    setReplyingTo,
    setUnreadCount,
    resetUnreadCount,
  } = useChatStore()

  const [userId, setUserId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Kiểm tra trạng thái đăng nhập của người dùng & Lắng nghe đăng xuất
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user ? user.id : null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentId = session?.user ? session.user.id : null
      setUserId(currentId)

      // Khi đăng xuất (SIGNED_OUT) hoặc không còn session: Xóa sạch toàn bộ dữ liệu chat cũ
      if (event === 'SIGNED_OUT' || !session?.user) {
        setConversation(null)
        setMessages([])
        setInputText('')
        setSelectedImages([])
        setImagePreviews([])
        setReplyingTo(null)
        useChatStore.getState().resetChatState()
      }
    })

    return () => subscription.unsubscribe()
  }, [setReplyingTo])

  // 2. Nạp dữ liệu hội thoại khi mở khung chat hoặc khi login
  const loadConversationData = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const res = await getOrCreateUserConversation()
      if (res.conversation) {
        setConversation(res.conversation)
        setMessages(res.messages)
        setUnreadCount(res.conversation.user_unread_count || 0)

        // Nếu đang mở chat, đánh dấu đã đọc
        if (isOpen && !isMinimized) {
          markChatAsRead(res.conversation.id, 'user')
          resetUnreadCount()
        }
      }
    } catch (err) {
      console.warn('Lỗi tải cuộc hội thoại:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId, isOpen, isMinimized, setUnreadCount, resetUnreadCount])

  // 3. Reset ngay lập tức dữ liệu cũ khi đổi tài khoản / đăng xuất
  useEffect(() => {
    // Luôn dọn dẹp tin nhắn và hội thoại cũ trước khi nạp user mới
    setConversation(null)
    setMessages([])
    setInputText('')
    setSelectedImages([])
    setImagePreviews([])
    setReplyingTo(null)

    if (userId) {
      loadConversationData()
    } else {
      useChatStore.getState().resetChatState()
    }
  }, [userId, loadConversationData, setReplyingTo])

  // 3. Tự động cuộn xuống cuối khi có tin nhắn mới
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom(false)
      if (conversation) {
        markChatAsRead(conversation.id, 'user')
        resetUnreadCount()
      }
    }
  }, [isOpen, isMinimized, messages.length, conversation, resetUnreadCount, scrollToBottom])

  // 4. Lắng nghe Realtime
  useChatRealtime({
    conversationId: conversation?.id || null,
    currentUserId: userId,
    onNewMessage: (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })

      if (isOpen && !isMinimized && conversation) {
        markChatAsRead(conversation.id, 'user')
        resetUnreadCount()
      } else {
        useChatStore.getState().incrementUnreadCount()
      }
      setTimeout(() => scrollToBottom(true), 100)
    },
  })

  // 5. Xử lý mở Chat (Kiểm tra đăng nhập)
  const handleToggleClick = () => {
    if (!userId) {
      setShowLoginPrompt(true)
      return
    }
    toggleChat()
  }

  // 6. Xử lý chọn ảnh đính kèm
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Giới hạn tối đa 3 ảnh
    const validImages = files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 3 - selectedImages.length)

    if (validImages.length === 0) return

    const newSelected = [...selectedImages, ...validImages]
    setSelectedImages(newSelected)

    // Tạo preview URL
    const newPreviews = validImages.map((file) => URL.createObjectURL(file))
    setImagePreviews((prev) => [...prev, ...newPreviews])

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  // 7. Gửi tin nhắn
  const handleSend = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || !conversation || isSending) {
      return
    }

    setIsSending(true)
    const textToSend = inputText.trim()
    const imagesToUpload = [...selectedImages]
    const currentReplyingTo = replyingTo
    const currentContext = activeContext

    // Dọn dẹp form trước để UI phản hồi mượt mà
    setInputText('')
    setSelectedImages([])
    setImagePreviews([])
    setReplyingTo(null)
    clearContext()

    try {
      const uploadedUrls: string[] = []

      // Nén ảnh client-side và tải lên Storage
      for (const file of imagesToUpload) {
        const compressedBlob = await compressImageToWebP(file)
        const formData = new FormData()
        formData.append('file', compressedBlob, `${file.name.split('.')[0]}.webp`)

        const res = await uploadChatImage(formData)
        if (res.success && res.url) {
          uploadedUrls.push(res.url)
        }
      }

      // Gửi tin nhắn lên DB
      const result = await sendChatMessage({
        conversation_id: conversation.id,
        content: textToSend,
        image_urls: uploadedUrls,
        reply_to_id: currentReplyingTo?.id || null,
        context_type: currentContext?.type || null,
        context_id: currentContext?.id || null,
      })

      if (result.success && result.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.message!.id)) return prev
          return [...prev, result.message!]
        })
        scrollToBottom(true)
      } else if (result.error) {
        console.warn('Lỗi gửi tin nhắn:', result.error)
      }
    } catch (err) {
      console.warn('Lỗi trong luồng gửi tin:', err)
    } finally {
      setIsSending(false)
    }
  }

  // 8. Bắt đầu phiên hỗ trợ mới khi phiên cũ đã đóng
  const handleStartNewSession = async () => {
    setIsLoading(true)
    try {
      const res = await startNewConversationSession()
      if (res.conversation) {
        setConversation(res.conversation)
        setMessages([])
      }
    } catch (err) {
      console.warn('Lỗi mở phiên mới:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenLightbox = (images: string[], index: number) => {
    setLightboxImages(images)
    setLightboxIndex(index)
    setIsLightboxOpen(true)
  }

  const isAuthPage =
    pathname === '/login' ||
    pathname?.startsWith('/login/') ||
    pathname === '/register' ||
    pathname?.startsWith('/register/')

  const isAdminPage =
    pathname === '/dashboard' ||
    pathname?.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname?.startsWith('/admin/')

  // Tự động đóng hộp chat khi người dùng chuyển hướng sang trang đăng nhập/đăng ký hoặc quản trị
  useEffect(() => {
    if (isAuthPage || isAdminPage) {
      closeChat()
    }
  }, [isAuthPage, isAdminPage, closeChat])

  // Không hiển thị bong bóng chat và cửa sổ chat tại trang đăng nhập/đăng ký hoặc trang quản trị
  if (isAuthPage || isAdminPage) {
    return null
  }

  return (
    <>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. NÚT BONG BÓNG CHAT NỔI (FLOATING ACTION BUTTON)          */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-20 md:bottom-6 right-5 md:right-6 z-50 select-none">
        <button
          onClick={handleToggleClick}
          className="relative w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white shadow-xl hover:shadow-pink-500/30 flex items-center justify-center transition-all duration-300 hover:scale-108 active:scale-95"
          aria-label="Mở hộp chat tư vấn"
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          )}

          {/* Huy hiệu số tin nhắn chưa đọc */}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. CỬA SỔ CHAT (PC POPOVER & MOBILE FULLSCREEN)              */}
      {/* ──────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white dark:bg-[#15121b] flex flex-col shadow-2xl transition-all duration-300 ${
            isMinimized
              ? 'hidden'
              : 'inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-[380px] md:h-[530px] md:rounded-2xl md:border md:border-rose-100 dark:md:border-zinc-800'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white md:rounded-t-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-base font-black shadow-inner">
                  🌸
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide leading-tight">CosRent Support</h3>
                <span className="text-[11px] text-pink-100 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                  Trực tuyến tư vấn
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Nút Thu nhỏ trên PC */}
              <button
                onClick={minimizeChat}
                className="hidden md:inline-flex p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Thu nhỏ"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>

              {/* Nút Đóng */}
              <button
                onClick={closeChat}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Đóng chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Thẻ Ngữ Cảnh ghim nếu người dùng mở từ trang chi tiết */}
          {activeContext && (
            <div className="px-3 py-2 bg-rose-50/90 dark:bg-zinc-800/80 border-b border-rose-100 dark:border-zinc-700/60 flex items-center justify-between text-xs animate-in slide-in-from-top-1">
              <div className="flex items-center gap-2 truncate">
                {activeContext.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeContext.image}
                    alt={activeContext.title}
                    className="w-7 h-9 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400 block">
                    Đang hỏi về:
                  </span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                    {activeContext.title}
                  </span>
                </div>
              </div>
              <button
                onClick={clearContext}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                title="Bỏ ghim"
              >
                ✕
              </button>
            </div>
          )}

          {/* Vùng Tin Nhắn */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-rose-50/30 dark:bg-[#120f17]">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
                <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải tin nhắn...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  💬
                </div>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  Chào mừng bạn đến CosRent!
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px]">
                  Bạn cần tư vấn về kích cỡ trang phục, tóc giả hay ngày thuê? Hãy gửi tin nhắn cho shop nhé!
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_role === 'user'}
                  onReply={(quote) => setReplyingTo(quote)}
                  onOpenImages={handleOpenLightbox}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Banner Thông Báo Khi Phiên Đã Đóng */}
          {conversation?.status === 'closed' && (
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800/90 border-t border-zinc-200 dark:border-zinc-700 text-center space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Phiên hỗ trợ này đã được lưu trữ (kết thúc).
              </p>
              <button
                onClick={handleStartNewSession}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-90 shadow-sm transition-opacity"
              >
                🌸 Bắt đầu phiên hỗ trợ mới
              </button>
            </div>
          )}

          {/* Khung Nhập Liệu (Chỉ hiện khi phiên 'active') */}
          {conversation?.status !== 'closed' && (
            <div className="p-2.5 bg-white dark:bg-[#15121b] border-t border-rose-100 dark:border-zinc-800 md:rounded-b-2xl">
              {/* Thanh hiển thị tin đang trả lời (Quote Banner) */}
              {replyingTo && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-pink-50 dark:bg-zinc-800 border-l-4 border-pink-500 flex items-center justify-between text-xs animate-in fade-in">
                  <div className="truncate pr-2">
                    <span className="font-bold text-pink-600 dark:text-pink-400 block text-[11px]">
                      Đang trả lời:
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-300 truncate block text-[11px]">
                      {replyingTo.content || '📷 [Hình ảnh]'}
                    </span>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold p-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Hàng ảnh xem trước trước khi gửi */}
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 mb-2 p-1 overflow-x-auto">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-pink-200 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Xem trước" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ô gõ tin nhắn + nút gửi */}
              <div className="flex items-center gap-2">
                {/* Nút chọn ảnh */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || selectedImages.length >= 3}
                  className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-pink-600 dark:hover:text-pink-400 transition-colors disabled:opacity-40"
                  title="Gửi ảnh (tối đa 3 ảnh)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </button>

                {/* Input nhập tin */}
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder="Nhập tin nhắn tư vấn..."
                  className="flex-1 max-h-24 resize-none bg-rose-50/50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />

                {/* Nút Gửi */}
                <button
                  onClick={handleSend}
                  disabled={isSending || (!inputText.trim() && selectedImages.length === 0)}
                  className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 text-white shadow-xs transition-opacity disabled:opacity-40 flex items-center justify-center shrink-0"
                  aria-label="Gửi tin nhắn"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4 transform rotate-45 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. MODAL YÊU CẦU ĐĂNG NHẬP DÀNH CHO KHÁCH VÃNG LAI         */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowLoginPrompt(false)}
        >
          <div
            className="bg-white dark:bg-[#1a1622] rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-rose-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-pink-950/40 text-pink-600 mx-auto flex items-center justify-center text-2xl mb-4">
              💬
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Trò chuyện cùng Shop CosRent
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Vui lòng đăng nhập hoặc tạo tài khoản để bắt đầu trò chuyện trực tiếp với Shop về trang phục và đơn hàng nhé!
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
              >
                Để sau
              </button>
              <button
                onClick={() => {
                  setShowLoginPrompt(false)
                  closeChat()
                  router.push('/login?redirect=' + encodeURIComponent(window.location.pathname))
                }}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-90 shadow-sm"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. TRÌNH XEM ẢNH LIGHTBOX                                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <ChatLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />
    </>
  )
}
