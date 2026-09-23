# Task History Log - BTC Purchasing Receipts (RESET 2026-09-22)

> RESET FRESH ตามคำสั่ง User: ล้างประวัติเก่าทั้งหมด ไม่แยกไฟล์เพิ่ม เริ่มงานใหม่จากโครงสร้างปัจจุบันวันนี้

## [2026-09-22] RESET + สรุปโครงสร้างระบบใหม่ (จุดเริ่มต้น)
- Backend: gas-backend/Code.gs (5696 lines / 177 functions) - source of truth เดียว
- Frontend: web-frontend/index.html (v3.14.0 GAS Web App only)
- Database: supabase_setup_all.sql (705 lines) - master ไฟล์เดียว
- Flow: LINE -> Drive -> Gemini 2-pass -> validate -> Sheet+Supabase dual-write -> Flex | Web: apiCall -> handleApiRequest(+session) -> Supabase-first+Realtime
- Tables: receipts / receipt_links / receipt_learning / doc_types(17) / ai_templates / ai_prompts / ai_feedback_logs / vendor_billing + views
- Status: fresh-start-ready - รอ User แจ้งโจทย์งานถัดไป

## [2026-09-22] 🗂️ จัดโครงสร้างไฟล์ใหม่แบบราบ (FLAT) + ลบของไม่จำเป็น
- **คำขอ User:** ย้ายไฟล์ออกจากโฟลเดอร์ให้แสดงนอกสุด แล้วลบไฟล์/โฟลเดอร์ที่ไม่จำเป็นออกให้หมด
- **ย้ายขึ้นราก (node fs.renameSync — คง bytes เดิม 100%):** gas-backend/Code.gs → Code.gs / web-frontend/index.html → index.html / gas-backend/deployment-notes.md → deployment-notes.md / web-frontend/api-config.example.json → api-config.example.json / tools/{split-codegs.js,split-map.json,verify-split.js} → ราก
- **README ชนกัน 2 ไฟล์:** รวม gas-backend/README.md + web-frontend/README.md เป็น README.md เดียวที่ราก (เนื้อหาสำคัญครบทั้งสองไฟล์เดิม)
- **ลบถาวร (ตามคำสั่ง User):** โฟลเดอร์ gas-backend / web-frontend / tools + ไฟล์ api-config.example.json (obsolete) + split-codegs.js / split-map.json / verify-split.js (แผนแยกไฟล์ถูกยกเลิก)
- **เหลือราก 10 ไฟล์:** AGENTS.md / agent_handoff.json / Code.gs / deployment-notes.md / index.html / README.md / supabase_setup_all.sql / tailwind.config.js / tailwind.input.css / task_history_log.md
- **Cascading:** ไม่มีโค้ดอ้างอิง path เดิม (tools ถูกลบพร้อมกัน — ไม่ต้องแก้ path ภายใน) / agent_handoff.json อัปเดต paths ใหม่แล้ว / โค้ดระบบไม่ถูกแตะ
- **สถานะ:** ✅ เสร็จ — Deploy workflow ไม่เปลี่ยน: copy Code.gs ลง GAS editor + index.html เป็น HtmlService

## [2026-09-22] ระบบจับคู่เอกสารโซ่ 3 ขั้น (PO → ใบส่งของ → ใบชั่ง) + System Record No.
- **คำขอ User:** (1) matcher กันไม่ให้ใบชั่งติด PO ตรง (2) ใบส่งของต้องมีแท็บ "จับคู่ใบชั่ง" (3) มุมมองกลุ่ม (แท็บ "บิลที่จับคู่แล้ว") โชว์โซ่ 3 ขั้น PO→ใบส่งของ→ใบชั่ง — แล้ว deploy + ทดสอบ / เพิ่มเลขที่รายการระบบ (System Record No.) เลขรันต่อเนื่องไม่ซ้ำ ใช้อ้างอิงตอนแก้ไข-อัปเดต + สร้างย้อนหลัง
- **Backend Code.gs (targeted):**
  - เพิ่ม `receiptDocTypeByKey()` + `isScaleLikeDocTypeForLink()` — guard โมเดลโซ่ 3 ขั้น: ใบชั่ง (scale-like) ห้ามจับติด ใบสั่งซื้อ ตรง
  - `upsertReceiptLink` + `setReceiptLinkStatus`: ปฏิเสธ ใบชั่ง↔PO ตรง คืน `SCALE_PO_FORBIDDEN` + ข้อความชี้ให้ลบแล้วจับผ่านใบส่งของแทน
- **Frontend index.html (targeted):**
  - แก้บั๊กพังแผงจับคู่ PO: เพิ่ม global `isScaleLike()` (เดิมมีแค่ `const` ใน buildAttachmentMap → renderMatchPanel เรียกแล้ว ReferenceError) + `isDeliveryLike()`
  - PO match panel: กรองใบชั่งออกจากการเลือกจับ PO ทุกกรณี (ปิดช่องโหว่ที่หลุดเมื่อเลือก store filter)
  - ใบส่งของ: แท็บ "จับคู่ใบชั่ง" = `renderScaleMatchPanel()` + `saveScaleMatchSelections()` — เขียน receipt_links po_doc_key=ใบส่งของ / link_doc_key=ใบชั่ง, แสดงสถานะ PO ตอนบน, ใบชั่งที่จับแล้ว (ยืนยัน/ลบ), แนะนำอัตโนมัติ (เลขอ้างอิง/ทะเบียนรถ/ร้าน)
  - มุมมองกลุ่ม: `renderMatchedView` โชว์โซ่ 3 ขั้น (ขั้น 2 แถวใบส่งของ + `renderScaleChainRows` ขั้น 3 ใบชั่ง ต่อท้ายแถว) + ป้ายเตือน "⚠️ ใบชั่งติด PO ตรง" สำหรับลิงก์ประเภทผิดจากของเดิม
  - `rerenderCurrentMatchPanel()` รวมศูนย์รีเฟรชแผงจับคู่ (ใช้ใน ยืนยัน/ลบ/บันทึก/กรองร้าน)
  - `loadReceiptLinks` mapping ต่อ fields ใหม่ (link_type/link_scale_net/link_vehicle/match_type/confidence_score)
  - System Record No.: `normalizeData` + ป้าย `#xxxxxx` ในตาราง + Detail Modal + หน้าต่างแก้ไข + ส่งใน payload delete/edit/reanalyze (backend `findReceiptRowByAny` รองรับแล้ว)
- **SQL:** section [13] receipt system_record_no (sequence + default + unique index + backfill + GRANT) มีอยู่แล้ว ✅ ไม่แก้ — รอ User รันถ้ายัง
- **Check:** node --check ผ่านทั้ง index.html script (295KB) และ Code.gs (6035 บรรทัด) | ไม่มี U+FFFD
- **สถานะ:** โค้ดพร้อม deploy — รอ User push GAS (ไม่มี .clasp.json) + รัน SQL [13] + ทดสอบ

## [2026-09-22] ปิดช่องว่างไดอะแกรม Target Architecture (A/B/C/D) — ปิด gap audit 4 จุด
- **ที่มา:** User แปะไดอะแกรมเป้าหมาย (LINE Group → Webhook/Queue Engine → Pre-Filter & Anti-Duplicate (MD5) → Gemini OCR → Supabase + Atomic Sequential Lock TR-202609-00001 → Google Drive Storage + Matching & Billing (Weight & Unit Variance Engine)) → audit gap พบ 4 จุด: (A) system_record_no เป็นตัวเลข ไม่ใช่ TR-YYYYMM-##### (B) ไม่มี MD5 dedup ก่อน OCR (C) ชื่อไฟล์ Drive ไม่มีเลขบิล/เลขเอกสาร (D) ไม่มี Weight & Unit Variance Engine
- **A. Running Number TR-YYYYMM-##### (Atomic Sequential Lock):**
  - SQL section [14]: `running_number_counter` (แถวเดียว + FOR UPDATE) + RPC `next_running_number(p_month)` (SECURITY DEFINER, service_role เท่านั้น) + `sync_running_number_counter()` + คอลัมน์ `running_number` + unique index + backfill แถวเก่าตามเดือน (submitted_at Asia/Bangkok) + GRANTs + รายงานผล
  - GAS: `getCurrentRunningMonth()` / `callNextRunningNumber()` (โทร RPC) / `ensureRunningNumberForReceipt()` (กันซ้ำ+จองใหม่) / `backfillMissingRunningNumbers()` (ชีต+Supabase+sync counter) / `menuBackfillRunningNumbers()`
  - Wire เข้า `processReceiptSubmission` หลัง system_record_no → saveToSheet column "Running No." + saveToSupabase row `running_number` + updateSupabaseReceipt map + getReceiptData → Flex เพิ่มแถว "เลขที่บิล" → หน้าเว็บ normalizeData + ป้าย TR ในตาราง/Detail/แก้ไข
