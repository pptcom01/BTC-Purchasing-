/* =============================================================================
   MOCK SCRIPT — พรีวิวโครง "ดูบิลเต็ม" (detailModal)
   - markup + CSS ทั้งหมดดึงมาจาก index.html จริง (v3.20.0) โดย tmp_build_detail_preview.js
   - ข้อมูล/รูป/ตัวเลขทั้งหมดเป็นตัวอย่าง (mock) ไม่ต่อ GAS / Supabase และไม่บันทึกอะไร
   - ตัวแปร/ฟังก์ชันอยู่ระดับ global เพราะ markup จริงเรียกผ่าน onclick inline
   ============================================================================= */

const $ = (id) => document.getElementById(id);
const T = (id, v) => { const e = $(id); if (e) e.textContent = (v === undefined || v === null || v === '') ? '-' : String(v); };
const H = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
const show = (id, on = true) => { const e = $(id); if (e) e.classList.toggle('hidden', !on); };
const money = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '-'; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
    const d = document.createElement('div');
    d.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 z-[80] bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg';
    d.textContent = '(พรีวิว) ' + msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
}

/* ------------------------------------------------------------------
   1) ตัวอย่างบิล 3 ประเภท (สลับดูได้จากแถบด้านบน)
   ------------------------------------------------------------------ */
const SAMPLES = {
    TAX: {
        banner: 'ใบกำกับภาษี',
        matrixCode: 'TAX',
        docTypeName: 'ใบกำกับภาษี',
        docLabel: '256502265',
        refNo: '256502265',
        taxInvoiceNo: '010755501234567',
        po: 'PO-2565-0112',
        date: '2022-05-22',
        category: 'ค่าอะไหล่',
        systemRecordNo: 'TR-2650-00123',
        sender: 'คุณบิ๊ก',
        source: 'กลุ่ม LINE ฝ่ายจัดซื้อ',
        docTitleText: '',
        dateFallback: false,
        hiddenDocNos: '',
        seller: { name: 'บจก. ยูโรมอเตอร์สปอร์ต จำกัด', phone: '044-851048, 085-329-8939', tax: '010755501234567', address: '199 หมู่ 4 ต.บ้านบัว อ.เมือง จ.บุรีรัมย์ 31000' },
        buyer: { name: 'บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด', requester: 'วิชัย', payApprover: 'สมศักดิ์', address: 'งาน/โครงการ: โครงการหนองบัว — ผู้เบิก วิชัย / ผู้สั่งจ่าย สมศักดิ์ (บิลนี้ไม่มีเลขอ้างอิงงาน)' },
        items: [
            { name: 'ลูกหมากบาร์ยาง', qty: 2, unit: 'ตัว', price: 225 },
            { name: 'น้ำมันเครื่อง 15W-40 (ลิตร)', qty: 4, unit: 'ลิตร', price: 0 }
        ],
        remarks: 'พนักงานขาย : บิ๊ก\nส่งของภายใน 3 วันทำการ',
        subtotal: 450, discount: 0, net: 450, bahtText: 'สี่ร้อยห้าสิบบาทถ้วน',
        file: { sections: { taxInv: true, po: true, poFields: false, scale: false } },
        match: { status: 'จับคู่แล้ว', poLabel: 'PO-2565-0112', rows: [['ใบส่งของ', 'DO-2565-0471', 'ยืนยัน', '98%'], ['ใบชั่งน้ำหนัก (ขั้น 3)', 'WB-2565-0091', 'ยืนยัน', '95%']] }
    },
    PO: {
        banner: 'ใบสั่งซื้อ',
        matrixCode: 'PUR',
        docTypeName: 'ใบสั่งซื้อ',
        docLabel: 'PO-2565-0112',
        refNo: 'PO-2565-0112',
        taxInvoiceNo: '',
        po: 'PO-2565-0112',
        date: '2022-05-18',
        category: 'ค่าอะไหล่',
        systemRecordNo: 'TR-2650-00124',
        sender: 'คุณสมชาย',
        source: 'กลุ่ม LINE ฝ่ายจัดซื้อ',
        docTitleText: 'ใบสั่งซื้อ / PURCHASE ORDER',
        dateFallback: false,
        hiddenDocNos: 'บันทึกเพิ่ม: เล่มที่ 2/2565',
        seller: { name: 'หจก. บุรีรัมย์ค้าวัสดุก่อสร้าง', phone: '044-612-345', tax: '0453561000123', address: '88 หมู่ 2 ต.อิสาณ อ.เมือง จ.บุรีรัมย์ 31000' },
        buyer: { name: 'บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด', requester: 'วิชัย', payApprover: 'สมศักดิ์', address: 'งาน/โครงการ: โครงการหนองบัว' },
        items: [
            { name: 'ปูนซีเมนต์ปอร์ตแลนด์ ตราช้าง 50 กก.', qty: 100, unit: 'ถุง', price: 155 },
            { name: 'เหล็กเส้นกลม SR24 Ø9 มม. (10 ม.)', qty: 30, unit: 'เส้น', price: 120 }
        ],
        remarks: 'กำหนดส่งของภายใน 7 วัน\nผู้ขายต้องแนบใบส่งของทุกครั้ง',
        subtotal: 19100, discount: 100, net: 19000, bahtText: 'หนึ่งหมื่นเก้าพันบาทถ้วน',
        file: { sections: { taxInv: false, po: true, poFields: true, scale: false } },
        match: { status: 'ยังไม่จับคู่', poLabel: 'PO-2565-0112', rows: [['ใบส่งของ', '(ยังไม่มี)', 'รอของ', '-'], ['ใบชั่งน้ำหนัก (ขั้น 3)', '(ยังไม่มี)', 'รอของ', '-']] }
    },
    SCALE: {
        banner: 'ใบชั่งน้ำหนัก',
        matrixCode: 'WB',
        docTypeName: 'ใบชั่งน้ำหนัก',
        docLabel: 'WB-2565-0091',
        refNo: 'WB-2565-0091',
        taxInvoiceNo: '',
        po: '',
        date: '2022-05-21',
        category: 'ค่าขนส่ง/วัสดุ',
        systemRecordNo: 'TR-2650-00125',
        sender: 'คุณสมพร',
        source: 'กลุ่ม LINE ฝ่ายจัดซื้อ',
        docTitleText: '',
        dateFallback: true,
        hiddenDocNos: '',
        seller: { name: 'ร้านรับซื้อของเก่าบุรีรัมย์ (จุดชั่ง)', phone: '089-999-1234', tax: '', address: 'ปากทางเข้า อ.ลำปลายมาศ จ.บุรีรัมย์' },
        buyer: { name: 'บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด', requester: 'วิชัย', payApprover: 'สมศักดิ์', address: 'งาน/โครงการ: โครงการหนองบัว' },
        items: [{ name: 'หินคลุก 3/4 นิ้ว (ชั่งน้ำหนัก)', qty: 12.5, unit: 'ตัน', price: 300 }],
        remarks: 'รถบรรทุก 6 ล้อ เข้าชั่งรอบเดียว (ไม่มีใบกำกับภาษี — ต้องออกบิลตามใบส่งของ)',
        subtotal: 3750, discount: 0, net: 3750, bahtText: 'สามพันเจ็ดร้อยห้าสิบบาทถ้วน',
        scale: { vehicle: '80-1234 บุรีรัมย์', wIn: '24.620 ตัน', wOut: '12.120 ตัน', wNet: '12.5000 ตัน' },
        file: { sections: { taxInv: false, po: false, poFields: false, scale: true } },
        match: { status: 'รอจับคู่ขั้น 3', poLabel: '(ต้องจับผ่านใบส่งของเท่านั้น)', rows: [['ใบส่งของ', 'DO-2565-0471', 'ยืนยัน', '92%'], ['ห้ามติด PO ตรง', 'ตามกฎ 3 ขั้น', 'ผ่านใบส่งของ', '-']] }
    }
};

