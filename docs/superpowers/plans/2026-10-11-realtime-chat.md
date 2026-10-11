# Hộp Chat Thời Gian Thực (Messenger-Style Realtime Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống chat trực tuyến thời gian thực hai chiều giữa Khách hàng và Shop Admin theo phong cách Facebook Messenger, hỗ trợ bong bóng chat nổi trên PC/Mobile, đính kèm ngữ cảnh sản phẩm/đơn hàng, trả lời trích dẫn (Quote Reply), nén ảnh WebP client-side, và lưu trữ (Archive) cuộc hội thoại trong Admin Dashboard.

**Architecture:** Sử dụng Supabase PostgreSQL kết hợp Row Level Security (RLS) và Supabase Realtime Channel (`postgres_changes` trên bảng `chat_messages`) để truyền tải tin nhắn tức thì (< 100ms). Ảnh được nén tự động trên trình duyệt qua HTML5 Canvas sang chuẩn WebP trước khi upload lên Storage bucket `chat-attachments`. Tích hợp trigger database đồng bộ số tin chưa đọc và đẩy thông báo In-App vào bảng `notifications`.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, TypeScript (strict mode), Tailwind CSS (Dark Mode & Sakura Light Mode), Supabase (Postgres, Auth, Storage, Realtime), Zustand, HTML5 Canvas.