- **B. MD5 File-Level Dedup ก่อน Gemini OCR:** SQL คอลัมน์ `image_md5` + index | GAS `md5Hex()` (Utilities.computeDigest) + `findDuplicateImageHash()` — เช็คทันทีหลังโหลดรูป (`STEP 2-DUP`) คืน `duplicate-image` แจ้งแชทเลขบิลเดิม ไม่เสียค่า OCR | เก็บ image_md5 ลง ชีต+Supabase
- **C. Drive File Naming:** `sanitizeFileNameStr()` + `renameReceiptDriveFile()` — ตั้งชื่อไฟล์เป็น `TR-YYYYMM-xxxxx_เลขเอกสาร_Wท_yyyyMMdd_HHmmss.jpg` (เรียกหลัง STEP 6)
- **D. Weight & Unit Variance Engine:** SQL section [15] `weight_variances` (RLS anon อ่าน + policy + GRANT) | GAS `runWeightVarianceCheck()` ไล่คู่ confirmed → เทียบจำนวน PO↔บิล (severity >5%=low / >10%=high) + ดึงน้ำหนักใบชั่งขั้น 3 → upsert ตาราง + ติดธง needs_review บิลเพี้ยน | `getWeightVariances()` + `runWeightVarianceCheckMenu()` + API cases + เมนูชีต | Frontend `loadWeightVariances()` (ตรง→GAS fallback) + `renderWeightVarianceChip()` ยางธง ⚖️ เพี้ยนในแถวคู่แท็บจับคู่
- **SQL:** section [14]+[15] ต่อท้าย supabase_setup_all.sql (หลัง [8] SELF-HEAL) — รอ User รันทั้งไฟล์ซ้ำได้ เลข TR backfill แถวว่างเท่านั้น
- **Check:** node --check ผ่าน Code.gs + script index.html | ไม่มี U+FFFD ใน 3 ไฟล์
- **สถานะ:** โค้ดพร้อม deploy — รอ User push GAS + รัน SQL [14]+[15] + รันเมนู "สร้างเลขที่บิล TR ย้อนหลัง" + "ตรวจความต่าง น้ำหนัก/จำนวน" 1 รอบ

## [2026-09-22] ปรับความเร็ว Gemini OCR (กันคำขอค้าง / backoff สั้นลง)
- **ที่มา:** User แคป log จริงของบิล IV69-00769 — ใช้เวลา อ่าน ≈ 2 นาที 22 วิ เพราะรุ่นหลัก gemini-3.8-flash ถูกเลื่อน (UNAVAILABLE) 3 ครั้ง + รุ่นสำรอง gemini-3.5-flash-lite อีก 2 ครั้ง แต่ละคำขอค้างไป ~45-50 วิ (UrlFetchApp ไม่ตั้ง timeout), backoff 8s/20s/30s ยาวเกิน
- **แก้ที่ `analyzeReceiptWithGemini` (Code.gs) แบบเจาะจง 3 จุด:**
  1. fetch options เพิ่ม `timeout: 30` — คำขอค้างไม่เกิน 30 วิ (เดิมปล่อยค้าง ~60 วิ)
  2. ห่อ `UrlFetchApp.fetch` ใน try/catch — ถ้าค้าง/หมดเวลา ถือว่า "หนาแน่นชั่วคราว" ลองใหม่/สลับรุ่น (เดิม exception หลุดทั้งระบบ) พร้อม log STEP 4-RETRY "ตอบช้า/หมดเวลา"
  3. `backoffMs = [4000, 8000, 15000]` แทน [8000, 20000, 30000] — รอสั้นลงแต่ยังกันชนกับ API หนาแน่น
- **Check:** node --check ผ่าน (คัด Code.gs ไป temp ตรวจ) | ค่าคงที่อื่น unchanged
- **ข้อสังเกตจาก log (แจ้ง User แล้ว):** โค้ดที่รันบน GAS ยังเป็นตัวเก่า (STEP 5 พิมพ์ "เลขที่รายการ #349" แบบเก่า ไม่มี "เลขที่บิล TR-") — ต้อง deploy Code.gs ใหม่จึงจะได้ทั้ง TR/MD5/rename + ความเร็วนี้พร้อมกัน
- **สถานะ:** แก้เสร็จในไฟล์ รอ deploy

## [2026-09-22] แก้ backfill TR ไม่ติด เพราะบิลเก่าไม่มี submitted_at → ใช้ created_at แทน
- **ที่มา:** User รันเมนู backfill TR สำเร็จ (รองรับ Code.gs ใหม่ deploy แล้ว) แต่ `SELECT count(running_number)` = 0/349 และ probe พบ `submitted_at` = 0/349 กับ `with_doc_key`=349, `with_srn`=349 → backfill SQL/[14] เดิมใช้ `submitted_at AT TIME ZONE 'Asia/Bangkok'` (null ทั้งหมด) => ได้ 0 แถว
- **แก้ supabase_setup_all.sql section [14] (backfill + report):** เปลี่ยนจาก `submitted_at` เป็น `COALESCE(created_at, submitted_at)` — created_at (ตอนรับบิลเข้า DB, default now()) มีค่าเสมอ + report ORDER BY created_at DESC
- **แก้ Code.gs `backfillMissingRunningNumbers`:** ข้ามแถวที่ชีตไม่มี Timestamp แท้ (non-Date) — เดิมใช้ `getCurrentRunningMonth()` เติมเดือนปัจจุบันทั้งแถว (เสี่ยงชนกับเลข RPC ฝั่ง DB) → ปล่อยให้ DB backfill (created_at) จัดการแทน
- **Check:** node --check ผ่าน Code.gs | SQL ไม่มี syntax ตรวจ (วางให้ User รัน snippet เดียวจบ)
- **สถานะ:** รอ User รัน snippet backfill (created_at) ใน Supabase SQL Editor

## [2026-09-22] เพิ่มฟังก์ชันเติม image_md5 ย้อนหลัง (แก้ "ส่งรูปซ้ำแล้วยังต้องรอ AI อ่านเนิ่นนาน")
- **ที่มา:** User แคป log ทาง LINE ให้ดู — ส่งภาพบิลซ้ำ (IV69-00769 กับ 13965) แต่ log ไม่มี `STEP 2-DUP` เลย ต้องรอ Gemini อ่าน (~3-4 นาที เพราะ gemini-3.8-flash หนาแน่น) กว่าจะเจอซ้ำที่ STEP 5-SKIP → สรุป: โค้ดที่ deploy บน GAS ยังเป็นตัวเก่า (ไม่มี MD5 pre-check) + บิลเก่าทุกใบมี image_md5 = NULL (บันทึกก่อนมีฟีเจอร์) → ต่อให้ deploy ใหม่ ภาพซ้ำของบิลเก่าก็ยังไม่โดนตัดก่อน OCR
- **แก้ Code.gs (เจาะจง):**
  - เพิ่ม `backfillImageMd5FromDrive(batchSize=25)` — ดึงแถว image_md5=is.null ไล่ตาม id, อ่านรูปจาก Drive (extractDriveFileId), คำนวณ md5Hex, PATCH กลับ (lock + กันครอบ 30 วิ + progress log ทุก 50)
  - เพิ่ม `menuBackfillImageMd5()` + เมนูชีต "🖼️ เติม MD5 รูปย้อนหลัง (กันส่งรูปซ้ำเร็ว)" ข้างเมนู Running No.
