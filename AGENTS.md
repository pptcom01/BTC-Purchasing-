\# AGENT INSTRUCTIONS \& SUB-AGENTS TEAM PROTOCOL



\## 🚨 MANDATORY INSTRUCTION FOR ALL AI AGENTS

ก่อนเริ่มทำงานทุกครั้ง คุณต้องอ่านไฟล์นี้ และตรวจสอบไฟล์ `agent\_handoff.json` เพื่อทำความเข้าใจ Context ปัจจุบัน ห้ามเริ่มทำงานโดยไม่อ่าน 2 ไฟล์นี้เด็ดขาด



\---



\## ⚠️ CRITICAL RULES (กฎเหล็กสูงสุด)

1\. \*\*Targeted Editing Only:\*\* แก้ไขเจาะจงเฉพาะ Function ที่มีปัญหา ห้าม Rewrite โค้ดใหม่ทั้งไฟล์ ห้ามลบฟังก์ชันเดิมทิ้ง

2\. \*\*System Context First:\*\* อ่านและวิเคราะห์ System Context ทั้งหมดเพื่อป้องกัน Side Effects

3\. \*\*Preserve Structure:\*\* ต่อยอดจากโครงสร้างเดิม และรักษาสไตล์โค้ดเดิม

4\. \*\*Auto Update History Log:\*\* ต้องอัปเดตไฟล์ `task\_history\_log.md` ทุกครั้งหลังแก้โค้ด

5\. \*\*Role Dynamic:\*\* User มีหน้าที่แจ้งปัญหา/Deploy/Push ขึ้น Host ส่วน AI มีหน้าที่แก้โค้ดระดับ Function ให้สมบูรณ์

6\. \*\*No Guessing Data:\*\* ห้ามเดาสุ่มข้อมูล DB หากขาดข้อมูล ให้สร้าง Function ดึงข้อมูลส่งให้ User นำไปรันแล้วส่งผลกลับมา

7\. \*\*Cascading Consistency Check:\*\* ตรวจสอบและอัปเดตไฟล์/Function ที่เกี่ยวข้องทั้งหมดให้ Sync Logic กัน

8\. \*\*Multi-AI Handoff:\*\* ต้องสร้าง/อัปเดตไฟล์ `agent\_handoff.json` ทุกครั้งก่อนจบการทำงาน

9\. \*\*🎌 UTF-8 FILE WRITEGUARD (กฎเด็ดขาด—ห้ามฝ่าฝืน):\*\* ห้ามเขียนทับไฟล์โปรเจกต์ (`index.html`, `Code.gs`, `*.md`, `*.json`) ด้วย PowerShell `Set-Content`/`Out-File`/เพิ่มเติมในไฟล์ BELOW-FILES เด็ดขาด ต้องใช้ Read/Edit/Write tool เท่านั้น เหตุผล: PS 5.1 อ่านไฟล์ UTF-8 แบบไม่มี BOM เป็น encoding ANSI ทำให้ภาษาไทยพลิ้ว (เป็นตางดาว) แล้วเขียนทับไฟล์เดิม — เกิดแล้วและต้อง reverse เอากลับคืน ถ้าต้องตรวจ syntax ให้ตัดเฉพาะ `<script>` ไปเขียนไฟล์ temp ใน `C:\Users\PC\AppData\Local\Temp\opencode` แล้ว `node --check` ห้ามสรุปผลกับไฟล์จริง



\---



\## 🤖 SUB-AGENTS TEAMS ARCHITECTURE



\### 1. System Context \& Analysis Agent

\- \*\*Architect Sub-Agent:\*\* วิเคราะห์ผลกระทบ (Side Effects) และวางแผนแก้ไข

\- \*\*DB Inspector Sub-Agent:\*\* เขียน Query/Script ให้ User นำไปดึงข้อมูลจริงจาก DB



\### 2. Targeted Development Agent

\- \*\*Refactoring \& Patch Sub-Agent:\*\* แก้ไขเฉพาะ Function เป้าหมายตามกฎ Targeted Editing

\- \*\*Integration \& Sync Sub-Agent:\*\* ไล่ Sync โค้ดส่วนอื่นๆ ที่ได้รับผลกระทบ (Cascading Check)



\### 3. Quality Assurance \& Handoff Agent

\- \*\*Code Auditor Sub-Agent:\*\* ตรวจสอบความถูกต้องของโค้ด ให้พร้อม Deploy/Push ขึ้น GitHub

\- \*\*History Logger Sub-Agent:\*\* บันทึกประวัติการแก้ไขลง `task\_history\_log.md`

\- \*\*Handoff Manager Sub-Agent:\*\* บันทึกสถานะงานปัจจุบันลง `agent\_handoff.json`



\---



\## 📋 OUTPUT REQUIRED FORMAT

ทุกครั้งที่ตอบกลับ ต้องแสดงผลลัพธ์ตามหัวข้อต่อไปนี้เสมอ:

1\. 📊 \*\*Analysis \& Impact:\*\* (สรุปสาเหตุและ Function ที่ต้องแก้)

2\. 🛠️ \*\*Code Modifications:\*\* (โค้ดเฉพาะ Function ที่แก้ พร้อมชื่อไฟล์และชื่อ Function)

3\. 🔄 \*\*Cascading Sync Check:\*\* (รายการจุดที่ต้อง Sync ตาม)

4\. 📝 \*\*Task History Log Update:\*\* (เนื้อหาที่จะนำไปต่อท้าย `task\_history\_log.md`)

5\. 🤝 \*\*Multi-AI Handoff Update:\*\* (เนื้อหา JSON ล่าสุดสำหรับ `agent\_handoff.json`)

