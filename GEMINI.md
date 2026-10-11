# GEMINI SYSTEM INSTRUCTIONS: COSPLAY RENTAL WEB APP (VIBE CODE KIT)

## Vibe Builder Project Reference

### ⛔ CONTEXT OVERFLOW RECOVERY
**When context gets full or you feel lost in a long session:**
1. Re-read the vibe-builder skill: `.agents/skills/vibe-builder/SKILL.md` (or `.claude/skills/vibe-builder/SKILL.md`)
2. Re-read `IMPLEMENTATION_PLAN.md` to check current progress
3. Re-read `TEST_PLAN.md` (if exists) to check test status
4. Follow the workflow strictly - especially the checkpoints below!

### ⚠️ WORKFLOW CHECKPOINTS (MANDATORY - DO NOT SKIP!)
| After Phase | Action |
| --- | --- |
| Phase 3 (Coding) complete | → Create TEST_PLAN.md → **⛔ STOP for Human review** |
| Phase 4 (Test Plan) approved | → Execute tests autonomously |
| Phase 5 (Testing) complete | → Report results → Enter Phase 6 loop |

**CRITICAL:** After finishing coding tasks, you MUST:
1. Create `TEST_PLAN.md`
2. **⛔ STOP and wait for Human approval**
3. DO NOT run destructive tests until Human reviews `TEST_PLAN.md`!

### Project Summary
- **App Type**: Mobile-First Costume & Cosplay Rental Web Application
- **Tech Stack**: Next.js 15+ (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage, RLS), VNPay IPN Webhook, Zustand, Zod
- **Core Features**: Product catalog, calendar-based date picker, booking overlap engine with buffer days, separated rent & deposit pricing, KYC CCCD verification, VNPay IPN HMAC webhook, Admin dashboard
- **Current Phase**: Phase 3 (Core Implementation & Foundation Ready)

### Primary Documentation
- **[`Claude.md`](file:///d:/Work/Cos-app/Claude.md)** — **TÀI LIỆU DUY NHẤT & TOÀN DIỆN (SINGLE SOURCE OF TRUTH):** Chứa trọn vẹn PRD, Mô hình dữ liệu ERD, Toàn bộ quy tắc nghiệp vụ, Thiết kế giao diện Sáng/Tối, Danh sách migration tuần tự và Tiến độ tính năng. Sau này chỉ cần đọc file này.


### Coding Guidelines
- Follow `IMPLEMENTATION_PLAN.md` for tasks
- TypeScript strict typing (no any)
- Mark completed tasks with `[x]`
- Keep code minimal and focused
