# IMPLEMENTATION PLAN: Cosplay Rental Web App

> **Vibe Builder Workflow Tracker**
> Current Phase: **Phase 3 (Core Implementation & Foundation Ready)**

---

## 🎯 Phase Summary & Checkpoints
- [x] **Phase 1: Research & Product Spec**
  - [x] Detect AI tool and configure context recovery
  - [x] Analyze domain business logic, edge cases & anti-patterns
  - [x] Define Mobile-first design guidelines & data models
  - [x] Create comprehensive `PRD.md`
- [x] **Phase 2: Planning & Architecture Validation**
  - [x] Fix 13 critical logic bugs in database schema and business logic
  - [x] Design PostgreSQL schema with RLS, triggers & foreign keys
  - [x] Establish Zod schema validations for booking inputs & shipping options
  - [x] Create `IMPLEMENTATION_PLAN.md`
- [ ] **Phase 3: Coding & Component Implementation** *(In Progress)*
  - [x] Setup Next.js 15 + TypeScript + Tailwind CSS project foundation
  - [x] Supabase Migration file `001_initial_schema.sql` (Tables: profiles, costumes, bookings)
  - [x] Booking overlap prevention logic with `buffer_days` & `quantity` support
  - [x] VNPay IPN Webhook endpoint (`/api/payment/webhook`) with HMAC SHA-512 verification
  - [x] Mobile Bottom Navigation layout and header
  - [x] Landing page with Hot/New costume discovery
  - [x] Product detail page with Calendar Range Date Picker
  - [x] Cart & Checkout page with deposit separation
  - [x] Profile & KYC CCCD submission page
  - [x] Admin dashboard (Inventory, Booking status transition, KYC approval)
  - [x] Schedule View: Selector xổ chọn tháng & năm linh hoạt
  - [x] Giao diện sáng (Light mode) chuẩn đẹp + nút chuyển đổi giao diện Dark/Light mode (Header & Mobile nav)
  - [x] Polish UI animations and Vietnamese micro-copy (Phong cách dễ thương, sakura/pastel, phân tách sáng tối chuẩn chỉnh)
  - [x] Trang Profile: xem/sửa Tên, SĐT, Địa chỉ, Avatar (Admin duyệt) + đổi mật khẩu + tab "Duyệt Hồ Sơ" trong Admin Dashboard
  - [x] Tối ưu bộ lọc Category/Series: Xóa thanh cuộn trình duyệt, phương án Hybrid (Top 5 Hot + nút mở Popup Danh Mục có tìm kiếm)
  - [x] Quy chuẩn mật khẩu an toàn (Password Security): Tối thiểu 8 ký tự, có Hoa, Thường, Số; kèm Password Strength Meter & Real-time checklist (Áp dụng toàn bộ Register, Profile change password, Zod schemas & APIs)
  - [x] Đặt đồ cho Khách vãng lai (Guest Booking) không cần login, tự động lấy thông tin Profile cho User và không tính ngày nhận/trả đồ khi tính tiền thuê
  - [x] Tối ưu quy trình giao hàng bên thứ 3: Modal nhập mã vận đơn bên thứ 3 (GHN, GHTK, Viettel Post, J&T...) & auto sinh link tra cứu chuẩn (Migration `011`)
  - [x] Hệ thống thông báo In-App thời gian thực: Icon Chuông 🔔 Header với badge chưa đọc, popup danh sách thông báo và điều hướng nhanh
  - [x] Trang theo dõi đơn hàng thời gian thực (`/profile/bookings`): Stepper tiến trình 6 bước, thông tin vận chuyển trực quan, đồng bộ Realtime
  - [x] Xác nhận nhận hàng kèm ảnh kiểm tra: Upload tối đa 5 ảnh unbox/kiểm tra phụ kiện lên Supabase Storage (`booking-proofs`), Admin xem đối soát khi hoàn cọc
  - [x] Trang tra cứu nhanh cho khách vãng lai (`/tracking`): Tra cứu theo Mã đơn + SĐT, xem timeline và xác nhận nhận hàng không cần login
  - [x] Popover Menu Profile Header Sakura Cute (`ProfileDropdown.tsx`): Avatar, Tên, nút "Đơn hàng của tôi", "Chỉnh sửa thông tin", "Đăng xuất"
  - [x] Add Docker setup for containerized deployment (`Dockerfile`, `docker-compose.yml`, `/api/health`)
  - [x] Tối ưu thông tin sản phẩm: Quick View Popup trang chủ gọn nhẹ vừa màn hình + Trang chi tiết `/products/[id]` chuyên sâu (Gallery ảnh, Lightbox, So sánh giá Test/Fes, Thêm vào giỏ hàng, Lịch Schedule View, Hệ thống Feedback & Reviews cho đơn hoàn thành) + Trang Đặt thuê độc lập `/checkout` (Lịch chọn ngày, Form vận chuyển, Tách cọc & thanh toán)
  - [x] Tối ưu Dashboard Quản trị: Lưới thẻ đơn hàng Grid 2-3 cột trực quan (ảnh trang phục, mã đơn, khách hàng, ngày thuê, cọc, mã vận đơn) + Popup chi tiết toàn diện & thao tác chuyển trạng thái đơn (State Machine Stepper) + Kho lưu trữ đơn đã đóng (Sub-tabs Đang xử lý vs Lưu trữ, Migration `013_archive_bookings.sql`)
  - [x] Tối ưu logic xử lý đơn hàng Admin: Miễn trừ mã vận đơn cho đơn nhận tại shop (`self_pickup`), cho phép bàn giao 1-click trực tiếp (`shipping` hoặc `renting`), chỉ yêu cầu đơn vị vận chuyển/mã vận đơn với đơn bưu điện/giao hàng.
  - [x] Fix bug giỏ hàng Guest: Chuyển lưu trữ giỏ hàng Guest sang `sessionStorage` (tự động reset sau mỗi phiên), chủ động xóa sạch giỏ hàng Guest khi đăng xuất (Logout) để không tồn dư sản phẩm cũ.
  - [x] Fix lỗi 500 chức năng Duyệt Hồ Sơ: Áp dụng cơ chế truy vấn 2 bước chống lỗi Schema Cache PostgREST giữa auth.users và public.profiles, đồng bộ helper `createClient` và migration `014_fix_profile_change_requests_fk.sql`.
