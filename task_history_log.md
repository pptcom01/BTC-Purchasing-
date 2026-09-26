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


## [2026-09-23] 📋 จัดเลย์เอาต์หน้าต่างแก้ไขให้เป็นแบบเดียวกับ "ดูบิลเต็ม" (หัวบิล + กริดข้อมูลหลัก) + ผู้ส่งบิล/แหล่งที่มา/เลขที่รายการระบบ
- **คำขอ User:** หน้าต่างแก้ไขข้อมูลบิลควรมีโครงสร้างแบบเดียวกับหน้าต่างดูบิลเต็ม (การ์ดบริษัทที่หัว + กริดข้อมูลหลัก 5 ช่อง) แต่ยังเป็นฟอร์มที่ทุกช่องแก้ไขได้ — ข้อมูลตัวตนอ้างอิง (ผู้ส่งบิล แหล่งที่มา เลขที่รายการระบบ) แสดงแบบอ่านอย่างเดียว
- **สิ่งที่แก้ (index.html เท่านั้น — Targeted, โครงสร้างคอลัมน์ขวาของ editModal):**
  1. **หัวการ์ดบริษัท (ใหม่):** คัดลอกการ์ดบีบีซีโทนเขียวมรกตจาก detail modal (โลโก้ + ชื่อ/ที่อยู่/เลขผู้เสียภาษี/โทร + ป้าย "เอกสารตรวจสอบการจัดซื้อ") วางก่อนกริดข้อมูลหลัก
  2. **กริดข้อมูลหลัก (ใหม่):** `grid-cols-5` แบบเดียวกันกับดูบิลเต็ม = เลขที่เอกสาร + เลขที่ PO + **เลขที่รายการระบบ (อ่านอย่างเดียว `editSystemRecordNo`)** / วันที่ในบิล + หมวดหมู่ / ชื่อร้านค้า / **ผู้ส่งบิล LINE (อ่านอย่างเดียว `editSender`)** / **แหล่งที่มา (อ่านอย่างเดียว `editSource`)** — ช่องหลัก (เลขที่/PO/วันที่/ร้าน/หมวดหมู่) ยัง input/select แก้ได้ทันทีเหมือนเดิม
  3. **แก้ปิดการ์ด editModal ด้านล่างหาย 1 ชั้น:** ปรับคลอสซิ่งให้ถูกหลัก — ลบ `</div>` หลงตำแหน่งเดิมที่จุดต่อกริด แล้วปิดชั้น เนื้อหา/คอลัมน์ขวา/flex-row ให้ครบ (เชิงลึก: 54/54 ดุลภายในบล็อก รองใหม่รายละเอียด-ข้างล่างขวา)
  4. **`openEditModalItem` เพิ่ม populating 3 ช่องใหม่:** `editSystemRecordNo` = running_number (ถอย #xxxxxx จาก system_record_no) / `editSource` = กลุ่ม LINE ฝ่ายจัดซื้อ vs แชทส่วนตัว / `editSender` = ชื่อผู้ส่ง + tooltip แสดง ID LINE — ต่อจาก `renderEditItemRows`+`editTotalInput` เดิม
  5. **ของเดิมทั้งหมดย้ายเป็นน้องร่วม (ไม่แตะ logic):** การ์ดคำแนะนำ amber / การ์ดประเภทเอกสาร+เพิ่มใหม่+ช่องบัญชี / การ์ดใบชั่ง(พิกัดน้ำหนัก) / ตารางรายการ (เพิ่มรายการ/ผลรวม) — จัดเรียงใหม่ภายใต้กริดหลัก, ID ทุกตัวเดิมครบ 1 จุด ไม่ซ้ำ
- **Check:** `node --check` script = EXIT 0 | Whole-file DIV 554/554 diff=0 | บล็อก editModal 54 open/54 close diff=0 | FFFD=0 | ID ใหม่ `editSystemRecordNo`/`editSender`/`editSource` และทุก `edit*` หลัก count=1 (ไม่มีซ้ำ/ไม่มีหาย)
- **สถานะ:** ✅ เสร็จ — **REDEPLOY index.html อย่างเดียว** → Save → New version → เปิด "แก้ไขข้อมูลบิล" ตรวจ: เห็นการ์ดบริษัท + กริด 5 ช่องแบบเดียวกับดูบิลเต็ม, เลขที่รายการระบบ/ผู้ส่ง/แหล่งที่มา เป็นข้อมูลอ่านอย่างเดียวชัดเจน, ช่องที่เหลือแก้ได้ และทุกการ์ดเดิม (ประเภทเอกสาร/ใบชั่ง/รายการ/ยอดรวม) ยังอยู่ครบ


## [2026-09-23] 🔍 ซูมดูบิลเต็มจอในตัว (ไม่ต้องเปิดแท็บใหม่) + ✂️ เพิ่มครอปในแผงแก้ไขรูปของ "แก้ไขข้อมูลบิล"
- **คำขอ User:** (1) "ส่วนแก้ไขภาพจะขาดการครอปภาพไป" — ต้องการครอปได้ใน "แก้ไขข้อมูลบิล" โดยตรง (2) ซูมดูบิลแบบไม่ต้องเปิดภาพใหม่/แท็บใหม่ ทั้งใน "แก้ไขข้อมูลบิล" และ "ดูบิลเต็ม"
- **สิ่งที่แก้ (index.html เท่านั้น — Targeted, ต่อจาก Phase 2.8/2.9):**
  1. **ซูมดูบิล full-screen ในตัว (ใหม่ `zoomModal`):** แสดงรูปขยายเต็มจอ อยู่เหนือ modals อื่น (z-index 60) — ล้อเมาส์ซูมเข้าออกล็อคจุดเมาส์ (`zoomAt`), ลากเพื่อเลื่อน (pan), ปุ่ม + / − / 100% / พอดีจอ (`zoomIn/zoomOut/zoomOneToOne/zoomFit`) + ลิงก์เปิดแท็บใหม่เป็นตัวเลือกรอง (`zoomExternal`) + ปิดด้วย X / Esc
  2. **"ดูบิลเต็ม":** รูปบิล (modalImage) + ปุ่มหัว "ซูมดูบิล" → `openImageZoomFromDetail()` (เดิม `modalImageExternal` เปิดแท็บใหม่ → ป้องกัน default + ซูมในตัว)
  3. **"แก้ไขข้อมูลบิล":** `openEditImageLarge()` เปลี่ยนจาก `window.open` → ซูมในตัว โดย**แสดงผลงานที่ยังแก้ (หมุน/พลิก/ครอป) ไม่ต้องบันทึกก่อน** (ส่ง canvas.toDataURL) หรือรูปปัจจุบันของบิล
  4. **ครอปในแผงแก้ไข (ใหม่ `emCrop*`):** แผ่น `emCropOverlay`+`emCropBox`+4 แฮนเดิล ฝังในกล่องรูป (เหมือนตัวแก้ไขเต็มรูปแบบ) + ปุ่ม "ครอป" ใน toolbar (กดอีกครั้ง = "ยืนยัน") — `emToggleCrop/emSetCropMode/emResetCropRect/emApplyCropRect/emApplyCrop/bindEmCropDrag` (pointer events) + `emDraw` รีเซ็ตวงครอปเมื่อหมุน/พลิก + `emSave` auto-apply crop ก่อนบันทึก (เปิดครอปค้างแล้วกดบันทึกได้ทันที) + reset state ตอนโหลดใหม่/ปิดหน้าต่าง
  5. **Cleanup:** กำจัด `window.open` ออกจาก frontend หมด (0 รายการ) — ทุกมุมมองใช้ซูมในตัว, เปิดแท็บใหม่เฉพาะตัวเลือกรองใน zoomModal
- **Cascading Sync Check:** `closeEditModal` ปิด zoomModal ด้วย | `emLoadImageForEdit`/`closeEditModal` reset ครอป | `emApplySavedImage` → อัปเดต editModalImageUrl แล้ว `openEditImageLarge` อ่านค่าใหม่ถูก | detail modal ใช้ id เดิม `modalImageExternal` (เปลี่ยน behavior เป็น preventDefault + ซูม)
- **Check:** `node --check` EXIT=0 | Whole-file DIV 563/563 diff=0 | FFFD=0 | ID ใหม่ 9 ตัว count=1 | ฟังก์ชันใหม่ 17 ตัว defined=1 ตัวละ | `window.open` ใน script = 0 | badge → v3.14.6
- **สถานะ:** ✅ เสร็จ — **REDEPLOY index.html อย่างเดียว** → Save → New version → ทดสอบ: (1) ดูบิลเต็ม → กดรูป/ซูมดูบิล → ล้อเมาส์ซูม+ลากดูรายละเอียด, Esc ปิด (2) แก้ไขข้อมูลบิล → หมุน/พลิก/ครอป → ซูมดูบิล เห็นผลงานที่แก้ก่อนบันทึก → บันทึกรูป (3) เปิดครอปค้างแล้วกด "บันทึกรูป" ต้องครอปก่อนบันทึกอัตโนมัติ + badge ต้องเป็น v3.14.6


## [2026-09-23] 🔄 แก้ทางตาม User: ซูมเข้าออก "บนรูปโดยตรง" (inline) ใน ดูบิลเต็ม + แก้ไขข้อมูลบิล — ไม่เปิดหน้าต่าง/เลเยอร์ใหม่
- **คำขอแก้:** User ย้ำความหมาย — "การซูมเข้า-ออก แบบไม่ต้องเปิดหน้าต่างใหม่" = เอาเมาส์ไปล้อบนรูปในช่องเดิมแล้วซูมได้เลย ไม่เปิด modal/หน้าต่างซ้อนขึ้นมาใหม่ (ตอน แรกทำเป็น zoomModal เต็มจอ = ผิดทาง)
- **สิ่งที่แก้ (index.html เท่านั้น — Targeted):**
  1. **ลบ zoomModal ทั้งหมดออก** (HTML + ฟังก์ชัน zoom*/initZoomStage/openImageZoom* + ปุ่ม +/−/100%) — ไม่มี overlay ใหม่มาแทรก
  2. **Inline zoom ตัวเดียวใช้ร่วมกัน (`createInlineImageZoom(stage, el, opts)`):** บน `detailImageStage`/`modalImage` (ดูบิลเต็ม) และ `emImageStage`/`editModalCanvas` (ฟอร์มแก้ไข) — ล้อเมาส์ `wheel` ซูมเข้าออกล็อคจุดเมาส์ (`zoomAt`), `mousedown`+`mousemove` ลากเลื่อน (ลากได้เมื่อซูมเข้าแล้ว), `dblclick` / ปุ่ม "พอดีจอ" กลับขนาดพอดีกล่อง — ทั้งหมดเป็น transform กับ element เดิม ไม่มี window ใหม่ (`window.open` ยัง = 0)
  3. **"ดูบิลเต็ม":** ปุ่มหัวเปลี่ยนเป็น "พอดีจอ" (`detailImageZoomReset`) + hint "ล้อเมาส์บนรูปเพื่อซูมเข้าออก · ลากเพื่อเลื่อน · ดับเบิลคลิก/กด พอดีจอ เพื่อคืนขนาด" + `openDetailItem` เรียก `detailImageZoom.fitNow()` เมื่อรูปโหลดเสร็จ
  4. **"แก้ไขข้อมูลบิล":** ปุ่ม head + toolbar เปลี่ยนเป็น "พอดีจอ" (`emZoomReset`) + `emDraw()` เรียก `emImageZoom.fitNow()` (คืนพอดีกล่องทุกครั้งที่วาดใหม่/หมุน/พลิก/ครอป) + โหมดครอป: **ปิดการซูมอัตโนมัติ** (`disabled: emCropMode`) และเริ่มครอปจะคืนรูปพอดีกล่องก่อน (วงครอปอ้างพิกัดจอปกติ ไม่รับผล transform) — `emSave` ยัง auto-apply ครอปก่อนบันทึกเหมือนเดิม
- **Cascading Sync Check:** ลบ `closeImageZoom` ออกจาก `closeEditModal` (ฟังก์ชันหายไป) | `openDetailItem` ต่อ `onload` → fitNow (คู่กับ onerror เดิม) | `emSetCropMode(true)` → fitNow ก่อน resetCropRect | `emZoomReset`/`detailImageZoomReset` ถูกเรียกผ่าน onclick ใน HTML 2 จุด/1 จุด
- **Check:** `node --check` EXIT=0 | DIV 557/557 diff=0 | FFFD=0 | ไม่เหลืออ้าง `zoomModal`/`zoomImage`/`zoomState`/`openEditImageLarge`/`openImageZoom` (0 จุดโค้ด, เหลือแค่ comment ที่อัปเดตใหม่) | ID ใหม่ `detailImageStage`/`emImageStage` count=1 | `createInlineImageZoom` def 1 ชุด, `fitNow()` ถูกใช้ 6 จุด | badge → v3.14.7
- **สถานะ:** ✅ เสร็จ — **REDEPLOY index.html อย่างเดียว** → Save → New version → badge ต้องเป็น v3.14.7 → ทดสอบ: (1) ดูบิลเต็ม → เอาเมาส์ล้อบนรูปเลย ซูมเข้าออก + ลาก ตอนซูมเข้า, ดับเบิลคลิกคืนขนาด (2) แก้ไขข้อมูลบิล → หมุน/หมุน/ครอป แล้วล้อเมาส์ซูมบนรูปได้ทันที (ครอปจะคืนพอดีกล่องอัตโนมัติ), บันทึกรูปครอปก่อนบันทึกอัตโนมัติ (3) ไม่มี windows/overlay ใหม่ถูกเปิดเลย


## [2026-09-23] 🎯 ตาม User: ลบปุ่ม "แก้ไขรูปบิล" ออกจาก "ดูบิลเต็ม" + "บันทึกการแก้ไข" ปุ่มเดียวบันทึกทั้งรูปและข้อมูล (badge v3.14.8)
- **คำขอแก้:** (1) ปุ่ม "แก้ไขรูปบิล" ใน ดูบิลเต็ม ซ้ำซ้อน — เพราะแผงแก้ไขรูปอยู่ใน "แก้ไขข้อมูลบิล" แล้ว (2) อยากได้ปุ่มเดียวบันทึกทุกอย่าง: กด "บันทึกการแก้ไข" = บันทึกทั้งรูปที่แก้และข้อมูลพร้อมกัน ไม่ต้องมีปุ่ม "บันทึกรูป" แยก
- **สิ่งที่แก้ (index.html เท่านั้น — Targeted):**
  1. **ดูบิลเต็ม:** ลบปุ่ม "แก้ไขรูปบิล" (`openImageEditorFromDetail`) ทิ้ง เหลือปุ่ม "แก้ไขข้อมูลบิล" + "ปิดหน้าต่าง" (มี comment อธิบายว่าการแก้รูปอยู่ที่แผงแก้ไขในหน้าต่างแก้ไขข้อมูล) — ตัวแก้ไขเต็มรูปแบบยังเข้าได้ผ่านลิงก์ในแผงแก้นี้
  2. **แผงแก้ไขรูปใน ฟอร์มแก้ไขข้อมูล:** ลบปุ่ม "บันทึกรูป" (`btnEmSave`/`emSave`) ทิ้ง — เพิ่ม flag `emDirty` (true เมื่อหมุน/พลิก/เปลี่ยนความสว่าง/ครอป, false เมื่อโหลดรูป/ปิดหน้าต่าง)
  3. **รวมสต็อปเดียว (`saveEditReceipt`):** ถ้า `emDirty` → `emSaveImage()` (แยก logic ออกจาก emSave เดิม: `emRenderImageDataUrl()` สร้าง dataURL → `emSaveImage()` คืน Promise เรียก `saveEditedReceiptImage` เดิม) ก่อน แล้วค่อย `updateReceipt` — สำเร็จแล้ว `emApplySavedImage(newUrl)` ซิงก์รูปทุกรายการหน้าจอทันที แล้วปิดหน้าต่าง + `refreshData()` | ไม่แก้รูป → เดิมทีเดียว บันทึกข้อมูลอย่างเดียว
- **Cascading Sync Check:** อัปเดต hint/comment ในแผง (ชี้ไปที่ "บันทึกการแก้ไข" แทน "บันทึกรูป") | ลบ `openImageEditorFromDetail` (ตัวเรียกเดียวย้ายไปแล้ว) | `emSaveImage`/`emRenderImageDataUrl` ถูกใช้ใน `saveEditReceipt` | badge → v3.14.8
- **Check:** `node --check` EXIT=0 | DIV 557/557 diff=0 | FFFD=0 | ไม่เหลืออ้าง `emSave()`/`btnEmSave`/`openImageEditorFromDetail` (0 ทั้ง 3) | `emDirty` ไหลครบ (โหลด/ปิด=reset, หมุน/พลิก/ความสว่าง/ครอป=set) | badge v3.14.8
- **สถานะ:** ✅ เสร็จ — **REDEPLOY index.html อย่างเดียว** → Save → New version → badge ต้องเป็น v3.14.8 → ทดสอบ: (1) ดูบิลเต็ม → ไม่มีปุ่ม "แก้ไขรูปบิล" แล้ว (มี แก้ไขข้อมูลบิล + ปิดหน้าต่าง) (2) แก้ไขข้อมูลบิล → หมุน/พลิก/ครอป/ความสว่างรูป → กด "บันทึกการแก้ไข" ปุ่มเดียว บันทึกรูปและข้อมูลเสร็จในครั้งเดียว หน้าต่างปิด รูปใหม่โชว์ (3) ไม่แตะรูป แก้ข้อมูลอย่างเดียว → บันทึกข้อมูลเหมือนเดิม


## [2026-09-23] 🐛 Hotfix Code.gs: `ReferenceError: oldPo is not defined` เมื่อกด "บันทึกการแก้ไข"
- **สาเหตุ:** ใน `updateReceipt` (Code.gs) ใช้ `(oldPo || '-')` ใน `writeLog` (บรรทัดแก้ไขบิล) แต่ตัวแปร `oldPo` ไม่เคยถูกนิยาม — ตกหล่นจากการ refactor เก่า → พอ User กด "บันทึกการแก้ไข" (ทั้งแบบที่มี/ไม่มีรูป) ก็พังก่อนเขียนชีต (writeLog อยู่หลังเขียนค่าแล้ว แต่ error ทำให้ catch จับแล้ว report ว่า "บันทึกการแก้ไขไม่สำเร็จ")
- **ที่แก้ (Code.gs เฉพาะจุด):** เพิ่มจับค่าเดิมของ PO จากชีต ก่อนเขียนทับ (คู่กับ `oldTotal` เดิมที่จับค่ายอดเดิมอยู่แล้ว):
  ```js
  const colPoForLog = colIndex['PO No.'] !== undefined ? colIndex['PO No.'] : -1;
  const oldPo = colPoForLog !== -1 ? String(sheet.getRange(rowIndex, colPoForLog + 1).getValue() || '').trim() : '';
  ```
- **Cascading Sync Check:** `oldPo` ถูกใช้แค่จุดเดียวใน writeLog (L4784) → เลิก ReferenceError | ไม่กระทบค่า/ลำดับคอลัมน์ที่เขียน (อ่านอย่างเดียว ไม่แตะแถว)
- **Check:** อ่านซ้ำยืนยัน `oldPo` ถูกนิยามก่อน `writeLog` แล้ว | ไม่มีฟีเจอร์/โครงสร้างอื่นเปลี่ยน
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** (คราวนี้ backend เปลี่ยนด้วย) → Save → New version → ทดสอบ: แก้ไขข้อมูลบิล → (มีรูป) หมุน/พลิก/ครอป แล้วกด "บันทึกการแก้ไข" ต้องสำเร็จ ไม่ error อีก + ไปเช็ค tab Log ว่ามีรายการ "✏️ EDIT" แสดง PO เดิม → ใหม่


## [2026-09-23] 🔢 การันตี "เลขที่รายการระบบ" เป็นตัวตนหลักในการบันทึกแก้ไข (เพราะเลขที่เอกสาร AI อ่านผิดได้)
- **ที่มา:** User แจ้งว่าเวลาส่งข้อมูลที่แก้ไขกลับไปบันทึก ให้ "เช็คเลขที่รายการระบบ" — เลขที่เอกสาร (Doc Key) ที่ AI อ่านบางครั้งผิด จึงไม่ควรเป็นตัวชี้ขาดว่าบิลคือแถวไหน
- **ระบบเดิม:** `findReceiptRowByAny` จับ System Record No. ก่อนแล้วจริง แต่ถ้าบิลนั้นยังไม่มีเลขที่รายการระบบ (SRN ว่าง) จะถอยไปใช้ Doc Key/Timestamp+PO → มีโอกาสโดนบิลอื่น/เพี้ยนตอน AI อ่านเลขที่เอกสารผิด
- **ที่แก้ (Code.gs: updateReceipt — เฉพาะจุด):** ก่อนเขียนค่าลงชีต ตรวจ/การันตี SRN:
  1. **หน้าเว็บส่ง SRN มา** → เทียบกับ SRN จริงบนแถวที่หาเจอ: ถ้าไม่ตรงกัน → log ⚠️ SRN (ชีต=#x หน้าเว็บ=#y) แล้ว **ยึดค่าจากชีต** เขียนกลับกันค่าหลุด
  2. **ไม่มี SRN (ทั้งหน้าเว็บและชีต)** → กดเบอร์ใหม่ผ่าน `ensureSystemRecordNoForReceipt(doc_key)` แล้วเขียนลงแถวนั้นทันที + log 🔢 SRN — ตั้งแต่บิลนี้เป็นต้นไป การแก้ครั้งถัดไปจะชี้ด้วยเลขที่รายการระบบเพียงอย่างเดียว ไม่พึ่งเลขที่เอกสารที่ AI อ่านผิด
- **Cascading Sync Check:** `ensureSystemRecordNoForReceipt` มีอยู่แล้ว (L80, ใช้ใน saveToSupabase) เรียกซ้ำได้ | `targetDocKey`/`rowIndex` ถูกนิยามก่อนบล็อกนี้ | SRN mismatch ยึดค่าแท้จากชีต (ข้อมูลจริง) ไม่มี Guessing | doc_key ใหม่ซ้ำบิลอื่น ยังโดนบล็อกก่อนหน้าเหมือนเดิม | ไม่แตะ index.html
- **Check:** node --check Code.gs EXIT=0 | braces 1649/1649 diff=0 | FFFD=0
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs (อย่างน้อย) + index.html** → Save → New version → ทดสอบ: แก้ไขบิลที่เคยไม่มีเลขที่รายการระบบ (ดูจากช่อง "เลขที่รายการระบบ: -") → บันทึก → tab Log ต้องมี "🔢 SRN กำหนด #..." แล้วเปิดแก้ใหม่ช่องเลขที่รายการระบบขึ้นหมายเลขประจำบิล | แก้บิลทั่วไป → ไม่กระทบ บันทึกปกติ


## [2026-09-23] 🖼️ แก้ไขรูปบิล → "เขียนทับภาพเดิม" ไฟล์ Drive เดิม (URL เดิม ไม่สร้างไฟล์ใหม่)
- **ที่มา:** User ระบุ: "ภาพ ถ้ามีการแก้ไขมันต้อง ส่งกลับไปอัพเดท ที่ URL ทับภาพเดิม" — ไม่อยากให้สร้างไฟล์ใหม่ใน Drive / เปลี่ยน URL ของบิล
- **ระบบเดิม:** `saveEditedReceiptImage` สร้างไฟล์ใหม่ (file ID ใหม่) แล้วย้ายไฟล์เก่าไปถังขยะ + อัปเดต Image URL ในชีต/Supabase เป็นไฟล์ใหม่ — เพื่อเลี่ยงแคช /thumbnail ฝั่ง Google Drive ที่ key ด้วย file ID เดิม
- **ที่แก้ (Code.gs: saveEditedReceiptImage — เฉพาะจุด):** ลบ logic สร้างไฟล์ใหม่/trash ทิ้ง → ใช้ `origFile.setBlob(blob)` **เขียนทับเนื้อหาในไฟล์ Drive เดิม (file ID เดิม = URL เดิม)** แล้ว `setSharing` เหมือนเดิม → `newImageUrl` ยังเป็น **fileId เดิม** แค่เพิ่ม `v=<Date.now()>` กันแคชเบราว์เซอร์ → `updateReceiptImageUrl` อัปเดตให้ → log 🖼️ IMAGE EDIT (เขียนทับภาพเดิมในไฟล์...)
- **หมายเหตุ cache:** Google Drive thumbnail อาจเสิร์ฟภาพเก่าค้างชั่วครู่หลังเขียนทับ (แคชฝั่งเซิร์ฟเวอร์) — ถ้าเห็นภาพเก่าให้รีเฟรช (F5) ดูครั้งถัดไปจะได้ภาพใหม่ ตามนโยบาย "ทับภาพเดิม" ของ User
- **Cascading Sync Check:** `updateReceiptImageUrl` ใช้ `extractDriveFileId(payload.image_url)` เทียบ file ID → fileId เดิม จึงเจอแถวได้เหมือนเดิม | frontend `emSaveImage`/`emApplySavedImage` ใช้ URL ใหม่ (fileId เดิม + v ใหม่) → ภาพในหน้าเว็บซิงก์ทันที ไม่ต้องแตะ index.html | โฟลเดอร์ปี/เดือนของไฟล์คงอยู่ที่เดิม (ดีกว่าเดิม: ไม่ถูกย้าย)
- **Check:** node --check Code.gs EXIT=0 | ภายในฟังก์ชัน: newFile=0 targetFolder=0 setTrashed=0 setBlob=1
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → Save → New version → ทดสอบ: แก้ไขข้อมูลบิล → หมุน/พลิก/ครอปรูป → "บันทึกการแก้ไข" → เปิดดูไฟล์ใน Drive (ไฟล์เดียวกัน ไม่มีไฟล์ใหม่/ขยะเพิ่ม) + รูปในหน้าเว็บเป็นภาพที่แก้แล้ว | tab Log มีรายการ "🖼️ IMAGE EDIT: เขียนทับภาพเดิมในไฟล์..."


## [2026-09-23] 🛠️ Hotfix: origFile.setBlob is not a function → ใช้ Drive API v3 แทนเนื้อหาไฟล์เดิม + fallback
- **ที่มา:** หลัง deploy คำสั่งเขียนทับภาพเดิม User ทดสอบแล้วเจอ runtime error `TypeError: origFile.setBlob is not a function` — `DriveApp.File` ไม่มี method `setBlob` (มีแค่ setContent ใช้ได้กับข้อความเท่านั้น)
- **ที่แก้ (Code.gs: saveEditedReceiptImage):**
  1. **โหมดเขียนทับ (หลัก):** `Drive.Files.update({}, fileId, blob)` ผ่าน Advanced Google Service: Drive API — แทนเนื้อหาไฟล์ในตำแหน่งเดิม ไฟล์ ID เดิม → URL เดิม → `setSharing` เหมือนเดิม → log "เขียนทับภาพเดิมในไฟล์..."
  2. **Fallback:** ถ้า `typeof Drive === 'undefined'` (ยังไม่เปิด Advanced Service) → สร้างไฟล์ใหม่ + trash ไฟล์เก่า (พฤติกรรมเดิม) + log แจ้ง "ปิดโหมดเขียนทับ (ยังไม่ได้เปิด Advanced Service Drive API)" — การบันทึกรูปจะไม่พัง
  3. โหมดไหนก็ได้ → `newImageUrl` จาก `newImageFileId` + `v=<ts>` → `updateReceiptImageUrl`
- **Cascading Sync Check:** ตรวจแล้วไม่มี `.setBlob(` คงเหลือในโค้ดจริง (จับแต่ในคอมเมนต์) | fallback ใช้ `getOrCreateDriveFolder`/`setTrashed` เดิม | frontend ไม่แตะ (emSaveImage รับ `new_image_url` เหมือนเดิม)
- **Check:** node --check Code.gs EXIT=0 | setTrashed=1 (เฉพาะ fallback) | Drive.Files refs=4 (ในฟังก์ชัน)
- **สถานะ:** ✅ เสร็จ — ⚠️ User ต้องทำ 2 อย่าง: **(1) เปิด Advanced Google Service "Drive API" ในตัวแก้ไขสคริปต์ (Services + → Drive API → บันทึก)** (2) **REDEPLOY Code.gs** → Save → New version → ทดสอบบันทึกรูปแก้ไข: อย่างน้อยต้องบันทึกสำเร็จโดยไม่มี error ถ้าเปิด Drive API แล้ว → Log ต้องเป็น "🖼️ IMAGE EDIT: เขียนทับภาพเดิมในไฟล์..." (โหมดทับจริง) และไฟล์เดิมใน Drive มีเนื้อหาใหม่


## [2026-09-23] ⚡ v3.14.9 — หลัง "บันทึกการแก้ไข" รีเฟรชเฉพาะรายการนั้น (ไม่โหลดตารางทั้งก้อน) เพื่อความลื่นไหล
- **ที่มา:** User ต้องการให้หลังบันทึกแก้ไข ระบบรีเฟรชข้อมูลรายการนั้นใหม่ทันที ไม่รีเฟรชตารางทั้งหมด (refreshData) เพื่อให้ UX ลื่นไหลที่สุด
- **ที่แก้ (index.html + Code.gs):**
  1. **Backend:** 
     - สร้าง helper `mapSheetRowToReceiptObject` ใช้ร่วม `getReceiptData` + `getSingleReceipt` → ไม่เพี้ยนกัน
     - เพิ่ม `getSingleReceipt(payload)`: รับ `system_record_no` + `doc_key` → คืน `[obj]` รายการเดียวจากชีต (reuse helper)
     - `updateReceipt` return เพิ่ม `system_record_no` (SRN ตัวจริงที่เขียน) + `doc_key` (Doc Key จริง) ให้ frontend ใช้ระบุรายการ
  2. **Frontend:** 
     - แทนที่ `refreshData()` ใน `saveEditReceipt` ด้วย `refreshSingleReceipt(res, oldItemId, oldDocKey)`
     - `refreshSingleReceipt`: 
       - **Supabase mode** → query เดียว `system_record_no.eq.X` (or `doc_key.eq.Y`) → `normalizeData([row])[0]` → `patchAllDataWith` แทนใน `allData` ทันที
       - **GAS mode** → `scriptCall('getSingleReceipt', ...)` → `normalizeData` → `patchAllDataWith`
       - ถ้าดึงไม่ได้ / match ไม่เจอ → fallback `refreshData()` ให้แน่ใจว่าถูกต้อง
     - `patchAllDataWith(normItem, oldId)`: หา index เดิมด้วย `oldId` (หรือ `doc_key`/`system_record_no`) → splice replace ใน `allData` แทนที่รายการเก่า → รักษาตำแหน่ง/การเรียง → `lastDataSignature` อัปเดต → `applyFilters()` รีเรนเดอร์แถว + สถิติ
- **Cascading Sync Check:** `normalizeData` รองรับทั้ง Supabase (snake_case) และ GAS (lower_underscore) อยู่แล้ว | `lastDataSignature` เราคำนวณเองหลัง patch → auto-refresh จะไม่ toast ซ้ำ | `closeEditModal()` ยังทำงานก่อน → `editTarget` นิ่งไว้ก่อนคืนค่า | ไม่ส่งผลต่อ Realtime / polling
- **Check:** index.html node --check EXIT=0 | Code.gs node --check EXIT=0 | FFFD=0 | DIV 557/557 diff=0 | badge v3.14.9 = 3 ครั้ง
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** → Save → New version → ทดสอบ: แก้ไขบิล (แก้ข้อมูล/แก้รูป/ทั้งคู่) → กด "บันทึกการแก้ไข" → แถวบิลอัปเดตทันทีไม่กระพริบ/โหลดตารางใหม่ | Tab Log มี ✏️ EDIT + สถิติอัปเดต | เปิดบิลเดียวกันซ้ำ ยังเห็นค่าที่แก้ | badge ในมุม v3.14.9


## [2026-09-23] 🎯 CLASSIFICATION-FIRST AI Analysis — ระบุประเภทเอกสารจากภาพก่อน (ป้องกันอ่านมั่ว)
- **ที่มา:** User ต้องการให้ AI **อ่านประเภทเอกสารจากภาพจริงก่อน** แทนที่จะเดาว่าบิลที่ได้รับมาคือบิลอะไร — เพื่อป้องกันการอ่านข้อมูลมั่ว ถ้าไม่มีชื่อประเภทบิลจริงถึงดูตามแม่แบบ
- **ฟิลด์บังคับ 3 ฟิลด์ (ต้องมีค่าเสมอ):**
  1. **ประเภทเอกสาร** (doc_type)
  2. **วันที่ในบิล** (date) — รูปแบบ YYYY-MM-DD
  3. **เลขที่เอกสาร** (doc_no) — ถ้าไม่มี ให้ '-'
- **ที่แก้ (Code.gs):**
  1. **`classifyDocumentType(imageBlob)`** — ฟังก์ชันใหม่: ส่งภาพให้ Gemini วิเคราะห์เฉพาะ "ประเภทเอกสาร" (โปรมป์เฉพาะเจาะจง 9 ประเภท + UNKNOWN) คืน `doc_type` (ไทย) + `confidence` + `universal_type` (อังกฤษ)
  2. **`ensureRequiredFields(result, fallbackDocType)`** — รับประกัน 3 ฟิลด์บังคับ: ถ้าไม่มี/ผิด → ใส่ค่าเริ่มต้น (doc_type จาก classification, date = today, doc_no = '-')
  3. **`analyzeReceiptSmart`** — เปลี่ยนเป็น **CLASSIFICATION-FIRST**: 
     - เรียก `classifyDocumentType` ก่อน → ได้ประเภทจริงจากภาพ
     - ดึง prompt เฉพาะประเภทนั้นผ่าน `resolvePromptInjection`
     - วิเคราะห์เต็มรูปแบบครั้งเดียวด้วย prompt ที่ตรงประเภท
     - ผลลัพธ์ผ่าน `ensureRequiredFields` ก่อนคืนค่า
- **Cascading Sync Check:** `resolvePromptInjection` ใช้เดิม (ดึง prompt/few-shot จาก ai_prompts + ai_templates) | `analyzeReceiptWithGemini` ใช้เดิม (เรียก Gemini) | ไม่แตะ index.html / frontend flow | โควตา Gemini: เรียก 2 ครั้ง (classify + extract) แทนเดิม 1-2 รอบ — ยอมรับได้เพราะความแม่นยำสูงขึ้น
- **Check:** Code.gs node --check EXIT=0 | index.html node --check EXIT=0 | FFFFD=0 | DIV 557/557
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → Save → New version → ทดสอบ: ส่งภาพบิลประเภทต่างๆ (ใบกำกับภาษี/ใบส่งของ/ใบชั่ง/PO/ใบเสนอราคา) → ต้องได้ doc_type ถูกต้อง + date/doc_no ครบถ้วน + Log มี `🔍 CLASSIFY: ประเภทที่ตรวจพบ: ...`


## [2026-09-23] 🎯 CLASSIFICATION-FIRST v2 — ยึด "ชื่อประเภทพิมพ์บนใบจริง" เป็นลำดับแรกเสมอ + ลบการเดาวันที่ (ตาม User ระบุซ้ำ)
- **ที่มา:** User ย้ำ: ต้องให้ AI **อ่านประเภทเอกสารจากภาพจริงก่อน** มากกว่าเดาว่าบิลที่ได้รับคือบิลอะไร (ป้องกันอ่านมั่ว) → ดูแม่แบบว่าประเภทนี้ต้องอ่านอะไรบ้าง → **ถ้าไม่มีชื่อประเภทบนใบจริง ถึงจะดูตามแม่แบบ** พร้อมยืนยัน 3 ฟิลด์บังคับ: ประเภทเอกสาร*/วันที่ในบิล*/เลขที่เอกสาร*
- **ที่แก้ (Code.gs — 4 จุด):**
  1. **`classifyDocumentType`** — อัปเกรดโปรมป์จำแนก: เพิ่มลำดับการตัดสิน 3 ขั้น (อ่านชื่อบนหัวใบจริงก่อน → ไม่มีค่อยใช้ลักษณะเอกสาร → ไม่แน่ใจ = UNKNOWN ห้ามเดา) + คืน `real_name` (ชื่อที่พิมพ์บนใบเป๊ะ ๆ) + `title_seen` (เห็นชื่อประเภทบนใบไหม) + ครอบคลุมรหัสครบ 17 มาตรฐาน (เพิ่ม INVOICE_BILLING/WHT_CERT/RECEIPT_TAX_INVOICE/DELIVERY_TAX_INVOICE/WORK_ACCEPTANCE/PURCHASE_REQUISITION/PAYMENT_VOUCHER/RECEIVE_VOUCHER/PETTY_CASH — เดิมแค่ 9) + ฉีดรายการประเภทเอกสารเฉพาะขององค์กร (getCustomDocTypes) ลงโปรมป์ด้วย | ผลลัพธ์: ถ้า title_seen และมี real_name → ใช้ชื่อบนใบจริงทันที (normalizeDocType เทียบเป๊ะ/คำพ้องได้ทั้งมาตรฐาน+องค์กร), ถ้าไม่มีชื่อบนใบ → ใช้ชื่อจากแม่แบบความรู้มาตรฐานบัญชี (mapped) | generationConfig เพิ่ม temperature 0.1 + maxOutputTokens 512 (เร็ว/นิ่ง)
  2. **`ensureRequiredFields`** — รื้อใหม่: (1) ประเภทเอกสาร = ใบจริงมาก่อนเสมอ (AI extract อ่านได้ชัด → doc_type_source='document' | AI กำกวม (ไม่ทราบ/อื่นๆ) → ยึดประเภทจากขั้นจำแนกภาพ → doc_type_source='image_classification' + doc_type_fallback_used=true | ไม่มีเลย → 'อื่นๆ') (2) **ลบการเติมวันที่ = "วันนี้" ทิ้ง** (เดิมเป็นการเดามั่วตามที่ User แจ้ง) — อ่านไม่ได้ให้ '-' + date_missing=true แล้วให้ validateReceiptData ตีกลับให้ถ่ายใหม่ (3) เลขที่เอกสารไม่มีจริง = '-' ตามเดิม
  3. **`analyzeReceiptSmart`** — ฉีดผลจำแนกเข้าขั้น extract: บอก AI ล่วงหน้าว่า "ขั้นแรกเห็นประเภท X จากใบ (มี/ไม่มีชื่อบนใบ)" พร้อมกฎ ให้ใช้ชื่อที่พิมพ์บนใบจริงเป๊ะ ๆ / ห้ามเปลี่ยนประเภทให้เข้ากับแม่แบบ / ห้ามอ่านฟิลด์ที่ประเภทนี้ไม่ควรมี + **ตรวจความขัดแย้งประเภท 2 ขั้น** (extract vs classify ผ่าน normalizeDocType) → ต่างกันจริง = doc_type_conflict=true + Log ⚠️ DOC-TYPE CONFLICT (ใช้ค่าจากใบจริงต่อไป — ไม่เดาฝ่ายใด)
  4. **`validateReceiptData` ข้อ 7.7 ใหม่** — บิลที่ประเภทขัดแย้งระหว่างขั้นจำแนกกับขั้นอ่าน = ติดธง needs_review ให้คนยืนยัน/แก้ประเภท (กันประเภทผิดถูกบันทึกเงียบ ๆ — เข้า Learning Loop เมื่อคนแก้)
- **Cascading Sync Check:** `resolvePromptInjection(detectedType)` ยังใช้ประเภทที่จำแนกได้เลือกแม่แบบเหมือนเดิม (ชื่อบนใบจริงเทียบ ai_prompts ตรงกว่าเดิม) | `normalizeDocType`/`getCustomDocTypes` ใช้เดิม (ตรงเป๊ะ+คำพ้อง ครอบองค์กรอยู่แล้ว) | เส้น fallback `adaptUniversalOcrResult` ไหลเข้า `ensureRequiredFields` เหมือนเดิม | `reanalyzeReceipt`/`processReceiptSubmission` เรียกผ่าน `analyzeReceiptSmart` ได้ประโยชน์อัตโนมัติ | ไม่แตะ index.html / SQL
- **Check:** Code.gs node --check EXIT=0 (ผ่าน temp .js) | FFFD=0
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → Save → New version → ทดสอบ: (1) ส่งใบที่หัวใบพิมพ์ชื่อประเภทชัด (เช่น ใบส่งของ) → Log `🔍 CLASSIFY` ต้องโชว์ประเภทตรงใบ + บันทึก doc_type ตรง (2) ส่งใบที่ไม่มีชื่อประเภท (เช่น สลิปค้างโรงพยาบาล/ใบนัด) → ต้องจำแนกจากลักษณะหรือติดรีวิว ไม่อ่านมั่ว (3) วันที่อ่านไม่ได้ → ต้องถูกตีกลับให้ถ่ายใหม่ ห้ามเป็นวันที่วันนี้ (4) บิลที่ extract/classify ต่างกัน → ติดธงตรวจสอบ (5) Log มี ⚠️ DOC-TYPE CONFLICT เมื่อขัดแย้ง


## [2026-09-23] 🐛 Hotfix จาก Log จริง 14:30-15:17 — Supabase ปฏิเสธ date "-" (HTTP 400: 22007) + seed prompt ชุดมาตรฐานพัง JSON.parse ว่าง
- **ที่มา (จาก tab Log จริง):**
  1. `⚠️ RESYNC Resync ไม่สำเร็จ: Supabase HTTP 400: {"code":"22007","message":"invalid input syntax for type date: \"-\""}` — เซลล์วันที่ในชีตที่เป็น "-"/ค่ามั่ว ถูกส่งตรงไปคอลัมน์ date ชนิด date ของ Postgres
  2. `❌ AI_TEMPLATE ensureStandardPromptSets error: SyntaxError: Unexpected end of JSON input` — response ว่าง/ตัดครึ่ง (timeout/edge) ถูก JSON.parse ทันทีทั้งใน ensureStandardPromptSet (GET หาของเดิม + POST สร้าง) และ getAIPrompts (view v_ai_prompts_ui) → throw หลุด forEach ทั้ง 17 หมวด
- **ที่แก้ (Code.gs):**
  1. **helper ใหม่ `normalizeSupabaseDateValue(v)`** — วันที่ไม่รู้รูปแบบ/'-'/ว่าง → null, Date → yyyy-MM-dd, ISO → ตัด 10 หลัก, dd/mm/yyyy|dd.mm.yy → แปลง, ข้อความอื่น → new Date() ลองแปลง ไม่ได้ = null
  2. **helper ใหม่ `normalizeSupabasePayloadDates(body)`** — ไล่ normalize คอลัมน์วันที่ทุกชั้น (date/billing_date → normalizeSupabaseDateValue, submitted_at → '-'/'' เป็น null) รองรับทั้ง object เดี่ยวและ array batch
  3. **`supabaseRequest`** — ยิง payload ผ่าน normalizeSupabasePayloadDates เสมอ = จุดกลางจุดเดียว ปิดทุกเส้นทาง (RESYNC batch/upsert/patch/delete อนาคต)
  4. **`saveToSupabase`** — date: ใช้ normalizeSupabaseDateValue (เดิม receiptData.date || null ยังส่ง '-' ได้)
  5. **`updateSupabaseReceipt`** — patch.date normalize ก่อนส่ง (เส้นบันทึกแก้ไขจากหน้าเว็บ/อ่านไม่ได้)
  6. **`resyncReceiptsBetweenStores`** — แทน IIFE แปลงวันที่ (เดิมคืน s || null ทำ "-" หลุดไป) ด้วย normalizeSupabaseDateValue
  7. **`ensureStandardPromptSet`** — GET หาของเดิม: try/catch JSON.parse (ว่าง = ถือว่าไม่พบข้ามไปสร้าง) | POST สร้าง: parse กันว่าง (ถ้า 2xx แต่ตอบไม่ใช่ JSON → throw ข้อความชัด ไม่ SyntaxError มั่ว)
  8. **`ensureStandardPromptSets`** — ครอบ try/catch รายหมวดใน forEach: หมวดไหนพัง log ⚠️ ข้ามหมวดนั้น ไม่ลากทั้ง 17 หมวดตาย (ต้นตอ log ❌ รอบก่อน)
  9. **`getAIPrompts`** — parse view v_ai_prompts_ui กันว่าง/ตัดครึ่ง (พัง = ใช้ชุดมาตรฐานสำรองในตัวตามดีไซน์เดิม)
- **Cascading Sync Check:** สายที่ใช้ raw UrlFetchApp ไม่ผ่าน supabaseRequest (เช่น ai_prompts/ai_templates/weight_variances) ไม่มีคอลัมน์ date ชนิด Postgres date จึงไม่เปลี่ยนพฤติกรรม | เส้นหน้าเว็บ (index.html) ส่ง date มาผ่าน updateReceipt → updateSupabaseReceipt ถูก normalize แล้ว | toIsoDate ของ migrateSheetsToSupabase เข้มอยู่แล้ว (ค่ามั่ว → null เอง)
- **Check:** node --check EXIT=0 (ผ่าน temp .js) | FFFD=0
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → Save → New version → ทดสอบ: (1) เมนูชีต Resync รายร้าน → ต้องไม่พัง HTTP 400 date อีก (2) เปิดหน้า AI Documents (เรียก getAIPrompts → seed) → Log ห้ามมี SyntaxError: Unexpected end of JSON input (ถ้าหมวดไหนพังจริงจะเห็น ⚠️ ข้ามรายหมวด ไม่ตายทั้งก้อน) (3) แก้ไขบิลที่วันที่ว่าง/"-" จากหน้าเว็บ → บันทึกสำเร็จไม่ติด 400


## [2026-09-23] 🖼️ แก้ไขรูป = เขียนทับไฟล์เดิมได้เองโดยไม่ต้องเปิด Advanced Service + fallback ลบไฟล์เดิมถาวรทันที (ตาม User: ห้ามมีไฟล์ขยะ)
- **ที่มา:** User ระบุ — การแก้ไขภาพไม่ควรสร้างไฟล์ใหม่เพราะทำให้มีข้อมูลขยะในฐานข้อมูล/Drive ถ้าจำเป็นต้องสร้างใหม่ต้องลบไฟล์เดิมทันทีและส่งลิงก์ใหม่มาแทน | Log 15:17 พิสูจน์แล้วว่า fallback เดิม "สร้างไฟล์ใหม่" เกิดขึ้นจริง (เพราะ Advanced Service Drive API ยังไม่ได้เปิด) และเดิมแค่ setTrashed (ทิ้งถังขยะ ยังเป็นขยะค้าง)
- **ที่แก้ (Code.gs):**
  1. **helper ใหม่ `driveRestOverwriteFile_(fileId, blob)`** — เขียนทับเนื้อหาไฟล์เดิมผ่าน Drive REST API v3 (`PATCH /upload/drive/v3/files/<id>?uploadType=media`) ด้วย `ScriptApp.getOAuthToken()` ของสคริปต์เอง — **ใช้ได้ทันทีโดยไม่ต้องเปิด Advanced Service** ไฟล์ ID/URL เดิมคงเดิม ไม่มีขยะ
  2. **helper ใหม่ `driveRestDeleteFilePermanent_(fileId)`** — ลบไฟล์ถาวรข้ามถังขยะ (`DELETE /drive/v3/files/<id>`) → ถ้าสิทธิ์ไม่พอค่อย setTrashed เป็นรอบสอง | คืนสถานะ deleted/trashed/failed ลง log เสมอ
  3. **`saveEditedReceiptImage`** — ลำดับใหม่ 3 ชั้น: (1) Advanced Service `Drive.Files.update` ถ้าเปิดไว้ (2) **`driveRestOverwriteFile_` = โหมดหลักที่ใช้ได้เลย** (3) สุดท้ายจริง ๆ เขียนทับไม่ได้ → สร้างไฟล์ใหม่ (ชื่อ/โฟลเดอร์เดิม) + **ลบไฟล์เดิมถาวรทันที** + ส่งลิงก์ใหม่ (`new_image_url` fileId ใหม่ + v=timestamp กันแคช) ตามที่ User สั่ง
- **Cascading Sync Check:** `updateReceiptImageUrl` ใช้เดิม (รับ URL ใหม่เขียนชีต+Supabase รวม `google_drive_file_id` ตาม fileId จริง) | frontend (`emSaveImage`/`emApplySavedImage`) รับ `new_image_url` เหมือนเดิม ไม่ต้องแก้ | สิทธิ์แชร์ ANYONE_WITH_LINK ตั้งซ้ำทุกโหมดเหมือนเดิม | ไม่แตะ SQL/index.html
- **Check:** node --check EXIT=0 (ผ่าน temp .js) | FFFD=0
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → ทดสอบแก้ไขรูปบิล 1 ครั้ง: Log ต้องเป็น "เขียนทับภาพเดิมในไฟล์ ... (Drive REST API — ไม่สร้างไฟล์ใหม่)" และใน Drive ต้องไม่มีไฟล์เพิ่ม (ถ้าเจอกรณี fallback จริง log ต้องโชว์ "ลบไฟล์เดิม: deleted (ถาวร)")


## [2026-09-23] 🐛 Hotfix: บันทึกการแก้ไขสำเร็จแต่ตารางหน้าเว็บไม่เปลี่ยนตาม (log จริง 15:48–15:49 — แก้รูปเขียนทับสำเร็จแล้ว)
- **ที่มา:** User รายงาน "การแก้ไขทำงานได้ดี แต่ข้อมูลในตารางไม่เปลี่ยนตาม" — log แสดง 🖼️ เขียนทับสำเร็จ + ✏️ EDIT สำเร็จ แต่ตารางยังโชว์ค่าเก่า
- **สาเหตุ 3 ชั้น:**
  1. `handleApiRequest` **ไม่มี `case 'getSingleReceipt'`** — ฟังก์ชันถูกสร้างใน Phase 2.10g แต่ลืมเปิดช่อง dispatch → `scriptCall('getSingleReceipt')` โดนตอบ "ไม่รู้จักฟังก์ชัน" → `refreshSingleReceipt` ตกไป fallback `refreshData()` เสมอ
  2. `refreshData` อ่าน **Supabase-first** — แต่ `updateSupabaseReceipt` patch ด้วย SRN แล้วไม่เช็คว่าโดนกี่แถว: PostgREST PATCH ปกติตอบ 204 ว่าง (นับไม่ได้) และถ้าแถวใน Supabase ยังไม่มี `system_record_no` (บิลเก่า/ไม่เคย sync SRN) = patch โดน **0 แถวแบบเงียบ ๆ** → Supabase ยังเก็บค่าเก่า → fallback โหลดค่าเก่ากลับมาโชว์ในตาราง
  3. (รูปไม่กระทบ เพราะ `emApplySavedImage` เขียนหน้าจอตรง + `updateReceiptImageUrl` patch ด้วย doc_key)
- **ที่แก้ (Code.gs):**
  1. `handleApiRequest` — เพิ่ม `case 'getSingleReceipt': return getSingleReceipt(safePayload || {})` → รีเฟรชรายการเดียวทำงานตามดีไซน์ v3.14.9 จริง ไม่ต้อง fallback
  2. `updateSupabaseReceipt` — patch ด้วย `Prefer: return=representation` (นับแถวที่โดนได้) + **ถ้า patch ด้วย SRN โดน 0 แถว → retry ด้วย doc_key** (เขียน SRN self-heal ลงแถวด้วย) + ยัง 0 แถว → log ⚠️ ชัดเจน + return `{ ok, matched }`
  3. `updateReceipt` — ข้อความบันทึกแสดงสถานะ sync จริง: matched=0 = "⚠️ Sync Supabase: patch ไม่โดนแถว (ตรวจ doc_key ใน Supabase)" ไม่ปล่อยเงียบอีก
- **Cascading Sync Check:** frontend ไม่แตะ (`refreshSingleReceipt` ใช้เส้นเดิม ตอนนี้ dispatch เปิดแล้ว) | `Prefer: return=representation` ใช้เฉพาะเส้น updateSupabaseReceipt เส้นอื่นคงเดิม | normalize date จากรอบก่อนคงอยู่ | หน้าเว็บที่เปิดค้างตอน patch เดิมพลาด = ค่าใน Supabase ยังเก่า → หลัง deploy นี้ให้แก้ซ้ำอีกครั้ง ค่าจะ sync และ self-heal SRN ให้เอง
- **Check:** node --check EXIT=0 (ผ่าน temp .js) | FFFD=0
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** → ทดสอบ: แก้ไขบิล (แก้ยอด/ข้อมูล) → ตารางต้องเปลี่ยนตามทันทีไม่ต้อง F5 + tab Log ห้ามมี "patch ไม่โดนแถว" (ถ้ามี = แถวนั้นไม่มี doc_key ตรงใน Supabase — ส่ง log มาดูต่อ)


## [2026-09-23] 🖼️ Hotfix: แก้รูปสำเร็จแต่ "รูปในตาราง/ดูบิลเต็ม" ยังเป็นรูปเก่า (แผงแก้ไขเห็นรูปใหม่เท่านั้น)
- **ที่มา:** User รายงาน — รูปบิลในตารางและดูบิลเต็มแสดงรูปเก่า แต่เปิด "แก้ไขข้อมูลบิล" แล้วเห็นภาพใหม่ที่แก้แล้ว
- **สาเหตุ (อาการตรงตามโครง):**
  1. แผงแก้ไขโหลดรูป **สดจากไฟล์ Drive** (`getReceiptImageData` → `DriveApp.getBlob`) จึงเห็นภาพใหม่เสมอ | ส่วนตาราง/ดูบิลเต็มใช้ `<img>` จาก **URL ในฐานข้อมูล** (`drive.google.com/thumbnail?id=...`)
  2. `updateReceiptImageUrl` เดิม **return false เงียบ ๆ ทันที** ถ้าหาแถวชีตไม่เจอ (เช่น เซลล์ Image URL เป็น HYPERLINK ที่ getValue ไม่ให้ URL) — และการ return false นั้น**ข้ามการซิงก์ Supabase ด้วย** → DB ยังเก็บ URL เก่า (ไม่มี v= ใหม่) → ตารางโชว์รูปเก่าตลอด
  3. `refreshSingleReceipt` ดึงแถวจาก DB กลับมา patch ตาราง แล้ว**ทับ URL สดที่ `emApplySavedImage` เพิ่ง bust ไว้** ด้วย URL เก่าจาก DB
- **ที่แก้:**
  1. **Code.gs: `updateReceiptImageUrl` รื้อโครงการซิงก์** — หาแถวชีตไม่เจอ = log ⚠️ แล้ว**ข้ามเฉพาะเขียนชีต** ยังซิงก์ Supabase ต่อเสมอ | ตัวระบุ Supabase 3 ชั้น: doc_key จาก payload (frontend ส่งมาใหม่) → doc_key จากแถวชีต → `google_drive_file_id=eq.<fileId>` (ตัวสำรองเมื่อไม่มี doc_key เลย) | ใช้ `Prefer: return=representation` + log จำนวนแถวที่โดนจริง | return แยกสถานะชีตจาก Supabase
  2. **index.html: `emSaveImage`** — ส่ง `doc_key` + `system_record_no` ไปกับ payload (เดิมไม่ส่ง → backend ไม่มีตัวระบุแถว Supabase ตอน sync URL)
  3. **index.html: `refreshSingleReceipt`** — รับ `savedNewImageUrl` (พารามิเตอร์ใหม่จาก saveEditReceipt) แล้วเทียบ file ID: ถ้าแถวจาก DB ยังเป็น URL เก่าของไฟล์เดียวกัน → ใช้ URL ที่มี v= ใหม่กว่าเสมอ (กัน DB เขียนช้ากว่าหน้าจอทับรูปสด)
- **Cascading Sync Check:** `saveEditedReceiptImage` รับ payload เพิ่มฟิลด์ = ไม่กระทบ (อ่านเฉพาะที่ต้องใช้) | `updateReceiptImageUrl` caller เดียว = saveEditedReceiptImage | `openDetailItem`/ตาราง/การ์ดใช้ `image_url`/`image_original_url` ตาม normalizeData เดิม — URL ใหม่จาก DB (มี v=) ผ่าน `toDirectImageUrl` คง v= ไว้อยู่แล้ว | Drive thumbnail แคชฝั่ง Google อาจค้างชั่วครู่ (F5 ได้) แต่ v= ใหม่จะบังคับเบราว์เซอร์โหลดใหม่
- **Check:** Code.gs node --check EXIT=0 | index.html inline script node --check EXIT=0 | FFFD=0 ทั้งคู่
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** → ทดสอบ: แก้รูปบิล 1 ใบ (หมุน/ปรับแสง/ครอป) → กดบันทึก → (1) ตาราง/ดูบิลเต็มต้องโชว์ภาพใหม่ทันที (2) Log ต้องมี "อัปเดต URL รูปในชีต..." หรือ "หาแถวในชีตไม่เจอ...ข้ามเขียนชีต" + "ซิงก์ Supabase ... โดยน 1 แถว" (3) ปิดหน้าเว็บเปิดใหม่ (โหลดจาก DB จริง) รูปต้องยังเป็นภาพใหม่ — ถ้ายังเก่าให้ดู log "โดยน 0 แถว" แล้วส่งมา


## [2026-09-23] 💡 v3.15.0 — ตัวเลือกช่องกรอกจากประวัติจริง (autocomplete) ลดภาระการคีย์ + รวมมาตรฐานการสะกดชื่อสินค้า
- **ที่มา:** User ต้องการให้ช่อง "แก้ไขรายการสินค้า/วัสดุ" (และทุกส่วน) แสดง "รายการที่เคยพิมพ์/แก้ไปแล้ว" มาให้เลือก เพื่อกันข้อมูลสินค้าซ้ำซ้อน (สินค้าเดียวกันเขียนต่างกัน/เว้นวรรคไม่เหมือนกัน) — ยืนยัน: datalist ใช้จากในฐานข้อมูลได้ และเป้าหมายใหญ่ = ระบบช่วยลดภาระการคีย์บิลให้งานเอกสารจัดซื้อเร็วขึ้น
- **ที่แก้:**
  1. **Code.gs: ฟังก์ชันใหม่ `getEditFieldSuggestions()`** — อ่าน receipts ล่าสุด 2,000 แถวจาก Supabase → รวมค่าที่เคยบันทึกของ 8 ฟิลด์ (ชื่อสินค้า/หน่วย/ชื่อร้าน/ทะเบียนรถ/ชื่อบริษัท/งาน/ผู้เบิก/ผู้สั่งจ่าย) → **นับความถี่แบบตัด case/ช่องว่างซ้ำ** ("คอนกรีตผสมเสร็จ" กับ "คอนกรีตผสมเสร็จ " = อันเดียวกัน) → เลือก **สะกดที่ใช้บ่อยสุดเป็นตัวแทน** (เสมอกันเลือกสะกดที่ยาว/เต็มกว่า) → เรียงใช้บ่อยก่อน (สินค้าสูงสุด 400, ร้าน 200, อื่น ๆ 60-150) + dispatch `case 'getEditFieldSuggestions'`
  2. **index.html: autocomplete ทุกช่อง** — datalist 8 ชุดสร้าง dynamic (editItemList/editUnitList/editStoreList/editVehicleList/editCompanyList/editJobList/editRequesterList/editPayApproverList) ผูกกับ: ชื่อสินค้า+หน่วย **ทุกแถวรายการ** (รวมแถว "เพิ่มรายการ" ใหม่) / ชื่อร้านค้า / ทะเบียนรถ / ชื่อบริษัท / งาน / ผู้เบิก / ผู้สั่งจ่าย | `loadEditSuggestions()` โหลดครั้งเดียวตอนเปิดฟอร์มแก้ไขแล้วแคชในหน้า (ครั้งถัดไปไม่ยิงซ้ำ) — ไม่บล็อกการเปิดฟอร์ม (ยิง background) พลาดก็เงียบ ๆ (autocomplete ไม่ใช่ฟีเจอร์บังคับ) | label โชว์ความถี่ เช่น "คอนกรีตผสมเสร็จ 35 Mpa (12 ครั้ง)" ให้เลือกสะกดมาตรฐานได้ทันที
- **Cascading Sync Check:** ช่องที่เป็น select อยู่แล้ว (หมวดหมู่/ประเภทเอกสาร) ไม่แตะ | ช่องเลข (จำนวน/ราคา/น้ำหนัก) ไม่ใส่ datalist | ค่าที่พิมพ์ใหม่จะกลายเป็นตัวเลือกรอบถัดไปเองเมื่อบันทึกลง Supabase (ประวัติโตเองตามการใช้) | การเลือกจาก list ไม่เปลี่ยน payload/บันทึกอะไรเพิ่ม | badge v3.14.9 → v3.15.0
- **Check:** Code.gs node --check EXIT=0 | index.html inline script node --check EXIT=0 | FFFD=0 ทั้งคู่
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** → ทดสอบ: เปิด "แก้ไขข้อมูลบิล" → คลิกช่อง "รายการสินค้า/วัสดุ" หรือพิมพ์ 1-2 ตัวอักษร → ต้องมีรายการเดิมที่เคยใช้ลอยมาให้เลือก เรียงใช้บ่อยก่อน (label มีจำนวนครั้ง) | ชื่อร้าน/ทะเบียนรถ/ผู้เบิกเหมือนกัน | แถว "เพิ่มรายการ" ใหม่ก็ต้องมีตัวเลือกเหมือนกัน | Log มี "💡 SUGGEST: ... สินค้า N รูปแบบ"


## [2026-09-23] 🎯 v3.15.1 — ฟอร์มปรับตามประเภทเอกสาร (ดูบิลเต็ม + แก้ไขข้อมูลบิล ใช้นโยบายเดียวกัน)
- **ที่มา:** User — "โหมดดูบิลเต็มและโหมดแก้ไขข้อมูลบิล ฟอร์มควรปรับตามประเภทเอกสาร" (ใบชั่งไม่ต้องโชว์เล่มที่/เลขกำกับ, ใบกำกับภาษีโชว์เลขกำกับ+เล่มที่, PO โชว์การ์ดบริษัท/งาน/ผู้เบิก)
- **หลักการ (ที่ User ยืนยันไว้ก่อนหน้า):** ช่องไหนมีค่าอยู่แล้วต้องโชว์เสมอ กันข้อมูลหายจากสายตา — ประเภทเอกสารเป็นตัวกำหนดแค่ "ส่วนที่ว่างแสดงเพิ่ม"
- **ที่แก้ (ทั้งหมดใน index.html — ไม่แตะ Code.gs):**
  1. **ฟังก์ชันนโยบายกลางใหม่ 2 ตัว:** `docTypeRelevantFieldKeys(type)` คืนชุดส่วนที่เกี่ยวข้อง (taxInvoice/book/ref/po) จาก meta มาตรฐานบัญชี (T1/T2 ใบกำกับ+ใบเสร็จกำกับ → เลขกำกับ+เล่ม+อ้างอิง | T3 ใบเสร็จ → อ้างอิง | T4/T5 ลดหนี้/เพิ่มหนี้ → เล่ม+อ้างอิง | D1/D2 ส่งของ/รับของ → อ้างอิง | O1/O2 PO/ขอซื้อ → การ์ดสั่งซื้อ/งาน) + `applyEditDocTypeVisibility(type)` คุม visibility ฟอร์มแก้ไข (เล่มที่/เลขกำกับ/เลขอ้างอิง/ชื่อเรียกอ้างอิง/การ์ด PO/ช่องใบชั่ง — รวม customScaleDocTypes องค์กร) **โดยค่าที่พิมพ์อยู่บังคับโชว์กล่องคืนเสมอ**
  2. **ฟอร์มแก้ไข:** ใส่ ID กล่อง (editBookBox/editTaxInvoiceBox/editRefNoBox/editRefLabelBox/editPoFieldsCard) + เรียก applyEditDocTypeVisibility ① ตอน onchange dropdown ประเภท ② ตอนเปิดฟอร์ม — **เรียกหลังเติมค่าครบทุกช่อง** (ย้ายจากจุดเดิมหลัง updateEditDocTypeTaxHint ซึ่งเติมค่ายังไม่ครบ = กฎมีค่าใช้งานไม่ได้) + ตอน submitNewDocType (เปลี่ยนเป็นประเภทองค์กรใหม่)
  3. **ดูบิลเต็ม:** แถว "เลขที่ PO:" ซ่อนเมื่อว่าง (เดิมโชว์ "-" ตลอด — ครอบ modalPoRowBlock) | การ์ดข้อมูลสั่งซื้อ/งาน ใช้ dtKeys.po จากฟังก์ชันกลางแทน hardcoded 'ใบสั่งซื้อ' (ครอบใบขอซื้อด้วย) | เพิ่มบรรทัด "บันทึกเพิ่ม: ..." (modalHiddenDocNos) เมื่อมีค่าที่มีแต่ไม่มีช่องโชว์เด่นในหน้านี้ (เล่มที่ล้วน/เลขอ้างอิงเมื่อมีเลขที่เอกสารแยกอยู่) — ค่าไม่หายจากสายตา | แถบใบชั่ง/การ์ดบริษัท/งานใช้โครงเดิมที่ปรับตามประเภทอยู่แล้ว
- **Cascading Sync Check:** ปุ่ม "ใช้ค่า AI" (เติมค่าจาก AI ทั้งฟอร์ม) ไม่เปลี่ยน visibility — ก่อนบันทึก applyEditDocTypeVisibility กำลังแสดงช่องที่มีค่าให้ครบอยู่แล้ว | toggleScaleFields โครงเดิมคงอยู่ (applyEditDocTypeVisibility คุมช่องใบชั่งเป็นจุดเดียว ผลลัพธ์ตรงกัน) | ตาราง/การ์ดไม่แตะ | บันทึก/พรีวิว/เส้น AI ไม่แตะ | badge v3.15.0 → v3.15.1 | **index.html inline script ผ่าน node --check (new Function), FFFD=0**
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** → ทดสอบ 3 สถานการณ์: (1) เปิดบิลใบชั่ง → ฟอร์มแก้ไขต้องเห็นช่องทะเบียน/น้ำหนัก ไม่เห็นเล่มที่/เลขกำกับ/การ์ด PO (2) เปิดบิลที่มีเลขกำกับ+เล่มอยู่แล้ว (ใบชั่งที่เคยอ่านเลขกำกับมา) → ช่องเหล่านั้นต้องยังโชว์พร้อมค่าเดิม (กฎมีค่า) (3) เปลี่ยนประเภทใน dropdown ระหว่างแก้ไข → ส่วนโชว์ต้องสลับตามทันที | ดูบิลเต็ม: บิลไม่มี PO ต้องไม่มีแถว "เลขที่ PO: -" อีกต่อไป



## [2026-09-24] 🔗 v3.15.2 — รวม เล่มที่/เลขที่เอกสาร เป็นช่องเดียว (แก้ doc_key ต่างกันเมื่อ AI อ่านเห็นเลขที่แต่ไม่มีเล่มที่)
- **ที่มา:** User พบปัญหา — ใบสั่งซื้อ/บิลที่มี เล่มที่ + เลขที่ แยกกัน ทำให้ระบบมองเป็นคนละเอกสาร เมื่อ AI อ่านเห็นเลขที่แต่ไม่มีเล่มที่ → ขอให้เก็บเป็น เล่มที่/เลขที่ (เลขที่เอกสาร) ในช่องเดียว (ช่องเลขที่เอกสาร)
- **สาเหตุ (ตรวจโค้ดจริง):** buildDocKey สร้าง key "DOC:ประเภท:เล่ม:เลขที่" — เมื่อ AI อ่านได้เฉพาะเลขที่ (book_no ว่าง) key จะเป็น "DOC:ประเภท::2680" ไม่ตรงกับบิลเดิม "DOC:ประเภท:5:2680" = ระบบมองเป็นคนละเอกสาร (ผ่าน findDuplicateByDocKey ไม่โดน)
- **ที่แก้:**
  1. **Code.gs: `splitCombinedDocNo()` ใหม่ + `buildDocKey` ปรับ** — doc_no ที่มี "/" (เช่น 5/2680) แยกเล่มจากตัวหน้า / อัตโนมัติ → ได้ key เดียวกับบิลเก่าที่เล่ม/เลขที่แยกช่อง (book_no ยังใช้ได้กับข้อมูลเดิม — ไม่ต้อง migrate บิลเก่า) | ทดสอบแล้ว: เก่า {book:5, doc:2680} กับ ใหม่ {doc:5/2680} → DOC:ใบส่งของ:5:2680 ตรงกัน + เลขไทย ๕/๒๖๘๐ normalize ตรงกัน
  2. **Code.gs: prompt `buildUniversalOcrPrompt`** — doc_number: ถ้าเอกสารมีทั้งเล่มที่และเลขที่ให้รวมเป็น "เล่มที่/เลขที่" ช่องเดียว ห้ามแยก | legacy prompt (สำรอง) ปรับตาม: book_no = (เลิกใช้ ใส่ - เสมอ), doc_no = รวม เล่มที่/เลขที่ + กฎแยกเลขข้อ • ปรับเป็น รวมเข้า doc_no ช่องเดียว
  3. **Code.gs: `buildDocLabel`** — doc_no แบบรวม (เช่น 5/2680) จะไม่โชว์ เล่มที่ 5 ซ้ำอีกช่อง
  4. **Code.gs: `findSoftDuplicate`** — เพิ่มการเทียบตัวตนเอกสารจริง (doc_key / tax / คู่เล่ม-เลขที่ splitCombinedDocNo / ref) นอกจากเทียบร้าน+วันที่+ยอดเดิม — กันบิลเดียวกันที่เก็บสองรูปแบบไม่โดนตรวจซ้ำ
  5. **Code.gs: `validateReceiptData`** — noDocIdentity รวม book_no เป็นตัวตนด้วย (บิลมีเล่มที่ล้วนไม่ fail แล้ว → ติดธงรีวิว 6b ให้คนเติมเลขที่ให้ครบ แจ้งรูปแบบ เล่มที่/เลขที่)
  6. **index.html: `docLabel`** — mirror ฝั่ง backend (bookInNo กันโชว์เล่มซ้ำ)
  7. **index.html: ฟอร์มแก้ไข** — placeholder ช่องเลขที่เอกสาร = "เช่น 5/2680 (เล่มที่/เลขที่) หรือ 12345" + `applyEditDocTypeVisibility` ซ่อนช่องเล่มที่แยกอัตโนมัติเมื่อ doc_no รวมเล่มอยู่แล้ว (บิลเก่าที่เล่มแยกช่องยังโชว์ตามกฎมีค่า) + oninput refresh (refreshEditDocNoVisibility ใหม่) | label ช่องเล่มที่ = เล่มที่ (บิลเก่า — ใหม่ให้รวมในช่องเลขที่เอกสาร)
  8. **index.html: ดูบิลเต็ม (modalHiddenDocNos)** — doc_no แบบรวม = ไม่แจ้ง เล่มที่ ซ้ำใน "บันทึกเพิ่ม"
- **Cascading Sync Check:** book_no คงอยู่ทุกชั้น (schema/saveToSheet/Supabase/normalizeData) — ไม่ลบคอลัมน์ บิลเก่าไม่พัง | receipt_links/po_doc_key ใช้ doc_key จากชั้นเดียวกัน (key เดิมของบิลเก่าไม่เปลี่ยน) | updateReceipt/normalizeReceiptDocFields ผ่าน buildDocKey ใหม่โดยอัตโนมัติ | badge v3.15.1 → v3.15.2
- **Check:** Code.gs node --check EXIT=0 (temp .js) | index.html inline script node --check EXIT=0 (new Function) | FFFD=0 ทั้งคู่ | ทดสอบ buildDocKey/splitCombinedDocNo/buildDocLabel ใน Node ผ่านครบ
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** → ทดสอบ: (1) ส่งบิลใหม่ที่มี เล่มที่ 5 + เลขที่ 2680 → ช่องเลขที่เอกสารต้องเป็น "5/2680" (2) ส่งซ้ำ/ส่งใบเดิมที่เคยบันทึกแบบแยกช่อง → ต้องขึ้น "บิลซ้ำ" ไม่ใช่บันทึกซ้ำเป็นคนละเอกสาร (3) บิลที่ AI อ่านได้เฉพาะเลขที่ (ไม่เห็นเล่มที่) → doc_key ต้องเป็น DOC:ประเภท::เลขที่ (ยอมให้ต่างจากบิลเต็ม แต่คนตรวจติดธงรีวิวได้) (4) เปิดฟอร์มแก้ไขบิลเก่า → ช่องเล่มที่โชว์ค่าเดิม, บิลใหม่แบบรวม → ช่องเล่มที่ถูกซ่อน


## [2026-09-24] 📅 v3.15.3 — วันที่ในบิลอ่านไม่ชัด → ใช้เดือน/ปีปัจจุบันเป็นหลักก่อน (กันบิลหล่นไปไกล) + ติดธงรีวิวให้คนแก้
- **ที่มา:** User — "เพิ่มส่วนการเช็ก เดือน/ปี ของวันที่ในบิล: ถ้าอ่านข้อมูลไม่ชัด ให้ใช้เดือน/ปีปัจจุบันเป็นหลักก่อน เพื่อไม่ให้ข้อมูลหล่นไปอยู่ไกล จะได้ตรวจสอบได้ทั่วถึงกว่า"
- **โครงเดิม:** วันที่อ่านไม่ได้ = hard fail ("วันที่ในบิลขาดหายไป — ต้องตรวจภาพใหม่ก่อนบันทึก") → บิลไม่ถูกบันทึกเลย หรือถ้าหลุดผ่านมาเป็นวันที่ว่าง/เพี้ยนก็หล่นไปไกลค้นยาก
- **ที่แก้ (Code.gs — validateReceiptData):**
  1. ข้อ 5 (วันที่ขาดหาย): เลิก push reasons (ไม่ตีกลับ) → เติม d.date = วันที่วันนี้ (Asia/Bangkok) + flag date_fallback_used + reviewReasons "อ่านวันที่ในบิลไม่ชัด — ระบบใช้เดือน/ปีปัจจุบันเป็นหลักก่อน (วันที่ YYYY-MM-DD) กันบิลหล่นไปไกล กรุณาตรวจและแก้ไขให้ตรงตามใบจริง"
  2. ข้อ 6 (อ่านไม่ได้/รูปแบบเพี้ยน เช่น 24/9/26): เดิมแค่เตือนแต่ยังบันทึกวันที่เพี้ยน → ตอนนี้เติมวันที่ปัจจุบัน + รีวิวเช่นกัน
  3. เคสอ่านได้จริง: วันที่ปกติคงเดิม | พ.ศ. แปลง ค.ศ. ตามเดิม | ปีผิดปกติ (นอกช่วง 2000..ปีปัจจุบัน+1) ยังติดธงรีวิว "ไม่น่าเชื่อถือ" (ไม่ fallback เพราะอ่านมาเป็นเลขจริง)
  4. ensureRequiredFields: อัปเดต comment ให้ตรงนโยบายใหม่ (คงส่ง date="-" มาให้ validate ตัดสินเหมือนเดิม)
- **ผลทดสอบ (Node, จำลอง Utilities.formatDate):** วันที่ว่าง / "-" / เพี้ยน → date=2026-09-24 + fallback=true + ติดรีวิว ไม่ fail ✓ | วันที่ปกติ/พ.ศ. → คงเดิมไม่ fallback ✓
- **Cascading Sync Check:** needs_review = true อัตโนมัติจาก reviewReasons (บิลโชว์ธงรอตรวจในตาราง) | normalizeSupabaseDateValue ได้วันที่ ISO ถูกต้องเสมอ (ไม่มี "-" ส่ง Supabase) | ensureRequiredFields ไม่เปลี่ยนพฤติกรรมส่งค่า | ช่องแก้ไข editDateInput ยังแก้วันที่ได้ตามเดิม | badge v3.15.2 → v3.15.3 (index.html เท่านั้น — โค้ดอื่นไม่แตะ)
- **Check:** Code.gs node --check EXIT=0 (temp .js) | index.html inline script node --check EXIT=0 (new Function) | FFFD=0 ทั้งคู่
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** (index.html แค่ badge เปลี่ยน แนะนำ deploy พร้อมกัน) → ทดสอบ: ส่งบิลที่วันที่เบลอ/ไม่มีวันที่ → บิลต้องถูกบันทึกด้วยวันที่วันนี้ + ธง "รอตรวจ" พร้อมเหตุผลว่าใช้เดือน/ปีปัจจุบันแทน ให้คนแก้วันที่ตรงใบในฟอร์มแก้ไข

## [2026-09-24] 📅 v3.15.4 — ปรับนโยบายวันที่: "วัน" ต้องอ่านจากใบเท่านั้น — เติมได้เฉพาะ "เดือน/ปีปัจจุบัน" (วันที่ 01 ของเดือน)
- **ที่มา:** User แก้นโยบาย v3.15.3 — "วันที่ต้องอ่านจากบิลเท่านั้น แต่เติมเดือน/ปีปัจจุบันได้" (ห้ามเอาวันนี้ไปใส่แทนวันที่จริงบนใบ)
- **ที่แก้ (Code.gs — validateReceiptData 2 จุด):**
  1. ข้อ 5 + ข้อ 6: เปลี่ยนจากเติมวันที่วันนี้ (yyyy-MM-dd) → เติม "YYYY-MM-01" (วันที่ 01 ของเดือนปัจจุบัน Asia/Bangkok) — บิลอยู่งวดเดือนปัจจุบัน ไม่หล่นไกล และค่าที่เติมไม่หลอกว่าเป็นวันที่จริงจากใบ
  2. ข้อความรีวิวปรับ: "ระบบเติมเดือน/ปีปัจจุบัน (YYYY-MM-01) กันบิลหล่นไปไกล วันที่จริงต้องอ่านจากใบ กรุณาตรวจและแก้ไขให้ตรงตามใบจริง"
  3. คงไว้จาก v3.15.3: ไม่ตีกลับให้ถ่ายใหม่ + flag date_fallback_used + needs_review อัตโนมัติ | เคสอ่านได้จริง (ปกติ/พ.ศ./ปีผิดปกติ) ไม่เปลี่ยน
- **ผลทดสอบ (Node จำลอง Utilities.formatDate):** วันที่ว่าง/"-"/เพี้ยน → 2026-09-01 + fallback + ok:true ✓ | วันที่ปกติ 2026-09-20 → คงเดิมไม่ fallback ✓ (ALL PASS)
- **Check:** Code.gs node --check EXIT=0 | index.html inline script node --check EXIT=0 | FFFD=0 | badge v3.15.3 → v3.15.4
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY Code.gs** (ยังไม่มีใคร deploy v3.15.3 อยู่แล้ว — deploy ครั้งนี้ได้ v3.15.2+3+4 รวดเดียว; index.html deploy พร้อมกันเพราะ badge)

## [2026-09-24] 🏷️ v3.15.5 — ป้าย + ฟิลเตอร์ "วันที่รอตรวจ" บนหน้าเว็บ (บิลที่ระบบเติมเดือน/ปีปัจจุบันแทน)
- **ที่มา:** User ยืนยันข้อเสนอ — เพิ่มป้าย/ฟิลเตอร์ในหน้าเว็บแสดงบิลที่วันที่เป็น "ตัวเติม" (date fallback จาก v3.15.4) ให้คนตรวจงวดหาเจอเร็วและแก้วันให้ตรงใบ
- **หลักการตรวจจับ:** ใช้ review_reason ที่ฝั่ง backend ประทับไว้เสมอ (ข้อความ "ระบบเติมเดือน/ปีปัจจุบัน" จาก validateReceiptData v3.15.4) ผ่าน helper `isDateFallbackItem()` — ทำงานได้ทั้งข้อมูลจากชีตและ Supabase ทันที ไม่ต้องแก้ schema/SQL (date_fallback_used เป็น transient flag ฝั่ง backend)
- **ที่แก้ (index.html ทั้งหมด — ไม่แตะ Code.gs):**
  1. **helper `isDateFallbackItem(item)`** — regex /เติมเดือน\/ปีปัจจุบัน/ บน review_reason
  2. **ฟิลเตอร์ใหม่** แถบกรอง: `dateFallbackFilter` (ทุกสถานะวันที่ / 📅 วันที่รอตรวจ (ระบบเติมเดือน/ปีแทน)) — กรองใน runFilters เมื่อเลือก
  3. **ป้ายในตาราง** (renderTableRows) — "วันที่รอตรวจ" โทนส้ม (แยกจากธง "รอตรวจ" โทนเหลืองของ needs_review) + tooltip อธิบาย + แนะนำเปิดแก้ไข
  4. **ป้ายในการ์ด** — มุมขวาใต้ธงรอตรวจ (top-12)
  5. **ดูบิลเต็ม** — badge `modalDateFallbackBadge` ใต้วันที่ โชว์/ซ่อนใน openDetailItem
- **ผลทดสอบ (Node):** isDateFallbackItem 5/5 เคสผ่าน (fallback ทั้งสองรูปแบบ = true | รีวิวเหตุผลอื่น/ปกติ/null = false) | index.html inline script node --check EXIT=0 | FFFD=0 | badge v3.15.4 → v3.15.5
- **Cascading Sync Check:** refreshSingleReceipt (patch รายการเดียวหลังบันทึก) ได้ review_reason ใหม่จาก mapSheetRowToReceiptObject (ส่ง Review Reason อยู่แล้ว) และ Supabase (มีคอลัมน์ review_reason) → ป้ายสดหลังแก้วันที่แล้วบันทึก ป้ายจะหายเองเมื่อ backend เขียน review_reason ใหม่ที่ไม่มีข้อความเติมเดือน/ปี | applyReanalyzedData คงส่ง review_reason เดิมของแถว (ไม่ล้างธง) | ฟิลเตอร์อื่น/การเรียง/แท็บไม่แตะ
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** (Code.gs ยังค้าง v3.15.2+3+4 รอ deploy อยู่ — deploy พร้อมกันครั้งเดียวได้ทั้งชุด)

## [2026-09-24] 🎨 v3.15.6 — UI มาตรฐานเดียวกัน (Phase 3): แปลง badge/ปุ่ม/ช่องกรอก/แท็บ ที่เหลือเข้า ui-* ครบ
- **ที่มา:** User — "ปรับหน้าเว็บให้เป็นมาตรฐานเดียวกัน" — User เลือกครบ 4 ส่วน: badge ทั้งหมด / ปุ่มที่ยังไม่มาตรฐาน / ช่องกรอก-select / แท็บหมวดบิล+แท็บในเมนู
- **ที่แก้ (index.html ทั้งหมด — ไม่แตะ Code.gs):**
  1. **CSS เพิ่ม token:** .ui-badge--orange / .ui-badge--muted-orange / .ui-badge--xs (เล็กพิเศษสำหรับ badge ซ้อนแท็บ) / .ui-btn--disabled (ปุ่ม disabled แบบ JS สลับ class — สไตล์เดียวกับ :disabled)
  2. **แท็บหมวดบิล (3 ปุ่ม)** ย้ายจาก activeCls/idleCls inline → .ui-tab + .is-active (setBillTab สลับ .className เป็น ui-tab/is-active) | แท็บดูบิลเต็ม (detailTabInfo/Match) + แท็บเอกสาร AI (aiModePrompts/Samples/Reference) แปลง HTML ให้ตรงกับ JS ที่ใช้ ui-tab อยู่แล้ว
  3. **badge inline → .ui-badge 29+ จุด** (script regex ทั่วไป): map สีเดิม→variant คงความหมาย (amber=pending, emerald=ok, red=danger, sky=info, slate=muted, orange=--orange ใหม่) | แท็บนับ 3-Way (twTab*Count) → ui-badge--xs | ป้ายบนหัวเมนู (supplier/priceMaterial/aiTemplate/vendorBilling/templateModal status) | badge ใน template JS strings (จับคู่/3-Way/ราคา) | badge version
  4. **ปุ่ม brand solid → .ui-btn--primary 13 จุด** (บันทึก/อัปโหลด/ตั้งค่า/บันทึกการจับคู่) — ตัดสี inline ซ้ำซ้อน (bg-btc-green/text-white ที่ ui-btn--primary คุมแล้ว) | ปุ่ม canSave สลับ class → .ui-btn--disabled
  5. **ช่องกรอก/select → .ui-input 47+ จุด** (เมนูเอกสาร AI / รับวางบิล / ตั้งค่า / ดูบิลเต็ม / JS strings) — focus ring สีเขียวเดียวกันทุกเมนู (ตาม READABILITY GUARD เดิม)
- **ของที่ตั้งใจคงเดิม (ไม่ใช่ข้าม):** ชิปแบรนด์ "BTC/AI" (span ป้าย), เมนูมือถือ mobile-page-btn, ปุ่ม outline ขาว hover เขียว (ดีไซน์ตั้งใจ), ชิปสถานะ 3-Way ขนาดใหญ่ text-xs font-bold (แยกดีไซน์ตาม Phase 2.6), วงกลมไอคอน w-16/w-12, เส้นตาราง 3-Way border-slate-300
- **ผลลัพธ์:** ui-btn 31 / ui-badge 60 / ui-input 48 / ui-tab 8 — ปุ่ม ป้าย ช่องกรอก แท็บ ทุกเมนูขนาด/เส้น/มุม/สี focus เท่ากันหมด | inline scripts node --check EXIT=0 | FFFD=0 | badge v3.15.5 → v3.15.6
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** (Code.gs ยังรอ deploy v3.15.2+3+4 — deploy พร้อมกันครั้งเดียวได้ทั้งชุด) → ทดสอบ: เปิดทุกเมนูสลับดู ปุ่ม/ป้าย/ช่องกรอก/แท็บต้องหน้าตาเท่ากันทุกเมนู + กดแท็บบิลทั้งหมด/ใบสั่งซื้อ/จับคู่แล้ว ต้องสลับ active ถูกต้อง

## [2026-09-24] 🖼️ v3.15.7 — แก้รูปบิล 3 จุดแสดงผลไม่ตรงกัน (ตาราง / ดูบิลเต็ม / รูปอ้างอิงในแก้ไข)
- **ที่มา:** User — รูปบิลในตาราง, "ภาพถ่ายบิลต้นฉบับ" ในดูบิลเต็ม, "รูปบิลอ้างอิง" ในแก้ไขข้อมูลบิล = ภาพเดียวกัน แต่หลังแก้ไขรูป (หมุน/ครอป/ความสว่าง) แล้วบางส่วนโชว์ภาพเก่า แสดงผลไม่ตรงกัน สับสนมาก
- **ต้นตอที่ตรวจพบ (3 ชั้น):**
  1. **v= ซ้อน 2 ตัว:** emApplySavedImage + applyEditedImageLocally รับ new_image_url จาก backend (มี v= แล้ว) ไปต่อ &v= ใหม่ท้ายอีกชั้น → URL มี v=...&v=... เบราว์เซอร์/Drive แคช key สับสน
  2. **ดูบิลเต็มใช้ URL หน่วง:** openDetailItem ใช้ image_url จากแถวตรง ๆ — ถ้าแถวเก่ากว่า (ไม่มี v= ใหม่ที่ emApplySavedImage เขียนลง allData) Drive เสิร์ฟภาพเก่าจากแคชเซิร์ฟเวอร์ ขณะที่แผงแก้ไขโหลดสดจากไฟล์จริง (getReceiptImageData) เห็นภาพใหม่เสมอ = สองจุดเห็นไม่ตรงกัน
  3. **normalizeData ปั่น URL จาก DB ทุกครั้ง:** ถ้า DB (ชีต/Supabase) ยังเก็บ URL ไม่มี v= ล่าสุด (patch ช้า/โดน 0 แถว) หลัง refreshData รูปในตารางกลับไปเป็นภาพเก่า
- **ที่แก้ (index.html ทั้งหมด — ไม่แตะ Code.gs):**
  1. **ฟังก์ชันกลางใหม่ 2 ตัว:** withCacheBust(url) — ต่อ/แทน v= "ตัวเดียว" เสมอ (มี v= แล้ว = แทน ห้ามซ้อน) | freshestImageUrl(a, b) — เทียบ file ID ก่อน (คนละไฟล์ = ใช้ตัวตนแถว) แล้วเทียบ v= (ไฟล์เดียวกัน = v= ใหม่กว่าชนะ)
  2. **emApplySavedImage + applyEditedImageLocally:** ใช้ withCacheBust แทนการต่อ v= เอง (เลิก v= ซ้อน) | emApplySavedImage เพิ่ม: ถ้า "ดูบิลเต็ม" เปิดค้างอยู่ → รีเฟรชรูป/ลิงก์ในหน้าต่างนั้นทันทีด้วย (เดิมลืม)
  3. **openDetailItem (ดูบิลเต็ม):** เลือก URL สดที่สุด = freshestImageUrl(image_url, image_original_url, แถวเดียวกันใน allData) ก่อนแสดง — จุดไหน v= ใหม่กว่าชนะ
  4. **normalizeData:** ถ้า DB ส่ง image_url กับ image_original_url มาคนละ v= (ไฟล์เดียวกัน) → ใช้ freshestImageUrl เลือก v= ใหม่สุด กันภาพเก่ากลับมาหลังโหลดใหม่
- **ผลทดสอบ (Node):** withCacheBust + freshestImageUrl 10/10 เคสผ่าน (v= ตัวเดียวเสมอ, ไฟล์คนละไฟล์คงตัวตน, v= ใหม่กว่าชนะ, ค่าว่างปลอดภัย) | inline scripts node --check EXIT=0 | FFFD=0 | badge v3.15.6 → v3.15.7
- **Cascading Sync Check:** refreshSingleReceipt เดิมมีกลไกเทียบ savedId/rowId อยู่แล้ว (ไฟล์เดียวกัน v= ใหม่ชนะ — สอดคล้อง freshestImageUrl) | โครง backend saveEditedReceiptImage (เขียนทับไฟล์เดิม + v= ต่อท้าย) ไม่แตะ | แผงแก้ไขรูปโหลดสดจากไฟล์จริงเหมือนเดิม (มองเห็นภาพจริงเสมอ — ตอนนี้อีก 2 จุดใช้ v= ใหม่สุดเท่ากัน)
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** (Code.gs ยังรอ deploy v3.15.2+3+4 — deploy พร้อมกันครั้งเดียวได้ทั้งชุด) → ทดสอบ: แก้รูปบิล 1 ใบ (หมุน/ครอป/ความสว่าง) บันทึก → (1) ตาราง (2) ดูบิลเต็ม (3) รูปอ้างอิงในแก้ไข ต้องโชว์ภาพใหม่เดียวกันทั้ง 3 จุด + ปิดหน้าเว็บเปิดใหม่ (โหลดจาก DB) ต้องยังเป็นภาพใหม่

## [2026-09-24] 🔄 v3.15.8 — ทุกการเปลี่ยนแปลงฐานข้อมูล → บังคับรูปทุกรูปโหลดใหม่ (image epoch)
- **ที่มา:** User ถาม "จำเป็นต้องใช้แคชด้วยหรือไม่" และสั่ง "ไม่ว่าจะแก้ไข/บันทึก/อะไรก็ตามที่มีผลกับฐานข้อมูล ให้แคชรีเฟรชใหม่ทุกครั้ง" — ตอบ: Drive แคชเซิร์ฟเวอร์ปิดไม่ได้ แต่ควบคุมได้ด้วย v=; จึงทำ global image epoch
- **หลักการ (image epoch):** ตัวนับรอบแคชรูปรวมของทั้งหน้า (imageEpoch = เวลาล่าสุดที่ DB เปลี่ยน) — ทุกครั้งที่มีการเปลี่ยนแปลง DB สำเร็จ → bumpImageEpoch() เพิ่มค่า → normalizeData ประทับ v=<epoch> ให้รูปทุกรูป → ตาราง/ดูบิลเต็ม/ทุกจุดโหลดจากเครือข่ายใหม่หมด ไม่ใช้แคชรอบเก่า
- **จุดที่ bump (ครบทุกการเปลี่ยน DB):** บันทึกแก้ไขบิล (edit-save) / ลบบิล (delete) / อ่านใหม่ AI (reanalyze) / บันทึกการจับคู่ (match-save) / Realtime event จากเครื่องอื่น (realtime) / โหลด DB ทั้งก้อน (refresh-data — ครอบ auto-refresh, ปุ่ม sync, หลังลบ)
- **ที่แก้ (index.html ทั้งหมด):** ① imageEpoch + bumpImageEpoch(reason) ใหม่ ② withCacheBust(url, epoch?) — ไม่ส่ง epoch = ใช้รอบรวมล่าสุด ③ normalizeData ประทับ v=<epoch> ให้ image_url/image_original_url ทุกรูปตอน normalize ④ ใส่ bump 6 จุดตามข้างบน | ตัวนับทำงานแบบ "รอบเดียวทั้งหน้า" — รูปทุกใบเปลี่ยน v= พร้อมกัน ตรวจง่าย ไม่ตามแต่ละรูป
- **ผลทดสอบ (Node):** 6/6 เคสผ่าน (v= ตัวเดียว / bump แล้ว v= เปลี่ยน / ไม่ซ้อน / v= เก่าถูกแทน / epoch เดียวกัน v= เดียวกัน) | inline scripts node --check EXIT=0 | FFFD=0 | badge v3.15.7 → v3.15.8
- **Cascading Sync Check:** แคชยังทำงานระหว่างรอบที่ DB ไม่เปลี่ยน (เลื่อนดูตารางเร็วเหมือนเดิม) — bump เฉพาะตอน DB เปลี่ยนเท่านั้น | emApplySavedImage ส่ง epoch ผ่าน URL ที่ backend ให้ + withCacheBust ปรับเป็น epoch ปัจจุบันให้อัตโนมัติ | refreshSingleReceipt (patch รายการเดียว) ไม่ bump แต่ v= จาก emApplySavedImage ใหม่อยู่แล้ว
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** (Code.gs ยังรอ deploy v3.15.2+3+4 — deploy พร้อมกันครั้งเดียวได้ทั้งชุด) → ทดสอบ: แก้รูป/แก้ข้อมูล/ลบ/จับคู่ อะไรก็แล้วแต่ → ตารางต้องโหลดรูปจากเครือข่ายใหม่ทั้งตาราง (ดู tab Network ใน DevTools จะเห็น request รูปใหม่หมด) | Console มี log "[BTC] 🖼️ image epoch bumped (...)"

## [2026-09-24] 🖼️💥 v3.15.9 — แก้ต้นตอราก: เขียนทับไฟล์ Drive เดิม = Drive แคช thumbnail ภาพเก่าฝั่งเซิร์ฟเวอร์ (v= หลอกไม่ได้)
- **อาการที่ User ยืนยัน (หลัง v3.15.7+8):** แก้รูป+บันทึกสำเร็จ → ตาราง = ภาพเก่า | ดูบิลเต็ม = ภาพเก่า | รูปอ้างอิงในแก้ไข = ภาพใหม่
- **ต้นตอจริง (ยืนยันจากอาการ):** แผงแก้ไขโหลด "ไฟล์จริง" ผ่าน backend (getReceiptImageData) เห็นภาพใหม่เสมอ | ตาราง/ดูบิลเต็มโหลดผ่านลิงก์ thumbnail ของ Google Drive — ระบบเขียนทับ "ไฟล์เดิม (file ID เดิม)" แต่ Drive แคช thumbnail **ตาม file ID ฝั่งเซิร์ฟเวอร์ของเขา** → ต่อ v= ท้าย URL หลอกแคชเบราว์เซอร์ได้ แต่ **หลอกแคชเซิร์ฟเวอร์ Drive ไม่ได้** = เสิร์ฟภาพเก่าต่อจนกว่าแคชเขาหมดอายุ
- **ทางแก้ถาวร (Code.gs — saveEditedReceiptImage รื้อลำดับ):**
  1. **เส้นทางหลัก = สร้างไฟล์ใหม่** (file ID ใหม่ = ไม่เคยมีแคช = thumbnail สดการันตี) โฟลเดอร์/ชื่อไฟล์เดิม + setSharing คนดูได้ + **ลบไฟล์เดิมถาวรทันที** (driveRestDeleteFilePermanent_ — ไม่ทิ้งขยะ)
  2. **เส้นทางสำรอง** = เขียนทับไฟล์เดิม (Advanced Service → Drive REST) เฉพาะเมื่อสร้างไฟล์ใหม่ล้มเหลว (โควตา/สิทธิ์) — ยอมรับ thumbnail อาจภาพเก่าชั่วคราว + ทั้งสองเส้นทางเขียน Image URL ลงชีต/Supabase (updateReceiptImageUrl) เหมือนเดิม
  3. new_image_url ที่ได้จะมี file ID ใหม่ → v3.15.7 freshestImageUrl เทียบ file ID: คนละไฟล์ = ใช้ URL ใหม่ของแถวทันที ทุกจุดโชว์ภาพใหม่พร้อมกัน
- **ผลข้างเคียงที่ตรวจแล้ว:** receipt_links เก็บแต่ doc_key ไม่ผูก file ID | google_drive_file_id ใน Supabase ถูกอัปเดตเป็นไฟล์ใหม่พร้อม URL (updateReceiptImageUrl) | deleteReceipt ใช้ image_url ปัจจุบัน extract file id — URL ใหม่ถูกเขียนทุกชั้นแล้ว | migrateEditedImages (เครื่องมือเก่า) ไม่เกี่ยว
- **Check:** Code.gs node --check EXIT=0 | FFFD=0 | badge v3.15.8 → v3.15.9
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** (ครั้งนี้ต้อง deploy Code.gs เพราะแก้ backend จริง) → ทดสอบ: แก้รูป 1 ใบ (หมุน/ครอป) บันทึก → (1) ตาราง (2) ดูบิลเต็ม (3) รูปอ้างอิงในแก้ไข ต้องโชว์ภาพใหม่เดียวกันทันที + F5 ใหม่ต้องยังเป็นภาพใหม่ | Log ต้องมี "สร้างไฟล์ใหม่ ... ลบไฟล์เดิม: deleted (ถาวร)"

## [2026-09-24] 🧭 v3.15.10 — เรียงเมนูใหม่: "เอกสารสำหรับ AI" ย้ายไปกลุ่มล่างกับ ข้อมูลองค์กร/ตั้งค่าระบบ
- **ที่มา:** User — "เอา เอกสารสำหรับ AI ไปไว้ กักกลุ่ม ข้อมูลองค์กร ตั้งค่าระบบ"
- **ลำดับเมนูใหม่:** ภาพรวม → ตารางบิล → ตรวจวางบิล 3-Way → วิเคราะห์ร้านค้า → ติดตามราคาวัสดุ → วางบิล/ใบกำกับ ║ (กลุ่มล่าง) **เอกสารสำหรับ AI → ข้อมูลองค์กร → ตั้งค่าระบบ**
- **ที่แก้ (index.html):** ย้ายปุ่ม aitemplates จาก <nav> กลุ่มหลัก → div กลุ่มล่าง (ก่อน ข้อมูลองค์กร) ทั้ง desktop sidebar และ mobile switcher | switchPage ใช้ data-page lookup ไม่ผูกลำดับ → active state ทำงานถูกต้องทันทีไม่ต้องแก้ JS
- **Check:** inline scripts node --check EXIT=0 | FFFD=0 | badge v3.15.9 → v3.15.10
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY index.html** (Code.gs ยังรอ deploy v3.15.2+4+9 — deploy พร้อมกันครั้งเดียวได้ทั้งชุด)

## v3.16.0 (2026-09-24) — ลบระบบ "ตัวอย่าง" (AI Templates/ai_templates) ออกจากระบบทั้งหมด

**เหตุผล:** User ต้องการเอาแถบ "ตัวอย่าง" ในหน้า "เอกสารสำหรับ AI" ออกจากระบบทั้งหมด

**ฝั่ง frontend (index.html):**
- ลบ view แถบตัวอย่างทั้งก้อน (aiModeSamplesView) + templateModal + uploadSampleModal + ปุ่มแท็บ "ตัวอย่าง"
- ลบ JS: renderSampleCards, renderReviewDocTypeOptions, getSelectedAIReviewSample, sampleThumb, dragSampleStart, findSampleIndexById, getSamplesByType, handlePromptDrop, uploadDroppedFile และ refs aiSampleList/aiReviewSelectedIndex ทั้งหมด
- renderPromptCards ปรับ: เอา drop-zone/ลาก-วาง/นับตัวอย่างออก — เหลือการ์ดชุด prompt + ปุ่ม AI เขียนชุด prompt (จากความรู้หมวด)
- คงไว้: แท็บชุด Prompt, แท็บอ้างอิงบัญชี, openCreatePromptModal, savePromptFields, generatePromptAction, deletePromptAction

**ฝั่ง backend (Code.gs):**
- ลบฟังก์ชัน: dedupeSampleRows, findPendingCandidateBySignature, incrementTemplateUsage, ensureTemplateCandidateIfNeeded, diagnoseAIDocuments, findMatchingTemplates
- ลบ webhook hook ensureTemplateCandidateIfNeeded (LINE ไม่เก็บ candidate อีกต่อไป)
- resolvePromptInjection: ตัด few-shot จาก ai_templates — เหลือเฉพาะ prompt_text จาก ai_prompts
- generateAIPrompt: ตัดการดึงตัวอย่าง 3 ใบ + รูปแนบ — AI เขียนชุด prompt จากความรู้หมวด (base_knowledge) อย่างเดียว
- deletePromptSet: ตัด PATCH กลับสถานะ ai_templates
- dispatch ยังรองรับ: ensureStandardPromptSets, getAIPrompts, createCustomPromptSet, generateAIPrompt, updateAIPromptFields, deletePromptSet (ชุด prompt ยังทำงานปกติ)

**หมายเหตุ:** ตาราง ai_templates ใน Supabase ยังอยู่ (ไม่ลบ schema) — แค่ระบบไม่อ่าน/ไม่เขียนแล้ว

**Check:** Code.gs node --check ผ่าน | index.html inline script ผ่าน (new Function) | FFFD=0 ทั้งคู่ | badge → v3.16.0

## v3.17.0 (2026-09-24) — เพิ่มประเภทเอกสารใหม่ 4 ประเภท + สิทธิ์ภาษีซื้อ + ชื่อเอกสารบนใบ (อ้างอิง prompt_builder.md)

**ที่มา:** User ส่ง prompt_builder.md / HTML Prompt Builder มาให้ศึกษา — คัดเฉพาะส่วนที่เสริมได้โดยไม่เปลี่ยนโครงข้อมูล (ชั้น 1+2 เร็ว)

**เพิ่ม 4 ประเภทเอกสาร (รวมเป็น 21):**
- ABB ใบกำกับภาษีอย่างย่อ — ห้ามใช้ภาษีซื้อ (ม.86/6, ม.82/5(6))
- CUSTOMS ใบเสร็จกรมศุลกากร — ใช้ภาษีซื้อได้ VAT นำเข้า (ม.86/14)
- CI Commercial Invoice — ไม่มี VAT ไทย (ภ.พ.36)
- ADV ใบขอเบิกเงินทดรองจ่าย/เคลมค่าใช้จ่าย
- แก้ทั้ง DOC_KNOWLEDGE_BASE (Code.gs — AI จำแนก) + ACCOUNTING_DOC_TYPES (index.html — อ้างอิง/ฟอร์ม/dropdown โชว์อัตโนมัติ)

**Code.gs:**
- getVatEligibility() ใหม่ — คำนวณสิทธิ์เครดิตภาษีซื้อจาก doc_type ฝั่ง backend (ไม่ให้ AI เดา) + tax_legal_ref
- buildUniversalOcrPrompt: เพิ่ม doc_title_text + is_title_explicit + ai_notes ใน schema + doc_title_fallback rules (คาดเดาจากองค์ประกอบเมื่อไม่มีชื่อ) + รหัสประเภทใหม่ใน typeMap (ABBREVIATED_TAX_INVOICE/DELIVERY_TAX_INVOICE/CUSTOMS/COMMERCIAL_INVOICE/ADVANCE_CLAIM)
- adaptUniversalOcrResult: เก็บ doc_title_text/is_title_explicit/is_vat_eligible/tax_legal_ref + รวม ai_notes เข้า remark_text รูปแบบ "[AI] ..."

**index.html:**
- normalizeData: รับ doc_title_text/is_title_explicit/is_vat_eligible/ai_notes จาก DB
- ดูบิลเต็ม: การ์ดบัญชีเพิ่มแถว "📄 ชื่อบนใบ" + ธง "AI เดาจากองค์ประกอบใบ" เมื่อ is_title_explicit=false

**Check:** Code.gs node --check ผ่าน | index.html inline OK | FFFD=0 | ทดสอบ getVatEligibility 9/9 + normalize 3/3 + types 7/7 | badge → v3.17.0

## v3.17.1 (2026-09-24) — เปลี่ยนชื่อโชว์ "ใบชั่ง" → "ใบชั่งน้ำหนัก" (ตาม User — ตรง prompt_builder.md)

**หลักการ:** เปลี่ยนเฉพาะ "ชื่อโชว์" (display_name) — ชื่อเก็บใน DB/doc_key ยังเป็น "ใบชั่ง" เพื่อคงตัวตนบิลเก่าทุกใบ (ไม่ต้อง migrate)

**Code.gs:**
- DOC_KNOWLEDGE_BASE ใบชั่ง: เพิ่ม display_name "ใบชั่งน้ำหนัก" (keywords มี "ใบชั่งน้ำหนัก" อยู่แล้ว)
- normalizeDocType: รับทั้ง "ใบชั่งน้ำหนัก"/"ใบชั่ง" → ใบชั่ง (regex /ชั่ง/ ครอบอยู่แล้ว)
- ข้อความ error จับคู่ SCALE_PO_FORBIDDEN 2 จุด → "ใบชั่งน้ำหนัก"

**index.html:**
- ACCOUNTING_DOC_TYPES ใบชั่ง: เพิ่ม display_name + helper displayDocTypeName() กลาง
- จุดโชว์ที่แก้: dropdown เลือกประเภท (accountingDocTypeOptions), ดูบิลเต็ม (modalDocTypeName), ตารางอ้างอิงบัญชี, แท็บ 3-Way (option ใบชั่งน้ำหนัก BULK + badge), dropdown จำแนกหมวด, placeholder ค้นหา
- option value ยังเป็น "ใบชั่ง" (คงความเข้ากัน DB/ฟอร์ม)

**Check:** node --check ผ่าน | inline OK | FFFD=0 | ทดสอบ normalize 4/4 + display 2/2 | badge → v3.17.1

## v3.17.2 (2026-09-24) — เพิ่มแท็บ "ตารางประเภทเอกสาร & สิทธิ์ภาษี" + "Matrix ฟิลด์ข้อมูล" ในหน้าเอกสารสำหรับ AI

**ที่มา:** User ต้องการตาราง 2 ตัวจาก prompt_builder.md ในหน้าเว็บ — สร้างจากแหล่งเดียวกับระบบ (ACCOUNTING_DOC_TYPES 21 ประเภท) ไม่ใช่ข้อมูลแข็ง

**แท็บ taxonomy (ตารางประเภทเอกสาร & สิทธิ์ภาษี):**
- ตารางรหัส/ชื่อ/สิทธิ์ VAT/มาตรา — สี badge: เขียว=ใช้ได้, ส้ม=พิจารณาเมื่อครบถ้วน, แดง=ห้ามใช้
- ค้นหา (รหัส/ชื่อ/มาตรา) + ฟิลเตอร์สิทธิ์ภาษี (ทั้งหมด/ใช้ได้/ห้าม/พิจารณา)

**แท็บ matrix (Matrix ฟิลด์ข้อมูล):**
- 10 ฟิลด์ × 21 ประเภท — ● บังคับ / ○ อ่านเมื่อพบ / – ไม่เกี่ยว
- เกณฑ์ M/O อิง prompt AI จริง: TAX-like=เลขกำกับบังคับ, WT=ชั่งบังคับ, PO=เลข PO บังคับ ฯลฯ (hover ชื่อประเภทเต็มได้)

**setAIMode ปรับ:** รองรับ 4 โหมด (prompts/reference/taxonomy/matrix) — ปุ่ม/วิว map แบบ lookup ไม่ผูกลำดับ

**Check:** inline script ผ่าน | FFFD=0 | ทดสอบ taxonomy (21 แถว/ฟิลเตอร์ YES=4/ค้นหา) + matrix (10×23 หัวตาราง) ผ่าน | badge → v3.17.2

## v3.17.3 (2026-09-24) — รวมแท็บ "อ้างอิงบัญชี" เข้า "ตารางประเภทเอกสาร & สิทธิ์ภาษี" (หน้าที่ซ้ำกัน)

**เหตุผล:** ทั้งสองแท็บใช้แหล่งเดียว (ACCOUNTING_DOC_TYPES) และหน้าที่เหมือนกัน — ตารางใหม่ (taxonomy) มีค้นหา+ฟิลเตอร์+สีสถานะ ครอบคลุมกว่า

**ที่ทำ:**
- ลบแท็บ "อ้างอิงบัญชี" (ปุ่ม + view + renderAccountingDocTypeReference 3,232 chars)
- ตาราง taxonomy เพิ่มคอลัมน์ "หมวด" (4 หมวดบัญชี เดิมจากการ์ดจัดกลุ่ม) + ค้นหาครอบคลุมหมวดด้วย
- หัวตาราง: รหัส / ชื่อเอกสาร / หมวด / สิทธิ์ VAT / อ้างอิงประมวลรัษฎากร (5 คอลัมน์)
- setAIMode เหลือ 3 โหมด: prompts / taxonomy / matrix

**ผลลัพธ์:** หน้าเอกสารสำหรับ AI เหลือ 3 แท็บ — ชุด Prompt | ตารางประเภทเอกสาร & สิทธิ์ภาษี | Matrix ฟิลด์ข้อมูล

**Check:** inline ผ่าน | FFFD=0 | ไม่มีเศษ reference | badge → v3.17.3

## v3.17.4 (2026-09-24) — รวม "ชุด Prompt" + "Matrix ฟิลด์ข้อมูล" เป็นตารางเดียว (เทียบเกณฑ์มาตรฐาน vs ค่าจริง)

**ที่มา:** User ขอรวม 2 แท็บ — การ์ดชุด Prompt เปลี่ยนเป็นตาราง + Matrix เทียบเกณฑ์กับ field_config จริงในเซลล์เดียว

**โครงใหม่ (แท็บ "ชุด Prompt & Matrix" แท็บเดียว):**
- ด้านบน: ตาราง Matrix เทียบ — 11 ฟิลด์ × 21 ประเภท เซลล์เดียวแสดง 2 ชั้น: เกณฑ์มาตรฐาน (● บังคับ/○ เมื่อพบ/– ไม่เกี่ยว) + ค่าจริง (✓ เปิด/✗ ปิด/· ไม่ได้ตั้ง)
  - เซลล์พื้นแดง = เปิดใช้ฟิลด์ที่เกณฑ์ระบุ "ไม่เกี่ยว" (เปิดเกิน → ตรวจสอบ)
  - เซลล์ขอบเข้ม = เกณฑ์บังคับ (●) แต่ชุดนั้นยังไม่เปิดใช้
  - · = ชุด prompt ของประเภทนั้นยังไม่มี field_config (ยังไม่ถูกตั้งค่า)
- ด้านล่าง: ตารางชุด Prompt แถวเดียวต่อประเภท (แทนการ์ด) — ประเภท+สถานะ+checkbox ฟิลด์ (แก้แล้วบันทึกทันที)+ปุ่ม AI เขียน/ลบ
- renderFieldMatrixTable วาดใหม่ทุกครั้งหลัง loadAIPrompts (ค่า field_config สดเสมอ)
- setAIMode เหลือ 2 โหมด: prompts (รวม Matrix) / taxonomy

**Check:** inline ผ่าน | FFFD=0 | ทดสอบ: 11 แถว, เซลล์แดง (DO เปิดเลขกำกับเกินเกณฑ์), ขอบเข้ม (บังคับแต่ไม่เปิด) ผ่าน | badge → v3.17.4

## v3.17.5 (2026-09-24) — ตารางเดียวจบ: เทียบเกณฑ์มาตรฐาน vs ค่าจริง + คลิกสลับในเซลล์ (ยกเลิกตาราง/การ์ดชุด Prompt แยก)

**ที่มา:** User ย้ำ — ต้องการ "ตารางเดียว" สำหรับเทียบค่า ไม่ใช่ 2 ส่วนซ้อนกัน

**สิ่งที่แก้:**
- ลบตารางชุด Prompt แถวเดียวต่อประเภท + checkbox builder + statusChipPrompt (ไม่ใช้แล้ว)
- เหลือตาราง Matrix ตัวเดียว: เซลล์แสดง 2 ชั้น (เกณฑ์ ●/○/– บน + ค่าจริง ✓/✗/· ล่าง)
- **คลิกเซลล์ค่าจริง = สลับเปิด/ปิดฟิลด์ของชุดนั้นทันที** (togglePromptField → updateAIPromptFields เดิม) — optimistic update + rollback เมื่อบันทึกล้มเหลว (คืนค่า undefined/true ตามเดิมเป๊ะ)
- เซลล์ · (ยังไม่มีชุด prompt) คลิกไม่ได้ — ต้องสร้างชุดก่อน (ปุ่ม + สร้างชุด Prompt ยังอยู่)
- loadAIPrompts วาดตารางเทียบโดยตรง (ไม่มี renderPromptCards แล้ว)

**Check:** inline ผ่าน | FFFD=0 | ทดสอบ toggle สลับ 2 ทิศ + rollback 2 เคส ผ่าน | badge → v3.17.5

## [2026-09-24] 📊 v3.17.6 — ตัวนับสรุปเหนือตาราง Matrix (ชุด Prompt & Matrix)

- **ที่มา:** User ขอ "เพิ่มตัวนับสรุปเหนือตาราง: กี่ประเภทยังไม่มีชุด (·) / กี่เซลล์แดงเกินเกณฑ์ / กี่ช่องบังคับยังไม่เปิด"

- **แก้ (index.html — targeted):**
  1. HTML: เพิ่ม `<div id="matrixSummaryBar">` (flex chips text-[11px]) เหนือ aiPromptNotice ก่อนตาราง matrix ใน aiModePromptsView
  2. `renderFieldMatrixTable()` — เรียก `renderMatrixSummaryBar(types, cfgByType, fields)` ท้ายฟังก์ชัน (ข้อมูลชุดเดียวกับตาราง)
  3. ฟังก์ชันใหม่ `renderMatrixSummaryBar()` — นับ 3 ค่า: (ก) noSet = ประเภทที่ไม่มี field_config เลย (เซลล์ ·) นับครั้งเดียวต่อประเภท (ข) redCells = std===N && เปิด (พื้นแดงเกินเกณฑ์) (ค) missingRequired = std===M && ไม่เปิด (ขอบเข้ม) — วาดเป็น chip 3 ใบ: slate / rose (เมื่อ >0) / amber (เมื่อ >0)
- **หมายเหตุ:** ตัวนับอัปเดตอัตโนมัติทุกครั้งที่ตารางวาดใหม่ รวมตอนคลิกสลับ ✓/✗ (optimistic) และตอน rollback — ไม่แตะ Code.gs / ไม่แตะ logic ตารางเดิม

**Check:** node --check (script ตัด temp) EXIT=0 | FFFD=0 | matrixSummaryBar=2 จุด (def+HTML), renderMatrixSummaryBar=2 จุด (def+call) | ไม่ REDEPLOY Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🔄 v3.17.7 — Prefetch ชุด Prompt ในเบื้องหลัง + พลิกตาราง Matrix (แถว=ประเภท, หัวคอลัมน์=ฟิลด์)

- **ที่มา:** User ถาม 2 เรื่อง: (1) ทำไมต้องเข้าเมนูก่อนถึงโหลด "กำลังโหลดตารางเทียบ..." — ไม่โหลดไว้ก่อนเบื้องหลังได้ไหม (2) เอา "ฟิลด์ (Field)" ไปเป็นหัวตาราง จะดูง่ายกว่าไหม (เดิมประเภทเอกสาร 21 ตัวเป็นคอลัมน์เลื่อนขวา)

- **แก้ (index.html — targeted):**
  1. **Prefetch:** window.onload เรียก `loadAIPrompts(false).catch(Noop)` หลัง setInterval autoRefresh — เข้าเมนูครั้งแรกข้อมูลมารอแล้ว (ถ้า prefetch ยังไม่เสร็จ fallback เดิมทำงานตามปกติ: switchPage/loadAISwitchView เช็ค aiPromptList ว่าง→โหลดต่อ)
  2. **พลิกตาราง `renderFieldMatrixTable()`:** แถว = ประเภทเอกสาร (คอลัมน์แรก กลุ่ม, คอลัมน์สอง = ชื่อไทยนำหน้า + ชิปรหัสสีเขียวตามหลัง), หัวคอลัมน์ = ฟิลด์ (ตัดวงเล็บ key ออกเหลือชื่อสั้น min-w-[64px] + tooltip ชื่อเต็ม) — เลื่อนแนวตั้งตามจำนวนประเภท ธรรมชาติกว่าเดิม
  3. **เซลล์/สี/คลิกสลับ/ตัวนับสรุป v3.17.6** คงพฤติกรรมเดิมทุกอย่าง (togglePromptField/rollback/summary bar ไม่แตะ) — เปลี่ยนแค่แกนตาราง
- **หมายเหตุ:** User ทวน "ประเภทเอกสาร ใส่ชื่อภาษาไทยด้วย" → จัดชื่อไทย (display_name||name) นำหน้า รหัสเป็นชิปตามหลังแล้ว

**Check:** node --check (script ตัด temp) EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🏷️ v3.17.8 — ปรับตัวเลือก/ป้ายประเภทเอกสารทุกจุดเป็น "ชื่อไทยนำ + [รหัส] ตามหลัง" (ตามมาตรฐานตาราง Matrix ใหม่)

- **ที่มา:** User รายงาน "พบปัญหาตัวเลือกประเภทเอกสาร ยังไม่ปรับใหม่" — dropdown/ป้ายอื่นยังเป็น [รหัส] ชื่อไทย ไม่ตรงกับตาราง Matrix ที่พลิกเป็นชื่อไทยนำหน้า (v3.17.7)

- **แก้ (index.html — targeted 5 จุด):**
  1. `accountingDocTypeOptions()` — option ทุก dropdown = "ชื่อไทย [CODE]" (ฟอร์มแก้ไข editDocTypeSelect + ฟิลเตอร์ docTypeFilter ผ่านตัวเดียว) | [CUSTOM] คงเดิม
  2. `docTypeDisplay()` — คืน "ชื่อไทย [CODE]"
  3. `docTypeBadge()` — ชิปโชว์รหัสล้วน (ตัด [ ] ออก) + tooltip = ชื่อไทย · สิทธิ์ภาษี · มาตรา
  4. `updateEditDocTypeTaxHint()` — hint เริ่มด้วย "ชื่อไทย [CODE] — สิทธิ์ภาษี"
  5. `renderDetailAccountingInfo()` — modalDocTypeCode โชว์รหัสล้วน (ชื่อไทยแยกอยู่ modalDocTypeName อยู่แล้ว)
- **หมายเหตุ:** value ของ option ยังเป็น item.name เดิมทั้งหมด — ข้อมูลบิลเก่า/AI ไม่กระทบ | ตารางอ้างอิงบัญชี (แท็บ taxonomy) คอลัมน์ "รหัส" เป็นตารางอ้างอิงจึงคง [CODE] หัวคอลัมน์เดิม

**Check:** node --check (script ตัด temp) EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🎨 v3.17.9 — เติม CSS ที่หายจาก tailwind-build เก่า: สีไฮไลต์ตาราง Matrix + แถบตัวนับสรุปแสดงผลไม่ติด

- **ที่มา:** User รายงานหลัง deploy — แถบตัวนับ 3 ชิปเห็นแค่ข้อความกับเลข "ไม่เห็นมีไฮไลเลย" (ไม่มีพื้น/กรอบ/สีแดง/ส้ม) — ตรวจด้วย node สแกน CSS จริงในไฟล์: class หาย 9 ตัว = บทเรียน Phase 2.6 ซ้ำ (tailwind build เก่ากว่าโค้ด)

- **แก้ (index.html — เติม CSS ใน MISSING UTILITIES append เท่านั้น):**
  1. รอบ 1 (ตัวนับ+เซลล์): .bg-rose-50 .text-rose-700 .border-rose-200 .hover:bg-rose-100 .ring-1 .ring-slate-400 .min-w-[64px]
  2. รอบ 2 (แถวประเภท): .px-1 .border-emerald-100 .hover:bg-slate-50/50 — ตรวจบริบทก่อนเติมกัน false-positive (divide-y/py-2.5/text-slate-300 มีอยู่แล้ว ไม่เติมซ้ำ)
- **ผลตรวจ:** สแกนครบ 52/52 class ที่ชิป/ตารางใช้ | node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs

**ทดสอบหลัง REDEPLOY index.html:** ชิปตัวนับต้องมีพื้น+กรอบ (เทา/แดงเมื่อ >0/ส้มเมื่อ >0) + เซลล์แดงเกินเกณฑ์/ขอบเข้มบังคับยังไม่เปิด ต้องเห็นสีจริง

## [2026-09-24] 📝 v3.18.0 — ฟิลด์หมายเหตุในเอกสาร (remark_text) + ลดกรอบซ้อนหน้าเอกสารสำหรับ AI + sticky หัวตาราง

- **ที่มา:** User ถาม 2 เรื่อง: (1) น่าจะเพิ่มฟิลด์หมายเหตุในเอกสาร — ตรวจพบ remark_text มีอยู่ทั้งระบบ (AI อ่าน+บันทึก Supabase/ชีต 
+
Remark Text
+
 อยู่แล้ว) แต่ฟอร์มแก้ไขไม่มีช่องให้คนดู/แก้ (2) หน้าเอกสารสำหรับ AI กรอบซ้อนหลายชั้น + อยากเลื่อนดูในตาราง + ตึงหัวตาราง

- **แก้ ก) หมายเหตุ:**
  1. index.html: ฟอร์มแก้ไขเพิ่ม textarea editRemarkInput (ใต้ช่องอ้างอิง, โชว์เสมอทุกประเภท)
  2. collectEditPayload: ส่ง remark_text (undefined เมื่อไม่มีช่อง = กันล้างค่าเดิม)
  3. openEditModalItem: เติมค่า item.remark_text | normalizeData: แม็พ remark_text||Remark Text
  4. ดูบิลเต็ม: แถว "📝 หมายเหตุในเอกสาร" ในการ์ดอ้างอิงบัญชี (โชว์เมื่อมีค่า)
  5. Code.gs updateReceipt: เขียนชีต Remark Text (เมื่อ payload ส่งมา) + updateSupabaseReceipt remark_text (รองรับอยู่แล้ว)
- **แก้ ข) หน้าเอกสาร AI:** ตัดการ์ดกรอบนอก (bg-white border rounded-xl) — เนื้อหาแนบเต็มพื้นที่เหมือนหน้าอื่น | ตาราง Matrix+taxonomy: overflow-x-auto→overflow-auto + max-h-[70vh] เลื่อนในกรอบ + thead sticky top-0 z-10 (bg ทึบ slate-100) + คอลัมน์หัว w-40/w-64 ตายตัว | เติม CSS ขาด: .sticky .sticky.top-0 .z-10 .max-h-[70vh] .w-64 .w-40

