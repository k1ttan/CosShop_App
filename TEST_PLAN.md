# KẾ HOẠCH KIỂM THỬ: HỘP CHAT THỜI GIAN THỰC (REALTIME CHAT TEST PLAN)

**Tính năng:** Messenger-Style Realtime Chat System (CosRent)  
**Tài liệu đặc tả (Spec):** [`docs/superpowers/specs/2026-10-11-realtime-chat-design.md`](file:///d:/Work/Cos-app/docs/superpowers/specs/2026-10-11-realtime-chat-design.md)  
**Tài liệu gốc (Single Source of Truth):** [`Claude.md`](file:///d:/Work/Cos-app/Claude.md)  
**Môi trường:** Local Dev (`http://localhost:3000`), Supabase PostgreSQL, Supabase Realtime Channels, Supabase Storage (`chat-attachments`).

---

## 1. MỤC TIÊU & PHẠM VI KIỂM THỬ
- Kiểm tra tính toàn vẹn của cơ sở dữ liệu (`conversations`, `chat_messages`, policies RLS, Realtime publication).
- Kiểm tra toàn bộ các điểm chạm người dùng: Nút mở chat nổi, nút chat từ trang sản phẩm `/products/[id]`, nút chat từ trang theo dõi đơn `/profile/bookings` và `/tracking`.
- Kiểm tra tính năng đồng bộ 2 chiều tức thì (Realtime Message Exchange) giữa Khách hàng và Quản trị viên.
- Kiểm tra cơ chế Quote Reply (trích dẫn tin nhắn, click cuộn mượt và highlight tin gốc).
- Kiểm tra nén ảnh Client-side WebP, hiển thị lưới ảnh và trình xem ảnh Lightbox.
- Kiểm tra luồng Lưu trữ cuộc trò chuyện (Archive/Closed) của Admin và mở lại phiên mới của User.
- Kiểm tra giao diện đáp ứng đa thiết bị (PC Desktop và Mobile Responsive) cùng 2 theme (Dark Mode & Light Sakura Mode).

---

## 2. HỆ THỐNG BẢNG TESTCASE CHI TIẾT (TESTCASE SPECIFICATION)

| Testcase ID | Hạng mục | Mô tả Ca kiểm thử | Điều kiện tiên quyết | Các bước thực hiện | Kết quả mong đợi | Mức độ ưu tiên | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **TC-CHAT-01** | Khởi tạo hội thoại | Khách hàng đã login bấm nút chat từ trang sản phẩm | Đã login, ở trang `/products/[id]` | 1. Bấm nút "Trò chuyện thêm về trang phục này trước khi đặt"<br>2. Nhập tin nhắn và gửi | Hộp chat mở ra, Thẻ trang phục (ảnh, tên, giá) ghim trên khung chat và đính kèm vào tin nhắn, Admin nhận được tin nhắn và thẻ ngữ cảnh. | **P0** | ⏳ Chờ test |
| **TC-CHAT-02** | Khởi tạo hội thoại | Khách hàng bấm nút chat từ trang theo dõi đơn hàng | Đã login, có đơn hàng tại `/profile/bookings` | 1. Bấm nút "Hỏi shop về đơn này"<br>2. Gửi tin nhắn hỏi | Hộp chat mở ra với Thẻ thông tin đơn hàng đính kèm, Admin click xem được mã đơn và trạng thái. | **P0** | ⏳ Chờ test |
| **TC-CHAT-03** | Khách vãng lai | Khách chưa đăng nhập bấm nút chat | Khách vãng lai (Guest) | Bấm vào bong bóng chat nổi hoặc nút chat tại trang chi tiết | Hiển thị Modal/Toast yêu cầu đăng nhập, bấm "Đăng nhập ngay" chuyển sang `/login?redirect=...`. | **P1** | ⏳ Chờ test |
| **TC-CHAT-04** | Đồng bộ Realtime | Nhắn tin 2 chiều tức thì giữa User và Admin | Mở đồng thời 2 tab (1 User, 1 Admin) | 1. User gửi tin nhắn văn bản<br>2. Admin gửi tin phản hồi | Tin nhắn xuất hiện tức thì (< 100ms) ở cả 2 màn hình mà không cần reload trang. | **P0** | ⏳ Chờ test |
| **TC-CHAT-05** | Quote Reply | Trả lời trích dẫn tin nhắn trên PC | Có sẵn tin nhắn trong hội thoại | 1. Rê chuột (Hover) lên tin nhắn đối phương<br>2. Bấm icon Reply ↩<br>3. Gõ câu trả lời và gửi | Xuất hiện thanh "Đang trả lời". Tin gửi đi có khối trích dẫn tin gốc. Click vào khối trích dẫn thì khung chat tự cuộn tới tin gốc và nháy viền hồng. | **P0** | ⏳ Chờ test |
| **TC-CHAT-06** | Quote Reply | Trả lời trích dẫn tin nhắn trên Mobile | Giao diện thu nhỏ màn hình mobile | 1. Chạm (Tap) hoặc bấm Reply<br>2. Gửi tin nhắn trả lời | Trích dẫn chính xác nội dung tin gốc, cuộn mượt khi click. | **P1** | ⏳ Chờ test |
| **TC-CHAT-07** | Nén & Gửi ảnh | Gửi từ 1 đến 3 ảnh dung lượng lớn (> 5MB) | Có sẵn file ảnh độ phân giải cao | 1. Bấm icon Ảnh 🖼️, chọn 1-3 ảnh<br>2. Xem thumbnail preview<br>3. Bấm Gửi | Ảnh được nén tự động sang WebP (< 600KB, cạnh dài $\le 1920$px), upload lên bucket `chat-attachments`, hiển thị lưới ảnh đẹp mắt. | **P0** | ⏳ Chờ test |
| **TC-CHAT-08** | Lightbox Phóng to | Xem ảnh toàn màn hình trong khung chat | Tin nhắn đã có ảnh gửi | Click vào bất kỳ ảnh nào trong bong bóng chat | Mở Lightbox toàn màn hình nền đen mờ, nút ✕ đóng hoặc phím ESC, chuyển ảnh bằng phím mũi tên. | **P1** | ⏳ Chờ test |
| **TC-CHAT-09** | Lưu trữ (Archive) | Admin lưu trữ cuộc trò chuyện đã xong | Cuộc trò chuyện đang `active` | 1. Admin bấm nút "Lưu trữ cuộc trò chuyện"<br>2. Xác nhận đóng | Cuộc hội thoại chuyển sang trạng thái `closed`, chuyển vào tab "Đã lưu trữ" của Admin. User thấy thông báo phiên đóng và nút "Bắt đầu phiên hỗ trợ mới". | **P0** | ⏳ Chờ test |
| **TC-CHAT-10** | Tạo phiên mới | User tạo phiên mới sau khi phiên cũ đã đóng | Phiên trước đó đã `closed` | User bấm "🌸 Bắt đầu phiên hỗ trợ mới" | Hệ thống tạo conversation `active` mới, lịch sử cũ vẫn được lưu trữ tra cứu. | **P1** | ⏳ Chờ test |
| **TC-CHAT-11** | Thông báo & Âm thanh | Nhận tin nhắn mới khi đang thu nhỏ chat | User hoặc Admin đang đóng khung chat | Đối phương gửi 1 tin nhắn mới | Bong bóng chat cập nhật huy hiệu đỏ đếm số tin chưa đọc (Badge), phát âm thanh 'ting' nhẹ nhàng. | **P1** | ⏳ Chờ test |
| **TC-CHAT-12** | Responsive & Theme | Đa thiết bị và chuyển Theme Sáng/Tối | Màn hình PC / Mobile | 1. Đổi giữa Light Mode và Dark Mode<br>2. Co giãn kích thước màn hình | Bong bóng chat, màu nền, độ tương phản chữ và hình ảnh hiển thị rõ ràng, không bị lỗi vỡ layout hoặc chìm màu chữ. | **P1** | ⏳ Chờ test |
| **TC-CHAT-13** | Xử lý file lỗi | Người dùng chọn file không phải ảnh | Đang mở ô chọn tệp | Chọn file văn bản PDF / DOCX | Bị lọc bỏ tự động, không thực hiện nén hay upload lên server. | **P2** | ⏳ Chờ test |
| **TC-CHAT-14** | Cách ly tài khoản | Đăng xuất tài khoản A và đăng nhập tài khoản B trên cùng thiết bị | Đang login tài khoản A có tin nhắn chat | 1. Bấm Đăng xuất từ tài khoản A<br>2. Kiểm tra cửa sổ chat<br>3. Đăng nhập tài khoản B | Cửa sổ chat của A đóng lại, toàn bộ tin nhắn A bị xóa sạch; khi B login chỉ hiển thị cuộc hội thoại của riêng B, không rò rỉ dữ liệu của A. | **P0** | ⏳ Chờ test |
| **TC-CHAT-15** | Ẩn trên Auth/Admin | Mở chat ở trang chủ rồi bấm chuyển sang trang Đăng nhập / Đăng ký | Đang mở khung chat ở trang chủ (`/`) | 1. Bấm nút "Đăng nhập" trên Header chuyển sang `/login`<br>2. Kiểm tra giao diện `/login` và `/register` | Khung chat tự động đóng lại (`closeChat`), toàn bộ bong bóng chat và cửa sổ chat biến mất hoàn toàn trên trang `/login` và `/register`. Khi quay lại trang chủ hoặc trang sản phẩm thì bong bóng chat hiển thị lại bình thường. | **P0** | ⏳ Chờ test |

---

## 3. CHECKPOINT DỪNG CHỜ PHÊ DUYỆT (MANDATORY STOP)
Theo quy tắc hệ thống:
1. Đã hoàn tất việc viết code (Phase 3).
2. Đã tạo `TEST_PLAN.md` với đầy đủ 15 Test Cases chi tiết (Phase 4).
3. **⛔ DỪNG LẠI TẠI ĐÂY để bạn duyệt Kế Hoạch Kiểm Thử trước khi tiến hành chạy kiểm thử thực tế.**

