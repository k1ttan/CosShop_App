'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getAdminChatList,
  fetchConversationMessages,
  sendChatMessage,
  markChatAsRead,
  archiveConversation,
  uploadChatImage,
} from '@/lib/supabase/chat-actions'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import { compressImageToWebP } from '@/lib/utils/image-compression'
import { ChatMessageItem } from '@/components/chat/ChatMessageItem'
import { ChatLightbox } from '@/components/chat/ChatLightbox'
import type { Conversation, ChatMessage, QuotedMessagePreview } from '@/types/chat'

export function AdminChatStudio() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [filterStatus, setFilterStatus] = useState<'active' | 'closed'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Message input state
  const [inputText, setInputText] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<QuotedMessagePreview | null>(null)

  // Lightbox
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Tải danh sách cuộc hội thoại
  const loadChatList = useCallback(async () => {
    try {
      const data = await getAdminChatList(filterStatus)
      setConversations(data)
      // Mặc định chọn hội thoại đầu tiên nếu chưa chọn
      if (!activeConvId && data.length > 0) {
        setActiveConvId(data[0].id)
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách chat:', err)
    } finally {
      setLoadingList(false)
    }
  }, [filterStatus, activeConvId])

  useEffect(() => {
    loadChatList()

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setConversations([])
        setMessages([])
        setActiveConvId(null)
      } else {
        loadChatList()
      }
    })

    return () => subscription.unsubscribe()
  }, [filterStatus, loadChatList])

  // 2. Tải tin nhắn của cuộc hội thoại đang chọn
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      const msgs = await fetchConversationMessages(convId)
      setMessages(msgs)
      await markChatAsRead(convId, 'admin')
      // Reset unread count trên UI
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, admin_unread_count: 0 } : c))
      )
    } catch (err) {
      console.warn('Lỗi tải tin nhắn:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    } else {
      setMessages([])
    }
  }, [activeConvId, loadMessages])

  // 3. Tự động cuộn xuống cuối
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom(false)
  }, [messages.length, scrollToBottom])

  // 4. Lắng nghe Realtime cho cuộc hội thoại đang chọn
  useChatRealtime({
    conversationId: activeConvId,
    onNewMessage: (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })

      if (activeConvId) {
        markChatAsRead(activeConvId, 'admin')
      }

      // Cập nhật lại tin nhắn cuối và sắp xếp danh sách
      setConversations((prev) =>
        prev.map((c) =>
          c.id === newMsg.conversation_id
            ? {
                ...c,
                last_message_at: newMsg.created_at,
                last_message_preview: newMsg.content || '📷 [Hình ảnh]',
                admin_unread_count: 0,
              }
            : c
        )
      )
      setTimeout(() => scrollToBottom(true), 100)
    },
  })

  // 5. Xử lý ảnh đính kèm
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const validImages = files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 3 - selectedImages.length)

    if (validImages.length === 0) return

    setSelectedImages((prev) => [...prev, ...validImages])
    const newPreviews = validImages.map((file) => URL.createObjectURL(file))
    setImagePreviews((prev) => [...prev, ...newPreviews])

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  // 6. Admin gửi tin nhắn
  const handleSend = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || !activeConvId || isSending) {
      return
    }

    setIsSending(true)
    const textToSend = inputText.trim()
    const imagesToUpload = [...selectedImages]
    const currentReply = replyingTo

    setInputText('')
    setSelectedImages([])
    setImagePreviews([])
    setReplyingTo(null)

    try {
      const uploadedUrls: string[] = []

      for (const file of imagesToUpload) {
        const compressedBlob = await compressImageToWebP(file)
        const formData = new FormData()
        formData.append('file', compressedBlob, `${file.name.split('.')[0]}.webp`)

        const res = await uploadChatImage(formData)
        if (res.success && res.url) {
          uploadedUrls.push(res.url)
        }
      }

      const result = await sendChatMessage({
        conversation_id: activeConvId,
        content: textToSend,
        image_urls: uploadedUrls,
        reply_to_id: currentReply?.id || null,
      })

      if (result.success && result.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.message!.id)) return prev
          return [...prev, result.message!]
        })
        scrollToBottom(true)
      } else if (result.error) {
        alert(result.error)
      }
    } catch (err) {
      console.warn('Lỗi admin gửi tin:', err)
    } finally {
      setIsSending(false)
    }
  }

  // 7. Admin Lưu trữ (Archive) cuộc hội thoại
  const handleArchive = async () => {
    if (!activeConvId) return
    const confirm = window.confirm(
      'Bạn có chắc chắn muốn lưu trữ (đóng) cuộc trò chuyện này không? Phiên hỗ trợ sẽ chuyển sang trạng thái Closed.'
    )
    if (!confirm) return

    const res = await archiveConversation(activeConvId)
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.id !== activeConvId))
      setActiveConvId(null)
      loadChatList()
    } else {
      alert(res.error || 'Lỗi lưu trữ cuộc trò chuyện')
    }
  }

  // Lọc theo tìm kiếm
  const filteredConversations = conversations.filter((c) => {
    const name = c.user_profile?.full_name?.toLowerCase() || ''
    const phone = c.user_profile?.phone || ''
    const q = searchQuery.toLowerCase().trim()
    return name.includes(q) || phone.includes(q)
  })

  const activeConv = conversations.find((c) => c.id === activeConvId)

  return (
    <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-lg flex flex-col md:flex-row h-[700px]">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN (320px)                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
        {/* Bộ lọc Trạng thái & Tìm kiếm */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterStatus('active')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                filterStatus === 'active'
                  ? 'bg-white dark:bg-zinc-700 text-pink-600 dark:text-pink-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Đang mở
            </button>
            <button
              onClick={() => setFilterStatus('closed')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                filterStatus === 'closed'
                  ? 'bg-white dark:bg-zinc-700 text-pink-600 dark:text-pink-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Đã lưu trữ
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm khách hàng (tên, SĐT)..."
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>
        </div>

        {/* Danh sách các phiên trò chuyện */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {loadingList ? (
            <div className="p-6 text-center text-xs text-zinc-400">Đang tải cuộc trò chuyện...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              Không có cuộc trò chuyện nào trong mục này
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = c.id === activeConvId
              const user = c.user_profile

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-3 cursor-pointer transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-rose-50 dark:bg-zinc-800 border-l-4 border-pink-500'
                      : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 font-bold flex items-center justify-center text-sm border border-pink-200 dark:border-pink-900">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
                    </div>
                    {c.admin_unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                        {c.admin_unread_count}
                      </span>
                    )}
                  </div>

                  {/* Thông tin & đoạn trích */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {user?.full_name || 'Khách hàng'}
                      </h4>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(c.last_message_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {c.last_message_preview || 'Bắt đầu cuộc trò chuyện'}
                    </p>

                    {user?.phone && (
                      <span className="text-[10px] text-pink-500 font-medium">{user.phone}</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CỘT PHẢI: KHUNG TRÒ CHUYỆN CHÍNH                            */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
        {activeConv ? (
          <>
            {/* Header khung chat */}
            <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 font-bold flex items-center justify-center text-sm">
                  {activeConv.user_profile?.full_name
                    ? activeConv.user_profile.full_name.charAt(0).toUpperCase()
                    : '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {activeConv.user_profile?.full_name || 'Khách hàng'}
                    </h3>
                    {activeConv.user_profile?.kyc_status === 'verified' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ Đã KYC
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    SĐT: {activeConv.user_profile?.phone || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>

              {/* Nút hành động Admin */}
              <div className="flex items-center gap-2">
                {activeConv.status === 'active' && (
                  <button
                    onClick={handleArchive}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors flex items-center gap-1.5"
                    title="Lưu trữ cuộc trò chuyện và đóng phiên tư vấn"
                  >
                    <span>📁</span>
                    <span>Lưu trữ cuộc trò chuyện</span>
                  </button>
                )}
                {activeConv.status === 'closed' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Đã đóng phiên
                  </span>
                )}
              </div>
            </div>

            {/* Vùng Tin Nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-rose-50/20 dark:bg-zinc-950">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  Đang tải tin nhắn...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  Chưa có tin nhắn nào trong cuộc trò chuyện này
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_role === 'admin'}
                    onReply={(quote) => setReplyingTo(quote)}
                    onOpenImages={(imgs, idx) => {
                      setLightboxImages(imgs)
                      setLightboxIndex(idx)
                      setIsLightboxOpen(true)
                    }}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Khung Nhập Liệu Admin */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              {/* Quote Reply Banner */}
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

              {/* Ảnh xem trước */}
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 mb-2 p-1 overflow-x-auto">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-pink-200">
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

              <div className="flex items-center gap-2">
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
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-pink-600 transition-colors"
                  title="Gửi ảnh tư vấn"
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
                  placeholder="Gõ tin nhắn phản hồi khách hàng..."
                  className="flex-1 max-h-24 resize-none bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />

                <button
                  onClick={handleSend}
                  disabled={isSending || (!inputText.trim() && selectedImages.length === 0)}
                  className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
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
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <span className="text-4xl mb-3">💬</span>
            <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
              Chọn một cuộc trò chuyện để bắt đầu tư vấn
            </h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Bạn có thể xem lịch sử trao đổi, hỗ trợ kích cỡ trang phục, giải đáp thắc mắc về đơn hàng và lưu trữ phiên khi hoàn tất.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox xem ảnh Admin */}
      <ChatLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  )
}
