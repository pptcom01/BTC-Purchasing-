/* ตรวจสุขภาพไฟล์ index.html (เครื่องมือชั่วคราว — ไม่ใช่ส่วนของแอป)
   ใช้: node tmp_check_syntax.js
   - syntax ของ <script> ทุกก้อน (new Function)
   - อักขระเสีย (U+FFFD)
   - ID ซ้ำใน markup
   - getElementById('x') ที่อ้างถึงแต่ไม่มีใน markup
   - สรุปการใช้งาน .matrix-row / .matrix-label / .matrix-value
*/
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let fail = 0;
const say = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) fail++; };

// 1) syntax ของ script ทุกก้อน
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
let synOk = true;
scripts.forEach((code, i) => {
    try { new Function(code); } catch (e) { synOk = false; console.log('     script#' + (i + 1) + ' → ' + e.message); }
});
say(synOk, 'syntax ของ <script> ทั้งหมด (' + scripts.length + ' ก้อน)');

// 2) อักขระเสีย
say(src.indexOf('\uFFFD') < 0, 'ไม่มีอักขระ U+FFFD');

// 3) ID ซ้ำ (ข้าม id ที่ประกอบจากตัวแปร เช่น 'cb' + cbId — ไม่ใช่ id คงที่)
const ids = [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).filter((v) => !/[+$]/.test(v));
const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
say(dup.length === 0, 'ID ไม่ซ้ำใน markup' + (dup.length ? ' → ซ้ำ: ' + [...new Set(dup)].join(', ') : ''));

// 4) getElementById ที่ไม่มีใน markup (ยอมรับที่สร้างเองภายหลังด้วย el.id = 'x')
const idSet = new Set(ids);
const dynamic = new Set([...src.matchAll(/\.id\s*=\s*'([^']+)'/g)].map((m) => m[1]));
const refs = [...src.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
const missing = [...new Set(refs.filter((r) => !idSet.has(r) && !dynamic.has(r)))];
// ไม่นับเป็น FAIL: รายชื่อนี้เป็น id ที่ "มี guard" (if (el) …) หรือเป็นโค้ดของฟีเจอร์ที่ markup ถูกถอดออกไปแล้ว
console.log((missing.length ? 'WARN ' : 'OK   ') + 'getElementById ที่ไม่มีใน markup (มี guard) — ' + (missing.length ? missing.join(', ') : 'ไม่มีเลย'));

// 5) สรุปคลาส matrix-*
const cnt = (t) => [...src.matchAll(new RegExp('class="[^"]*\\b' + t + '\\b', 'g'))].length;
console.log('INFO matrix-row=' + cnt('matrix-row') + ' | matrix-label=' + cnt('matrix-label') + ' | matrix-value=' + cnt('matrix-value'));

// 6) CSS ที่ต้องมี (คลาสที่ markup ใช้แต่ Tailwind บิลด์ไม่มี)
['.matrix-row:not(.hidden)', '.matrix-row > .matrix-label', '.break-words{', '.items-baseline{']
    .forEach((s) => say(src.indexOf(s) >= 0, 'CSS มี ' + s));

process.exit(fail ? 1 : 0);
