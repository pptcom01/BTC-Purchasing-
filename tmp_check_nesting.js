/* ตรวจความสมดุลของ tag ในก้อน markup ของ detailModal (เครื่องมือชั่วคราว)
   ใช้: node tmp_check_nesting.js [ไฟล์] [id ที่สนใจ]
   - เดิน markup ด้วย stack ง่าย ๆ (ข้าม void element) แล้วรายงานจุดที่ tag ไม่สมดุล
   - รายงานสายพ่อ-แม่ของ id ที่สนใจ (ว่า nest อยู่ใต้ modalTabData หรือหลุดออกไป)
*/
const fs = require('fs');
const file = process.argv[2] || 'index.html';
const target = process.argv[3] || 'modalSellerName';
const src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('<div id="detailModal"');
const end = src.indexOf('<!-- Edit Receipt Modal');
const html = src.slice(start, end);
if (start < 0 || end < 0) { console.log('หา marker ไม่เจอ'); process.exit(1); }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const stack = [];
const problems = [];
let targetChain = null;

// ตัด comment, script, style ก่อน (แต่คงความยาวไว้เพื่อรายงานบรรทัด)
const cleaned = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
const lineOf = (i) => cleaned.slice(0, i).split('\n').length;

const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
let m;
while ((m = re.exec(cleaned)) !== null) {
    const [, slash, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (tag === 'script' || tag === 'style') continue;
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!slash) {
        if (idMatch && idMatch[1] === target && !targetChain) {
            targetChain = stack.map((s) => s.tag + (s.id ? '#' + s.id : '')).concat('(target)');
        }
        if (VOID.has(tag) || selfClose === '/') continue;
        stack.push({ tag, id: idMatch ? idMatch[1] : '', line: lineOf(m.index) });
    } else {
        if (VOID.has(tag)) continue;
        const top = stack.pop();
        if (top && top.tag !== tag) {
            problems.push('บรรทัด ' + lineOf(m.index) + ': เจอ </' + tag + '> แต่บนสุดคือ <' + top.tag + (top.id ? '#' + top.id : '') + '> (เปิดที่บรรทัด ' + top.line + ')');
        }
    }
}
// ตรวจ id ที่ "ถูกคอมเมนต์กลืน" (อยู่ใน raw แต่หายไปหลังตัดคอมเมนต์) — เคยเจอจริง: คอมเมนต์ปิดด้วย */ แทน -->
const rawIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const cleanIds = new Set([...cleaned.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const swallowed = [...new Set(rawIds.filter((v) => !cleanIds.has(v)))];

console.log('ไฟล์: ' + file + ' | markup ' + html.split('\n').length + ' บรรทัด');
console.log((swallowed.length ? 'FAIL ' : 'OK   ') + 'id ที่ถูกคอมเมนต์กลืน: ' + (swallowed.length ? swallowed.join(', ') : 'ไม่มี'));
console.log('target id="' + target + '" สายพ่อ-แม่: ' + (targetChain ? targetChain.join(' > ') : '(ไม่พบ)'));
console.log('tag ค้างใน stack ' + stack.length + ' ตัว' + (stack.length ? ': ' + stack.map((s) => s.tag + (s.id ? '#' + s.id : '') + '@' + s.line).join(', ') : ''));
if (problems.length) { console.log('พบ tag ไม่สมดุล ' + problems.length + ' จุด:'); problems.slice(0, 12).forEach((p) => console.log('  - ' + p)); }
else console.log('ไม่พบ tag ปิดไม่ตรง');