**Check:** node --check Code.gs EXIT=0 | index.html EXIT=0 | FFFD=0 | CSS ครบ 7/7 | ⚠️ REDEPLOY BOTH Code.gs + index.html

## [2026-09-24] 📄 v3.18.1 — จัดเลย์เอาต์ฟอร์มแก้ไขให้ไล่ตามโครงบิลจริง (Authentic Document Layout)

- **ที่มา:** User ขอเลย์เอาต์เหมือนบิลจริง — สรุป scope หลังทักว่าเข้าใจผิด: "ต้องการแค่การวางเลย์เอาต์ของฟอร์มเฉยๆ" — ไม่แตะ ID/ฟังก์ชัน/ช่องกรอกใด ๆ

- **แก้ (index.html — ย้ายบล็อกล้วน):**
  1. ย้ายตารางรายการสินค้า + ยอดรวมสุทธิ ขึ้นหลังการ์ดข้อมูลเอกสาร/อ้างอิง (กลางเอกสารแบบบิลจริง — เดิมอยู่ท้ายสุด)
  2. หมายเหตุในเอกสาร (v3.18.0) อยู่ถัดจากยอดรวม → ข้อมูลสั่งซื้อ/งาน → ใบชั่ง (ส่วนท้ายเอกสาร)
  3. กล่องอธิบาย amber (ใช้กรณี AI อ่านไม่ตรง) ย้ายลงล่างสุดของฟอร์ม ไม่ขวางสายตาส่วนหัว
  - ลำดับใหม่: หัวบริษัท → เลขที่/วันที่/ร้านค้า/ผู้ส่ง → ประเภท+เล่ม+กำกับภาษี+อ้างอิง → รายการสินค้า+ยอดรวม → หมายเหตุ → PO/ใบชั่ง → คำอธิบาย