/* ------------------------------------------------------------------
   2) รูปบิล mock (วาดด้วย canvas — ไม่มีไฟล์รูปในโปรเจกต์)
   ------------------------------------------------------------------ */
function mockReceiptDataURL(s) {
    const c = document.createElement('canvas');
    c.width = 620; c.height = 880;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#cbd5e1'; x.lineWidth = 2; x.strokeRect(10, 10, 600, 860);

    x.fillStyle = '#0f172a'; x.font = 'bold 20px Kanit, sans-serif';
    x.fillText(s.seller.name, 36, 60);
    x.font = '11px Kanit, sans-serif'; x.fillStyle = '#475569';
    if (s.seller.phone) x.fillText('โทร. ' + s.seller.phone, 36, 80);
    if (s.seller.tax) x.fillText('เลขประจำตัวผู้เสียภาษี ' + s.seller.tax, 36, 96);
    x.fillText(s.seller.address, 36, 112);

    x.textAlign = 'center'; x.fillStyle = '#0f172a'; x.font = 'bold 17px Kanit, sans-serif';
    x.fillText(s.docTypeName, 310, 158);
    x.textAlign = 'left'; x.font = '11px Kanit, sans-serif'; x.fillStyle = '#334155';
    x.fillText('เลขที่ : ' + s.docLabel, 424, 132);
    x.fillText('วันที่ : ' + fmtDate(s.date), 424, 150);

    x.strokeStyle = '#cbd5e1'; x.beginPath(); x.moveTo(36, 184); x.lineTo(584, 184); x.stroke();

    // หัวตาราง
    x.font = 'bold 11px Kanit, sans-serif'; x.fillStyle = '#0f172a';
    x.fillText('ลำดับ', 44, 208); x.fillText('รายการ', 110, 208);
    x.textAlign = 'right'; x.fillText('จำนวน', 440, 208); x.fillText('ราคา/หน่วย', 520, 208); x.fillText('จำนวนเงิน', 584, 208);
    x.textAlign = 'left'; x.strokeStyle = '#e2e8f0'; x.beginPath(); x.moveTo(36, 218); x.lineTo(584, 218); x.stroke();

    x.font = '11px Kanit, sans-serif'; x.fillStyle = '#334155';
    let y = 244;
    s.items.forEach((it, i) => {
        x.fillText(String(i + 1), 48, y);
        x.fillText(String(it.name).slice(0, 34), 110, y);
        x.textAlign = 'right';
        x.fillText(`${it.qty} ${it.unit}`, 440, y);
        x.fillText(money(it.price), 520, y);
        x.fillText(money(it.qty * it.price), 584, y);
        x.textAlign = 'left';
        y += 26;
    });

    // ยอดรวม
    x.strokeStyle = '#cbd5e1'; x.beginPath(); x.moveTo(36, 600); x.lineTo(584, 600); x.stroke();
    x.textAlign = 'right'; x.fillStyle = '#334155';
    x.fillText('ยอดรวม / Subtotal', 480, 628); x.fillText(money(s.subtotal), 584, 628);
    if (s.discount) { x.fillText('ส่วนลด / Discount', 480, 650); x.fillText('-' + money(s.discount), 584, 650); }
    x.fillStyle = '#15803d'; x.font = 'bold 14px Kanit, sans-serif';
    x.fillText('ยอดรวมสุทธิ / Net Total', 480, 676); x.fillText(money(s.net), 584, 676);
    x.textAlign = 'left'; x.font = '11px Kanit, sans-serif'; x.fillStyle = '#334155';
    x.fillText('(' + s.bahtText + ')', 36, 676);
    if (s.file.sections.scale && s.scale) {
        x.fillStyle = '#1e293b'; x.font = 'bold 12px Kanit, sans-serif';
        x.fillText('ข้อมูลการชั่งน้ำหนัก', 36, 300);
        x.font = '11px Kanit, sans-serif';
        x.fillText('ทะเบียนรถ : ' + s.scale.vehicle, 36, 322);
        x.fillText('น้ำหนักเข้า : ' + s.scale.wIn, 36, 340);
        x.fillText('น้ำหนักออก : ' + s.scale.wOut, 36, 358);
        x.fillText('น้ำหนักสุทธิ : ' + s.scale.wNet, 36, 376);
    }
    x.fillText('เอกสารตัวอย่างสำหรับพรีวิวเท่านั้น (mock)', 36, 838);
    return c.toDataURL('image/png');
}

/* ------------------------------------------------------------------
   3) inline zoom / หมุน / พลิก / ความสว่าง-คมชัด (พรีวิวเท่านั้น ไม่บันทึกทับไฟล์)
   ------------------------------------------------------------------ */
let zScale = 1, zFit = 1, zTx = 0, zTy = 0, drag = null, rot = 0, flip = false, bright = 100, contrast = 100;
const stage = () => $('detailImageStage');
const img = () => $('modalImage');

