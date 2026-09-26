// v3.17.5 — ตารางเดียว: เซลล์ค่าจริงคลิกสลับได้ + togglePromptField + ตัดฟังก์ชันการ์ด/checkbox ที่ไม่ใช้แล้ว
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');

// 1) แทนที่ renderFieldMatrixTable ทั้งฟังก์ชัน
const a = s.indexOf('        // 🎯 v3.17.4: Matrix เทียบเกณฑ์มาตรฐาน');
if (a === -1) { console.log('MISS start marker'); process.exit(1); }
const b = s.indexOf('        function loadAIPage(force) {');
if (b === -1 || b <= a) { console.log('MISS end'); process.exit(1); }

const newFn = `        // 🎯 v3.17.5: ตารางเดียว — เทียบเกณฑ์มาตรฐาน (●/○/–) กับค่าจริง (✓/✗/·) และคลิกเซลล์ค่าจริงเพื่อสลับได้เลย
        function renderFieldMatrixTable() {
            const tbody = document.getElementById('matrixTableBody');
            if (!tbody) return;
            const fields = [
                ['ตัวตนเอกสาร', 'ประเภท (doc_type)', 'doc_type', function () { return 'M'; }],
                ['ตัวตนเอกสาร', 'เลขที่ (doc_no)', 'doc_no', function () { return 'M'; }],
                ['ตัวตนเอกสาร', 'วันที่ (date)', 'date', function () { return 'M'; }],
                ['ตัวตนเอกสาร', 'เลขใบกำกับ (tax_invoice_no)', 'tax_invoice_no', function (t) {
                    return ['TAX', 'REC/TAX', 'CN', 'DN', 'DO/TAX', 'CUSTOMS'].indexOf(t.code) >= 0 ? 'M' : (['ABB', 'DO', 'INV/BILL', 'PO'].indexOf(t.code) >= 0 ? 'N' : 'O');
                }],
                ['การสั่งซื้อ', 'เลขที่ PO (po_number)', 'po_number', function (t) { return ['PO', 'PR', 'DO', 'DO/TAX', 'WT', 'WR'].indexOf(t.code) >= 0 ? 'M' : 'O'; }],
                ['ร้านค้า/ผู้ขาย', 'ชื่อร้าน (store_name)', 'store_name', function () { return 'M'; }],
                ['รายการสินค้า', 'รายการ (items)', 'items', function (t) { return ['PO', 'PR', 'QT', 'DO', 'DO/TAX', 'INV/BILL'].indexOf(t.code) >= 0 ? 'M' : 'O'; }],
                ['การเงิน', 'ยอดรวม (total_amount)', 'total_amount', function (t) { return /เอกสารภาษี|จัดซื้อ|บัญชีภายใน/.test(t.group || '') ? 'M' : 'O'; }],
                ['งานก่อสร้าง', 'บริษัท/งาน/ผู้เบิก/ผู้สั่งจ่าย', 'company_name', function (t) { return ['PO', 'PR'].indexOf(t.code) >= 0 ? 'M' : 'O'; }],
                ['การชั่งน้ำหนัก', 'น้ำหนักสุทธิ (scale_weight_net)', 'scale_weight_net', function (t) { return t.scale ? 'M' : (['DO', 'DO/TAX', 'WR'].indexOf(t.code) >= 0 ? 'O' : 'N'); }],
                ['การชั่งน้ำหนัก', 'ทะเบียนรถ (vehicle_registration)', 'vehicle_registration', function (t) { return t.scale ? 'M' : (['DO', 'DO/TAX', 'WR'].indexOf(t.code) >= 0 ? 'O' : 'N'); }]
            ];
            const types = ACCOUNTING_DOC_TYPES;
            const cfgByType = {};
            aiPromptList.forEach(function (p) { cfgByType[String(p.doc_type || '').trim()] = p.field_config || {}; });

            const rowsHtml = fields.map(function (f) {
                const cells = types.map(function (t) {
                    const std = f[3](t);
                    const cfg = cfgByType[t.name] || {};
                    const hasCfg = Object.keys(cfg).length > 0;
                    const actual = hasCfg ? (cfg[f[2]] === true) : null;
                    const sym = std === 'M' ? '●' : (std === 'O' ? '○' : '–');
                    const clickable = hasCfg; // ยังไม่มีชุด (·) คลิกไม่ได้ — ต้องไปสร้างชุดก่อน
                    let inner, cls = 'py-2 px-2 text-center';
                    if (!hasCfg) {
                        inner = '<div class=\\"font-bold text-slate-500\\">' + sym + '</div><div class=\\"text-[9px] text-slate-300\\">·</div>';
                    } else if (actual === true) {
                        if (std === 'N') { inner = '<div>' + sym + '</div><div class=\\"text-[10px] font-bold text-rose-700\\">✓</div>'; cls += ' bg-rose-50 cursor-pointer hover:bg-rose-100'; }
                        else { inner = '<div>' + sym + '</div><div class=\\"text-[10px] font-bold text-emerald-700\\">✓</div>'; cls += ' cursor-pointer hover:bg-slate-100'; }
                    } else {
                        if (std === 'M') { inner = '<div class=\\"text-slate-400\\">' + sym + '</div><div class=\\"text-[10px] font-bold text-slate-600\\">✗</div>'; cls += ' ring-1 ring-slate-400 cursor-pointer hover:bg-slate-100'; }
                        else { inner = '<div class=\\"text-slate-400\\">' + sym + '</div><div class=\\"text-[10px] text-slate-400\\">✗</div>'; cls += ' cursor-pointer hover:bg-slate-100'; }
                    }
                    const tip = (t.display_name || t.name) + ' — เกณฑ์: ' + (std === 'M' ? 'บังคับ' : std === 'O' ? 'เมื่อพบ' : 'ไม่เกี่ยว') + (hasCfg ? ' / คลิกเพื่อสลับ' : ' / ยังไม่มีชุด prompt');
                    const click = clickable ? ' onclick=\\"togglePromptField(\\'' + escJsAttr(t.name) + '\\',\\'' + escJsAttr(f[2]) + '\\')\\"' : '';
                    return '<td class="' + cls + '"' + click + ' title="' + escapeAttr(tip) + '">' + inner + '</td>';
                }).join('');
                return '<tr class="hover:bg-slate-50/50 transition"><td class="py-2 px-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">' + escapeHtml(f[0]) + '</td>' +
                    '<td class="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">' + escapeHtml(f[1]) + '</td>' + cells + '</tr>';
            }).join('');
            const headCells = types.map(function (t) {
                return '<th class="py-2 px-2 text-center font-mono text-[10px]" title="' + escapeAttr(t.display_name || t.name) + '">' + escapeHtml(t.code) + '</th>';
            }).join('');
            const headRow = tbody.closest('table').querySelector('thead tr');
            if (headRow) {
                headRow.innerHTML = '<th class="py-2.5 px-3">กลุ่ม</th><th class="py-2.5 px-3">ฟิลด์ (Field)</th>' + headCells;
            }
            tbody.innerHTML = rowsHtml;
        }

        // 🎯 v3.17.5: คลิกเซลล์ค่าจริง → สลับ field_config ของชุดนั้น + บันทึกทันที (ใช้ updateAIPromptFields เดิม)
        function togglePromptField(docType, fieldKey) {
            const p = aiPromptList.find(function (x) { return String(x.doc_type || '') === docType; });
            if (!p) return;
            const cfg = p.field_config || {};
            const next = !(cfg[fieldKey] === true);
            cfg[fieldKey] = next;
            p.field_config = cfg;
            renderFieldMatrixTable(); // วาดใหม่ทันที (optimistic)
            scriptCall('updateAIPromptFields', { docType: docType, fields: cfg })
                .then(function (res) {
                    if (res && res.success) showToast((next ? 'เปิด' : 'ปิด') + 'ฟิลด์ "' + fieldKey + '" ของ ' + docType + ' แล้ว');
                    else { showToast((res && res.message) || 'บันทึกไม่สำเร็จ', 'error'); renderFieldMatrixTable(); }
                })
                .catch(function (err) {
                    showToast(err && err.message ? err.message : 'บันทึกไม่สำเร็จ', 'error');
                    cfg[fieldKey] = !next; // rollback
                    p.field_config = cfg;
                    renderFieldMatrixTable();
                });
        }

`;
s = s.slice(0, a) + newFn + s.slice(b);
console.log('REPLACED renderFieldMatrixTable + added togglePromptField');

// 2) ตัด statusChipPrompt + renderPromptFieldBuilder + renderPromptCards (การ์ด/ตารางชุดเดิมที่ไม่ใช้แล้ว)
function cutFn(name) {
  const re = new RegExp('\\n        function ' + name + '\\\\([\\\\s\\\\S]*?\\\\n        \\\\}\\\\r?\\\\n');
  const m = s.match(re);
  if (!m) { console.log('MISS fn: ' + name); return; }
  s = s.replace(m[0], '\n');
  console.log('CUT ' + name + ' (' + m[0].length + ' chars)');
}
cutFn('statusChipPrompt');
cutFn('renderPromptFieldBuilder');
cutFn('renderPromptCards');

// 3) loadAIPrompts เรียก renderPromptCards + renderFieldMatrixTable — เหลือเรียก matrix อย่างเดียว
s = s.replace('                    renderPromptCards();\n                    renderFieldMatrixTable(); // v3.17.4: มี field_config ใหม่แล้ว — วาดตารางเทียบใหม่', '                    renderFieldMatrixTable(); // v3.17.5: วาดตารางเทียบจาก field_config ที่เพิ่งโหลด');
console.log('loadAIPrompts updated');

fs.writeFileSync('index.html', s);
console.log('done');