- **ยืนยัน:** ทุก ID ครบจุดเดียว (editItemsBody/editTotalInput/editRemarkInput/editDocNoInput/editStoreInput) | node --check EXIT=0 | FFFD=0 | JS/ฟังก์ชันไม่เปลี่ยน

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 📄 v3.18.2 — ช่องเล่มที่แยกโชว์เฉพาะบิลเก่าที่มีค่าค้าง (User: เล่ม ยังต้องมีอยู่หรอ งง)

- **ที่มา:** User งงว่าทำไมยังเห็นช่องเล่มที่ — ตรวจพบ: v3.15.2 รวมเล่มที่เข้าเลขที่เอกสารแล้ว (book_no=เลิกใช้, AI ไม่อ่าน) แต่ applyEditDocTypeVisibility ยังโชว์ช่องเล่มที่ว่าง ๆ ให้บิลใหม่ที่เป็นใบกำกับภาษี/ลดหนี้/เพิ่มหนี้ (keys.book=true)

- **แก้ (index.html — 2 จุด):**
  1. showBook = bookVal !== \"\" && !bookInsideDocNo — ตัด keys.book ออก: โชว์เฉพาะบิลเก่าที่มี book_no ค้างจริง (และไม่ซ้ำกับเล่มที่/เลขที่ ในเลขที่เอกสาร)
  2. label เปลี่ยนเป็น \"เล่มที่ (บิลเก่าเท่านั้น — บิลใหม่พิมพ์รวมในช่องเลขที่เอกสาร เช่น 5/2680)\"