- [ ] **Phase 4: Test Plan Creation** *(⛔ STOP for Human Review Checkpoint)*
  - [ ] Create `TEST_PLAN.md` detailing unit, integration and E2E test cases
  - [ ] Await Human Approval before test execution
- [ ] **Phase 5: Test Execution & Verification**
  - [ ] Execute build checks & type validations
  - [ ] Verify booking calendar collision tests
  - [ ] Verify VNPay IPN checksum verification
- [ ] **Phase 6: Deployment & Launch Readiness**
  - [ ] Apply `vibe-deployer` Dockerfile & CI/CD workflow
  - [ ] Environment variables configuration verification
  - [ ] Production deployment

---

## 📋 Detailed Task Breakdown

### 1. Database & Security Foundation
- [x] Profiles table with `kyc_status` and private CCCD storage URL
- [x] Costumes table with separated `rent_price_per_day` and `deposit_price`
- [x] Costumes `quantity`, `buffer_days`, and `late_fee_multiplier` fields
- [x] Bookings table with status state machine:
  `pending` → `confirmed` → `shipping` → `renting` → `returned` → `inspecting` → `deposit_refunded` / `deposit_withheld`
- [x] PostgreSQL RLS policies for Profiles, Costumes, and Bookings
- [x] Auto-trigger `handle_new_user` on `auth.users` creation
- [x] Multi-column index on `bookings(costume_id, start_date, end_date, status)`

### 2. Core Business Logic Engine
- [x] Overlap check formula: `start_date <= existing.effective_end_date AND end_date >= existing.start_date`
- [x] Effective end date calculation: `end_date + buffer_days` (when `quantity = 1`)
- [x] Multi-item concurrency: Allow parallel bookings when active bookings count < `quantity`
- [x] Late fee calculation formula: `days_overdue * rent_price_per_day * late_fee_multiplier`
- [x] Max 3 active bookings per user constraint

### 3. Payment & Webhook Integration
- [x] VNPay payment gateway service & query parameter sorting
- [x] HMAC-SHA512 checksum creation and verification
- [x] Webhook route handler `/api/payment/webhook` with idempotent status updates
- [x] Protection against fake payment notifications

### 4. Client Pages & Mobile UI
- [x] Root layout with Geist font & Mobile Bottom Nav bar
- [x] Homepage with banners, category chips & product grid
- [x] Costume detail page with interactive calendar date range picker
- [x] Cart & Checkout page displaying separate Rent Fee vs Deposit Fee
- [x] User Profile page with KYC status badge & CCCD upload form
- [x] Admin dashboard with tabbed views: Overview, Products, Bookings, KYC

---

## 🛠️ Context Recovery Reference
If context gets lost, resume by checking:
1. `PRD.md` - Product specifications
2. `IMPLEMENTATION_PLAN.md` - Current status check
3. `.agents/skills/vibe-builder/SKILL.md` - Workflow guide
