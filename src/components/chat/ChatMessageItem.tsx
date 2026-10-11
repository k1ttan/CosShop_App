'use client'

import React from 'react'
import Link from 'next/link'
import type { ChatMessage, QuotedMessagePreview } from '@/types/chat'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwn: boolean
  onReply: (quote: QuotedMessagePreview) => void
  onOpenImages: (images: string[], index: number) => void
}

export function ChatMessageItem({
  message,
  isOwn,
  onReply,
  onOpenImages,
}: ChatMessageItemProps) {
  // Cuộn mượt đến tin nhắn gốc và nháy viền sáng
  const handleScrollToOriginal = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2', 'transition-all', 'duration-300')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2')
      }, 1500)
    }
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex items-end gap-2 my-2 transition-all duration-200 ${
        isOwn ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Nút Reply hiện khi Hover trên PC hoặc bấm vào */}
      <div
        className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center ${
          isOwn ? 'order-last' : 'order-first'
        }`}
      >
        <button
          onClick={() =>
            onReply({
              id: message.id,
              sender_role: message.sender_role,
              content: message.content,
              image_urls: message.image_urls,
            })
          }
          className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-pink-600 transition-colors shadow-sm"
          title="Trả lời tin nhắn"
          aria-label="Trả lời"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
      </div>

      {/* Khối nội dung tin nhắn */}
      <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Thẻ Ngữ Cảnh (Context Card) nếu có đính kèm */}
        {message.context_data && (
          <div className="mb-1.5 w-full max-w-[280px] bg-white dark:bg-zinc-800 border border-pink-200 dark:border-pink-900/60 rounded-xl p-2 shadow-sm flex items-center gap-2.5">
            {message.context_data.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.context_data.image}
                alt={message.context_data.title}
                className="w-12 h-14 object-cover rounded-lg shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 block">
                {message.context_data.type === 'costume' ? 'Trang phục quan tâm' : 'Đơn thuê cần hỗ trợ'}
              </span>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {message.context_data.title}
              </p>
              {message.context_data.price !== undefined && (
                <p className="text-xs font-semibold text-rose-500">
                  {message.context_data.price.toLocaleString('vi-VN')} đ
                </p>
              )}
              {message.context_data.type === 'costume' && (
                <Link
                  href={`/products/${message.context_data.id}`}
                  className="text-[10px] text-pink-500 hover:underline font-medium inline-block mt-0.5"
                >
                  Xem chi tiết đồ ↗
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Bong bóng tin nhắn */}
        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm text-sm break-words ${
            isOwn
              ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-br-xs'
              : 'bg-white dark:bg-zinc-800/90 border border-rose-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-bl-xs'
          }`}
        >
          {/* Khối trích dẫn (Quote Reply Preview) */}
          {message.reply_to && (
            <div
              onClick={() => handleScrollToOriginal(message.reply_to!.id)}
              className={`mb-2 pl-2.5 py-1 pr-2 rounded-lg text-xs cursor-pointer border-l-3 transition-colors ${
                isOwn
                  ? 'border-white/80 bg-white/15 text-white/95 hover:bg-white/25'
                  : 'border-pink-500 bg-rose-50/70 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-rose-100/60'
              }`}
            >
              <div className="font-bold text-[11px] opacity-90">
                {message.reply_to.sender_role === 'admin' ? 'Shop CosRent' : 'Khách hàng'}
              </div>
              <div className="truncate text-[11px] mt-0.5">
                {message.reply_to.content || (message.reply_to.image_urls?.length ? '📷 [Hình ảnh]' : '...')}
              </div>
            </div>
          )}

          {/* Lưới hình ảnh đính kèm */}
          {message.image_urls && message.image_urls.length > 0 && (
            <div
              className={`mb-1.5 gap-1.5 ${
                message.image_urls.length === 1
                  ? 'block'
                  : message.image_urls.length === 2
                  ? 'grid grid-cols-2'
                  : 'grid grid-cols-3'
              }`}
            >
              {message.image_urls.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenImages(message.image_urls, idx)}
                  className="overflow-hidden rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`Ảnh đính kèm ${idx + 1}`}
                    className="w-full max-h-48 object-cover rounded-xl shadow-xs hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Nội dung văn bản */}
          {message.content && (
            <p className="whitespace-pre-wrap leading-relaxed font-normal">{message.content}</p>
          )}

          {/* Thời gian gửi */}
          <div
            className={`text-[10px] mt-1 text-right select-none ${
              isOwn ? 'text-white/75' : 'text-zinc-400 dark:text-zinc-500'
            }`}
          >
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}