- **หมายเหตุ:** ไม่ลบช่อง/คอลัมน์ Book No. — บิลเก่ายังต้องดู/แก้ค่าได้ + Doc Key/จับคู่บิลซ้ำยังใช้ book_no normalize อยู่ | บิลใหม่ AI ไม่เติม book_no = ไม่มีวันโชว์

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🧾 v3.18.3 — ฟอร์มแก้ไขเป็นเอกสารมี Section เลขกำกับ + แผงสรุปยอดแบบใบจริง + จำนวนเงินตัวอักษร (จากตัวอย่าง Authentic Document Layout ที่ User ส่ง)

- **ที่มา:** User ส่งตัวอย่าง HTML (Vue mock) ให้ศึกษา — สิ่งที่ยกมาใช้แบบ targeted (ไม่เปลี่ยน framework/ID): (1) Section มีเลขกำกับ 1/2/3 (2) แผงสรุปยอดแบบเอกสารจริง (3) จำนวนเงินตัวอักษร

- **แก้ (index.html):**
  1. Section headers: 1. เลขที่เอกสาร·วันที่·ผู้ขาย / 2. ประเภทเอกสาร+เลขกำกับ+อ้างอิง / 3. รายการสินค้า (สไตล์หัวเรื่อง+คำกำกับขวาตามตัวอย่าง)
  2. แผงสรุปยอดใต้กล่องยอดรวม: editItemsSum (รวมรายการทั้งหมด) + editTotalDiff (ส่วนต่างยอดสุทธิ vs ผลรวมรายการ — เขียว=ตรง/ส้ม=ไม่ตรง+tooltip) + editTotalBahtText (จำนวนเงินตัวอักษร)
  3. thaiBahtText() แปลงเงินเป็นตัวอักษรไทย (ทดสอบ: 55640→ห้าหมื่นห้าพันหกร้อยสี่สิบบาทถ้วน, 1500.50→หนึ่งพันห้าร้อยบาทห้าสิบสตางค์, เอ็ด/ยี่/ล้าน ถูกต้อง)
  4. recalcEditTotal คำนวณ sum ก่อนเช็ค editTotalManual แล้วเรียก updateEditSummary เสมอ (ส่วนต่างอัปเดตแม้ผู้ใช้พิมพ์ยอดเอง) + openEditModalItem เรียกครั้งแรกตอนเปิดฟอร์ม
