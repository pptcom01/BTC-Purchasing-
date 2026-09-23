# BTC Purchasing Receipts

ระบบสแกนบิลจัดซื้อผ่าน LINE + Gemini + Sheets + Supabase — โครงสร้างไฟล์แบบราบ (FLAT) ทุกไฟล์อยู่ระดับรากของ workspace (จัดใหม่ 2026-09-22)

## ไฟล์หลัก (source of truth)
- **Code.gs** — Backend Google Apps Script ทั้งหมด (5,696 บรรทัด / 177 functions) — deploy ลง GAS editor ไฟล์เดียว
- **index.html** — Frontend Dashboard v3.14.0 — โฮสต์ใน GAS Web App เท่านั้น (HtmlService ไฟล์ index)
- **supabase_setup_all.sql** — SQL master รันซ้ำได้ตลอด (idempotent + SELF-HEAL)

## ไฟล์ประกอบ
- `deployment-notes.md` — หมายเหตุการ deploy GAS
- `tailwind.config.js` / `tailwind.input.css` — คอนฟิก Tailwind (build สำเร็จฝังใน index.html แล้ว ไม่ต้อง build ซ้ำ ถ้าไม่เพิ่ม class ใหม่)
- `agent_handoff.json` — แผนที่โครงสร้างระบบ + anchor เลขบรรทัด function สำคัญ (AI ต้องอ่านก่อนทำงานทุกครั้ง)
- `task_history_log.md` — ประวัติการแก้โค้ด
- `AGENTS.md` — กฎการทำงานของ AI agents

## เครื่องมือเสริม (ไม่เกี่ยวกับการ deploy)
- `split-codegs.js` / `split-map.json` / `verify-split.js` — เครื่องมือแยก/ตรวจ Code.gs (แผนแยกไฟล์ถูกยกเลิกแล้ว — path ภายในชี้ไฟล์รากแล้ว)

## Runtime (GAS-hosted only — เปลี่ยนเมื่อ 2026-09-22)
- โฮสต์เดียว: **Google Apps Script Web App** (`doGet` → `HtmlService` ไฟล์ `index`) เท่านั้น
- ไม่รองรับการโฮสต์ภายนอก (GitHub Pages / Netlify / static host อื่น) — เส้นทาง REST จากภายนอก (`?action=call`) ปิดเป็นค่าเริ่มต้น (ถ้าจำเป็น: Script Property `REST_API_ENABLED = true` แล้ว deploy ใหม่)
- หน้าเว็บคุยกับ backend ผ่าน `google.script.run.apiCall(...)` เท่านั้น และทุกคำขอต้องมี session token ที่ได้จากการล็อกอินหน้าตั้งค่า (`createApiSession`)
- `api-config.example.json` **เลิกใช้แล้ว** (คงไว้เป็นประวัติเท่านั้น)

## Deployment notes
- GAS project เป็น source of truth ของ backend — deploy `Code.gs` ลง GAS และ `index.html` เป็น HtmlService
- Frontend ห้ามอ่าน secrets ตรง ๆ — ค่าทั้งหมดเก็บใน Script Properties (ตั้งผ่านหน้า ตั้งค่าระบบ)
- เปิด session validation + origin checks ไว้เสมอ