- **Check:** node --check ผ่าน Code.gs
- **คำแนะนำถึง User:** ต้อง redeploy Code.gs ใหม่ (ตัวที่ log ไม่มี STEP 2-DUP = ตัวเก่า) แล้วรันเมนูเติม MD5 1 รอบ ครบแล้วส่งภาพซ้ำ → ต้องเห็น STEP 2-DUP ตัดทันที
- **สถานะ:** โค้ดพร้อม — รอ User deploy + รันเมนูเติม MD5

## [2026-09-22] MD5 backfill รอบแรกคืน 0 แถว → ปรับให้มี telemetry + สรุปผลละเอียด
- **ที่มา:** User deploy เวอร์ชัน 160 (โค้ดใหม่ขึ้นจริง — เห็น backoff 4/8s ใน log) แล้วรัน menuBackfillImageMd5 (4.5 วิ) + ส่งภาพซ้ำใบ 13965 → log ยังไม่มี STEP 2-DUP, ต้องรอ Gemini แล้วเจอซ้ำที่ STEP 5-SKIP; probe พบ have_md5=0/349 + row 13965 image_md5=null
- **สรุป:** เมนูเติม hash ไม่ได้เขียนค่าเลย (จบไว 4.5 วิ) — ยังไม่รู้ว่าคำถามคืน 0 แถวหรือโหลดรูปไม่ได้
- **แก้ Code.gs `backfillImageMd5FromDrive`:** เก็บ prof {total/filled/noUrl/errored} + writeLog 'fetch rows="..."' ทุก batch + log ok/skip/error รายแถว + return message แบบ X จาก Y (ไม่มีลิงก์ Z / โหลดไม่ได้ W) — รอบหน้าวาง Log มาวินิจฉัยได้ทันที
- **Check:** node --check ผ่าน | ยังไม่มีการเปลี่ยน SQL
- **สถานะ:** รอ User redeploy + รันเมนูเติม MD5 แล้ววาง Log (คอลัมน์ Step=MD5) + สรุปผล 3 ตัวเลข

## [2026-09-22] ต้นเหตุจริง = AI อ่านเองไม่ไหว (ไม่ใช่เช็คซ้ำ) → สลับโมเดล flash-lite ขึ้นนำ
- **ที่มา:** User ระบุตรงๆ ว่า "ปัญหาคือ AI อ่านข้อมูลไม่ได้สักที อ่านหลายรอบ เปลี่ยนรุ่น" พร้อม log ใหม่: RESOURCE_EXHAUSTED/UNAVAILABLE วน ~5-6 ครั้งต่อใบ + คำขอบางตัวค้าง 47 วิ (15:46:36→15:47:23) ทั้งที่ไฟล์เครื่องตั้ง timeout 30 ไว้อีกทั้งชื่อรุ่นหลังสลับยังเป็น 3.8-flash เดิม → สรุป: (ก) โค้ดที่รันจริง ≠ ไฟล์เครื่อง (deploy ไม่ตรงตัว) (ข) รุ่น 3.8-flash หนาแน่น ส่วน flash-lite ตอบสำเร็จจริงทุกครั้ง
- **แก้ Code.gs `getPreferredGeminiModels`:** สลับลำดับการเลือก 1 รุ่นต่อตระกูล = flash-lite → flash → pro (เดิม flash มาก่อน) — ลดการตีกันของ 3.8-flash
- **Check:** node --check ผ่าน Code.gs
- **ข้อสังเกตยืนยัน:** ถึง log จะมี backoff 4/8 วิ (ของใหม่) แต่ "ค้าง 47 วิ" + "ป้ายรุ่นไม่เปลี่ยน" = binary ที่รันจริงยังเก่า — ต้อง verify ที่ runtime (log) ไม่ใช่ดูใน editor
- **สถานะ:** รอ User Deploy ตัวจริง + ส่งบิลใหม่เช็คที่ log (ไม่ควรมีคำขอค้าง >30 วิ + แลเบลรุ่นตรง)

## [2026-09-22] Flex Message 2 แบบ (บันทึกแล้ว / บิลมีในระบบแล้ว) + เจอโควตา LINE 429
- **ที่มา:** User ขอ Flex Message: (1) ยืนยันบันทึกบิลแล้ว (2) บิลมีในระบบแล้ว — สั้นๆ เข้าใจง่าย พร้อมเลขที่เอกสาร (TR) | log 16:04 ใหม่เผย (ก) ยังเป็น gemini-3.8-flash ตัวแรก = deploy ยังไม่โดน (ข) ❌ PUSH HTTP 429 "reached your monthly limit" = โควตาส่งข้อความรายเดือนของ LINE หมด (แก้ที่โค้ดไม่ได้ — รอเดือนใหม่/อัปเกรดแพลน)
- **แก้ Code.gs:**
  - `findDuplicateImageHash`: เพิ่ม select doc_type,doc_no,store_name,date,total_amount (ใช้ทำ Flex ซ้ำให้แสดงร้าน/วันที่/ยอดได้)
  - `findDuplicateByDocKey`: คืนแถวเต็ม (row object จับคู่ตาม header) แทน {rowIndex} — เพื่อเอา Running No./ร้าน/วันที่/ยอด ของบิลเดิมไปโชว์ใน Flex ซ้ำ
  - `pushFlexMessage`: รีดีไซน์เป็น Flex "✅ บันทึกบิลแล้ว" ขนาด giga (สั้นลง) — หัวเขียว ตัวหนา docLabel + กล่องเลขที่บิล TR ใหญ่ชัด + ร้าน/วันที่/PO/ยอด/สถานะ + ปุ่มดูรูป และผู้ส่งบิล (ตัด หมวดหมู่/รายการ ออกให้สั้น)
  - ใหม่ `pushDuplicateFlexMessage(to, opts)`: Flex "⚠️ บิลนี้มีในระบบแล้ว" ขนาด giga — หัวส้ม ตัวหนา docLabel + กล่อง "เลขที่บิล (ในระบบแล้ว)" + ร้าน/วันที่/ยอด (ถ้ามี) + บันทึกย่อ "ไม่บันทึกซ้ำ รูปเดิมอยู่ Drive"
  - เรียกแทน pushLineMessage 2 จุด: STEP 2-DUP (MD5 gate) และ STEP 5-SKIP (docKey ซ้ำ)
- **Check:** node --check ผ่าน Code.gs | ไม่แก้ SQL
- **สถานะ:** รอ User Deploy (โค้ดเดียวกับที่แก้ gemini) + ตรวจ flex ละเอียดใน LINE หลังโควตา 429 ผ่าน/อัปเกรด

## [2026-09-22] ปรับตารางบิลหน้าเว็บให้เป็นรูปแบบ Demo (สถานะจับคู่ + บทบาท) — จาก demo "ระบบจับคู่เอกสาร 3-Way" ที่ User ให้ศึกษา
- **ที่มา:** User ชี้แจงว่า demo ที่ส่งมาคือภาพจำลองของ **ระบบจับคู่บิลที่มีอยู่แล้ว** ไม่ใช่งานใหม่ — แต่ "ตารางบิล ที่มีตอนนี้มันทำงานวุ่นวาย สรุปไม่รู้จะจับคู่แบบไหน โฟรมั่วไปหมด" → ต้องการให้แก้ **ตาราง (UI)** ให้ทำงานแบบ demo ที่เข้าใจง่ายกว่า: ทุกแถวเห็น Master PO เป้า + สถานะ + match score + ⚖️ และแยกบทบาทในโซ่ (BULK/UNIT/ORPHAN)
- **ขอบเขต (User ยืนยัน):** ทั้ง 2 แท็บ (ตารางบิลหลัก + แท็บบิลที่จับคู่แล้ว) / แบบ "ปรับ UI + เชื่อมข้อมูลจริง" (ใช้ receipt_links/weight_variances จริง ไม่สร้างข้อมูลใหม่ ไม่รื้อทั้งไฟล์)
- **แก้ index.html (Targeted, เลียนแบบหลักการ demo):**
  - ใหม่ `renderBillMatchStatus(item)`: ป้ายสถานะจับคู่ต่อแถวจาก receipt_links จริง — ฝั่ง PO = "Master PO + จับแล้ว N + ⏳รอตรวจ M" / ฝั่งบิล = "ยังไม่จับคู่ · <บทบาท>" หรือ "จับคู่แล้ว ↖ PO" หรือ "รอตรวจสอบ ↖ PO" + matchTypeChip (ตรงอัตโนมัติ 98% / [แนะนำการจับคู่] 85%)
  - ใหม่ `renderMatchStatusCell(item)`: รวมสถานะจับคู่ + ยางธง ⚖️ (วอร์ริเอพ/ผล weight_variance)
  - ใหม่ `renderMatchRoleCell(item)`: ป้ายบทบาทแบบ demo — Master PO / ใบชั่ง (BULK) / ใบส่งของ·ใบรับของ / บิลอื่น
  - ตารางหลัก: เพิ่มคอลัมน์ "บทบาทการจับคู่" (หัวตาราง + แถว, colspan แถวรายละเอียด 9→10) + ป้ายสถานะต่อแถวใต้ PO (ลบป้าย "X จับคู่/รอตรวจสอบ" เดิมที่ซ้ำออก)
  - การ์ด view: เพิ่มป้ายบทบาทใต้ชื่อร้าน + แถบสถานะจับคู่ที่มุมซ้ายล่างรูป
  - แท็บ "บิลที่จับคู่แล้ว" (renderMatchedLinkRow): เพิ่ม renderMatchRoleCell ในแถวคู่
  - ใหม่ dropdown `matchStatusFilter` (ทุก/ยังไม่จับคู่/รอตรวจสอบ/จับคู่แล้ว) + dropdown `matchRoleFilter` (ทุก/Master PO/ใบชั่ง/ใบส่งของ·ใบรับของ/บิลอื่น) + logic กรองใน runFilters (ใช้ buildLinkIndex จริง)