- **ยืนยัน:** ไม่เปลี่ยน ID/ฟังก์ชันบันทึก/payload ใด ๆ | node --check EXIT=0 | FFFD=0

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🎨 v3.19.0 — รื้อฟอร์มแก้ไขตามตัวอย่าง Authentic Document จริง (การ์ด light-panel แยก Section)

- **ที่มา:** User ตำหนิรอบ v3.18.3 ว่าแค่เสียบหัวข้อทับ ไม่ได้เปลี่ยนโครงหน้าตาให้เหมือนตัวอย่างที่ส่ง (ถูกต้อง — รอบก่อนยังใช้การ์ด bg-slate-50/grid เดิมทั้งก้อน)

- **แก้ (index.html — รื้อโครง HTML ฟอร์มทั้งก้อนตามตัวอย่าง, ไม่แตะ ID/ฟังก์ชัน):**
  - โครงใหม่: ทุก Section เป็นการ์ดขาวขอบมน .light-panel (พื้นขาว+เส้นเทา+เงาจาง เหมือนตัวอย่าง) หัว Section = ไอคอน+ชื่อเลขกำกับ+คำกำกับภาษาอังกฤษขวา
  - Section 1: ผู้ออกเอกสาร (โลโก้/ที่อยู่/เลขภาษี) + ช่องกรอกเลขที่เอกสาร/วันที่/PO/ร้านค้า/หมวดหมู่ แบบ label เทาบน+ช่องขาว (สไตล์ตัวอย่าง) + กล่องเทา SRN/ผู้ส่ง/แหล่งที่มา
  - Section 2: ประเภทเอกสาร+กำกับภาษี+เล่ม+อ้างอิง (grid 4 คอลัมน์) + กล่องเพิ่มประเภทองค์กร (hidden คงเดิม)
  - Section 3: ตารางรายการสินค้า + ยอดรวมสุทธิ + แผงสรุป (รวมรายการ/ส่วนต่าง/Baht Text)
  - Section 4: หมายเหตุ + ข้อมูลสั่งซื้อ/งาน (hidden คงเดิม — applyEditDocTypeVisibility เปิดเอง) + ใบชั่ง (hidden คงเดิม)
  - แก้ HTML แตกจากรอบ v3.18.1 (<div> หลุด class) ด้วย
  - เติม CSS: .light-panel .rounded-2xl .space-y-3/4/5 .md:p-5