**Spec:** [`docs/superpowers/specs/2026-10-11-realtime-chat-design.md`](file:///d:/Work/Cos-app/docs/superpowers/specs/2026-10-11-realtime-chat-design.md) & [`Claude.md`](file:///d:/Work/Cos-app/Claude.md)

## Global Constraints
- TypeScript strict typing (không sử dụng `any`).
- Màu sắc tuân thủ quy chuẩn Sakura Cute (`#fff5f7`, `#ffffff`, hồng rose, tím soft) và Dark Mode (`#120f17`, `#1f1a24`).
- Không phá vỡ các chức năng hiện có (Catalog, Booking, Profile, Admin Dashboard 4 Tab, Notifications).
- Client-side image compression: định dạng WebP, chất lượng 82%, cạnh dài tối đa 1920px.

## Review Focus
1. **Khách vãng lai chưa đăng nhập bấm nút Chat:** Phải hiển thị Toast nhắc nhở đăng nhập và điều hướng sang `/login` an toàn kèm `redirect`, không crash do thiếu `userId`.
2. **Tin nhắn có trích dẫn mà tin gốc bị xóa hoặc không tải kịp:** Phải hiển thị khối trích dẫn dự phòng an toàn *"Tin nhắn gốc không khả dụng"*, không gây crash render.
3. **Mất kết nối mạng tạm thời (Network drop/reconnect):** Hook Realtime phải tự động subscribe lại và fetch đồng bộ tin nhắn mới mà không bị lặp tin.
4. **Quá nhiều ảnh hoặc ảnh dung lượng cực lớn:** Giới hạn tối đa 3 ảnh/tin nhắn; nếu chọn file không phải ảnh thì phải chặn ngay từ input và báo lỗi Toast.
5. **Phiên đã đóng (status = 'closed'):** Khóa ô nhập liệu, hiển thị banner chỉ đọc và nút *"Bắt đầu phiên hỗ trợ mới"* để tạo bản ghi conversation active mới cho khách hàng.

---

### Task 1: Cơ Sở Dữ Liệu & Phân Quyền (Migration `015_realtime_chat.sql`)

**Files:**
- Create: `supabase/migrations/015_realtime_chat.sql`

**Interfaces:**
- Produces: Tables `conversations`, `chat_messages`, Publication `supabase_realtime`, Bucket `chat-attachments`, Trigger `on_chat_message_inserted`.

- [ ] **Step 1: Viết file migration `supabase/migrations/015_realtime_chat.sql`**
  - Tạo bảng `public.conversations` (`id`, `user_id`, `status`, `last_message_at`, `last_message_preview`, `user_unread_count`, `admin_unread_count`, `created_at`, `updated_at`).
  - Tạo bảng `public.chat_messages` (`id`, `conversation_id`, `sender_id`, `sender_role`, `content`, `image_urls`, `reply_to_id`, `context_type`, `context_id`, `is_read`, `created_at`).
  - Thiết lập Indexes, Foreign Keys, và RLS Policies cho User và Admin.
  - Tạo Storage bucket `chat-attachments` (public read, authenticated insert).
  - Thêm publication `supabase_realtime` cho `chat_messages` và `conversations`.
  - Tạo function và trigger đồng bộ `last_message_at` và tự động insert vào bảng `notifications` khi `sender_role = 'admin'`.

- [ ] **Step 2: Kiểm tra cú pháp SQL và tính toàn vẹn của Migration**
  - Xác minh cấu trúc câu lệnh SQL phù hợp với PostgreSQL và các migrations trước đó (`001` đến `014`).

---

### Task 2: Type Definitions & Client-side Image Compression Utility

**Files:**
- Create: `src/types/chat.ts`
- Create: `src/lib/utils/image-compression.ts`
- Test: `tests/unit/image-compression.test.ts` (hoặc kiểm thử hàm tiện ích)

**Interfaces:**
- Produces:
  - `Conversation`, `ChatMessage`, `ChatContextType`, `SenderRole` in `src/types/chat.ts`
  - `compressImageToWebP(file: File, maxDimension?: number, quality?: number): Promise<Blob>` in `src/lib/utils/image-compression.ts`

- [ ] **Step 1: Định nghĩa Types trong `src/types/chat.ts`**
  - Định nghĩa đầy đủ kiểu dữ liệu: `ConversationStatus = 'active' | 'closed'`, `SenderRole = 'user' | 'admin'`, `ChatContextType = 'costume' | 'booking'`, `ChatMessage`, `Conversation`, `SendMessagePayload`.

- [ ] **Step 2: Viết tiện ích nén ảnh `compressImageToWebP` trong `src/lib/utils/image-compression.ts`**
  - Đọc `File` bằng `ImageBitmap` hoặc `FileReader` + `HTMLImageElement`.
  - Giữ tỉ lệ cạnh dài tối đa 1920px, vẽ lên Canvas và gọi `canvas.toBlob(blob, 'image/webp', 0.82)`.

---

### Task 3: Server Actions & Data Access Layer (`chat-actions.ts`)

**Files:**
- Create: `src/lib/supabase/chat-actions.ts`

**Interfaces:**
- Consumes: Supabase server client `createClient` from `@/lib/supabase/server`
- Produces:
  - `getOrCreateUserConversation(userId?: string): Promise<{ conversation: Conversation; messages: ChatMessage[] }>`
  - `sendChatMessage(payload: SendMessagePayload): Promise<ChatMessage>`
  - `markChatAsRead(conversationId: string, role: 'user' | 'admin'): Promise<void>`
  - `archiveConversation(conversationId: string): Promise<void>`
  - `startNewConversationSession(userId: string): Promise<Conversation>`
  - `getAdminChatList(filterStatus?: 'active' | 'closed'): Promise<ConversationWithUser[]>`
  - `uploadChatImage(formData: FormData): Promise<string>`

- [ ] **Step 1: Cài đặt Server Actions tương tác DB và Storage**
  - Đảm bảo kiểm tra xác thực người dùng qua `supabase.auth.getUser()`.
  - Xử lý upload ảnh vào bucket `chat-attachments` và trả về public URL.
  - Xử lý gửi tin nhắn, lưu thẻ ngữ cảnh (`costume_id` hoặc `booking_id`) và liên kết tin nhắn trả lời (`reply_to_id`).
  - Hỗ trợ Admin đổi trạng thái sang `'closed'` (Lưu trữ) và Khách hàng mở phiên mới (`startNewConversationSession`).

---

### Task 4: Client State Management (Zustand) & Realtime Hook

**Files:**
- Create: `src/store/useChatStore.ts`
- Create: `src/hooks/useChatRealtime.ts`

**Interfaces:**
- Consumes: `useChatStore` manages widget visibility (`isOpen`, `isMinimized`), `activeContext`, `replyingTo`, `unreadCount`.
- Produces:
  - Hook `useChatRealtime(conversationId, onNewMessage)`: Lắng nghe kênh `chat:${conversationId}` qua `supabase.channel`, tự động cập nhật danh sách tin nhắn và phát âm thanh 'ting' nhẹ nhàng khi có tin mới.

- [ ] **Step 1: Tạo Store Zustand `useChatStore.ts`**
  - Quản lý trạng thái mở/đóng popup chat, tin nhắn đang được trích dẫn trả lời (`replyingTo`), thông tin sản phẩm/đơn hàng đang cần hỏi (`activeContext: { type, id, title, image, price }`).
  - Quản lý số lượng tin nhắn chưa đọc để gắn Badge lên Floating Action Button.

- [ ] **Step 2: Tạo Hook Realtime `useChatRealtime.ts`**
  - Đăng ký lắng nghe sự kiện `postgres_changes` trên bảng `chat_messages` ứng với `conversation_id`.
  - Xử lý cleanup subscription khi unmount hoặc đổi cuộc trò chuyện.
  - Tích hợp hàm phát âm thanh thông báo nhẹ `playPopSound()` bằng Audio Web API (synth tone mềm mại, không cần tải file mp3 ngoài).

---

### Task 5: Component Lightbox & Message Bubble với Quote Reply

**Files:**
- Create: `src/components/chat/ChatLightbox.tsx`
- Create: `src/components/chat/ChatMessageItem.tsx`

**Interfaces:**
- Consumes: `ChatMessage`, `useChatStore`
- Produces:
  - `ChatLightbox`: Trình phóng to ảnh toàn màn hình nền đen mờ sang trọng, hỗ trợ phím ESC.
  - `ChatMessageItem`: Bong bóng tin nhắn phong cách Messenger, hỗ trợ:
    - Hiển thị người gửi bên phải (Gradient hồng tím), người nhận bên trái (Trắng viền pastel / Dark xám tối).
    - Khối trích dẫn phía trên tin nhắn (nếu có `reply_to_id`): click vào tự cuộn mượt và highlight tin nhắn gốc.
    - Lưới hiển thị 1-3 ảnh kèm click mở Lightbox.
    - Nút Reply xuất hiện khi Hover trên PC hoặc Tap trên Mobile.
    - Thẻ ngữ cảnh sản phẩm (Costume Card) hoặc đơn hàng (Booking Card) hiển thị tinh tế.

- [ ] **Step 1: Xây dựng `ChatLightbox.tsx`**
  - Hỗ trợ bấm ra ngoài đóng, nút ✕ góc trên, điều hướng ảnh mượt mà.

- [ ] **Step 2: Xây dựng `ChatMessageItem.tsx`**
  - Xử lý định dạng thời gian thân thiện (vd: *14:30*), trạng thái đã đọc/đang gửi.
  - Hiển thị khối trích dẫn tin gốc với cơ chế `document.getElementById('msg-' + reply_to_id)?.scrollIntoView({ behavior: 'smooth' })`.

---

### Task 6: Floating Chat Widget phía Khách hàng (PC Popover & Mobile Fullscreen)

**Files:**
- Create: `src/components/chat/FloatingChatWidget.tsx`
- Modify: `src/app/layout.tsx` (hoặc `src/app/(main)/layout.tsx`) để nhúng widget trên toàn hệ thống

**Interfaces:**
- Consumes: `useChatStore`, `useChatRealtime`, `chat-actions.ts`
- Produces: Floating Action Button + Messenger Popup 380×520px trên PC / Fullscreen Drawer trên Mobile.

- [ ] **Step 1: Xây dựng khung cửa sổ chat `FloatingChatWidget.tsx`**
  - Header: Avatar Shop CosRent, trạng thái *"Trực tuyến"*, nút Thu nhỏ (-), nút Đóng (✕).
  - Khung tin nhắn: Danh sách tin nhắn kèm tự động cuộn xuống cuối (Auto-scroll) khi có tin mới.
  - Banner ngữ cảnh (Costume/Booking Preview Card) ghim đầu khung chat khi mở từ trang sản phẩm/đơn hàng.
  - Banner trích dẫn phía trên ô chat khi bấm Reply kèm nút hủy.
  - Khung nhập liệu: Ô gõ văn bản tự co giãn, nút chọn ảnh đính kèm (tối đa 3 ảnh, nén WebP trước khi gửi), hàng ảnh thumbnail xem trước có nút xóa từng ảnh.
  - Trạng thái phiên đóng (`status = 'closed'`): Ẩn ô nhập, hiện banner *"Phiên hỗ trợ này đã kết thúc"* và nút *"🌸 Bắt đầu phiên hỗ trợ mới"*.

- [ ] **Step 2: Nhúng Widget vào Layout tổng thể**
  - Mount component `FloatingChatWidget` tại `src/app/layout.tsx` để luôn sẵn sàng trên toàn bộ các trang mua sắm.

---

### Task 7: Tích Hợp Điểm Chạm Mua Sắm (Product Detail & Order Tracking)

**Files:**
- Modify: `src/components/products/ProductDetailView.tsx`
- Modify: `src/app/(main)/profile/bookings/page.tsx`
- Modify: `src/app/(main)/tracking/page.tsx`

**Interfaces:**
- Consumes: `useChatStore.getState().openWithContext(...)`

- [ ] **Step 1: Thêm nút "Trò chuyện thêm về sản phẩm" trong `ProductDetailView.tsx`**
  - Đặt cạnh nút "Thêm vào giỏ" và "Đặt ngay".
  - Khi click: Nếu chưa login $\rightarrow$ Toast thông báo yêu cầu đăng nhập và chuyển hướng sang `/login`; Nếu đã login $\rightarrow$ mở Floating Chat Widget và nạp `context: { type: 'costume', id: costume.id, title: costume.character + ' - ' + costume.name, image: costume.image_urls[0], price: costume.rent_price_per_day }`.

- [ ] **Step 2: Thêm nút "Hỏi shop về đơn hàng" trong `bookings/page.tsx` và `tracking/page.tsx`**
  - Đặt trên thẻ đơn hàng hoặc modal chi tiết đơn.
  - Khi click: mở Floating Chat Widget với `context: { type: 'booking', id: booking.id, title: 'Đơn hàng #' + booking.id.slice(0, 8), status: booking.status }`.

---

### Task 8: Giao Diện Quản Trị Viên (Admin Chat Studio - Tab 5 trong Dashboard)

**Files:**
- Create: `src/components/admin/AdminChatStudio.tsx`
- Modify: `src/components/admin/AdminSection.tsx` (bổ sung Tab 5: "💬 Tin nhắn & Tư vấn")

**Interfaces:**
- Consumes: `getAdminChatList`, `getConversationMessages`, `sendChatMessage`, `archiveConversation`, Realtime subscriptions.

- [ ] **Step 1: Xây dựng giao diện 2 cột `AdminChatStudio.tsx`**
  - Cột trái: Ô tìm kiếm khách hàng, 2 tab lọc "Đang hoạt động" và "Đã lưu trữ", danh sách cuộc trò chuyện với avatar, tên khách, tin nhắn cuối, thời gian và huy hiệu tin chưa đọc.
  - Cột phải: Header hiển thị thông tin khách hàng, huy hiệu KYC, nút liên kết xem nhanh hồ sơ/lịch sử đơn hàng, nút hành động **" Lưu trữ cuộc trò chuyện (Đóng phiên)"**.
  - Khung chat tương tác: Đầy đủ tính năng như phía User (Quote Reply, gửi ảnh tư vấn, xem Lightbox).

- [ ] **Step 2: Tích hợp vào `AdminSection.tsx`**
  - Bổ sung nút Tab 5 **"💬 Tin Nhắn"** trên thanh điều hướng Admin Dashboard với huy hiệu đếm tổng số tin nhắn chưa đọc của tất cả khách hàng.

---

### Task 9: Kiểm Thử Toàn Diện Theo Bảng Testcase (`TC-CHAT-01` đến `TC-CHAT-13`)

**Files:**
- Verification: Thực thi kiểm tra đối chiếu từng testcase trên trình duyệt (PC và Mobile responsive).

- [ ] **Step 1: Kiểm thử luồng khởi tạo và đính kèm ngữ cảnh (TC-CHAT-01, 02, 03)**
- [ ] **Step 2: Kiểm thử tính năng Realtime 2 chiều & thông báo chuông (TC-CHAT-04, 11)**
- [ ] **Step 3: Kiểm thử Quote Reply trên PC & Mobile (TC-CHAT-05, 06)**
- [ ] **Step 4: Kiểm thử Nén ảnh WebP & Lightbox (TC-CHAT-07, 08, 13)**
- [ ] **Step 5: Kiểm thử Lưu trữ phiên & Tạo phiên mới (TC-CHAT-09, 10)**
- [ ] **Step 6: Kiểm thử Responsive & Chuyển đổi Theme Dark/Sakura (TC-CHAT-12)**

---

### Task 10: Tổng Hợp & Đồng Bộ Tài Liệu Dự Án

**Files:**
- Modify: `Claude.md` (cập nhật trạng thái tính năng sang ✅ Hoàn thành sau khi kiểm thử đạt chuẩn)
- Modify: `TEST_PLAN.md` (nếu cần theo quy trình kiểm thử)

- [ ] **Step 1: Cập nhật tài liệu `Claude.md` bảng Implementation Status**
- [ ] **Step 2: Hoàn tất tài liệu và báo cáo kết quả**