- **Check:** node --check ผ่าน script ของ index.html | ไม่มี U+FFFD | จำลองรัน 3 กรณี: PO→"Master PO จับแล้ว 1 ⏳รอตรวจ 1" / ใบส่งของ→"จับคู่แล้ว↗ร้าน ก ตรงอัตโนมัติ 98%" / ใบชั่ง→"รอตรวจสอบ↗ร้าน ก [แนะนำการจับคู่] 85% ⚖️เพี้ยนมาก 12.3% · 5 ตัน" ✓
- **ไม่แตะ:** Code.gs, SQL, โมเดลจับคู่ backend (runAutoMatcher), ข้อมูลจริง
- **ยังไม่ทำ (รอ User ดูหน้าเว็บก่อน):** สถานะ DISPUTED (ทักท้วง) — demo มี 4 สถานะ แต่ receipt_links/weight_variances จริงมีแค่ pending/confirmed + needs_review → ถ้าต้องการสถานะทักท้วงต้อง alter SQL + backend เพิ่ม (แยกงานอีกก้อน)
- **สถานะ:** โค้ดเสร็จ รอ User Deploy (index.html เป็น HtmlService) + เปิดดูแท็บตาราง/แท็บจับคู่ + ทดสอบตัวกรองสถานะ/บทบาท

## [2026-09-22] ใช้รุ่นฟรีเป็นหลัก (คำสั่ง User) + ลดคำขอ AI ครึ่งหนึ่งกันตกหล่น
- **ที่มา:** User ย้ำชัดว่า "ให้ใช้รุ่นฟรีเป็นหลักในการอ่านเอกสาร" แต่ระบบยังใช้ gemini-3.8-flash (รุ่น+หนาแน่น ติด RESOURCE_EXHAUSTED ทุกใบ) + บิล 1 ใบเรียก AI 2 รอบ (PASS1+enhance) → โควตาฟรีหมดไว → เอกสารอ่านไม่ได้/ตกหล่น
- **แก้ Code.gs:**
  - `getPreferredGeminiModels`: **ตัด pro ออกจากตัวเลือก** (ไม่ใช่รุ่นฟรี), ให้คะแนน flash-lite=70 > flash=50 (ล็อก flash-lite เป็นตัวหลักเสมอ), fallback ลำดับใหม่ ['gemini-2.5-flash-lite','gemini-2.5-flash','gemini-flash-latest'], แคช/RETRY เดิมเก็บไว้
  - `analyzeReceiptSmart`: **รอบ 2 (enhance) เรียกต่อเมื่อผลรอบ 1 ไม่ชัดพอ** (confidence<85 หรือ readability≠clear) — ผลชัดเจนพอ = ใช้ใบเดียว จำกัดคำขอ Gemini เหลือ 1 ต่อใบ
- **Check:** node --check ผ่าน Code.gs | ไม่แก้ SQL | ไม่แก้ Flex 2 แบบที่ทำก่อนหน้า
- **ยังค้าง:** deploy ตัวจริง (ทุกครั้ง binary รันจริงไม่ตรงไฟล์: log 16:04 ยังเป็น 3.8-flash ตัวแรก) + LINE 429 monthly limit (แก้ที่โค้ดไม่ได้)

## [2026-09-22] ตอบกลับโดยไม่ติดโควตา LINE — โหมด reply-first (REPLY_ONLY_MODE)
- **ที่มา:** User ถาม "ทำยังไงให้ตอบกลับจากโค้ดแบบไม่ยุ่งโควตา LINE" — จาก log จริงของบัญชี: reply (ตอบทันที) HTTP 200 ผ่าน แต่ push 429 'monthly limit' → LINE บัญชีฟรีให้ reply โดยไม่หักโควตา push
- **ข้อจำกัด:** replyToken ใช้ได้ครั้งเดียว + หมดอายุเร็ว → ใช้ตอบ "ผลสรุปบิล" ที่ใช้เวลาอ่าน 1-2 นาทีตรงๆ ไม่ได้ → ต้องเลือก: งดแจ้ง "กำลังอ่านบิล" แล้วเอา replyToken เก็บไว้ตอบผลสรุปตอนจบ
- **แก้ Code.gs:**
  - ใหม่ `isReplyOnlyMode()`: อ่าน Script Property `REPLY_ONLY_MODE` (default = true)
  - `handleImageMessage`: ถ้า mode reply-first → งด reply "กำลังอ่านบิล" แล้วส่ง `event.replyToken` เข้า `processReceiptSubmission` (โหมดเดิมยังมี)
  - `processReceiptSubmission(messageId, senderId, source, replyToken)`: ส่ง replyToken ไปยัง pushFlexMessage / pushDuplicateFlexMessage / pushLineMessage(retake) ทุกจุด
  - ใหม่ `sendResultMessages(replyToken, to, messages, label)`: ลอง reply ก่อน (log `✅ REPLY-SAVED/DUP/TEXT` ไม่กินโควตา) → ถ้าไม่ผ่าน (โทเคนหมด/ใช้แล้ว/429) → fallback push (log `⚠️ REPLY-...` + `❌ PUSH`)
  - ใหม่ `sendLineMessagesRaw(replyToken, messages)`: คืน {ok,code,body} (refactor จาก sendLineMessage เดิมที่ log เอง)
  - `pushFlexMessage`/`pushDuplicateFlexMessage`/`pushLineMessage`: เพิ่มพารามิเตอร์ replyToken ตำแหน่งหลัง ค่าเริ่มต้น undefined
  - `handleLineEventError`: ส่งข้อความ error ผ่าน reply-first ด้วย (event.replyToken)
  - เส้นทางคิว (burst/timer) ไม่มี replyToken → push เหมือนเดิม
- **Check:** node --check ผ่าน Code.gs | ไม่แก้ SQL | Flex 2 แบบเดิมไม่แตะ
- **ผลที่คาด:** เมื่อ deploy แล้ว ส่งบิล 1 ใบ → อ่านเสร็จแล้วตอบการ์ดผลด้วย REPLY (ผ่านทั้งที่ push หมด) ถ้า reply ไม่ผ่าน → ยัง available push สำรอง
- **Re-open วิธีสลับ:** ตั้ง Script Property REPLY_ONLY_MODE=false → กลับโหมดเดิม (แจ้งกำลังอ่าน + push สรุปผล)