- **ยืนยัน:** ID 34 ตัวครบจุดเดียว | hidden ของ PO/ใบชั่ง/เพิ่มประเภท คงเดิมให้ visibility เดิมทำงาน | node --check EXIT=0 | FFFD=0 | CSS ครบ 10/10

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🖥️ v3.19.1 — ขยายหน้าต่างดูบิลเต็ม/แก้ไขให้กว้าง-สูงขึ้น (User: ฝั่งขวาจะได้แสดงข้อมูลชัดเจน)

- **ที่มา:** User ขอขยายขนาดโหมดให้ใหม่กว่าเดิม

- **แก้ (index.html — 2 modal ทั้งคู่เท่ากัน):**
  1. max-w-6xl→max-w-7xl (72→80rem) + max-h-[92vh]→max-h-[96vh] + padding รอบนอก p-4→p-2 sm:p-4
  2. จอ ≥1280px (xl): แผงรูปซ้าย 38%→36% ให้ฝั่งฟอร์มกว้างขึ้น
  3. เติม CSS .max-w-7xl + .xl:w-[36%] (แก้ escape ซ้อนจากการสร้าง — ยืนยัน codepoint ครบ \/\[\%\])

**Check:** CSS selector ถูกต้อง 2 จุด | modal ใช้ class ใหม่ 3 จุด (2 modal + CSS def) | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-24] 🎨 v3.19.2 — ดูบิลเต็มใช้โครง UI ตัวอย่าง Authentic Document ทั้งหมด (ลิงก์ข้อมูลระบบเรา)

- **ที่มา:** User ย้ำ: อยากใช้โครงสร้าง UI ตัวอย่างทั้งหมด แต่ลิงก์ข้อมูลระบบเอง — คราวนี้เปลี่ยนผิวหน้าทั้งโครง โดยคง ID/แท็บจับคู่/ฟังก์ชันเดิม

- **แก้ (index.html — หน้าดูบิลเต็ม detailModal):**
  1. ซ้าย: แถบควบคุมบนขาว (ไอคอน+ชื่อ+ปุ่ม "เต็มขนาด"/"พอดีจอ") + สเตจรูปพื้นเทา slate-300 + แถบท้ายวิธีใช้ (แบบตัวอย่าง) — detailImageStage/modalImage คงเดิม
  2. ขวา: แถบควบคุมบนสุด — ป้าย "โหมดดูข้อมูล" ฟ้า + แท็บข้อมูล/จับคู่ + ปุ่มอ่านใหม่(AI) + ปุ่ม "แก้ไขข้อมูล & รูปภาพ" เขียวเด่น (ย้ายจาก footer ล่าง)
  3. Section 1 ข้อมูลหลักเอกสาร: การ์ดขาว shadow-sm + ค่าเป็นป้ายสี (เลขเอกสารเขียว/PO ฟ้า/หมวดหมู่เขียว/SRN ฟ้า) ตามตัวอย่าง
  4. Section อ้างอิงบัญชี/PO/จับคู่/ใบชั่ง: การ์ดขาว + ทะเบียนรถป้ายส้ม + น้ำหนักสุทธิป้ายม่วง (สไตล์ตัวอย่าง)
  5. Section รายการสินค้า: หัวเรื่องสไตล์ตัวอย่าง + แถว Baht Text (modalBahtTextRow/modalTotalBahtText ใหม่) — openDetailItem เติมค่า thaiBahtText เมื่อยอด>0 (ใบชั่ง/ส่งของไม่โชว์)
- **ยืนยัน:** ID 54 ตัวครบจุดเดียว (รวมคืน modalImageExternal) | แท็บจับคู่/อ่านใหม่/modalCompareBox คงเดิม | node --check EXIT=0 | FFFD=0

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html

## [2026-09-25] 🎨 v3.19.3 — ดูบิลเต็มรื้อโครงตัวอย่าง Authentic Document เต็มรูปแบบ (แทนโครงเดิมทั้งหมด — ลิงก์ข้อมูลระบบจริง)

- **คำขอ User:** เอาโครงสร้าง UI ตัวอย่าง (ซ้ายรูป 40% / ขวาฟอร์ม 60% การ์ดแยก Section 1-4) ไปแทนส่วน "ดูบิลเต็ม" ทั้งส่วน แล้วเชื่อมข้อมูลจริงของระบบ

- **แก้ (index.html — detailModal เท่านั้น ไม่แตะ JS ส่วนอื่น/Code.gs):**
  1. โครงหลัก: ลบ header modal เดิม (BTC badge + h3 + ปุ่ม X) — โครงตัวอย่างไม่มี header แยก → ชื่อร้าน (modalSupplierTitle) ย้ายไปเป็นชื่อหัวการ์ด "ข้อมูลหลักเอกสาร" + ปิดหน้าต่าง = ปุ่ม X มุมขวาแถบควบคุมบน (เหมือนตัวอย่าง)
  2. ซ้าย (40% — เติม CSS .lg:w-[40%]): แถบควบคุมบนขาว + สเตจรูปพื้นเทา + แถบท้ายวิธีใช้ (ล้อเมาส์ซูม/ลาก/ดับเบิลคลิกพอดีจอ) — timestamp ย้ายมาแสดงขวาแถบท้ายนี้ (footer เดิมถูกลบ) ตัดข้อความเป็น "บันทึก: ..." ให้สั้น
  3. ขวา (60%): แถบบนสุด = ป้าย "โหมดดูข้อมูล" + แท็บข้อมูล/จับคู่ + ปุ่มอ่านใหม่(AI) + ปุ่ม "แก้ไขข้อมูล & รูปภาพ" + X — ลบ footer แถบล่างเดิมทิ้ง (ปุ่มแก้ไข/ปิดซ้ำซ้อน 2 จุด → เหลือจุดเดียว)
  4. Section 1 ข้อมูลหลัก: หัวการ์ดเพิ่ม badge ประเภทเอกสาร (modalDocTypeBadge: ชื่อไทย + [รหัส]) ฝั่งขวาแทนคำกำกับ — openDetailItem เติมค่าจาก getAccountingDocTypeLoose(item.doc_type)
  5. Section 2 ประเภทเอกสาร & อ้างอิงบัญชี: หัวการ์ดแบบตัวอย่าง (ไอคอน+ชื่อหัวข้อซ้าย + badge รหัส/กลุ่มขวา) — ชื่อประเภท (modalDocTypeName) เป็นตัวหนาสีแอมเบอร์ + ธง "AI เดาจากองค์ประกอบใบ" (modalDocTitleGuess) ย้ายมาอยู่แถวเดียวกัน (ลบตัวซ้ำเดิมในแถวชื่อบนใบ)
  6. Section 3 รายการสินค้า: ลบ badge "N รายการ" (ตัวอย่างไม่มี) — เก็บ element เป็น hidden พร้อม null-guard เดิม (ID ไม่หาย กัน caller อื่นพัง)
  7. CSS: เติม .lg:w-[40%] + .md:grid-cols-2/3/4 + .whitespace-pre-line (Tailwind build ในไฟล์ไม่มี) — class อื่นใช้ของเดิมที่มีอยู่แล้วทั้งหมด
  8. versionBadge v3.17.5→v3.19.3 (badge ตกเก่าตั้งแต่ v3.18)
- **คงเดิมตั้งใจ:** ID ระบบทุกตัว — แท็บจับคู่/อ่านใหม่/modalCompareBox/modalMatchSummary/ใบชั่ง/PO fields/Baht Text ทำงานเหมือนเดิมทุกอย่าง | detailImageZoom (inline zoom) ผูกกับ detailImageStage/modalImage ซึ่งคงเดิม

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html อย่างเดียว

## [2026-09-25] 🎨 v3.19.4 — รื้อดูบิลเต็มให้เหมือนตัวอย่างจริง ๆ (แก้งาน v3.19.3 ที่ยังเป็นโครงเดิมมากเกินไป — User: "ไม่ได้ UI แบบที่ส่งโค้ดมาแม้แต่น้อย")

- **คำขอ User:** ส่งภาพจริง 2 ภาพเทียบ — ต้องการ: กล่องข้อมูล boxed 4 ช่องแถว / การ์ดผู้ขาย+ผู้ซื้อคู่ / หมายเหตุ+แผงสรุปยอดคู่ล่าง / แถบเครื่องมือรูปใต้ภาพ / ปุ่มซูมลอย −/%/+/Fit