function applyT() {
    const el = img(); if (!el) return;
    el.style.transformOrigin = 'center center';
    el.style.transform = `translate(${zTx}px,${zTy}px) scale(${zScale}) rotate(${rot}deg) scaleX(${flip ? -1 : 1})`;
}
function applyFilter() {
    const el = img(); if (!el) return;
    el.style.filter = `brightness(${bright}%) contrast(${contrast}%)`;
}
function zoomLabel() {
    const el = $('detailZoomLabel'); if (!el) return;
    el.textContent = Math.max(1, Math.round(zScale / zFit * 100)) + '%';
}
function fitNow() {
    const st = stage(), el = img(); if (!st || !el || !el.clientWidth) return;
    zFit = Math.max(0.02, Math.min(st.clientWidth / el.clientWidth, st.clientHeight / el.clientHeight) * 0.96);
    zScale = zFit; zTx = 0; zTy = 0; applyT(); zoomLabel();
}
function zoomAt(cx, cy, f) {
    const st = stage(); if (!st) return;
    const r = st.getBoundingClientRect();
    const ns = Math.min(Math.max(zScale * f, zFit), zFit * 16);
    if (ns === zFit) { zScale = zFit; zTx = 0; zTy = 0; applyT(); zoomLabel(); return; }
    const wx = (cx - r.left - r.width / 2 - zTx) / zScale;
    const wy = (cy - r.top - r.height / 2 - zTy) / zScale;
    zScale = ns; zTx = (cx - r.left) - r.width / 2 - wx * ns; zTy = (cy - r.top) - r.height / 2 - wy * ns;
    applyT(); zoomLabel();
}
function detailImageZoomReset() { fitNow(); }
function detailZoomStep(dir) {
    const st = stage(); if (!st) return;
    const r = st.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, dir > 0 ? 1.18 : 1 / 1.18);
}
function detailSetBrightness(v) { bright = Number(v) || 100; T('detailBrightnessLabel', v + '%'); applyFilter(); }
function detailSetContrast(v) { contrast = Number(v) || 100; T('detailContrastLabel', v + '%'); applyFilter(); }
function detailImgRotate(d) { rot = ((rot + d * 90) % 360 + 360) % 360; applyT(); }
function detailImgFlipToggle() { flip = !flip; applyT(); }
function detailImgCrop() { toast('ครอป/แก้รูป ทำในหน้าต่าง "แก้ไขข้อมูล & รูปภาพ" ของระบบจริง'); }
function detailImgResetAll() {
    rot = 0; flip = false; bright = 100; contrast = 100;
    const b = $('detailImgBrightness'), c = $('detailImgContrast');
    if (b) b.value = 100;
    if (c) c.value = 100;
    T('detailBrightnessLabel', '100%'); T('detailContrastLabel', '100%');
    applyFilter(); fitNow();
}

/* ------------------------------------------------------------------
   4) แท็บ / ข้อมูลดิบ / ปุ่มอื่น ๆ
   ------------------------------------------------------------------ */
function showDetailTab(tab) {
    const isInfo = tab === 'info';
    // คลาสเดียวกับ showDetailTab() ของ index.html เป๊ะ (ui-tab / ui-tab is-active)
    const ti = $('detailTabInfo'), tm = $('detailTabMatch');
    if (ti) ti.className = isInfo ? 'ui-tab is-active' : 'ui-tab';
    if (tm) tm.className = isInfo ? 'ui-tab' : 'ui-tab is-active';
    show('modalTabData', isInfo);
    show('modalTabMatch', !isInfo);
}
function toggleRawDataCard(btn) {
    const box = $('modalRawDataBox'); if (!box) return;
    box.classList.toggle('hidden');
    const icon = btn && btn.querySelector('i.fa-chevron-down');
    if (icon) icon.style.transform = box.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}
function closeModal() { const m = $('detailModal'); if (m) m.classList.add('hidden'); }
function openEditModalFromDetail() {
    // เหมือนระบบจริง: กดแล้ว "หน้าต่างเดิม" สลับเป็นโหมดแก้ไข (ไม่เปิดหน้าต่างใหม่)
    renderEditSample(currentSampleKind, null);
    setDetailMode('edit');
}
function reanalyzeCurrentBill() { toast('ปุ่ม "อ่านใหม่ (AI)" ทำงานเฉพาะในระบบจริง'); }

/* ------------------------------------------------------------------
   5) เติมข้อมูลลงโครง (ลำดับเดียวกับ openDetailItem ของ index.html)
   ------------------------------------------------------------------ */
let currentSampleKind = 'TAX';