## [2026-09-22] หน้าใหม่ "ตรวจวางบิล 3-Way" — port UI demo ทดสอบ.html เป็นส่วนหนึ่งของเว็บจริง (เชื่อมข้อมูลจริง)
- **ที่มา:** User ส่งไฟล์ `C:\Users\PC\OneDrive\Desktop\ทดสอบ.html` (demo ระบบจับคู่เอกสาร 3-Way — React mock) พร้อมย้ำหลายรอบว่า "ผมบอก UI ต้องการตารางที่เหมือน" → ต้องการให้หน้าเว็บจริงมีตาราง UI แบบ demo นั้น (ตาราง 4 ส่วน PO/DO/Ticket/Audit + KPI 5 ใบ + แท็บ BULK/UNIT/ORPHAN + ป้ายสถานะสี + โหมดคิดเงิน DO/Ticket)
- **ขอบเขต (User เลือกผ่านคำถาม):** ทำเป็น **หน้าใหม่ทั้งหน้า** ใน sidebar (ไม่แตะตารางเดิม) ชื่อ "ตรวจวางบิล 3-Way" — ใช้ข้อมูลจริง (receipts / receipt_links / weight_variances) ไม่สร้าง mock
- **แก้ index.html (Targeted — ส่วน HTML + JS ใหม่, ไม่แตะฟังก์ชันเดิม):**
  - sidebar + mobile nav: เพิ่มปุ่ม `data-page="3way"` "ตรวจวางบิล 3-Way" (หลังปุ่ม ตารางบิล)
  - ใหม่ `<div id="page3Way">`: header + ริเฟรช + search (`threeWaySearch`) + แถบกรองสถานะ 5 ปุ่ม (`twFilter*`) + KPI container (`threeWayKpis`) + แท็บ 3 ตัว (`twTabBULK/UNIT/ORPHAN`) + content (`threeWayContent`)
  - `switchPage`: เพิ่ม toggle `page3Way` (ทั้ง class.hidden + inline display ตาม isDesktop) + `render3WayView()` เมื่อสลับมา
  - ใหม่ state/ตัวแปร: `threeWayTab` / `threeWayStatusFilter` / `threeWayBulkMode` / `threeWayData` / `THREE_WAY_TOLERANCE = 0.5`
  - ใหม่ `build3WayData()`: ประกอบจากข้อมูลจริง — PO(ใบสั่งซื้อ)+ลิงก์ → แยก BULK (มีใบชั่ง/ใบส่งของมีน้ำหนัก) / UNIT (นับชิ้น) / ORPHAN (ไม่ใช่ PO และไม่มีลิงก์, แนะนำ PO จากร้านค้าตรงกัน); **ดึงใบชั่งต่อจาก chain ของ DO (โซ่ 3 ขั้น) ไม่ใช่ติด PO ตรง**; สถานะ: MATCHED / TOLERANCE_EXCEEDED (diff ±0.5% หรือ weight_variance) / WRONG_MATCH (ใบชั่งติด PO ตรงโดยไม่มี DO) / QTY_MISMATCH / PENDING (มี link รอตรวจสอบ)
  - ใหม่ `compute3WayKpis()` 5 การ์ด (ตาม demo): มูลค่าวางบิลรวม / Matched Rate / น้ำหนักเกินเกณฑ์ / จับคู่ผิดพลาด·ขาดส่ง / Orphans
  - ใหม่ `renderBulkTable()` (ตาราง 4 ส่วน PO-blue/DO-amber/Ticket-emerald/Audit-slate, min-w 1600px, สีแถวแดง/เหลือง, select โหมดคิดเงิน DO/Ticket สลับ `threeWaySwitchMode`, ยอดคิดจาก unitPrice×นน.สุทธิ หรือ total_amount เมื่อไม่มี) / `renderUnitTable()` (3 ส่วน PO/DO·Invoice/Audit, เทียบ qty สั่ง vs ส่งจริง) / `renderOrphanTable()` (ตาราง 9 คอลัมน์ + ปุ่มเชื่อมโยง
  - ใหม่ `threeWayOpenDoc()`/`threeWayOpenMatch()` → เปิด `openMatchedDetail` เดิม + toast นำทาง (ไม่มีฟังก์ชันจับคู่ใหม่ ไม่สร้าง modal ใหม่)
  - `threeWayFilterRows()` กรอง search + สถานะ / `threeWayStatusChip()` ป้ายสีตาม demo / helpers: `sumItemsQty`/`firstUnitPrice`/`fmtTons`/`fmtQty`
- **Check:** node --check ผ่าน script ทั้งไฟล์ (402KB) | ไม่มี U+FFFD | mock test ผ่าน: PO+DO+Ticket โซ่ถูกต้อง→MATCHED diff 0.033% / ใบชั่งติด PO ตรง→WRONG_MATCH (บังคับโหมด TICKET) / UNIT 5vs3→QTY_MISMATCH / 5vs5→MATCHED / orphan แนะนำ PO จากร้านค้าเดียวกัน ✓
- **ไม่แตะ:** Code.gs, SQL, ตารางเดิม (pageTable), renderMatchedView, ตัวกรองเดิม
- **ยังค้าง:** Content ของ row bulk ที่มีเฉพาะใบส่งของแต่ไม่มีใบชั่ง (แสดง Ticket เป็น '-' ตามข้อมูลจริง) | หน้าใหม่ยังต้อง verify สี/ขนาด real device
- **สถานะ:** โค้ดเสร็จ รอ User Deploy (index.html เป็น HtmlService) + กด sidebar "ตรวจวางบิล 3-Way" ดูผลจริง

## [2026-09-22] แก้บั๊กหน้า 3-Way ขึ้น "โหลดข้อมูลไม่สำเร็จ" — ReferenceError up is not defined (UNIT branch)
- **ที่มา:** User รายงานว่าหน้ากด sidebar "ตรวจวางบิล 3-Way" แล้วประโยค error message เดียวกับ `.catch` ใน `render3WayView` (โหลดข้อมูลไม่สำเร็จ — ลองรีเฟรชใหม่อีกครั้ง) หน้าเลยไม่วาดตารางเลย
- **วินิจฉัย (harness จำลองข้อมูลจริง):** นำฟังก์ชันจริงจาก index.html ไปรันใน Node กับข้อมูลเลียนแบบ (PO+DO+Ticket โซ่จริง / ใบชั่งติด PO ตรง / PO จับ invoice นับชิ้น / orphan) → **พบ ReferenceError: `up is not defined` ที่ build3WayData** — ในแขนง UNIT (`else`) บรรทัดคำนวณ `totalAmount: (up && up > 0 && delQty > 0) ? up * delQty ...` อ้างตัวแปร `up` แต่ `const up = firstUnitPrice(it)` ประกาศอยู่แค่ในแขนง BULK (`if`) ข้างบน → PO ทุกใบที่จับบิลแบบนับชิ้น (ใบกำกับ/ใบส่งของไม่มีน้ำหนัก) ตกเข้า UNIT แล้ว throw → Promise.all `.catch` แสดงข้อความ error
- **แก้ index.html (เจาะจง 1 จุด):** แขนง UNIT เปลี่ยนเป็นประกาศตัวแปรใหม่ `const up_u = firstUnitPrice(it);` แล้วใช้ `pricePerUnit: up_u` + `totalAmount: (up_u && ...)` ครอบแทนการใช้ `up` ข้างนอกขอบเขต (ไม่แตะแขนง BULK ที่มี `up` อยู่แล้ว)
- **Check:** harness จำลองรันใหม่ผ่านทั้ง build3WayData (bulk 2/unit 2/orphan 1 + renderBulkTable/renderUnitTable/renderOrphanTable/threeWayStatusChip) → RENDERERS-OK | node --check ผ่าน script ทั้งไฟล์ | ไม่มี U+FFFD | ค่า KPI/สถานะ/variance ยังอ่านจากข้อมูลจริง (ไม่เดา)
- **ยังค้าง:** หน้าใหม่ยังต้อง verify สี/ขนาด real device พร้อมกันกับ deploy นี้
- **สถานะ:** แก้เสร็จในไฟล์ รอ User redeploy index.html (HtmlService) + กด "ตรวจวางบิล 3-Way" ดูผลจริง

## [2026-09-23] 🎨 Phase 1 — วาง Design Tokens + UI Components มาตรฐาน (index.html)
- **คำขอ User:** "UI ไม่มีมาตรฐานอะไรเลย" — วินิจฉัยจากโค้ดจริง: ปุ่ม 7 ขนาด (px-3 py-1 → px-4 py-2), primary 2 สีแข่งกัน (bg-btc-green vs bg-emerald-600 ทั้งที่ tailwind.config ล็อก btc.green แล้ว), badge copy-paste string ซ้ำ 30+ จุด, activeCls/idleCls redefine ใน JS 4 จุดไม่ sync (showDetailTab/setViewMode/setAIMode/switchPage), font 10-16px มั่ว (text-[10px]/[11px]/xs/sm), หัวตาราง 3 สไตล์ + patch .text-slate-400 ทั้งคลาสเป็นหลักฐานไม่มี token
- **แก้ (เจาะจงจุดเดียว):** แทรกบล็อก `<style id="ui-standard">` ใน index.html (ต่อจาก SUPPLEMENTARY UTILITIES ปิด </style> ของ style เดิมก่อนเสมอ) — CSS variables (--ui-brand=#27AE60 lock ห้าม emerald-600 แทน primary, สถานะ ok/pending/danger/info/role/muted, radius 3 ระดับ btn/card/pill, font 5 ระดับ 11/12/14/16/24) + components: .ui-btn(--sm/--primary/--ghost/--danger) .ui-badge(--ok/--pending/--role/--muted/--danger/--info) .ui-card .ui-th .ui-tab(.is-active) .ui-input
- **บั๊กระหว่างทำ (แก้แล้ว):** แทรกครั้งแรกทำให้ `<style id="ui-standard">` ไปอยู่ข้างใน `<style>` เดิม (HTML parser อ่าน style ซ้อนไม่ได้ → :root จะถูกตีความเป็น selector พัง + มี </style> ซ้ำ) — แก้ targeted 2 จุด: ย้าย </style> ปิดของเดิมมาไว้ก่อน comment บล็อกใหม่ + ตัด </style> ซ้ำท้ายบล็อก
- **ไม่ rebuild Tailwind** (CSS ล้วน — ไม่เพิ่ม class Tailwind ใหม่ กันบั๊ก "class ใหม่ไม่มีผลเงียบ") / ไม่แก้ HTML นิ่ง+JS logic ใด ๆ / ไม่แตะ Code.gs+SQL / ของเดิมทุกจุดยังทำงานเหมือนเดิม 100% (ยังไม่มีอะไรอ้าง class ใหม่)
- **Check:** node --check script ทั้งไฟล์ (348KB ตัดผ่าน temp extract-check.js) = OK | FFFD=none | style open=3 close=3 | อ่านทวนไฟล์ยืนยันโครง </style> บรรทัด 73 → comment 75 → <style id="ui-standard"> 76-153 → </head> 154
- **สถานะ:** ✅ Phase 1 เสร็จ — รอ User deploy index.html (HtmlService) ยืนยันหน้าเว็บเดิมเหมือนเดิมเป๊ะ แล้วสั่งเริ่ม Phase 2 (ย้ายจุดจริงทีละกลุ่ม: 4 activeCls → .ui-tab / ปุ่ม emerald-600 → .ui-btn--primary / badge จับคู่ → .ui-badge / หัวตาราง → .ui-th / KPI สองหน้าให้เหลือแพตเทิร์นเดียว)


## [2026-09-23] 🎨 Phase 2 — ย้ายจุดจริงใน index.html ไปใช้ ui-* ครบทุกกลุ่มเป้าหมาย
- **คำขอ User:** "เริ่ม Phase 2" — ย้ายทุกจุดที่วินิจฉัยไว้ใน Phase 1 ไปใช้ class มาตรฐาน (Targeted Editing รายจุด ไม่ rewrite บล็อก)
- **แก้สรุป (index.html ทั้งหมด ~36 จุด):**
  1. **CSS:** เพิ่ม `.ui-badge--scale` (สีส้ม — ใบชั่ง BULK) ในบล็อก ui-standard
  2. **Tab → .ui-tab (4 จุด):** `setAIMode` activeCls/idleCls / `switchView` btnTable·btnGrid / `showDetailTab` btnInfo·btnMatch / `switchPage` mobile (`mobile-page-btn ui-tab [is-active]`) — คง mobile-page-btn ไว้เพราะ CSS/JS เดิม query class นี้
  3. **ปุ่ม emerald-600 → .ui-btn--primary (12 จุด):** สร้างชุด Prompt / บันทึก&ให้AIเรียนรู้ / จัดหมวด / บันทึกที่เลือก (reanalyze) / ปุ่ม AI เขียนชุด prompt (generating เป็น --ghost) / อนุมัติจ่าย / ป้าย "AI" x2 → ui-badge--ok / ปุ่ม ยืนยันจับคู่+ยืนยัน x3 (renderMatchedLinkRow / renderMatchPanel / renderScaleMatchPanel / renderScaleChainRows)
  4. **Badge → .ui-badge (19 จุด):** matchTypeChip (--info/--role) / renderBillMatchStatus (PO·จับแล้ว·รอตรวจ·ยังไม่จับคู่·parts) / renderMatchRoleCell (--ok/--scale/--info/--muted) / span "รอตรวจสอบ·จับคู่แล้ว" x6 (รวมตัด text-[9px] มั่วออก)
  5. **หัวตาราง → .ui-th (4 จุด):** thead หน้าแก้ไข (sticky) / ตารางซัพพลายเออร์ / ตารางติดตามราคา / ตาราง Orphan (เปลี่ยน bg-slate-800 เป็น ui-th)
  6. **KPI → .ui-card (10 ใบ):** หน้าภาพรวม 5 ใบ (คง border-l-4 btc-green) + หน้า 3-Way 5 ใบ
- **ไม่แตะ (จงใจ):** `bg-emerald-600` บรรทัด 3178 = header "ส่วนที่ 3: ใบชั่งน้ำหนัก (Ticket)" ในตาราง 3-Way — สีโซ่ 4 ช่อง (blue/amber/emerald/slate) เป็น design ตาม demo ที่ User ให้ศึกษา ไม่ใช่ปุ่ม/ไม่ใช่ primary
- **Cascading ตรวจแล้ว:** `mobile-page-btn` class คงไว้ครบ (switchPage เดิม query อยู่) / ปุ่ม match ทุกแผงใช้ class เดียวกันหมด (ยืนยัน·ลบ 4 แผง sync) / ไม่มีจุด JS อ่าน activeCls/idleCls เดิมอีก
- **Check:** node --check ผ่าน (344KB script) | FFFD=none | style open=3 close=3 | bg-emerald-600 เหลือ 1 บรรทัด (3178 = header โซ่ 3-Way ตามขั้น) | นับการใช้งานจริง: ui-btn=39 ui-badge=19 ui-card=11 ui-tab=11 ui-th=13
- **สถานะ:** ✅ Phase 2 เสร็จ — รอ User deploy index.html (HtmlService) แล้วดูจริง 4 แท็บ (ภาพรวม/ตาราง/จับคู่/3-Way) + modal แก้ไข + แผง AI: ปุ่มเขียวควรเหลือสีเดียวกันหมด (#27AE60), ป้ายสถานะทรงเดียวกัน, หัวตารางเทาอ่อนเหมือนกัน, KPI การ์ดเดียวกัน — ถ้าจุดไหนดูแปลกส่งภาพมาได้เลย



## [2026-09-23] 🎨 Phase 2.5 — แก้ปัญหาใหญ่ "ตัวอักษรสีขาว/กลืนพื้น" + รวมทุกเมนูให้ไปทางเดียวกัน (คงสไตล์เดิม)
- **คำขอ User:** "เหมือนไม่ได้แก้อะไรเลย — UI ที่ต้องการคือแบบเดิมทั้งหมด แต่ให้มีมาตรฐานไปทางเดียวกันทุกเมนู ไม่ใช่คนละทาง และปัญหาใหญ่คือสีตัวอักษรขาว/สีเดียวกับพื้นหลัง ทั้งปุ่มทั้งข้อมูล"
- **Audit text-white ทั้ง 40 จุด + คู่สีอันตราย (พื้นอ่อน+ขาว / พื้นเข้ม+เทา) — สรุปบั๊กจริงที่แก้ 5 ชุด:**
  1. 🔴 ปุ่ม "บันทึกการจับคู่/บันทึกจับคู่ใบชั่ง": ตอน disabled = bg-slate-200 + `text-white` ตายตัว → ขาวบนเทาอ่อนอ่านไม่ออก — แก้ conditional: enabled = text-white บนเขียว / disabled = text-slate-600 บนเทาอ่อน
  2. 🔴 `.ui-btn--primary:disabled` (CSS Phase 1): color #94A3B8 บน #E2E8F0 = 1.9:1 เกือบกลืน — แก้เป็น #475569
  3. 🟠 chip หัวโมเดล 5 เมนู คนละสีคนละทรง (btc-green / amber-500 / ui-badge--ok / sky-600) — รวมเป็นสูตรเดียว `bg-btc-green text-white text-xs px-2.5 py-1 rounded-md font-bold tracking-wide` (BTC รายละเอียด / BTC แก้ไข / AI ดูตัวอย่าง / AI อัปโหลด / AI สร้างชุด Prompt)
  4. 🟠 hover ปุ่มเขียว 2 แบบ (hover:bg-emerald-700 vs btc-green-hover) — รวมเป็น `hover:bg-btc-green-hover` (btnCreatePrompt / btnUploadSample)
  5. 🟠 **ย้อน mobile nav กลับเป็นแบบเดิม** (bg-btc-green text-white active) ตามคำสั่ง "คงสไตล์เดิม" — เอา ui-tab ออกเฉพาะจุดนี้ (คงไว้ใน 3 แท็บ modal ที่ไม่เปลี่ยนลุกเดิม)
- **เพิ่ม READABILITY GUARD ใน <style id="ui-standard">:** `input/select/textarea { color:#1E293B }` (ข้อมูลในช่องกรอกเข้มเสมอทุกเมนู) + `::placeholder { color:#64748B }` (≥4.5:1) + `select option { color:#1E293B; background:#fff }`
- **แก้ผิดระหว่างทำ (จับและย้อนทันที):** เผลอแตะ onclick saveMatchSelections (เพิ่ม space) ตอนตั้งใจแก้ class — ย้อนกลับพร้อมแก้ class ถูกจุดในรอบเดียว
- **ไม่แตะ:** ป้ายสีหัวตาราง 3-Way 4 โซ่ (ตั้งใจตาม demo) / ปุ่ม text-white บนพื้นเข้ม-แบรนด์ 37 จุดที่ถูกต้องอยู่แล้ว
- **Check:** node --check EXIT=0 (345KB script) | FFFD=none | style open=3 close=3 | bad-patterns left=0 (bg-amber-500+white / slate-200+white / hover:bg-emerald-700 = 0)
- **สถานะ:** ✅ แก้เสร็จ — รอ User REDEPLOY index.html แล้วไล่ดู 4 ข้อ: (ก) ปุ่มบันทึกยังไม่เลือก = เทาเข้มอ่านออก / เลือกแล้ว = เขียวขาว (ข) chip หัวโมเดลทุกใบเขียวเหมือนกัน (ค) ช่องกรอก+placeholder อ่านชัดทุกเมนู (ง) mobile nav กลับเขียวแบบเดิม — จุดไหนยังขาว/กลืนพื้น ส่งภาพมาได้เลย

## [2026-09-23] 🔴 Phase 2.6 — ต้นตอจริง "ตัวอักษรขาว/กลืนพื้น + ทุกเมนูไม่เหมือนกัน": Tailwind build เก่ากว่าโค้ด (class หาย 130 ตัว)
- **คำขอ User:** ส่งภาพหน้า 3-Way จริง (deploy แล้ว) ระบุ "ไม่มีอะไรเปลี่ยน ปัญหาที่บอกไปยังอยู่ครบ" + ลูกศรชี้ช่อง "จัดการ/ส่งเอกสาร"
- **วินิจฉัยด้วยหลักฐานจากไฟล์ (ไม่เดา):** เขียนสคริปต์ diff-classes.js เทียบ **class ที่ใช้จริงในโค้ด (502 ตัว)** กับ **class ที่มี CSS ในทุก <style> (420 ตัว)** → พบ **ขาด 130 ตัวจริง** ต้นเหตุ:
  - `bg-blue-700` / `bg-amber-600` / `bg-emerald-600` (หัวตาราง 3-Way ส่วนที่ 1/2/3) **ไม่มีใน build** แต่ `text-white` มี → **ขาวบนขาว = อ่านไม่ออก** (ส่วนที่ 4 ใช้ bg-slate-800 ที่มีใน build → แสดงปกติ จึงเห็นแค่ 1 ใน 4 ส่วน) — ตรงกับที่ลูกศรชี้เป๊ะ
  - `bg-slate-200` ขาด → ปุ่ม disabled ของผม (saveMatch/saveScale) พื้นเทาไม่มี = ขาวบนขาวด้วย
  - `bg-blue-50`/`bg-indigo-50`/`bg-red-500`/`bg-indigo-100`/`text-indigo-600`/`bg-sky-100` ขาด → KPI icon + ป้ายเลขแท็บ ORPHAN หายทั้งสี
  - `min-w-[1600px]` ขาด → ตาราง 3-Way ไม่กว้างเท่าที่ออกแบบ / `shadow`, `p-5`, `pt-1`, `max-w-48`, `h-24` ฯลฯ ขาดอีกกว่า 100
- **สาเหตุราก:** หน้า 3-Way + จุดใหม่เขียนหลัง build Tailwind ครั้งสุดท้าย แต่ไม่ได้ rebuild (README เขียนกฎนี้ไว้เองว่า "ห้ามเพิ่ม class ใหม่โดยไม่ rebuild") — pattern เดิมของโปรเจกต์แก้ด้วยการ append เข้า `SUPPLEMENTARY UTILITIES`
- **แก้ (index.html เท่านั้น — append เท่านั้นไม่แก้ของเดิม):** สร้าง CSS มาตรฐาน Tailwind v3 ครบ 130 rule ด้วย generator (temp gen-missing-css.js + palette v3 ตรวจค่า hex จริง) → append ต่อท้ายบล็อก SUPPLEMENTARY: colors 48 ตัว (รวม /opacity 14), border 11, cursor/float/col-span 5, focus 4, gap 3, hover 12, last 1, spacing/size ~30, ring 2, shadow/p-5/pt-* 20+, text colors 12, top/left 3, transition-colors 1, group-hover 2 + @keyframes pulse + @media sm/md/lg ตาม breakpoint
- **เพิ่ม v3.14.1 ที่ versionBadge** — เป็นตัวพิสูจน์ว่า "ไฟล์ที่ deploy ตรงกับเครื่องจริง" (แก้ปัญหา deploy ไม่โดนซ้ำซาก)
- **Check:** node --check EXIT=0 (345KB) | FFFD=none | style 3/3 | literal check ทุก class ที่เคยขาด = True (group-hover/min-w-[1600px]/bg-blue-50/bg-red-500/bg-indigo-50/shadow/p-5/bg-slate-200) | diff ใหม่เหลือแต่ false-positive 6 ตัว (bottom/items/left/right/text/max-w-6xl ที่มีอยู่แล้ว) | HANDOFF JSON OK
- **สถานะ:** ✅ แก้เสร็จ — **ต้อง REDEPLOY ก่อนจึงจะเห็นผล** (copy index.html ทั้งไฟล์ → Save → Deploy > Manage deployments > edit (ดินสอ) > Version: **New version** > Deploy) แล้วเช็คป้ายมุมซ้ายบนต้องเป็น **v3.14.1** ถ้ายังเป็น v3.14.0 = deploy ยังไม่เข้า


## [2026-09-23] 🔑 Phase 2.7 — แก้ "บันทึกการแก้ไขไม่สำเร็จ: SESSION_EXPIRED" (sliding session + ล็อกอินใหม่แล้วทำต่ออัตโนมัติ)
- **คำขอ User:** "พบปัญหา บันทึกการแก้ไขไม่สำเร็จ: SESSION_EXPIRED"
- **วินิจฉัยจากโค้ดจริง 2 ชั้น:**
  1. **Backend:** session token มีอายุ **2 ชม. แบบไม่ต่ออายุ** (`apiSessionValid` คืน true/false ตรง ๆ) → ผู้ใช้ที่เปิดหน้าค้างไว้แล้วกด "บันทึกการแก้ไข" หลัง 2 ชม. จะโดน `validateApiRequestContext` ตอบ `SESSION_EXPIRED` ทันที (รวมถึงกรณี CacheService ของ GAS evict token ก่อนกำหนด)
  2. **Frontend (บั๊กจริง):** catch ของ `saveEditReceipt` เขียนเงื่อนไข `err.message === 'SESSION_EXPIRED' && !GAS_MODE` → **โหมด GAS Web App (ที่ใช้งานจริง) ไม่เปิดหน้าให้ล็อกอินใหม่เลย** ผู้ใช้เห็นแค่ข้อความตายตัว "บันทึกการแก้ไขไม่สำเร็จ: SESSION_EXPIRED" แล้วตัน (ต้องไปกดเมนูตั้งค่าเองเท่านั้น) — เกิดกับ `saveImageEdit` + `deleteReceiptConfirm` + `handleLinkError` เหมือนกันทั้ง 4 จุด
- **แก้แบบเจาะจง Function (Targeted):**
  - **Code.gs — `apiSessionValid()`:** เพิ่ม **sliding session** — token ที่ยังใช้ได้และเหลืออายุ < 50% ของ TTL จะต่ออายุอัตโนมัติเป็น `now + 2 ชม.` (ต่อเฉพาะเมื่อใกล้หมด → cache.put ครั้งคราว ไม่ถี่ทุกคำขอ) — หมดอายุจริงเมื่อ "ไม่มีการใช้งาน" ครบ TTL จึงคงความปลอดภัยเดิม
  - **index.html — เพิ่ม `postLoginRetry` + `handleSessionExpired(actionLabel, retryFn)`:** แจ้งข้อความไทยชัดเจน (บอกสาเหตุ 2 ชม. + บอกว่าจะทำต่อให้) → เปิดหน้าเข้าสู่ระบบ **ทั้ง GAS และ REST** → โฟกัสช่องรหัสผ่านให้
  - **index.html — `loginSettings()` สำเร็จ:** ถ้ามีงานค้าง → ปิดหน้าตั้งค่า + toast + **เรียกงานที่ค้างต่อให้อัตโนมัติ (200 ms)** ผู้ใช้ไม่ต้องกรอกฟอร์มซ้ำ/กดซ้ำ
  - **Cascading 4 จุด catch:** `deleteReceiptConfirm` (retry ลบบิล) / `saveImageEdit` (retry บันทึกรูป) / `saveEditReceipt` (retry บันทึกการแก้ไข) / `handleLinkError` (เปิดล็อกอิน ไม่ auto-retry เพราะต้องติ๊กเลือกใหม่)
  - **bump versionBadge → v3.14.2** (ตัวพิสูจน์ว่า deploy index.html เข้าจริง)
- **Check:** `node --check` index.html script = EXIT 0 (346KB) | **`node --check` Code.gs = EXIT 0** | FFFD=False ทั้ง 2 ไฟล์ | `handleSessionExpired` = 5 ตำแหน่ง (1 def + 4 call) | ไม่เหลือ pattern `SESSION_EXPIRED' && !GAS_MODE` (0) | badge v3.14.2 | sliding-session อยู่ในไฟล์
- **สถานะ:** ✅ แก้เสร็จ — **ต้อง DEPLOY ทั้ง 2 ไฟล์**: (1) `Code.gs` วางใน GAS editor ไฟล์ Code.gs → Save (2) `index.html` วางในไฟล์ index → Save (3) Deploy > Manage deployments > ✏️ > Version: **New version** > Deploy — แล้วBadge ต้องเป็น v3.14.2
- **พฤติกรรมใหม่เมื่อ session หมดอายุ:** กดบันทึก → ระบบขึ้น "⏰ เซสชันหมดอายุ (2 ชั่วโมง) — กรุณากรอกรหัสผ่านอีกครั้ง ระบบจะ...ต่อให้อัตโนมัติ" → หน้าล็อกอินเด้ง → กรอกรหัส → ระบบปิดหน้าล็อกอินและบันทึกต่อให้เองทันที (ไม่เสียข้อมูลที่กรอกไว้)


## [2026-09-23] 🖼️ Phase 2.8 — แผงแก้ไขรูปในหน้าต่าง "แก้ไขข้อมูลบิล" (แก้รูปพร้อมกับฟอร์มข้อมูลได้เลย)
- **คำขอ User:** "เมื่อกด แก้ไขข้อมูลบิล รูปบิลอ้างอิง ควรให้แก้ไขรูปได้พร้อมกันเลย" (ซ้ำ 2 ครั้ง — ฟีเจอร์เดิมมีแต่พบว่าปุ่มจิ๋ว + หาบิลไม่เจอบางมุมมอง)
- **สิ่งที่แก้ (index.html เท่านั้น — Targeted):**
  1. **แผงแก้ไขรูปใหม่ในหน้าต่างแก้ไข (โซนซ้าย):** canvas `editModalCanvas` + toolbar `ui-btn` — หมุนซ้าย/หมุนขวา/พลิกแนวนอน/ปรับความสว่าง (slider)/รีเซ็ต/บันทึกรูป — ใช้งานพร้อมกับฟอร์มข้อมูลด้านขวาได้ทันทีโดยไม่ต้องปิดหน้าต่าง
  2. **`emLoadImageForEdit()`:** เปิดหน้าต่างแก้ไข → โหลดรูปบิลเข้าแผงพร้อม `editModalImageUrl` เดิม (backend `getReceiptImageData` เดิม) — แสดงสถานะผ่าน `emStatus`/placeholder
  3. **`emSave()`:** คำนวณ jpeg 0.9 + กันไฟล์ >12MB (ชี้ไปใช้ตัวเต็มเพื่อครอป) → ส่ง backend `saveEditedReceiptImage` (ตัวเดิม) → `emApplySavedImage()` ซิงก์รูปใหม่เข้า filteredData/allData/renderView/`editModalImageUrl`/`editTarget` แล้วโหลดรูปใหม่เข้าแผงอัตโนมัติ — ข้อมูลที่กรอกในฟอร์มค้างไว้ไม่หาย
  4. **Cascading:** `openEditModalItem` เรียก `emLoadImageForEdit()` แทนการตั้ง `<img>` | `applyEditedImageLocally` (ตัวแก้ไขเต็มรูปแบบเดิม) อัปเดตแผงใหม่ถ้าหน้าต่างแก้ไขเปิดอยู่ | `closeEditModal` ล้าง state em* | SESSION_EXPIRED ใช้กลไก Phase 2.7 (`handleSessionExpired` + retry `emSave`)
  5. **Robustness:** `openImageEditorFromEditModal` ใช้ `editModalItemRef` อ้างอิงตรง → ถอย allData → filteredData (เดิมค้นเฉพาะ filteredData บิลจากมุมมอง 3-Way/แท็บอื่นขึ้น "ไม่พบข้อมูลบิล")
  6. **บำรุงมาตรฐาน:** กล่อง info ใหม่ใช้ `text-sky-800` (เติมใน MISSING CSS แล้ว) / ปุ่มใช้ `ui-btn--sm ui-btn--ghost/--primary` / bump versionBadge → v3.14.3→v3.14.4 รอบแก้ไขจริง
- **หมายเหตุขอบเขต:** ครอป/ตัดขอบยังอยู่ในตัวแก้ไขเต็มรูปแบบ ("ตัวแก้ไขเต็มรูปแบบ" ลิงก์ใต้แผง) เพื่อไม่ประดิษฐ์ logic crop ซ้ำซ้อน
- **Check:** `node --check` EXIT=0 (355KB) | FFFD=False | ฟังก์ชัน em* defined ครบ 9 ตัว | ไม่เหลืออ้าง element `editModalImage` ที่ลบ (leftover=0, เหลือเฉพาะตัวแปร editModalImageUrl) | badge v3.14.4
- **สถานะ:** ✅ เสร็จ — **REDEPLOY index.html อย่างเดียว (Code.gs ไม่เปลี่ยน)** → Save → New version → เช็ค badge v3.14.4 → กด "แก้ไขข้อมูลบิล" ต้องเห็นแผงรูปซ้ายพร้อม toolbar หมุน/พลิก/ความสว่าง/บันทึกทันที: แก้รูป+แก้ข้อมูลค้างในฟอร์มได้พร้อมกัน, กด "บันทึกรูป" แล้วรูปในแผงเปลี่ยนโดยฟอร์มไม่ปิด