- **แก้ (index.html — detailModal + createInlineImageZoom + openDetailItem):**
  1. **ปุ่มซูมลอย** มุมล่างซ้ายของรูป: − / 100% (label) / + / Fit — detailZoomStep ยิง WheelEvent เดียวกับล้อเมาส์ (สเต็ป 1.18 เดียวกัน) + updateDetailZoomLabel อ่าน scale จาก transform เทียบ fit
  2. **แผงเครื่องมือปรับแต่งรูปภาพ** ใต้รูป (แทนแถบวิธีใช้เดิม): หมุนซ้าย/หมุนขวา/พลิกภาพ/ครอป/รีเซ็ต — หมุน+พลิกทำจริงผ่าน opts.extraTransform ใหม่ของ createInlineImageZoom (ซูม/ลากไม่ลบการหมุน — apply ต่อ transform ทุกครั้ง) — พรีวิวอย่างเดียวไม่บันทึกทับไฟล์ (บันทึกยังอยู่ที่หน้าแก้ไข) + ปุ่มครอปพาไปหน้าแก้ไข (มีครอปจริง)
  3. **Section 1 ข้อมูลหลัก:** รื้อเป็นกล่องข้อมูล boxed (border+rounded-lg+p-2.5+bg-slate-50/50) 4 ช่องต่อแถว — แถว 1: ประเภทเอกสาร (modalDocTypeName เขียว + ธง AI เดาย้ายมาใต้ชื่อ) / เลขที่เอกสาร / วันที่เอกสาร / เลขอ้างอิง (modalRefNoBox ใหม่ — เล่มที่/เลขที่ หรือ ref_no+label) — แถว 2: เลขใบกำกับภาษี (modalTaxInvBox ใหม่ ป้ายเขียว โชว์เมื่อมีค่า) / เลขที่ PO / หมวดหมู่ / เลขที่รายการระบบ — แถว 3: ผู้ส่งบิล LINE / แหล่งที่มา
  4. **Section 2 การ์ดคู่ (md:grid-cols-2):** ผู้ออก/ผู้ขายเอกสาร (ชื่อร้าน+เลขภาษี vendor_tax_id มีเมื่อมีค่า+ที่อยู่) | ลูกค้า/บริษัท/ผู้เบิก (company_name+ผู้เบิก/ผู้สั่งจ่าย+งาน/โครงการ) — ใช้เฉพาะค่าที่ระบบมีจริง ห้ามเดา (แถวว่างซ่อน)
  5. **ตารางรายการ:** หัวคอลัมน์เปลี่ยนเป็นแบบตัวอย่าง (# / รายการ / จำนวน / หน่วย / ราคา/หน่วย / จำนวนเงิน (บาท)) + tfoot "ยอดรวมสุทธิ / Net Total:"
  6. **Section 4 คู่ล่าง (ใหม่):** การ์ดหมายเหตุ (modalRemarksBox — whitespace-pre-line เติมจาก remark_text ไม่มีค่า="ไม่มีหมายเหตุ") + แผงสรุปยอด (ยอดรวม/Subtotal + ส่วนลด 0.00 (ระบบยังไม่มีฟิลด์) + Net Total เขียวใหญ่ + ตัวอักษรไทย) — modalRemarkRow ในการ์ดบัญชีซ่อนถาวร (คง ID)
  7. CSS เติม: .grid-cols-5 .bottom-3 .left-3 .min-h-[60px] .z-20 .bg-btc-green/5 .h-6 .w-px .mx-0.5 .break-all .bg-white/95 | badge v3.19.3→v3.19.4
  8. ไฟล์ preview_detail_modal.html (ใหม่ — mock เต็มรูปแบบ เปิดดูโครงได้ทันทีไม่ต้อง deploy ไม่เกี่ยวกับการ deploy)
- **ยืนยัน:** ID ระบบครบ + null-guard ทุกจุดใหม่ | แท็บจับคู่/อ่านใหม่/compareBox/matchSummary/ใบชั่ง/PO fields คงเดิม | openDetailItem เปิดบิลใหม่ล้างหมุน/พลิกค้าง + อัปเดต %

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html อย่างเดียว (พรีวิว: เปิด preview_detail_modal.html ในเบราว์เซอร์ได้เลย)

## [2026-09-25] 🗂️ v3.19.5 — ลบการ์ด "ประเภทเอกสาร & อ้างอิงบัญชี" + หลักการแสดงผล 1:1 + รื้อหน้าแก้ไขธีมเดียวกับดูบิลเต็ม

- **คำขอ User:** (1) "ส่วน ประเภทเอกสาร & อ้างอิงบัญชี มีไว้เพื่ออะไร มันไรสาระมาก" — ลบทิ้ง (2) "หน้าแก้ไขละ" — รื้อให้เข้าธีมเดียวกับดูบิลเต็ม (3) "การแสดงผลควร 1:1 แม้ DB เก็บเป็น JSON" — หน้าเว็บสะท้อนข้อมูลจริงทุกฟิลด์

- **แก้ (index.html):**
  1. **ลบการ์ด modalAccountingInfo ทิ้ง** — ของที่มีประโยชน์ยกไปจุดที่ใช้จริง: ชื่อบนใบ (doc_title_text) → กล่อง "ประเภทเอกสาร" ใน S1 (modalDocTitleText เติมใต้ชื่อประเภท + ธง AI เดา) / รหัส+กลุ่ม → badge หัวการ์ด S1 / ประโยคสิทธิ์ VAT+อ้างอิงกฎหมาย → tooltip ของ badge (ชี้เมาส์ดู) / หมายเหตุ → การ์ดหมายเหตุแยก (v3.19.4 แล้ว) — renderDetailAccountingInfo รื้อใหม่ ทำแค่ 3 อย่างนี้ + null-guard ทุกจุด (ID เก่าที่ลบแล้วไม่พัง)
  2. **การ์ดใหม่ "ข้อมูลที่ระบบเก็บทั้งหมด (1:1 กับฐานข้อมูล)"** (พับเก็บ กดขยายได้) — renderDetailAccountingInfo เรนเดอร์ทุกฟิลด์ใน item JSON ตรงตัว (label ไทยจาก RECEIPT_FIELD_LABELS 30+ ฟิลด์ + ค่าดิบ TRUE/FALSE/—) ไม่ตัด ไม่เดา ยกเว้น items (มีตารางแล้ว) กับ URL รูป (โชว์เป็นภาพแล้ว) → toggleRawDataCard หมุนลูกศร
  3. **หน้าแก้ไข (editModal) รื้อโครงตามดูบิลเต็ม:** ลบ header "BTC แก้ไขบิล" เดิม + ลบ footer ล่าง (ยกเลิก/บันทึก) → แถบบนขวาของฟอร์ม = ป้าย "โหมดแก้ไขข้อมูลและรูปภาพ" amber + ข้อความตัวตนบิล (editOriginInfo2 — openEditModalItem เติมทั้ง ID เก่า/ใหม่กัน caller) + ปุ่มยกเลิก/บันทึกการแก้ไข (btnSaveEdit คงเดิม) + X มุมขวาแถบควบคุมรูป
  4. **ซ้าย editModal:** แถบควบคุมบนขาว (ไอคอนดินสอ+ชื่อ+emStatus+X) + สเตจรูปพื้นเทา slate-200/70 + ปุ่มซูมลอย −/%/+/Fit (emZoomStep ยิง WheelEvent เดียวกับล้อเมาส์ + emZoomLabelUpdate อ่าน scale ของ canvas) + แผงเครื่องมือ grid 5 ปุ่ม (หมุนซ้าย/ขวา/พลิก/ครอป/รีเซ็ต) + แถบความสว่าง — ลบกล่อง tip ฟ้า+ข้อความวิธีใช้ยาว ๆ (เหลือ 1 บรรทัดในหัวแผง) — emDraw เรียก emZoomLabelUpdate ทุกครั้ง
  5. **S1+S2 ฟอร์มแก้ไข:** ช่องกรอกหลักทุกช่องลงกล่อง boxed (border+rounded-lg+p-2.5+bg-slate-50/50 label slate-400 11px) แบบเดียวกับดูบิลเต็ม — กำกับภาษี = กล่องเขียว / SRN+ผู้ส่ง = กล่องฟ้า — ID input ครบไม่แตะ payload
  6. CSS เติม .w-52 .max-h-72 .bg-sky-50/60 .last:border-0 | badge v3.19.4→v3.19.5
- **คงเดิม:** payload/collectEditPayload/saveEditReceipt/toggleScaleFields/applyEditDocTypeVisibility ทำงานเหมือนเดิมทุกอย่าง (เปลี่ยนแค่ผิว HTML ครอบ)

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html อย่างเดียว

## [2026-09-25] 🖥️ v3.19.6 — ป็อบอัพดูบิลเต็ม + หน้าแก้ไข เต็มจอ (User: "ป็อบอัพโหมไม่ทำให้มันเต็มจอไปเลยละ")

- **แก้ (index.html — detailModal + editModal):**
  1. กล่องเนื้อหา: max-w-7xl + max-h-[96vh] → w-full h-full (เต็ม viewport ทั้งกว้าง-สูง ทุกขนาดจอ)
  2. overlay รอบนอก: ลบ p-2 sm:p-4 (เดิมเว้นขอบรอบป็อบอัพ) → เนื้อหาชิดขอบจอจริง
- **คงเดิม:** rounded-2xl เดิม (มุมมน) / โครงภายในทั้งหมดจาก v3.19.5 / Esc ปิด / X ปิด | badge v3.19.5→v3.19.6

**Check:** node --check EXIT=0 | FFFD=0 | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html อย่างเดียว

## [2026-09-25] 🎯 v3.20.0 — ดูบิลเต็ม = โครงตัวอย่าง Pro UI ตรง ๆ (ยก markup มาทั้งดุ้น ผูกข้อมูลจริง — User: "ยก markup ตัวอย่างมาทำควายอะไร ก็ใช้ข้อมูลจริงสิวะ")

- **คำขอ User:** เอาโครงตัวอย่าง (ซ้าย 42% studio / ขวา 58% ฟอร์ม) ไปแทนทั้งดุ้น — ไม่ใช่แต่งโครงเดิม — แล้วข้อมูลจริงไหลเข้าช่องของมัน

- **แก้ (index.html — detailModal ทั้งก้อน splice ใหม่):**
  1. **ซ้าย 42% (Image Studio):** Controls Top Bar ขาว (ไอคอน+ป้าย+ปุ่มเต็มขนาด+ปุ่มอ่านใหม่ AI เขียว ย้ายมาแถวนี้ตามตัวอย่าง) / สเตจรูป bg-slate-200/60 + **grid dots pattern** (radial-gradient) / **ปุ่มซูมลอย −/%/+/Fit** (ไอคอน minus/plus ตามตัวอย่าง) / **แผงเครื่องมือ studio**: grid 5 ปุ่ม (หมุนซ้าย/ขวา/พลิก/ครอป/รีเซ็ต-สีแอมเบอร์) + **slider ความสว่าง 50-150% + คมชัด 50-150%** (detailSetBrightness/detailSetContrast — filter กับรูป พรีวิวเท่านั้น) + timestamp มุมขวาหัวแผง
  2. **ขวา 58% (Smart Form):** แถบบน = ป้ายจุดเขียว "โหมดดูข้อมูล" (rounded-full ตามตัวอย่าง) + **Matrix Code: [รหัส]** (modalMatrixCode ใหม่) + แท็บข้อมูล/จับคู่ + ปุ่ม "แก้ไขข้อมูล & รูปภาพ" เขียว + X
  3. **S1:** กล่องข้อมูล boxed p-3 rounded-xl bg-slate-50 4 ช่องแถว (ประเภท+ชื่อบนใบ+ธงAI / เลขที่+บันทึกเพิ่ม / วันที่+ป้ายรอตรวจ / เลขอ้างอิง) + แถว 2 ตาม Matrix (กำกับภาษี=กล่องเขียว / PO=กล่องฟ้า / หมวด / SRN / ผู้ส่ง / แหล่งที่มา)
  4. **S2:** การ์ดคู่ p-5 (ผู้ขาย: ชื่อ+เบอร์+เลขภาษี+ที่อยู่ | ลูกค้า: ชื่อ+ผู้เบิก/ผู้สั่งจ่าย+งาน)
  5. **S3:** ตาราง px-3 py-2.5 หัวเทา (ตามตัวอย่างเป๊ะ) + tfoot Net Total เขียว
  6. **S4:** หมายเหตุ min-h-[100px] + แผงยอด (Subtotal "บาท" / Discount / Net Total text-xl เขียว / **Baht Text gradient from-emerald-50 to-sky-50**) + การ์ด 1:1 คงเดิม
  7. openDetailItem: เติม modalMatrixCode + label "บาท" + reset filter ตอนเปิดบิลใหม่ | CSS เติม .lg:w-[42%] .lg:w-[58%] .flex-grow .shadow-inner .min-h-[100px] .bg-gradient-to-r .from-emerald-50 .to-sky-50 | badge v3.20.0
- **ยึด ID ระบบครบ:** modalImage/modalImageExternal/btnReanalyzeBill/detailTabInfo/detailTabMatch/modalTabData/modalTabMatch/matchPanelContent/modalDocLabel/modalPoRowBlock/modalPoNumber/modalDate/modalCategory/modalSystemRecordNo/modalSender/modalSource/modalScaleInfo ทั้งชุด/modalCompareBox/modalItemsTableBody/modalTotalAmountTable/modalRemarksBox/modalRawDataBox — ฟังก์ชันเดิมทำงานครบ (openDetailItem/showDetailTab/reanalyzeCurrentBill/จับคู่/เทียบน้ำหนัก/1:1)

**Check:** node --check EXIT=0 | FFFD=0 | ID 19/19 ครบ | ไม่แตะ Code.gs — ⚠️ REDEPLOY index.html อย่างเดียว

## [2026-09-25] 🔍 v3.20.2 — พรีวิว "ดูบิลเต็ม" จาก markup จริง + แก้บั๊กป้าย ui-badge ที่สั่งซ่อนแต่โชว์ค้าง

- **คำขอ User:** "ดูโหมด ดูบิลเต็ม" — เปิดดูหน้าต่างดูบิลเต็ม (โหมดดูข้อมูล) โดยไม่ต้อง deploy ขึ้น GAS
- **สร้างเครื่องมือพรีวิว (ไฟล์ใหม่ 2 ไฟล์ + ทับไฟล์เดิม — ไม่แตะ index.html ในส่วนโครง):**
  1. `tmp_build_detail_preview.js` — ตัวสร้าง: ดึง `<style>` ทั้ง 3 ก้อน + markup `#detailModal` (358 บรรทัด) จาก index.html จริง → `preview_detail_modal.html` (ไม่คัดลอกมือ จึงไม่มีวันเพี้ยนจากของจริง) + QA นับ class ที่ markup ใช้เทียบ CSS
  2. `tmp_preview_detail_mock.js` — ข้อมูล mock 3 ตัวอย่าง (ใบกำกับภาษี / ใบสั่งซื้อ / ใบชั่งน้ำหนัก) สลับดูได้จากแถบด้านบน + รูปบิลวาดด้วย canvas + ซูม/ลาก/หมุน/พลิก/ความสว่าง-คมชัด/แท็บจับคู่/การ์ดข้อมูลดิบ 1:1 (เดิม preview_detail_modal.html เป็น mock v3.19.4 เขียนมือ — ตอนนี้กลายเป็นไฟล์ที่ generate ได้ใหม่ทุกครั้ง)
- **🐛 บั๊กจริงที่เจอจากพรีวิว (แก้แล้ว):** ป้ายที่สั่งซ่อนด้วย `.hidden` โชว์ค้างตลอด — เพราะ `.ui-badge{display:inline-flex}` อยู่ใน `<style id="ui-standard">` ซึ่งมาทีหลัง `.hidden{display:none}` ของ tailwind-build → ป้ายทับ display:none
  - ตัวที่โชว์ค้าง: `modalDateFallbackBadge` (วันที่รอตรวจ) + `modalDocTitleGuess` (AI เดาจากองค์ประกอบใบ) ใน "ดูบิลเต็ม" / `tabBadgeOtherReview` `tabBadgePoPending` `tabBadgeMatchedPending` (ตัวนับรอตรวจบนแท็บบิล) / `aiTemplateBadge`
  - แก้: append CSS ท้ายสไตล์ก้อนที่ 2 → `.ui-badge.hidden,.ui-tab.hidden{display:none !important}` (ไม่แตะของเดิม) | ยืนยันด้วย computed style ในพรีวิว: display = none ครบ
- **⚠️ ยังเหลือ (รายงานให้ User ตัดสิน ไม่แก้):** markup v3.20.0 ใช้ Tailwind class ที่ยังไม่มีใน CSS ในไฟล์ 24 ตัว — `shadow-xl` (เงารูปบิล) / `bg-slate-200/60` (พื้นสเตจเทา — ตอนนี้โปร่งใส) / `opacity-20` (ลายจุดทึบเกิน) / `max-w-[55%]` `w-20` `w-2` `h-3` `h-1.5` `mx-1` `bg-slate-300` `bg-emerald-500` / `space-y-2.5` `space-y-3.5` `gap-3.5` `pb-1.5` `pb-2.5` / `break-words` `md:p-6` `sm:max-w-xs` `bg-purple-50` `text-purple-700` `w-36` / `disabled:opacity-50` `active:cursor-grabbing` — ตัวสร้างพรีวิวรายงานให้ทุกครั้งที่รัน
- **Check:** `node tmp_build_detail_preview.js` ผ่าน | `node --check tmp_preview_detail_mock.js` EXIT=0 | script ใน index.html node --check EXIT=0 (5,838 บรรทัด) | FFFD=0 ทั้ง 3 ไฟล์ | badge v3.20.0→v3.20.2
- **สถานะ:** ✅ พรีวิวเปิดดูได้ทันที (ไม่ต้อง deploy) — ⚠️ ถ้าต้องการให้ป้ายที่แก้มีผลบนระบบจริง ต้อง REDEPLOY index.html อย่างเดียว (ไม่แตะ Code.gs/SQL)

## [2026-09-25] 🧹 v3.20.3 — "ข้อมูลหลักเอกสาร" ในดูบิลเต็ม เลิกเป็นกล่องการ์ด (User: "ไม่เอาแบบการ์ด")

- **คำขอ User:** ส่วนแสดงข้อมูลหลักเอกสาร (Section 1 ของหน้าต่างดูบิลเต็ม) ไม่เอาแบบการ์ด
- **แก้ (index.html — เฉพาะ SECTION 1 ใน #detailModal, ไม่แตะ Section อื่น/ไม่แตะ JS):**
  1. กรอบการ์ดรอบนอก `bg-white rounded-xl p-5 border shadow-sm` → `space-y-4` (เนื้อหาอยู่บนพื้นหน้าต่างเลย ไม่มีแผ่นขาวล้อม)
  2. กล่องรายช่อง 8 กล่อง (`bg-slate-50 p-3 rounded-xl border`) + กล่องเขียว/ฟ้า (modalTaxInvBox/modalPoRowBlock) → `min-w-0` เพียว — ใช้ label เทา 11px + ค่าตัวหนาต่อกันเป็นกริด ไม่มีพื้น/ขอบ/เงา
  3. หัวข้อ: ตัดชิปไอคอนเขียว 7x7 ออก (เหลือไอคอนเดี่ยว) + เส้นคั่น pb-3/border-slate-100 → pb-2/border-slate-200 (เพราะไม่มีพื้นขาวแล้ว) + ระยะในกริด gap-3.5 (คลาสไม่มีใน CSS) → gap-4 (มีจริง)
  4. เก็บสีภาษาเดิมไว้: ใบกำกับภาษี = ตัวเขียว / PO = ตัวฟ้า / ผู้ส่งบิล = ไอคอนคนเขียว — แค่เลิกใส่กล่อง
- **ไม่แตะ:** ID ทุกตัวครบ 16/16 (modalDocTypeName/modalDocLabel/modalDate/modalRefNoBox/modalTaxInvBox/modalPoRowBlock/modalCategory/modalSystemRecordNo/modalSender/modalSource/modalDocTypeBadge/modalSupplierTitle/modalDocTitleText/modalDocTitleGuess/modalHiddenDocNos/modalDateFallbackBadge) → openDetailItem/applyDocTypeVisibility/JS เดิมทำงานเหมือนเดิม 100%
- **Check:** node --check script index.html EXIT=0 | FFFD=0 | กล่องการ์ดใน SECTION 1 เหลือ 0 | ดูผลจริงในพรีวิว (ดีไซน์ข้อความเพียวตามที่ขอ) | badge v3.20.2→v3.20.3
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว (Code.gs/SQL ไม่แตะ)

## [2026-09-25] 🔢 v3.20.4 — "ข้อมูลหลักเอกสาร" เรียงช่องตามความสำคัญ (User: "เรียงข้อมูลตามความสำคัญ")

- **คำขอ User:** เรียงช่องในส่วนข้อมูลหลักเอกสาร (ดูบิลเต็ม) ตามความสำคัญ
- **แก้ (index.html — SECTION 1):** ยุบ 2 กริด (กริดหลัก 4 ช่อง + กริด Matrix 6 ช่อง) เป็นกริดเดียว grid-cols-2 md:grid-cols-4 gap-4 พร้อมจัดลำดับใหม่ตามความสำคัญ:
  1. ประเภทเอกสาร  2. เลขที่เอกสาร  3. วันที่เอกสาร  4. เลขใบกำกับภาษี  5. เลขที่ PO  6. เลขอ้างอิง  7. หมวดหมู่  8. เลขที่รายการระบบ  9. ผู้ส่งบิล (LINE)  10. แหล่งที่มา
- **เหตุผลการเรียง:** ตัวตนเอกสาร (ประเภท/เลขที่/วันที่) → เลขที่ใช้ทางบัญชีและจับคู่ (กำกับภาษี/PO) → เลขอ้างอิง → การจำแนก (หมวดหมู่) → รหัสระบบ → ข้อมูลตรวจสอบย้อนหลัง (ผู้ส่ง/แหล่งที่มา)
- **พฤติกรรม:** ช่องที่ซ่อนตามประเภทเอกสาร (modalTaxInvBox/modalPoRowBlock = display:none) ไม่กินช่อง ในกริด → กริดไหลอัตโนมัติ ไม่มีช่องว่าง (ยืนยันในพรีวิว: ใบสั่งซื้อ/ใบชั่งไม่มีเลขกำกับ ก็เรียงชิด)
- **ไม่แตะ:** ID ครบ 16/16 + JS ไม่แตะเลย (openDetailItem/applyDocTypeVisibility เดิม)
- **Check:** node --check script index.html EXIT=0 | FFFD=0 | ลำดับใน DOM ตรงตามที่กำหนด (ตรวจจาก index.html + พรีวิว) | badge v3.20.3→v3.20.4
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว

## [2026-09-25] 🪟 v3.20.5-7 — 🚨 แก้โครงหน้าต่างแก้ไขพัง + รวมเป็น "หน้าต่างเดียว" 2 โหมด (User: "กด แก้ไขข้อมูล & รูปภาพ ก็เปิดให้แก้ไขได้เลย ทำไมต้องสลับหน้าตาไปมา วุ่นวาย")

- **🐛 อาการที่ User แจ้ง:** กด "แก้ไขข้อมูล & รูปภาพ" แล้วเลย์เอาต์พัง
- **✅ ต้นตอจริง (เจอด้วยการวัดกล่องในพรีวิว ไม่ใช่ดูด้วยตา):** คอลัมน์ซ้ายของหน้าต่างแก้ไข "ปิด div เร็วเกินไป" — ปิดก่อนหน้าแผงเครื่องมือแก้ไขรูป ทำให้ `<div class="bg-white border-t ... p-2.5">` หลุดออกมาเป็น flex sibling ของ flex row → วัดได้: คอลัมน์ซ้าย 576px / **แผงเครื่องมือ 288px (ยืดเต็มความสูง 900px)** / ฟอร์มขวาถูกบีบเหลือ 577px (ควรได้ ~58%=835px) | และปุ่มซูมลอย (absolute) เกาะขอบ modal ไม่ใช่ขอบรูป → ลอยทับแผงเครื่องมือ
- **แก้:** (1) ย้าย `</div>` ปิดคอลัมน์ซ้ายไปไว้ "หลัง" แผงเครื่องมือ (2) ย้ายปุ่มซูมลอยเข้าไปในเวทีรูป (3) ลบคอมเมนต์ v3.20.1 ที่ทำให้เข้าใจผิด — ตรวจซ้ำด้วยตัวนับแท็ก div + วัดกล่องจากพรีวิวจริง
- **🪟 รวมเป็นหน้าต่างเดียว (คำขอหลักของ User):** ไม่มี modal ที่สองอีกต่อไป
  1. `mergeEditPaneIntoDetail()` — ย้ายแผงโหมดแก้ไข (คอลัมน์รูป canvas + ฟอร์ม) เข้ามาเป็นแผงที่สองของ #detailModal ตั้งแต่โหลดหน้า แล้ว `.remove()` กล่อง #editModal ทิ้ง — **ID/ปุ่ม/คำสั่งเดิมทั้งหมดยังใช้เหมือนเดิม (ย้ายทั้งก้อน ไม่เขียนใหม่)**
  2. `setDetailMode('view'|'edit')` — สลับแผง + สลับชุดปุ่มบน **แถบหัวเดียวกัน**: โหมดดู = [แก้ไขข้อมูล & รูปภาพ] / โหมดแก้ไข = [อ่านใหม่ (AI)] [ยกเลิก] [บันทึกการแก้ไข] + ป้ายโหมดเปลี่ยนสี-ข้อความในตำแหน่งเดิม (emerald ↔ amber) + Matrix Code อยู่ที่เดิม + ซ่อนแท็บ ข้อมูล/จับคู่ และแสดงตัวตนบิล ในโหมดแก้ไข
  3. ปุ่ม "แก้ไขข้อมูล & รูปภาพ" → **ไม่ปิดหน้าต่างเดิม/ไม่เปิดใหม่** แค่ `setDetailMode('edit')` | "ยกเลิก" → `setDetailMode('view')` (กลับโหมดดูข้อมูลในหน้าต่างเดิม) | เปิดบิลใหม่ → เริ่มที่โหมดดูเสมอ
  4. หลัง "บันทึกการแก้ไข" สำเร็จ → กลับโหมดดูข้อมูลแล้ววาดค่าล่าสุดลงแผงดูข้อมูลให้ทันที (เดิมต้องปิดแล้วเปิดบิลใหม่)
  5. ปรับหน้าตาโหมดแก้ไขให้ตรงกับโหมดดู: คอลัมน์ซ้าย 42% สี/ขอบเดียวกัน, แถบหัวคอลัมน์รูปใช้ไอคอน+หัวข้อเดียวกับโหมดดู, แผงเครื่องมือใช้หัวข้อ/ไอคอนเดียวกัน, และ **เลิกใช้การ์ด light-panel ทั้ง 4 หมวด** (พืนเรียบเหมือน SECTION ของโหมดดู) — ต่างกันแค่ช่องกรอกแก้ได้
  6. ปุ่ม "อ่านใหม่ (AI)" ย้ายมาอยู่แถบหัวของหน้าต่างเดียว (เห็นเฉพาะโหมดแก้ไข) — กดแล้ว AI อ่านรูปใหม่แล้วเติมค่าลงช่องกรอกทุกช่อง + ไฮไลต์ช่องที่เปลี่ยน (emReanalyzeIntoForm/emFillFormFromAi — เติมเฉพาะช่องที่ AI อ่านได้ ค่าว่าง = คงค่าเดิม)
- **Check:** `node --check` script index.html EXIT=0 | FFFD=0 | ID ซ้ำภายในไฟล์ = ไม่มี | แท็ก div ทั้งสองหน้าต่างบาลานซ์ | ลองกดจริงในพรีวิว: ดูข้อมูล → กดแก้ไข → สลับโหมดในหน้าต่างเดิม (ป้าย/ปุ่ม/แผงถูกต้อง) → กดยกเลิก → กลับโหมดดู | badge v3.20.5, v3.20.6, v3.20.7
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว (Code.gs/SQL ไม่แตะ)

## [2026-09-25] 🪟 v3.21.0 — หน้าต่างเดียว "หน้าตาเดียว": ยกช่องกรอกมาทับช่องข้อมูลเดิม (User: "ให้ใช้โหมดดูข้อมูลเลย เมื่อกดแก้ไข แค่เปลี่ยนให้มันเป็นฟิลด์ที่แก้ได้ ไม่ต้องสลับโหมด")

- **คำขอ User:** เลิกสลับ "โหมดดูข้อมูล ↔ โหมดแก้ไขข้อมูล" (v3.20.7 ยังสลับแผงอยู่) — ให้ใช้โครงโหมดดูข้อมูลเป็นหลัก แล้วตอนกดแก้ไข "ช่องข้อมูลเดิมกลายเป็นช่องกรอก" ในตำแหน่งเดิม
- **แนวทางที่เลือก:** ไม่คัดลอก markup / ไม่สร้าง ID ซ้ำ — ใช้ node เดิม "ย้าย" จากกล่อง #editModal มาวางทับตำแหน่งของช่องข้อมูลในแผงดูข้อมูล แล้วสลับแค่ชั้นการแสดงผล
  - CSS (สไตล์ก้อนที่ 2): `#detailModal.mode-edit .mode-view{display:none!important}` + `#detailModal:not(.mode-edit) .mode-edit{display:none!important}` → ไม่ทับการซ่อนตามเงื่อนไข (.hidden) ของแต่ละโหมด
  - `mergeEditPaneIntoDetail()` → **`mountEditControlsIntoView()`** (แทนที่ ไม่ได้เพิ่มซ้อน): ติดป้าย `.mode-view` ให้ค่าเดิม (ที่ถูกแทน) + `.mode-edit` ให้ช่องกรอกที่ย้ายมา แล้ว `.remove()` กล่อง #editModal ทิ้ง
    1) หัวคอลัมน์รูป: ย้าย `emStatus` + ป้าย "แก้ไขรูปได้" (สร้างสด) / 2) สเตจรูป: `modalImage`+แถบซูมดู ↔ `emImageStage` (canvas+กรอบครอป emCropOverlay) + `emPlaceholder` + แถบซูม emZoom
    3) แผงเครื่องมือ: แผงพรีวิวดูบิล ↔ แผงแก้รูปจริง (หมุน/พลิก/ครอป/รีเซ็ต + emBrightness)
    4) ช่องหลัก 10 ช่อง: ประเภทเอกสาร→editDocTypeSelect, เลขที่เอกสาร→editDocNoInput(+editBookBox), วันที่→editDateInput, "เลขอ้างอิง"→editRefNoBox+editRefLabelBox (ในช่องเดิม), หมวดหมู่→editCategorySelect, เลขใบกำกับภาษี→editTaxInvoiceBox, เลขที่ PO→editPoInput (ย้ายเป็นช่องใหม่ในกริดเดียวกัน เพราะกล่องเดิมซ่อนเมื่อไม่มีค่า), ชื่อร้าน→editStoreInput
    5) การ์ดข้อมูลสั่งซื้อ/งาน + การ์ดใบชั่ง: ค่าเดิม 8 ช่องกลายเป็นช่องกรอกในช่องเดิม (editCompanyInput/editJobInput/editRequesterInput/editPayApproverInput + editVehicleInput/editWeightIn-Out-NetInput)
    6) ตารางรายการสินค้า: ตารางอ่านอย่างเดียว ↔ ตารางแก้ไขได้ (editItemsBody + ปุ่ม "เพิ่มรายการ" + ป้ายจำนวน ในหัวการ์ดเดียวกัน)
    7) หมายเหตุ: modalRemarksBox ↔ editRemarkInput / 8) การ์ดยอดรวม: บล็อกอ่านอย่างเดียว ↔ editTotalInput + สรุปยอด (editItemsSum/editTotalDiff/editTotalBahtText) / 9) กล่อง "+ เพิ่มประเภทเอกสารใหม่" + กล่องอธิบายการบันทึก (โชว์เฉพาะโหมดแก้ไข)
  - `setDetailMode(mode)`: เลิกสลับแผง — สลับ `#detailModal.classList('mode-edit')` + ป้ายโหมด/ชุดปุ่ม/ซ่อนแท็บเดิม + `showDetailTab('info')` เมื่อเข้าโหมดแก้ไข + fit ซูมรูปใหม่ตอนสลับกลับ
  - Cascading: `toggleScaleFields()` ซิงก์การ์ดใบชั่ง (`modalScaleInfo`) / `applyEditDocTypeVisibility()` ซิงก์การ์ดข้อมูลสั่งซื้อ (`modalPoFields`) ให้เป็นกล่องเดียวกับที่ตามองเห็นจริง / `closeModal()` กลับโหมดดูข้อมูลก่อนปิด
- **🧩 ยุบการ์ดข้อมูลซ้ำ (User: "ลูกค้า / บริษัท / ผู้เบิก ก็คือชื่อบริษัท (ผู้สั่งซื้อ) นี่ — ทำไมต้องมี 🏢/🚧/🙋/💳 แยกอีกละ งง"):** ลบการ์ด "ข้อมูลสั่งซื้อ/งาน" (`#modalPoFields`) ที่ซ้ำทั้งใบ แล้วยกช่อง 4 ตัว (🏢 ชื่อบริษัท (ผู้สั่งซื้อ) / 🚧 งาน / โครงการ / 🙋 ผู้เบิก / 💳 ผู้สั่งจ่าย) พร้อมป้ายกำกับ "ไปอยู่ในการ์ด ลูกค้า / บริษัท / ผู้เบิก" แทน (2 คอลัมน์บนมือถือ/จอกว้าง) — ข้อมูลตัวตนบิลอยู่ที่เดียวจบ
  - ลบช่องที่ไม่ใช้แล้ว: `modalBuyerName` / `modalBuyerMeta` / `modalBuyerRequester` / `modalBuyerPayApprover` / `modalBuyerAddress` / `modalPoStoreName` (openDetailItem เติมค่าบริษัท/งาน/ผู้เบิก/ผู้สั่งจ่ายแบบ "ทุกใบ" ทางช่องเดิม modalCompanyName/modalJobName/modalRequester/modalPayApprover + ลบ logic ซ่อน/โชว์การ์ดทั้งกล่อง + ลบซิงก์ใน applyEditDocTypeVisibility)
  - ช่องกรอกโหมดแก้ไขตามไปโดยอัตโนมัติ (editCompanyInput/editJobInput/editRequesterInput/editPayApproverInput อยู่การ์ดเดียวกัน ตำแหน่งเดิม)
  - เปลี่ยนหัวการ์ดตามคำสั่ง User ต่อมา ("ลูกค้า / บริษัท / ผู้เบิก แก้เป็น ชื่อบริษัท (ผู้สั่งซื้อ) ได้มั๊ย"): หัวการ์ด = **ชื่อบริษัท (ผู้สั่งซื้อ)** + คำใบ้ด้านขวา "ผู้ซื้อ / ผู้ว่าจ้าง" และตัดป้าย 🏢 ที่ซ้ำหัวการ์ดออก → ชื่อบริษัทเป็นบรรทัดหลักใต้หัวการ์ด (สไตล์เดียวกับการ์ดผู้ขาย) แล้วตามด้วย 🚧 งาน/โครงการ (เต็มแถว) + 🙋 ผู้เบิก | 💳 ผู้สั่งจ่าย
  - ตรวจในพรีวิว: #modalPoFields = ไม่มีแล้ว | สลับโหมด ดู→แก้→ดู ช่องกรอกชุดนี้ hidden/visible ถูกต้อง (การ์ดอ่าน: ชื่อบริษัท (ผู้สั่งซื้อ) | ผู้ซื้อ / ผู้ว่าจ้าง | บริษัท… | 🚧 งาน/โครงการ | โครงการหนองบัว | 🙋 ผู้เบิก | วิชัย | 💳 ผู้สั่งจ่าย | สมศักดิ์)
