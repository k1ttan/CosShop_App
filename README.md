# 👘 Cosplay Rental Web App (with Vibe Code Kit)

Nền tảng thương mại điện tử chuyên biệt cho thuê trang phục, wig và đạo cụ Cosplay — tối ưu hóa Mobile-First, tích hợp thanh toán bảo chứng VNPay và công nghệ Agentic Coding từ **[Neurons-AI/vibecodekit](https://github.com/Neurons-AI/vibecodekit)**.

---

## ⚡ Bộ kỹ năng Vibe Code Kit đã tích hợp

Dự án đã được tích hợp bộ kỹ năng Vibe Code Kit theo cấu trúc workspace chuẩn của **Antigravity IDE** (`.agents/skills/`), **Claude Code** (`.claude/skills/`), và `.agent/skills/`:

| Kỹ năng | Thư mục | Chức năng & Cách vận dụng |
| :--- | :--- | :--- |
| **`vibe-builder`** | [`.agents/skills/vibe-builder`](file:///d:/Work/Cos-app/.agents/skills/vibe-builder) | **Solo Builder Agent:** Quản lý quy trình phát triển 6 bước (Research → PRD → Plan → Code → Test Plan → Verify). Đã tạo sẵn [`PRD.md`](file:///d:/Work/Cos-app/PRD.md) và [`IMPLEMENTATION_PLAN.md`](file:///d:/Work/Cos-app/IMPLEMENTATION_PLAN.md). |
| **`vibe-debugger`** | [`.agents/skills/vibe-debugger`](file:///d:/Work/Cos-app/.agents/skills/vibe-debugger) | **Structured Debugger:** Định chuẩn quy trình điều tra lỗi, tạo `BUG_REPORT.md` phân tích nguyên nhân gốc rễ (Root Cause Analysis), đề xuất giải pháp và checkpoint duyệt trước khi sửa. |
| **`vibe-deployer`** | [`.agents/skills/vibe-deployer`](file:///d:/Work/Cos-app/.agents/skills/vibe-deployer) | **DevOps & Docker Deployment:** Cung cấp sẵn [`Dockerfile`](file:///d:/Work/Cos-app/Dockerfile) tối ưu hóa đa tầng (multi-stage build), [`docker-compose.yml`](file:///d:/Work/Cos-app/docker-compose.yml) và endpoint kiểm tra sức khỏe [`/api/health`](file:///d:/Work/Cos-app/src/app/api/health/route.ts). |

---

## 🚀 Khởi chạy dự án

### 1. Khởi chạy Local Development (Node.js)

```bash
# Cài đặt dependencies (nếu chưa có)
npm install

# Khởi chạy server phát triển
npm run dev
```
Truy cập [http://localhost:3000](http://localhost:3000).

### 2. Khởi chạy bằng Docker (Vibe Deployer)

```bash
# Build và chạy container production
docker compose up --build -d
```
Kiểm tra sức khỏe container: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🗄️ Cấu hình Supabase & Database

1. Đăng ký/tạo dự án trên [Supabase](https://supabase.com).
2. Sao chép URL và Anon Key vào file [`.env.local`](file:///d:/Work/Cos-app/.env.local):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Mở **SQL Editor** trong Supabase Dashboard và thực thi toàn bộ nội dung file migration:
   - [`supabase/migrations/001_initial_schema.sql`](file:///d:/Work/Cos-app/supabase/migrations/001_initial_schema.sql)

---

## 📚 Tài liệu chuẩn & Thiết kế nghiệp vụ của dự án

> **Tài liệu duy nhất (Single Source of Truth):**
> Toàn bộ yêu cầu sản phẩm, kiến trúc kỹ thuật, mô hình cơ sở dữ liệu (ERD), bộ quy tắc nghiệp vụ, giao diện người dùng và hướng dẫn triển khai đã được hợp nhất đầy đủ tại:
> 👉 **[`Claude.md`](file:///d:/Work/Cos-app/Claude.md)** — *Chỉ cần đọc duy nhất file này để nắm trọn vẹn toàn bộ dự án.*