function renderSample(kind) {
    const s = SAMPLES[kind] || SAMPLES.TAX;
    currentSampleKind = SAMPLES[kind] ? kind : 'TAX';

    // แถบเลือกตัวอย่าง (เฉพาะไฟล์พรีวิว)
    ['TAX', 'PO', 'SCALE'].forEach((k) => {
        const b = $('sampleBtn' + k);
        if (b) b.className = (k === kind)
            ? 'px-2.5 py-1 rounded-md bg-btc-green text-white font-bold'
            : 'px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium';
    });

    // หัวหน้าต่าง
    T('modalSupplierTitle', s.seller.name);
    T('modalMatrixCode', s.matrixCode);
    show('modalDocTypeBadge', true);
    T('modalDocTypeBadgeName', s.docTypeName);
    T('modalDocTypeName', s.docTypeName);
    T('modalDocTitleText', s.docTitleText || '-');
    show('modalDocTitleText', !!s.docTitleText);
    show('modalDocTitleGuess', false);
    T('modalDocLabel', s.docLabel);
    T('modalRefNoBox', s.refNo);
    T('modalTaxInvoiceNo', s.taxInvoiceNo || '-');
    show('modalTaxInvBox', !!s.file.sections.taxInv);
    T('modalPoNumber', s.po || '-');
    show('modalPoRowBlock', !!s.po);
    T('modalDate', fmtDate(s.date));
    show('modalDateFallbackBadge', !!s.dateFallback);
    T('modalCategory', s.category);
    T('modalSystemRecordNo', s.systemRecordNo);
    T('modalSender', s.sender);
    T('modalSource', s.source);
    T('modalHiddenDocNos', s.hiddenDocNos || '');
    show('modalHiddenDocNos', !!s.hiddenDocNos);

    // การ์ดผู้ขาย / ลูกค้า
    T('modalSellerName', s.seller.name);
    T('modalSellerPhone', s.seller.phone || '-');
    show('modalSellerPhoneRow', !!s.seller.phone);
    T('modalSellerTax', s.seller.tax || '-');
    show('modalSellerMeta', !!s.seller.tax);
    T('modalSellerAddress', s.seller.address);
    // v3.21.1: บริษัท/งาน/ผู้เบิก/ผู้สั่งจ่าย อยู่การ์ด "ลูกค้า / บริษัท / ผู้เบิก" ที่เดียว (เลิกการ์ดข้อมูลสั่งซื้อ/งานที่ซ้ำ)
    T('modalCompanyName', s.buyer.name);
    T('modalJobName', 'โครงการหนองบัว');
    T('modalRequester', s.buyer.requester);
    T('modalPayApprover', s.buyer.payApprover);
    show('modalScaleInfo', !!s.file.sections.scale);
    if (s.scale) {
        T('modalVehicle', s.scale.vehicle);
        T('modalWeightIn', s.scale.wIn);
        T('modalWeightOut', s.scale.wOut);
        T('modalWeightNet', s.scale.wNet);
    }
    show('modalMatchSummary', false);
    show('modalCompareBox', false);
    show('modalItemBadge', false);

    // ตารางรายการ + ยอด
    H('modalItemsTableBody', s.items.map((it, i) => `
        <tr class="hover:bg-slate-50 transition">
            <td class="px-3 py-2.5 text-center text-slate-400 font-mono">${i + 1}</td>
            <td class="px-3 py-2.5 font-semibold text-slate-800">${esc(it.name)}</td>
            <td class="px-3 py-2.5 text-center font-bold text-slate-900">${it.qty}</td>
            <td class="px-3 py-2.5 text-center"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">${esc(it.unit)}</span></td>
            <td class="px-3 py-2.5 text-right font-mono text-slate-600">${it.price ? '฿' + money(it.price) : '-'}</td>
            <td class="px-3 py-2.5 text-right font-bold text-emerald-700 font-mono">฿${money(it.qty * it.price)}</td>
        </tr>`).join(''));
    T('modalTotalAmountTable', '฿' + money(s.net));
    T('modalRemarksBox', s.remarks);
    T('modalSumSubtotal', money(s.subtotal) + ' บาท');
    T('modalSumDiscount', money(s.discount) + ' บาท');
    T('modalSumNetTotal', '฿' + money(s.net));
    T('modalSumBahtText', '(' + s.bahtText + ')');
    show('modalSumBahtText', true);

    // timestamp (แบบเดียวกับแถบวิธีใช้ฝั่งรูป) — v3.21.5: ตัด "วันที่ในบิล" ที่ซ้ำออก เหลือเฉพาะเวลาบันทึก (+ รอตรวจ)
    const ts = $('modalTimestamp');
    if (ts) { ts.textContent = 'บันทึก: ' + fmtDate('2022-05-22') + ' 14:32'; ts.title = ts.textContent; }

    // รูป
    const el = img();
    if (el) {
        el.src = mockReceiptDataURL(s);
        el.onload = function () { fitNow(); };
    }
    const ext = $('modalImageExternal');
    if (ext) ext.href = '#';
    applyFilter();
    detailImgResetAll();

    // แผงจับคู่ (แท็บ "จับคู่")
    const m = s.match;
    H('matchPanelContent', `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div class="flex items-center justify-between">
                <div class="font-bold text-sm text-slate-800"><i class="fa-solid fa-link text-btc-green mr-1.5"></i>จับคู่เอกสาร — ${esc(s.docTypeName)}</div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${m.status === 'จับคู่แล้ว' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">${esc(m.status)}</span>
            </div>
            <div class="text-xs text-slate-600">อ้างอิงใบสั่งซื้อ: <span class="font-mono font-bold text-slate-800">${esc(m.poLabel)}</span></div>
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                <table class="w-full text-xs">
                    <thead class="bg-slate-50 text-slate-600 font-semibold"><tr>
                        <th class="px-3 py-2 text-left">ขั้น</th><th class="px-3 py-2 text-left">เลขที่เอกสาร</th>
                        <th class="px-3 py-2 text-center">สถานะ</th><th class="px-3 py-2 text-right">ความมั่นใจ</th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-100">
                        ${m.rows.map((r) => `<tr><td class="px-3 py-2.5 text-slate-700">${esc(r[0])}</td><td class="px-3 py-2.5 font-mono text-slate-800">${esc(r[1])}</td><td class="px-3 py-2.5 text-center">${esc(r[2])}</td><td class="px-3 py-2.5 text-right font-mono text-slate-600">${esc(r[3])}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                แผงนี้ในระบบจริงสร้างจาก <span class="font-mono">renderMatchPanel()</span> ด้วยข้อมูล <span class="font-mono">receipt_links</span> จริง — พรีวิวแสดงเฉพาะโครง/ข้อมูลตัวอย่าง
            </div>
        </div>`);

    // การ์ดข้อมูลดิบ 1:1
    const raw = [
        ['doc_type', s.docTypeName], ['doc_no', s.docLabel], ['tax_invoice_no', s.taxInvoiceNo || '(ว่าง)'],
        ['po_number', s.po || '(ว่าง)'], ['date', s.date], ['category', s.category],
        ['running_number', s.systemRecordNo], ['system_record_no', '#' + String(345).padStart(6, '0')],
        ['sender_name', s.sender], ['source', s.source], ['store_name', s.seller.name],
        ['vendor_tax_id', s.seller.tax || '(ว่าง)'], ['total_amount', money(s.net)],
        ['needs_review', s.dateFallback ? 'true' : 'false'], ['review_reason', s.dateFallback ? 'วันที่ในบิลอ่านไม่ชัด — ระบบเติมเดือน/ปีปัจจุบัน' : ''],
        ['image_url', 'drive.google.com/thumbnail?id=1AbC… (mock)']
    ];
    H('modalRawDataList', raw.map(([k, v]) => `
        <div class="flex items-start gap-2 px-4 py-1.5 border-b border-slate-100 last:border-0">
            <span class="font-mono text-[11px] text-slate-500 w-40 shrink-0">${esc(k)}</span>
            <span class="text-slate-800 break-all">${esc(v === '' ? '(ว่าง)' : v)}</span>
        </div>`).join(''));

    showDetailTab('info');
    const pane = $('modalTabData');
    if (pane) pane.scrollTop = 0;   // เปิดบิลใหม่ = เริ่มจากบนสุดของแผงข้อมูล

    if (typeof renderEditSample === 'function') renderEditSample(currentSampleKind, null);   // ให้ฟอร์มแก้ไขตามตัวอย่างเดียวกัน
}

/* ------------------------------------------------------------------
   6) โหมดพรีวิว: สลับระหว่าง "ดูบิลเต็ม" และ "แก้ไขข้อมูล & รูปภาพ" (2026-09-25 v3.20.5)
   ------------------------------------------------------------------ */
// 🪟 จำลองกลไกจริงใน index.html (v3.21.0): หน้าต่างเดียว "หน้าตาเดียว" — ยกช่องกรอกมาวางทับช่องข้อมูลเดิม
//   แล้วสลับแค่ชั้น .mode-view ↔ .mode-edit (ไม่สลับแผง/ไม่สลับหน้าตา) — คัดลอกตรรกะจาก index.html
let detailMode = 'view';

function mountEditControlsIntoView() {
    const template = $('editModal');      // กล่องแก้ไขเดิม (ทำหน้าที่เป็น "ต้นทาง" ของช่องกรอก)
    if (!template || !$('detailViewPane')) return;

    const markEdit = function (el) { if (el) el.classList.add('mode-edit'); return el; };
    const markView = function (el) { if (el) el.classList.add('mode-view'); return el; };
    const moveAfter = function (el, anchor) {
        if (!el || !anchor || !anchor.parentNode) return null;
        markEdit(el);
        anchor.parentNode.insertBefore(el, anchor.nextSibling);
        return el;
    };
    // ช่องย่อยที่อยู่ในช่องเดิม (เช่น เล่มที่ อยู่ใต้เลขที่เอกสาร) — ไม่เพิ่มแถวใหม่
    //   v3.21.4: ป้าย + ช่องกรอก "บรรทัดเดียวกัน" (.matrix-row) ให้ตรงกับโหมดดูข้อมูล
    const subField = function (hostCell, labelText, inputEl) {
        if (!hostCell || !inputEl) return null;
        const wrap = document.createElement('div');
        wrap.className = 'mode-edit matrix-row mt-1.5';
        const lb = document.createElement('span');
        lb.className = 'matrix-label';
        lb.textContent = labelText;
        wrap.appendChild(lb);
        markEdit(inputEl);
        wrap.appendChild(inputEl);
        hostCell.appendChild(wrap);
        return wrap;
    };
    // สร้างช่องใหม่: "ป้าย + ช่องกรอก บรรทัดเดียวกัน" แบบ .matrix-row
    const labelCell = function (labelText, anchor, inputEl) {
        if (!inputEl || !anchor || !anchor.parentNode) return null;
        const cell = document.createElement('div');
        cell.className = 'mode-edit matrix-row min-w-0';
        const lb = document.createElement('span');
        lb.className = 'matrix-label';
        lb.textContent = labelText;
        cell.appendChild(lb);
        markEdit(inputEl);
        cell.appendChild(inputEl);
        anchor.parentNode.insertBefore(cell, anchor.nextSibling);
        return cell;
    };

    // 1) แถบหัวคอลัมน์รูป: ป้าย "แก้ไขรูปได้" + สถานะการโหลดรูป
    const extLink = $('modalImageExternal');
    const imgHeadBar = extLink ? extLink.parentElement.parentElement : null;
    if (imgHeadBar && imgHeadBar.firstElementChild) {
        const badge = document.createElement('span');
        badge.className = 'ui-badge ui-badge--pending mode-edit';
        badge.textContent = 'แก้ไขรูปได้';
        imgHeadBar.firstElementChild.appendChild(badge);
        imgHeadBar.firstElementChild.appendChild(markEdit($('emStatus')));
    }

    // 2) สเตจรูป: img พรีวิว ↔ canvas แก้รูป (+ กรอบครอป + แถบซูม)
    const imgStage = $('detailImageStage');
    markView($('modalImage'));
    markView($('detailZoomLabel') ? $('detailZoomLabel').closest('div.absolute') : null);
    if (imgStage) {
        [$('emImageStage'), $('emPlaceholder'), $('emZoomLabel') ? $('emZoomLabel').closest('div.absolute') : null].forEach(function (el) {
            if (el) { markEdit(el); imgStage.appendChild(el); }
        });
    }

    // 3) แผงเครื่องมือรูป: แผงพรีวิว ↔ แผงแก้รูปจริง
    const viewToolPanel = imgStage ? imgStage.nextElementSibling : null;
    markView(viewToolPanel);
    const emToolPanel = $('emBrightness') ? $('emBrightness').closest('div.bg-white') : null;
    if (emToolPanel && viewToolPanel && viewToolPanel.parentNode) {
        markEdit(emToolPanel);
        viewToolPanel.parentNode.insertBefore(emToolPanel, viewToolPanel.nextSibling);
    }

    // 4) กริดข้อมูลหลัก
    const set = function (viewId, editId) { return moveAfter($(editId), markView($(viewId))); };
    set('modalDocTypeName', 'editDocTypeSelect');
    set('modalDocLabel', 'editDocNoInput');
    set('modalDate', 'editDateInput');
    markView($('modalHiddenDocNos'));
    set('modalCategory', 'editCategorySelect');
    markView($('modalMatchSummary'));
    markView($('modalTaxInvBox'));
    labelCell('เลขใบกำกับภาษี', $('modalTaxInvBox'), $('editTaxInvoiceInput'));
    markView($('modalPoRowBlock'));
    labelCell('เลขที่ PO', $('modalPoRowBlock'), $('editPoInput'));
    markView($('modalRefNoBox'));
    const refCell = $('modalRefNoBox') ? $('modalRefNoBox').closest('div.min-w-0') : null;
    set('modalRefNoBox', 'editRefNoInput');   // v3.21.4: ช่องกรอกอยู่บรรทัดเดียวกับป้าย
    // v3.21.2: เล่มที่ / ชื่อเรียกเลขอ้างอิง = ช่องย่อยในช่องที่เกี่ยวข้อง (ไม่เพิ่มแถวให้กริดเพี้ยน)
    subField($('modalDocLabel') ? $('modalDocLabel').closest('div.min-w-0') : null, 'เล่มที่ (บิลเก่าเท่านั้น)', $('editBookInput'));
    subField(refCell, 'ชื่อเรียกเลขอ้างอิง', $('editRefLabelInput'));

    // 5) ชื่อร้าน/ผู้ขาย
    set('modalSellerName', 'editStoreInput');

    // 6) การ์ดข้อมูลสั่งซื้อ/งาน + การ์ดใบชั่ง
    [['modalCompanyName', 'editCompanyInput'], ['modalJobName', 'editJobInput'],
     ['modalRequester', 'editRequesterInput'], ['modalPayApprover', 'editPayApproverInput'],
     ['modalVehicle', 'editVehicleInput'], ['modalWeightIn', 'editWeightInInput'],
     ['modalWeightOut', 'editWeightOutInput'], ['modalWeightNet', 'editWeightNetInput']
    ].forEach(function (pair) { set(pair[0], pair[1]); });

    // 7) ตารางรายการสินค้า: ตารางอ่านอย่างเดียว ↔ ตารางแก้ไขได้
    const viewItemsWrap = $('modalItemsTableBody') ? $('modalItemsTableBody').closest('div.overflow-x-auto') : null;
    markView(viewItemsWrap);
    const editTable = $('editItemsBody') ? $('editItemsBody').closest('table') : null;
    const editItemsWrap = editTable ? editTable.parentElement : null;
    if (viewItemsWrap && editItemsWrap && viewItemsWrap.parentNode) {
        markEdit(editItemsWrap);
        viewItemsWrap.parentNode.insertBefore(editItemsWrap, viewItemsWrap.nextSibling);
    }
    moveAfter($('editItemBadge') ? $('editItemBadge').parentElement : null, $('modalItemBadge'));

    // 8) หมายเหตุในเอกสาร
    set('modalRemarksBox', 'editRemarkInput');

    // 9) ยอดรวมสุทธิ + สรุปยอด
    const totalsCard = $('modalSumNetTotal') ? $('modalSumNetTotal').closest('div.bg-white') : null;
    if (totalsCard) {
        const viewRows = document.createElement('div');
        viewRows.className = 'mode-view space-y-3';
        Array.prototype.slice.call(totalsCard.children).forEach(function (ch) { viewRows.appendChild(ch); });
        totalsCard.appendChild(viewRows);
        const editRows = document.createElement('div');
        editRows.className = 'mode-edit space-y-3';
        [$('editTotalInput') ? $('editTotalInput').closest('div.bg-emerald-50') : null,
         $('editItemsSum') ? $('editItemsSum').closest('div.bg-slate-50') : null
        ].forEach(function (el) { if (el) editRows.appendChild(el); });
        if (editRows.childNodes.length) totalsCard.appendChild(editRows);
    }

    // 10) กล่องเพิ่มประเภทเอกสาร + กล่องอธิบายการบันทึก
    // v3.21.2: ยึด "กล่องรวมกริด" (ไม่ใช่ div.grid แถวใดแถวหนึ่ง)
    const gridWrap = $('modalInfoGrid') || ($('modalSource') ? $('modalSource').closest('div.space-y-4') : null);
    const addBox = $('editDocTypeAddBox');
    if (addBox && gridWrap && gridWrap.parentNode) {
        markEdit(addBox);
        gridWrap.parentNode.insertBefore(addBox, gridWrap.nextSibling);
    }
    const helpBox = $('editScaleFields') ? $('editScaleFields').closest('div.space-y-4').nextElementSibling : null;
    const dataBox = $('modalTabData');
    if (helpBox && dataBox) { markEdit(helpBox); dataBox.appendChild(helpBox); }

    template.remove();
}

function setDetailMode(mode) {
    const isEdit = (mode === 'edit');
    detailMode = isEdit ? 'edit' : 'view';
    $('detailModal').classList.toggle('mode-edit', isEdit);   // สลับชั้นช่องกรอกในโครงเดิม (ไม่สลับแผง)
    $('detailModal').classList.remove('hidden');   // พรีวิว: ให้หน้าต่างเปิดอยู่เสมอ
    if (isEdit && typeof showDetailTab === 'function') showDetailTab('info');

    const pill = $('detailModePill');
    if (pill) {
        pill.className = isEdit
            ? 'px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm'
            : 'px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm';
        const dot = pill.querySelector('span');
        if (dot) dot.className = isEdit ? 'w-2 h-2 rounded-full bg-amber-500' : 'w-2 h-2 rounded-full bg-emerald-500';
    }
    T('detailModePillText', isEdit ? 'โหมดแก้ไขข้อมูล' : 'โหมดดูข้อมูล');
    show('detailTabsWrap', !isEdit);
    if (isEdit) show('matchTabHint', false);
    show('editOriginInfo2', isEdit);
    const va = $('detailViewActions'), ea = $('detailEditActions');
    if (va) { va.classList.toggle('hidden', isEdit); va.classList.toggle('flex', !isEdit); }
    if (ea) { ea.classList.toggle('hidden', !isEdit); ea.classList.toggle('flex', isEdit); }

    // ปุ่มบนแถบพรีวิว (มีเฉพาะไฟล์นี้)
    [['view', 'View'], ['edit', 'Edit']].forEach(function (k) {
        const b = $('modeBtn' + k[1]);
        if (b) b.className = (k[0] === detailMode)
            ? 'px-2.5 py-1 rounded-md bg-btc-green text-white font-bold'
            : 'px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium';
    });
    if (isEdit) setTimeout(emFitNow, 40);
}

/* ------------------------------------------------------------------
   7) ฟอร์ม "แก้ไขข้อมูล & รูปภาพ" (editModal) — mock ล้วน
   ------------------------------------------------------------------ */
let emZoom = 1, emRot = 0, emFlipX = 1, emFlipY = 1;
let emAiVariant = false;   // สลับชุดข้อมูลเพื่อจำลองผล "อ่านใหม่ (AI)"

function editItemRowHtml(sub) {
    const it = sub || {};
    return `<tr class="hover:bg-slate-50 transition">
        <td class="p-1.5 text-center text-slate-400 font-mono edit-row-no">-</td>
        <td class="p-1.5"><input type="text" class="ui-input edit-name w-full" placeholder="ชื่อสินค้า / วัสดุ" value="${esc(it.name)}"></td>
        <td class="p-1.5"><input type="number" step="any" class="ui-input edit-qty w-full text-center" value="${esc(it.quantity)}" oninput="recalcEditRowTotal(this)"></td>
        <td class="p-1.5"><input type="text" class="ui-input edit-unit w-full text-center" placeholder="หน่วย" value="${esc(it.unit)}"></td>
        <td class="p-1.5"><input type="number" step="any" class="ui-input edit-price w-full text-right" value="${esc(it.price_per_unit)}" oninput="recalcEditRowTotal(this)"></td>
        <td class="p-1.5"><input type="number" step="any" class="ui-input edit-line-total w-full text-right font-semibold" value="${esc(it.total)}" oninput="recalcEditTotal()"></td>
        <td class="p-1.5 text-center"><button onclick="removeEditItemRow(this)" title="ลบรายการนี้" class="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 inline-flex items-center justify-center transition border border-red-200"><i class="fa-solid fa-minus text-[10px]"></i></button></td>
    </tr>`;
}

function updateEditItemIndexes() {
    document.querySelectorAll('#editItemsBody .edit-row-no').forEach(function (td, i) { td.textContent = i + 1; });
}
function renderEditItemRows(items) {
    const body = $('editItemsBody');
    if (!body) return;
    body.innerHTML = (items && items.length) ? items.map(editItemRowHtml).join('') : editItemRowHtml(null);
    updateEditItemIndexes();
    recalcEditTotal();
}
function addEditItemRow() {
    const body = $('editItemsBody');
    if (!body) return;
    body.insertAdjacentHTML('beforeend', editItemRowHtml(null));
    updateEditItemIndexes();
}
function removeEditItemRow(btn) {
    const body = $('editItemsBody');
    const tr = btn && btn.closest('tr');
    if (tr) tr.remove();
    if (body && !body.querySelectorAll('tr').length) body.insertAdjacentHTML('beforeend', editItemRowHtml(null));
    updateEditItemIndexes();
    recalcEditTotal();
}
function recalcEditRowTotal(inp) {
    const tr = inp && inp.closest('tr');
    if (!tr) return;
    const q = parseFloat(tr.querySelector('.edit-qty').value) || 0;
    const p = parseFloat(tr.querySelector('.edit-price').value) || 0;
    tr.querySelector('.edit-line-total').value = (q * p).toFixed(2);
    recalcEditTotal();
}
function recalcEditTotal() {
    let sum = 0;
    document.querySelectorAll('#editItemsBody .edit-line-total').forEach(function (i) { sum += parseFloat(i.value) || 0; });
    if (!editTotalManual) { const el = $('editTotalInput'); if (el) el.value = sum.toFixed(2); }
    updateEditSummary(sum);
}
function updateEditSummary(itemsSum) {
    const totalEl = $('editTotalInput');
    const total = totalEl ? (parseFloat(totalEl.value) || 0) : 0;
    const diff = Math.round(((total - itemsSum) + Number.EPSILON) * 100) / 100;
    T('editItemsSum', itemsSum.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท');
    const diffEl = $('editTotalDiff');
    if (diffEl) {
        diffEl.textContent = (diff > 0 ? '+' : '') + diff.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท';
        diffEl.className = 'font-mono font-semibold ' + (Math.abs(diff) < 0.005 ? 'text-emerald-700' : 'text-amber-700');
    }
    T('editTotalBahtText', '(' + currentBahtText + ')');
}
let editTotalManual = false;
let currentBahtText = '-';

function emSetStatus(msg) { T('emStatus', msg || ''); }
function toggleScaleFields(type) {
    show('editScaleFields', sampleIsScale(type));
    show('modalScaleInfo', sampleIsScale(type));   // v3.21.0: การ์ดที่โชว์จริงคือการ์ดในแผงดูข้อมูล
}
function updateEditDocTypeTaxHint() { /* mock — ไม่มีผลกับโครง */ }
function refreshEditDocNoVisibility() { /* mock */ }
function submitNewDocType() { toast('เพิ่มประเภทเอกสารใหม่ทำงานเฉพาะในระบบจริง'); }
function saveEditReceipt() { toast('บันทึกการแก้ไข — ระบบจริงจะเขียนชีต + Supabase แล้วรีเฟรชแถวเดียว'); }
function closeEditModal() { setDetailMode('view'); }

function sampleIsScale(type) {
    const t = String(type || '').trim();
    return t === 'ใบชั่ง' || t === 'ใบชั่งน้ำหนัก';
}

// วาดรูปบิล mock ลง canvas ของฟอร์มแก้ไข
function emLoadImageForEdit(s) {
    const c = $('editModalCanvas');
    if (!c) return;
    const im = new Image();
    im.onload = function () {
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        c.classList.remove('hidden');
        const ph = $('emPlaceholder'); if (ph) ph.style.display = 'none';
        emApplyTransform();
        emFitNow();
    };
    im.src = mockReceiptDataURL(s);
}
function emApplyTransform() {
    const c = $('editModalCanvas');
    if (!c) return;
    c.style.transformOrigin = 'center center';
    c.style.transform = `scale(${emZoom}) rotate(${emRot}deg) scaleX(${emFlipX}) scaleY(${emFlipY})`;
}
function emFitNow() { emZoom = 1; emRot = 0; emFlipX = 1; emFlipY = 1; emApplyTransform(); T('emZoomLabel', '100%'); }
function emZoomStep(d) {
    emZoom = Math.min(Math.max(emZoom * (d > 0 ? 1.18 : 1 / 1.18), 0.2), 6);
    emApplyTransform();
    T('emZoomLabel', Math.round(emZoom * 100) + '%');
}
function emZoomReset() { emFitNow(); }
function emRotate(dir) { emRot = ((emRot + (dir === 'right' ? 90 : -90)) % 360 + 360) % 360; emApplyTransform(); }
function emFlip(axis) { if (axis === 'v') emFlipY *= -1; else emFlipX *= -1; emApplyTransform(); }
function emReset() { emFitNow(); const b = $('emBrightness'); if (b) b.value = 0; emSetBrightness(0); }
function emSetBrightness(v) {
    const c = $('editModalCanvas');
    if (c) c.style.filter = 'brightness(' + (100 + Number(v || 0) * 0.7) + '%)';
}
function emToggleCrop() { toast('โหมดครอปทำงานเฉพาะในระบบจริง (วาดวงครอปบน canvas แล้วบันทึกทับไฟล์เดิม)'); }

/* ------------------------------------------------------------------
   8) เติมฟอร์มแก้ไขจากตัวอย่าง (ใช้ชุดเดียวกับ renderSample)
   ------------------------------------------------------------------ */
function setSelectValue(id, value) {
    const sel = $(id);
    if (!sel) return;
    const has = Array.from(sel.options).some(function (o) { return o.value === value; });
    if (!has && value) {
        const opt = document.createElement('option');
        opt.value = value; opt.text = value;
        const addOpt = sel.querySelector('option[value="__ADD_NEW__"]');
        sel.insertBefore(opt, addOpt);
    }
    sel.value = value;
}

function renderEditSample(kind, aiVariant) {
    const base = SAMPLES[kind] || SAMPLES.TAX;
    // ชุด "AI อ่านใหม่": สลับไปใช้ค่าแก้ (ค่าต่างจากเดิมบางช่อง) เพื่อสาธิตการเติมฟอร์ม
    const s = aiVariant ? Object.assign({}, base, emAiDiff(base)) : base;
    const touched = aiVariant ? aiVariant.touched : [];
    currentBahtText = s.bahtText;

    T('editOriginInfo2', 'แก้ไขบิล ' + s.systemRecordNo + ': PO ' + (s.po || '-') + ' | วันที่ในบิล: ' + fmtDate(s.date));
    emSetStatus(aiVariant ? 'AI อ่านใหม่แล้ว — ยังไม่บันทึก (รอตรวจในฟอร์ม)' : '');

    const set = function (id, v) { const el = $(id); if (el) el.value = v == null ? '' : String(v); };
    set('editDocNoInput', s.docLabel);
    set('editBookInput', s.hiddenDocNos ? '2/2565' : '');
    set('editTaxInvoiceInput', s.taxInvoiceNo);
    set('editRefNoInput', s.refNo);
    set('editRefLabelInput', '');
    set('editDateInput', s.date);
    set('editStoreInput', s.seller.name);
    setSelectValue('editCategorySelect', s.category);
    setSelectValue('editDocTypeSelect', s.docTypeName);
    set('editPoInput', s.po);
    set('editCompanyInput', s.buyer.name);
    set('editJobInput', 'โครงการหนองบัว');
    set('editRequesterInput', s.buyer.requester);
    set('editPayApproverInput', s.buyer.payApprover);
    set('editVehicleInput', s.scale ? s.scale.vehicle : '');
    set('editWeightInInput', s.scale ? '24.620' : '');
    set('editWeightOutInput', s.scale ? '12.120' : '');
    set('editWeightNetInput', s.scale ? '12.5000' : '');
    set('editRemarkInput', s.remarks);

    T('editSystemRecordNo', s.systemRecordNo);
    T('editSource', s.source);
    const snd = $('editSender');
    if (snd) snd.innerHTML = '<i class="fa-solid fa-user text-btc-green text-[10px]"></i><span>' + esc(s.sender) + '</span>';

    // รายการ + ยอด (ยอดรวมจาก AI = คงไว้ตามใบ ไม่ทับด้วยผลรวมรายการ)
    editTotalManual = true;
    renderEditItemRows(s.items.map(function (it) { return { name: it.name, quantity: it.qty, unit: it.unit, price_per_unit: it.price, total: it.qty * it.price }; }));
    set('editTotalInput', s.net.toFixed(2));
    let sum = 0;
    document.querySelectorAll('#editItemsBody .edit-line-total').forEach(function (i) { sum += parseFloat(i.value) || 0; });
    updateEditSummary(sum);

    // ส่วนโชว์/ซ่อนตามประเภทเอกสาร (นโยบายเดียวกับระบบจริง)
    show('editBookBox', !!$('editBookInput').value);
    show('editTaxInvoiceBox', !!s.file.sections.taxInv);
    show('editRefNoBox', true);
    show('editRefLabelBox', true);
    // v3.21.0: การ์ดข้อมูลสั่งซื้อ/งาน + ใบชั่ง ที่โชว์จริงคือการ์ดในแผงดูข้อมูล (ช่องกรอกถูกย้ายเข้าไปอยู่แล้ว)
    show('editPoFieldsCard', !!(s.file.sections.poFields || s.po));
    show('editScaleFields', !!s.file.sections.scale);
    show('modalScaleInfo', !!s.file.sections.scale);

    emLoadImageForEdit(s);

    // ไฮไลต์ช่องที่ AI เติมใหม่ (จำลอง) — เหมือน ring-2 ring-amber-300 ของระบบจริง
    document.querySelectorAll('#editModal [data-ai-changed]').forEach(function (el) { el.classList.remove('ring-2', 'ring-amber-300'); el.removeAttribute('data-ai-changed'); });
    touched.forEach(function (id) {
        const el = $(id);
        if (!el) return;
        el.setAttribute('data-ai-changed', '1');
        el.classList.add('ring-2', 'ring-amber-300');
    });
    if (touched.length) setTimeout(function () {
        touched.forEach(function (id) { const el = $(id); if (el) el.classList.remove('ring-2', 'ring-amber-300'); });
    }, 8000);
}

// ค่าที่ "AI อ่านใหม่" ได้ — จำลองว่าต่างจากค่าเดิม 3 ช่อง (เพื่อให้เห็นการเติม + ไฮไลต์)
function emAiDiff(base) {
    return {
        docLabel: base.docLabel,
        taxInvoiceNo: base.taxInvoiceNo,
        date: base.date,
        category: base.category === 'ค่าอะไหล่' ? 'ค่าซ่อมบำรุง' : base.category,
        net: base.net,
        bahtText: base.bahtText,
        remarks: (base.remarks || '') + '\nหมายเหตุเพิ่มเติม: AI อ่านลายมือท้ายใบได้',
        touched: ['editCategorySelect', 'editRemarkInput', 'editDocNoInput']
    };
}

// ปุ่ม "อ่านใหม่ (AI)" ในหน้าต่างแก้ไข — พรีวิวนี้จำลองการอ่าน + เติมฟอร์ม
function emReanalyzeIntoForm(btn) {
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอ่าน...'; }
    emSetStatus('AI กำลังอ่านภาพบิลใหม่...');
    setTimeout(function () {
        renderEditSample(currentSampleKind, { touched: [] });
        const touched = ['editCategorySelect', 'editRemarkInput', 'editDocNoInput'];
        renderEditSample(currentSampleKind, { touched: touched });
        toast('(พรีวิว) AI อ่านใหม่เสร็จ — เติมค่าลงฟอร์ม 3 ช่อง (ระบบจริงอ่านจากรูป Drive จริง)');
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }, 1200);
}

/* ------------------------------------------------------------------
   9) เปิดหน้าต่าง + ผูกอีเวนต์ซูม
   ------------------------------------------------------------------ */
mountEditControlsIntoView();   // หน้าต่างเดียว หน้าตาเดียว (เหมือน index.html จริง)
renderSample('TAX');
renderEditSample('TAX');
$('detailModal').classList.remove('hidden');   // ในระบบจริง openDetailItem() เป็นคนเปิดหน้าต่าง
setDetailMode('view');       // เริ่มที่โหมดดูข้อมูล

const st = stage();
if (st) {
    st.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
    st.addEventListener('mousedown', (e) => { if (zScale <= zFit * 1.001) return; drag = { mx: e.clientX, my: e.clientY, tx: zTx, ty: zTy }; e.preventDefault(); });
    st.addEventListener('dblclick', (e) => { e.preventDefault(); fitNow(); });
}
window.addEventListener('mousemove', (e) => { if (!drag) return; zTx = drag.tx + e.clientX - drag.mx; zTy = drag.ty + e.clientY - drag.my; applyT(); });
window.addEventListener('mouseup', () => { drag = null; });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('resize', () => fitNow());