- **🧹 แก้เลย์เอาท์ "ข้อมูลหลักเอกสาร" ตอนเข้าโหมดแก้ไข (User: "เวลาเข้าโหมดแก้ เลย์เอาท์มั่วมาก"):** ต้นตอ = ตอน mount ยก "กล่องฟอร์ม" ที่มีทั้งขอบ+ป้ายกำกับของตัวเองมาทั้งกล่อง (เลขใบกำกับภาษี/เลขที่ PO/เล่มที่/ชื่อเรียกเลขอ้างอิง) → ในกริดเลยมีป้ายซ้ำกับหัวช่องเดิม + กล่องซ้อนในกล่อง + ความสูงช่องไม่เท่ากัน (grid row สูงตามกล่องที่สูงสุด → โหว่เป็นหย่อม)
  - เปลี่ยน `moveIntoNewCell()` → **`labelCell(label, anchor, input)`** สร้างช่องใหม่สไตล์เดียวกับโหมดดูข้อมูล (ป้าย `text-slate-500 block text-[11px] mb-1` + ช่องกรอก `ui-input w-full`) แล้วย้ายมาแค่ "ตัว input"
  - เลขอ้างอิง: วาง input ต่อท้ายป้าย "เลขอ้างอิง" เดิมในช่องเดิม (ไม่สร้างกล่องซ้อน) / เล่มที่ + ชื่อเรียกเลขอ้างอิง: ต่อท้ายกริดเป็นแถวสุดท้าย / เลขใบกำกับภาษี + เลขที่ PO: ช่องใหม่หน้าตาเดียวกัน และ "มีให้กรอกเสมอ" ในโหมดแก้ไข (เดิมถูกซ่อนทั้งช่องเมื่อไม่มีค่า → เติมเลข PO/กำกับภาษีทีหลังทำไม่ได้)
  - วัดผลจากพรีวิว (โหมดแก้ไข): กริด 4 คอลัมน์เท่ากัน (161.99px × 4) ทุกช่องสูงเท่ากัน 58/58/54px — แถว 1: ประเภท/เลขที่/วันที่/กำกับภาษี, แถว 2: PO/เลขอ้างอิง/หมวดหมู่/เลขที่รายการระบบ, แถว 3: ผู้ส่งบิล/แหล่งที่มา/เล่มที่/ชื่อเรียกเลขอ้างอิง | โหมดดูข้อมูลยังเหมือนเดิมทุกช่อง (36px/แถว)
- **🖇️ จัดกริด "ข้อมูลหลักเอกสาร" ใหม่เป็น 2 คอลัมน์ตามที่ User ระบุ:** ซ้าย = เลขที่รายการระบบ → ประเภทเอกสาร → หมวดหมู่ → ผู้ส่งบิล (LINE) → แหล่งที่มา | ขวา = วันที่เอกสาร → เลขที่เอกสาร → เลขที่ PO → เลขอ้างอิง → เลขใบกำกับภาษี
  - โครงใหม่: กล่องรวม `div.space-y-4` + แต่ละแถวเป็น `grid sm:grid-cols-2 gap-x-6` (จับคู่ซ้าย|ขวาเป็นแถวเดียวกัน) → **ป้ายซ้าย-ขวาตรงกันทุกแถว** (เดิมทำเป็น 2 stack อิสระ → แถวไม่ตรงกัน ดูมั่ว)
  - เล่มที่ / ชื่อเรียกเลขอ้างอิง (ช่องที่โหมดดูไม่มี) → เปลี่ยนจาก "ต่อเป็นแถวใหม่" มาเป็น **ช่องย่อยในช่องที่เกี่ยวข้อง** (`subField()`): เล่มที่อยู่ใต้เลขที่เอกสาร, ชื่อเรียกเลขอ้างอิงอยู่ใต้เลขอ้างอิง
  - จุดเกาะของกล่อง "+ เพิ่มประเภทเอกสารใหม่" เปลี่ยนจาก `closest('div.grid')` (ที่ตอนนี้กลายเป็นกริดแถว) → `closest('div.space-y-4')` = กล่องรวมกริด
  - ตรวจพรีวิว: โหมดดู 5 แถวตรงกัน (178/230/282/334/386px) | โหมดแก้ 5 แถวตรงกัน เหมือนกันทุกคอลัมน์ | สลับ ดู→แก้→ดู ไม่เพี้ยน
- **📐 แถบหัวหน้าต่างบิลสูงไม่เท่ากัน (User: "ส่วนหัว รูปภาพบิลต้นฉบับ กับ โหมดดูข้อมูล มันสูงไม่เท่ากัน"):** วัดจริง ฝั่งซ้าย 55px / ฝั่งขวา 95px — ต้นตอ = `#detailModalTabsRow` เป็น `flex-wrap` แล้วของเกินความกว้าง 734px เลยขึ้นบรรทัดที่ 2 (โหมดแก้ยิ่งหนัก: ป้าย + Matrix Code + ตัวตนบิล 200px + ปุ่ม 3 ปุ่ม 302px)
  - 🔎 **เจอปัญหาซ้อนที่ต้องรู้:** คลาสที่ใช้ (`lg:h-14`, `lg:py-0`, `lg:flex-nowrap`, `sm:flex`, `xl:inline`, `xl:flex`, `gap-x-6`, `gap-y-4`, `gap-y-5`, `border-amber-100`, `max-w-[220px]`) **ไม่มีใน CSS บิลด์ของโปรเจกต์** — ถ้าไม่เติมจะ "หายเงียบ" (เช่น `sm:flex` หาย → ป้าย Matrix Code หายทั้งอัน) → เติมเองท้ายสไตล์ก้อนที่ 2 แบบเดียวกับที่โปรเจกต์เคยเติม `.w-52`/`.lg\:w-\[42\%\]` แล้วเปลี่ยน `border-amber-100`→`border-amber-200` และ `max-w-[220px]`→`max-w-[200px]` (มีอยู่แล้ว) เพื่อลดคลาสใหม่
  - แก้: ล็อกความสูงทั้งสองแถบ `lg:h-14 lg:py-0` + `lg:flex-nowrap` | ป้ายโหมด/Matrix Code/แท็บ/ปุ่ม เป็น `shrink-0` | คำว่า "Matrix Code:" โชว์เฉพาะ `xl` (chip ยังอยู่ทุกจอ) | คำอธิบายแท็บจับคู่ ห่อ `hidden xl:flex` + `truncate max-w-[200px]` | **ย้ายตัวตนบิล (`editOriginInfo2`) ออกจากแถบหัว** ไปเป็นแถบเล็ก amber ใต้แถบหัว (`.mode-edit`) | ปุ่ม "เต็มขนาด" เพิ่ม `whitespace-nowrap` (ไม่ให้ตกบรรทัดบนมือถือ)
  - ตรวจพรีวิว: 1265px = 56/56px (ทั้งโหมดดู/แก้) ไม่มี overflow | 1025px = 56/56px ไม่ clip | 1441px = 56/56px และโชว์ label Matrix Code + คำอธิบายแท็บ | 390px การ์ดซ้อนตามแนวตั้งปกติ
- **🐛 บั๊กแถมที่เจอระหว่างทาง:** `openDetailItem()` เขียน `document.getElementById('modalPoStoreName')` แต่ ID นี้ไม่มีในโครง markup → TypeError ทำ "เปิดบิลไม่ขึ้น" ทั้งบิลที่เป็นใบสั่งซื้อ/มีการ์ดข้อมูลสั่งซื้อ — แก้เป็น null-guard
- **Check:** syntax script index.html EXIT=0 | FFFD=0 | ID ซ้ำ = ไม่มี | ID ที่ mount อ้างถึง 33 ตัว มีใน markup ครบ 33/33 | พรีวิว (node tmp_build_detail_preview.js): กดดูข้อมูล → แก้ไข → กลับ 3 รอบ จำนวนช่อง/ชั้น .mode-view(24)/.mode-edit(33) คงที่ ไม่มี error + ตรวจด้วยตา 3 ตัวอย่าง (ใบกำกับภาษี/ใบสั่งซื้อ/ใบชั่ง — ช่องกรอกอยู่ตำแหน่งเดิมทุกช่อง) | badge v3.20.7→v3.21.0
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว (Code.gs/SQL ไม่แตะ) | ⚠️ #editModal ยังอยู่ในไฟล์เป็น "ต้นทาง" ของช่องกรอก (ถูก `.remove()` ทุกครั้งตอนโหลดหน้า) — ห้ามลบ markup ก้อนนี้ทิ้ง หรือใช้เป็นหน้าต่างที่สองอีก

## [2026-09-25] 📏 v3.21.4 — "ป้าย + ค่า" อยู่บรรทัดเดียวกันทั้งฝั่งซ้าย-ขวา + 🐛 คอมเมนต์กลืนการ์ดผู้ขาย

- **คำขอ User:** "ข้อมูลหลักเอกสาร: กับ ชื่อบริษัท (ผู้สั่งซื้อ): ป้าย กับส่วนแสดงข้อมูลให้มันอยู่บรรทัดเดียวกันได้มั๊ย ทั้งสองฝั่งซ้าย ขวา"
- **สิ่งที่พบก่อนแก้ (วัดจากพรีวิวจริง):** กริด "ข้อมูลหลักเอกสาร" เป็น `grid md:grid-cols-2` ที่มีลูกเดียว → เนื้อหายืดแค่ **ครึ่งซ้ายของการ์ด** (336px จาก 696px) → ช่องแคบ 156px ต่อช่อง (ที่เหลือว่างเปล่าทางขวา) และแต่ละช่องยังเป็น "ป้ายบรรทัดบน + ค่าบรรทัดล่าง"
- **แนวทาง:** ทำ "ช่องแบบบรรทัดเดียว" กลาง ๆ ใช้ร่วมทุกที่ — `.matrix-row` (ป้ายซ้ายกว้างคงที่ + ค่าขวา) ใช้ทั้งโหมดดูข้อมูล (span `.matrix-value`) และโหมดแก้ไข (`input/select.ui-input` ที่ mount เข้ามาในแถวเดียวกัน)
  - CSS ใหม่ (สไตล์ก้อนที่ 2): `.matrix-row:not(.hidden){display:flex;align-items:baseline;gap:.5rem;min-width:0}` + `.matrix-row > .matrix-label{flex:0 0 auto;width:7.5rem;color:#64748b;font-size:11px}` + `.matrix-row > .matrix-value{flex:1 1 auto;min-width:0}` + `.matrix-row > .ui-input{flex:1 1 auto;min-width:0}` + `.matrix-row > select.ui-input{height:2.125rem}`
  - ใช้ `:not(.hidden)` สำคัญ: เลขที่ PO / เลขใบกำกับภาษี ถูก JS สั่งซ่อนด้วย `.hidden` — ถ้าเขียน `display:flex` ตรง ๆ จะชนะ `.hidden` แล้วโชว์ช่องว่างทุกใบ
  - 🧩 **คลาสที่ Tailwind บิลด์ชุดนี้ไม่มีอีก 2 ตัว:** `.break-words` + `.items-baseline` (คลาสหายเงียบเหมือนรอบ v3.21.3) → เติมให้ในบล็อกเดียวกัน
  - ป้ายหดลงช่วงจอแคบ (แต่ยังบรรทัดเดียว): `@media (min-width:640px) and (max-width:1023px){.matrix-row > .matrix-label{width:6.5rem}}`
- **index.html — markup:** เปลี่ยนทุกช่องของ 2 ส่วนนี้เป็น `.matrix-row`
  - "ข้อมูลหลักเอกสาร": เลิกกริดซ้อน 2 ชั้น (ลบ `md:grid-cols-2` ตัวนอกทิ้ง) → กล่องรวม `#modalInfoGrid` ใช้เต็มความกว้างการ์ด แต่**คงแต่ละแถวเป็นกริด 2 คอลัมน์ (ซ้าย | ขวา)** เหมือนเดิม → ซ่อนช่องใดช่องหนึ่ง (เลขที่ PO / เลขใบกำกับภาษี) คอลัมน์อื่นไม่เลื่อน (ที่สำคัญ: ถ้าเปลี่ยนเป็นกริด 10 ช่องรวด `display:none` ของช่องที่ซ่อนจะดึงช่องถัดไปขยับคอลัมน์)
  - ช่องที่มีของแถม (วันที่รอตรวจ / ชื่อเอกสารที่ AI อ่าน / "บันทึกเพิ่ม" / AI เดาจากองค์ประกอบใบ) → ตัวป้าย+ค่าอยู่บรรทัดเดียว ส่วนของแถมอยู่บรรทัดล่างในเซลล์เดิม (ไม่ไปแย่งที่)
  - การ์ด "ชื่อบริษัท (ผู้สั่งซื้อ)": 🚧 งาน / โครงการ, 🙋 ผู้เบิก, 💳 ผู้สั่งจ่าย ใช้ `.matrix-row` เหมือนกัน และเปลี่ยนจาก 2 คอลัมน์ → **บรรทัดละช่อง** (การ์ดกว้างครึ่งเดียว ป้าย 120px + ค่า จะไม่เหลือที่)
  - การ์ดคู่ผู้ขาย/ผู้ซื้อ: `md:grid-cols-2` → `xl:grid-cols-2` (≥1280) — จอแท็บเล็ตหน้าต่างบิลถูกแบ่งครึ่งให้รูปอยู่แล้ว ถ้าฝืน 2 การ์ดติดกัน "ค่าบรรทัดเดียว" จะเหลือที่ให้ค่าแค่หลักสิบ px | `xl:grid-cols-2` ก็ไม่มีในบิลด์ → เติม CSS ให้
- **index.html — JS (`mountEditControlsIntoView`):** `labelCell()` + `subField()` เปลี่ยนจาก "ป้ายบน + ช่องกรอกล่าง" → สร้าง `.matrix-row` "ป้าย + ช่องกรอก" บรรทัดเดียว; เลขอ้างอิงเปลี่ยนจาก `refCell.appendChild(editRefNoInput)` → `set('modalRefNoBox','editRefNoInput')` (ของเดิมช่องกรอกตกไปบรรทัดใหม่เพราะต่อท้าย "เซลล์" ไม่ใช่ "แถว"); จุดเกาะกล่อง "+ เพิ่มประเภทเอกสารใหม่" เปลี่ยนเป็น `#modalInfoGrid` (id ใหม่ ชัดกว่าการเดาจากคลาส `space-y-4`)
- **🐛 บั๊กใหญ่ที่เจอตอนตรวจ (เกิดจากงานรอบนี้เอง — แก้แล้ว):** คอมเมนต์ใหม่ท้าย SECTION 2 ปิดด้วย `*/` แทน `-->` → เบราว์เซอร์กลืน **การ์ด "ชื่อร้าน / ผู้ออกเอกสาร" ทั้งใบ** (และตัวห่อการ์ดคู่/`.bg-white`) เป็นคอมเมนต์ → ในหน้าจริงผู้ขายหายไปทั้งการ์ด (หา ID `modalSellerName` ไม่เจอ) — เจอเพราะเช็คว่า id ที่ควรมีกลับ `getElementById` ไม่เจอ
  - เพิ่มเครื่องมือกันซ้ำ: `tmp_check_nesting.js` (เดิน stack ของ tag + ตรวจ "id ที่ถูกคอมเมนต์กลืน" + สายพ่อ-แม่ของ id ที่สนใจ) และ `tmp_check_syntax.js` (syntax/FFFD/id ซ้ำ/id ที่อ้างแล้วไม่มี)
- **ตรวจพรีวิวจริง (1400 / 1280 / 1024 / 768 / 500px × โหมดดู/แก้ × ตัวอย่าง ใบกำกับภาษี/ใบสั่งซื้อ/ใบชั่ง):** ทุกช่องป้าย+ค่าอยู่บรรทัดเดียวกัน (ต่างกัน ≤ 10px) | ป้ายไม่ตัดบรรทัด | ค่าไม่แคบกว่า 60px | ไม่มี overflow แนวนอนในแผงข้อมูล | จำนวนช่องต่อแถว 2-2-2-2-2 (ใบกำกับภาษี) / 2-2-2-2-1 (ใบสั่งซื้อ ไม่มีเลขกำกับภาษี) / 2-2-1-2-1 (ใบชั่ง ไม่มี PO และเลขกำกับภาษี) — คอลัมน์ไม่เลื่อน | การ์ดคู่: ≥1280 = 2 คอลัมน์ (344px การ์ด) / <1280 = ซ้อน (556px) | edit: ช่องกรอกทุกตัวอยู่ใน `.matrix-row` เดียวกับป้าย (วัด dy ≈ 9px = กึ่งกลางกล่องกรอก) | console error = 0
- **ที่ยังเหลือ (ไม่กระทบคำขอนี้):** จอ ≤500px แถบหัว "ข้อมูลหลักเอกสาร:" ยังล้นแนวนอน ~31px (สาเหตุคือหัวข้อ + ป้าย + ชื่อผู้ขายในแถบเดียว ไม่ใช่ช่องข้อมูล) และยังมีคลาสที่ markup ใช้แต่หายจาก CSS อีก ~31 ตัว (เช่น `h-3`, `w-20`, `shadow-xl`, `md:p-6`)
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว | badge v3.21.0 → **v3.21.4**

## [2026-09-25] 🕒 v3.21.5 — "modalTimestamp" ยังต้องมีไหม → เก็บไว้ แต่ตัดวันที่ซ้ำ

- **คำถาม User:** "id=\"modalTimestamp\" ยังจำเป็นต้องมีอยู่มั้ยครับ"
- **ตรวจสอบก่อนตอบ (ไม่ได้เดา):**
  - `index.html` (เดิม 943) = `<span id="modalTimestamp">` อยู่ในหัวข้อย่อย "🛠️ เครื่องมือปรับแต่งรูปภาพ" (ฝั่งขวา หลังปุ่ม Fit)
  - `index.html` (เดิม 5358) ใน `openDetailItem()` เติมข้อความ `วันที่ในบิล: … | บันทึก: … [| ⚠️ รอตรวจ: เหตุผล]`
  - grep ทั้งไฟล์: มีแค่ 2 จุดนี้ที่อ้าง ID → **ไม่ใช่โค้ดตาย ยังทำงานอยู่จริง**
- **ตรวจการซ้ำซ้อน (เทียบกับที่แสดงใน "โหมดดูข้อมูล"):** วันที่ในบิล → ซ้ำกับช่อง `modalDate` (แถว "วันที่เอกสาร") อยู่แล้ว | เวลาที่บันทึก (timestamp) → ไม่มีที่อื่นแสดงในโหมดดู (มีแค่โหมดแก้ไข `originTxt` + tooltip การ์ดลิสต์) | ⚠️ รอตรวจ + เหตุผล → ในโมดัลโหมดดูมีแค่ที่นี่
- **User เลือก:** เก็บไว้ แต่ตัดวันที่ซ้ำออก
- **แก้ (index.html):** `tsText` เหลือ `'บันทึก: ' + formatRecordDateTime(item.timestamp) + (needs_review ? ' | ⚠️ รอตรวจ: …' : '')` — ไม่แตะ markup/CSS (span เดิม + `truncate` + `title` ยังใช้ได้เหมือนเดิม) | เพิ่มคอมเมนต์อ้าง User ที่จุด markup + จุด JS
- **ซิงก์ harness:** `tmp_preview_detail_mock.js` (บรรทัด ~339) แก้ข้อความ mock ให้ตรงกัน (ตัด "วันที่ในบิล") แล้ว `node tmp_build_detail_preview.js` ใหม่
- **Check:** `tmp_check_syntax.js` EXIT=0 (syntax OK / FFFD=0 / ID ซ้ำ=0) | `tmp_check_nesting.js` EXIT=0 (tag ค้าง 0 / ไม่มี tag ปิดไม่ตรง / ไม่มี id ถูกคอมเมนต์กลืน) | พรีวิวจริง: `modalTimestamp.innerText` = "บันทึก: …" ถูกต้อง + `title` ตรงกัน + ไม่ทับป้ายซ้าย (`overlap=false`) + `overflowX=0` | ทดสอบข้อความยาว (บันทึก + ⚠️ รอตรวจ + เหตุผลยาว) → ยัง `ellipsis/nowrap` หดพอดีกล่อง ไม่ล้นแถบ
  - 🔎 **พบเพิ่ม (ไม่ใช่บั๊ก แต่ควรรู้):** คลาส `max-w-[55%]` ยังไม่มีใน CSS บิลด์ (`getComputedStyle().maxWidth = none`) — แต่ทรงยังถูกต้องเพราะกล่องเป็น flex + `min-w-0` + `truncate` จึงหด/ตัดคำเองได้ ไม่ต้องเติม CSS
- **สถานะ:** ✅ เสร็จ — ⚠️ REDEPLOY index.html อย่างเดียว (Code.gs/SQL ไม่แตะ) | badge v3.21.4 → **v3.21.5**

## [2026-09-25] 🧾 v3.21.6 — เพิ่มประเภทเอกสารมาตรฐาน "ใบส่งของ/ใบแจ้งหนี้" (DO/INV)

- **ที่มา:** User — "เอกสารสำหรับ AI จะไม่มีประเภทเอกสาร ใบส่งของ / ใบแจ้งหนี้" (ต้องการประเภทรวม 1 ใบเป็นทั้งใบส่งของและใบแจ้งหนี้ — ระบบเดิมมี DO กับ INV/BILL แยกกัน และมี DO/TAX แต่ไม่มี DO/INV) — User เลือกทาง "เพิ่มประเภทใหม่"
- **แก้ (3 ไฟล์):
  1. **Code.gs:** DOC_KNOWLEDGE_BASE เพิ่ม KB ใหม่ (type='ใบส่งของ/ใบแจ้งหนี้', code='DO/INV', group='Delivery & Site Operations', money_doc=true, delivery_document+billing_document=true, focus กันสับสนกับใบกำกับภาษี/หลักฐานรับเงิน) — buildStandardFieldConfig (po_number/ref_no เปิด, tax_invoice_no ปิด) + buildStandardPromptText focus เฉพาะประเภท | normalizeDocType แทรก pattern /ส่งของ.*(แจ้งหนี้|วางบิล)|…/ ก่อน /วางบิล|แจ้งหนี้/ และก่อน /ส่งของ/ เดิม (ทดสอบ 6 เคสผ่าน รวมไม่กลืน DO และ INV/BILL เดิม) | classifyDocumentType: เพิ่มรหัส DELIVERY_INVOICE_BILLING ในเกณฑ์+typeMap | buildUniversalOcrPrompt: เพิ่มรหัสในลิสต์ที่อนุญาต + adaptUniversalOcrResult typeMap
  2. **index.html:** ACCOUNTING_DOC_TYPES เพิ่มแถว DO/INV (ต่อจาก DO, vat='เอกสารเรียกเก็บเงิน…' badge สีเหลือง/amber ตามสิทธิ์) | getAccountingDocTypeLoose เพิ่ม pattern จับชื่อพ้องบนใบ | ฟอร์มแก้ไข editDocTypeSelect เพิ่ม option | renderFieldMatrixTable: po_number='M' + items='M' + total_amount='M' สำหรับ DO/INV | badge v3.21.5→v3.21.6
  3. **supabase_setup_all.sql:** seed doc_types เพิ่มแถว ('ใบส่งของ/ใบแจ้งหนี้','DO/INV','Delivery & Site Operations', sort_order=85, aliases=['Delivery Order / Invoice','ใบส่งของ/ใบวางบิล'])
- **ไม่ต้อง migrate ข้อมูลเดิม:** บิลเก่าที่เคยถูกจำแนกเป็น DO/INV/BILL คงเดิมทุกอย่าง — ประเภทใหม่ใช้กับบิลที่ AI อ่านใหม่/คนแก้เองเท่านั้น
- **หน้าที่ประเภทใหม่โผล่อัตโนมัติ:** แท็บ ตารางประเภทเอกสาร & สิทธิ์ภาษี + Matrix ฟิลด์ข้อมูล (แหล่งเดียว ACCOUNTING_DOC_TYPES) + dropdown ฟอร์มแก้ไข + ชุด Prompt (getStandardDocTypeNames → AI รู้จักทันที และหน้าเว็บกดสร้างชุด prompt รายประเภทได้) + โซ่ 3 ขั้น (isDeliveryLike เจอ "ส่งของ" ในชื่อประเภทจับบทบาทขั้น 2 ให้เอง)
- **Check:** node --check Code.gs EXIT=0 | index.html script syntax OK | FFFD=0 | ทดสอบ normalizeDocType 6 เคสผ่าน
- **สถานะ:** ✅ เสร็จ — ⚠️ **REDEPLOY BOTH Code.gs + index.html** (SQL รันเฉพาะเมื่อต้องการ seed ใหม่ใน Supabase) | badge v3.21.5 → **v3.21.6**
