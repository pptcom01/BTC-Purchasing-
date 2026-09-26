/* =============================================================================
   สร้างไฟล์พรีวิว "ดูบิลเต็ม" (preview_detail_modal.html) จาก index.html จริง
   - ดึง <style> ทุกก้อน + markup ของ detailModal ออกมาตรง ๆ (ไม่คัดลอกด้วยมือ)
   - ต่อด้วย mock script (tmp_preview_detail_mock.js) เพื่อเติมข้อมูลตัวอย่าง
   - ไม่แก้ไข index.html / Code.gs / SQL — ไฟล์นี้เป็นเครื่องมือดูโครงเท่านั้น
   วิธีใช้: node tmp_build_detail_preview.js
   ============================================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const MOCK = path.join(ROOT, 'tmp_preview_detail_mock.js');
const OUT = path.join(ROOT, 'preview_detail_modal.html');

const src = fs.readFileSync(SRC, 'utf8');

// ---- 1) CSS: ทุก <style> ใน index.html (tailwind build + custom + ui-standard) ----
const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');

// ---- 2) markup: detailModal + editModal (ดึงจาก index.html ตรง ๆ) ----
function sliceBetween(startMarker, endMarker, label) {
    const a = src.indexOf(startMarker);
    const b = src.indexOf(endMarker);
    if (a < 0 || b < 0 || b < a) {
        console.error('❌ หา marker ไม่เจอ: ' + label + ' (start=' + a + ', end=' + b + ')');
        process.exit(1);
    }
    return src.slice(a, b).replace(/\s+$/, '');
}
const modal = sliceBetween('<div id="detailModal"', '<!-- Edit Receipt Modal', 'detailModal');
const editModal = sliceBetween('<!-- Edit Receipt Modal', '<div id="companyModal"', 'editModal');

// ---- 3) ตรวจว่า class ที่ markup ใช้ มีอยู่ใน CSS ที่ดึงมาหรือยัง ----
const used = new Set();
for (const html of [modal, editModal]) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
        m[1].split(/\s+/).filter(Boolean).forEach((t) => used.add(t));
    }
}
const escapeSel = (t) => t.replace(/[:\/\[\]%().,#*]/g, (c) => '\\' + c);
// จับ selector แบบตรงตัว (กัน .h-3 ไปแมตช์ .h-32) — ข้าม fa-* ที่มาจาก FontAwesome ไม่ใช่ Tailwind
// CSS ที่ build ฝังไว้ใช้รูป selector escape เดียวกับ Tailwind (.px-2\.5{…}) → เทียบแบบสตริงแล้วตรวจตัวคั่นต่อท้าย
function isDefined(token) {
    const needle = '.' + escapeSel(token);
    let i = styles.indexOf(needle);
    while (i >= 0) {
        const ch = styles[i + needle.length];
        if (ch === undefined || '{:,. >+~\n\r\t'.includes(ch)) return true;
        i = styles.indexOf(needle, i + 1);
    }
    return false;
}
const twTokens = [...used].filter((t) => !t.startsWith('fa-'));
const missing = twTokens.filter((t) => !isDefined(t));

// ---- 4) mock script ----
const mock = fs.readFileSync(MOCK, 'utf8');

const html = `<!DOCTYPE html>
<html lang="th" class="h-full">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>พรีวิว "ดูบิลเต็ม" (markup จริงจาก index.html) — mock ข้อมูล ไม่ต่อระบบ</title>
${styles}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
/* ===== เฉพาะไฟล์พรีวิวนี้ (ไม่มีใน index.html): เว้นที่ด้านบนให้แถบเลือกตัวอย่าง ===== */
#detailModal { top: 44px !important; }
</style>
</head>
<body class="h-full bg-slate-300">

<!-- ===== แถบเครื่องมือพรีวิว (เฉพาะไฟล์นี้) ===== -->
<div class="fixed top-0 left-0 right-0 z-[70] h-11 bg-slate-900 text-white px-3 flex items-center gap-2 text-[11px]">
    <span class="font-bold whitespace-nowrap">🔍 พรีวิว markup จริงจาก index.html</span>
    <span class="w-px h-5 bg-slate-700 mx-1"></span>
    <span class="text-slate-400 whitespace-nowrap">สลับโหมด:</span>
    <button id="modeBtnView" onclick="setDetailMode('view')" class="px-2.5 py-1 rounded-md bg-btc-green text-white font-bold">โหมดดูข้อมูล</button>
    <button id="modeBtnEdit" onclick="setDetailMode('edit')" class="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium">โหมดแก้ไขข้อมูล</button>
    <span class="w-px h-5 bg-slate-700 mx-1"></span>
    <span class="text-slate-400 whitespace-nowrap">ตัวอย่าง:</span>
    <button id="sampleBtnTAX" onclick="renderSample('TAX')" class="px-2.5 py-1 rounded-md bg-btc-green text-white font-bold">ใบกำกับภาษี</button>
    <button id="sampleBtnPO" onclick="renderSample('PO')" class="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium">ใบสั่งซื้อ</button>
    <button id="sampleBtnSCALE" onclick="renderSample('SCALE')" class="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium">ใบชั่งน้ำหนัก</button>
    <span class="ml-auto text-slate-400 whitespace-nowrap hidden md:inline">ข้อมูล mock ล้วน — ไม่ต่อ GAS/Supabase</span>
</div>

${modal}

${editModal}

<button onclick="document.getElementById('detailModal').classList.remove('hidden')"
    class="fixed bottom-4 right-4 z-[75] px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-lg">เปิดหน้าต่างอีกครั้ง</button>

<script>
${mock}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');

console.log('✅ เขียน ' + path.basename(OUT) + ' (' + html.split('\n').length + ' บรรทัด, ' + Math.round(html.length / 1024) + ' KB)');
console.log('   - CSS: ' + Math.round(styles.length / 1024) + ' KB จาก <style> ' + [...src.matchAll(/<style/gi)].length + ' ก้อน');
console.log('   - markup: detailModal ' + modal.split('\n').length + ' บรรทัด + editModal ' + editModal.split('\n').length + ' บรรทัด | class ที่ใช้ ' + used.size + ' ตัว (ไม่นับ fa-*)');
if (missing.length) {
    console.log('   ⚠️ class ที่ markup ใช้แต่ไม่พบใน CSS (' + missing.length + '/' + twTokens.length + '):');
    missing.forEach((t) => console.log('        - ' + t));
} else {
    console.log('   ✅ class Tailwind ทุกตัวมีใน CSS ครบ (0 missing)');
}
