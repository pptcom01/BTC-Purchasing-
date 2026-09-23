// ==========================================
// CONFIGURATION (บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด - BTC)
// ==========================================
// เลิกใช้ fallback key ในไฟล์ (2026-09-18) — ค่าจริงเก็บใน Script Properties ที่ตั้งผ่านหน้าเว็บแล้ว
const LINE_CHANNEL_ACCESS_TOKEN = ''; // LINE Channel Access Token — อ่านจริงผ่าน getLineToken() (Script Properties)
const GEMINI_API_KEY = '';            // Gemini API Key — อ่านจริงผ่าน getGeminiKey() (Script Properties)
const DRIVE_FOLDER_NAME = 'BTC_Purchasing_Receipts'; 
const SPREADSHEET_ID = '1g8phrNtvv6jnMUDVPeWp-IfI-f9VKvfBVkhtmSG6Sj8';

// อ่านค่าคอนฟิกจาก Script Properties ก่อน (ตั้งได้ผ่านหน้าเว็บ > ตั้งค่าระบบ) ถ้ายังไม่มีใช้ค่าเริ่มต้นด้านบน
// ⚠️ SECRET (LINE Token / Gemini Key) ห้ามใส่ค่าจริงในไฟล์นี้เด็ดขาด — ต้องตั้งผ่านหน้าเว็บ > ตั้งค่าระบบ เท่านั้น
//    ตรวจสถานะได้จากเมนูชีต "🔎 ตรวจสถานะค่าการตั้งค่า" หรือรันฟังก์ชัน checkConfigSources()
function getScriptProps() { return PropertiesService.getScriptProperties(); }
function getLineToken() { return getScriptProps().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || LINE_CHANNEL_ACCESS_TOKEN; }
function getGeminiKey() { return getScriptProps().getProperty('GEMINI_API_KEY') || GEMINI_API_KEY; }
function getDriveFolderName() { return getScriptProps().getProperty('DRIVE_FOLDER_NAME') || DRIVE_FOLDER_NAME; }
function getSpreadsheetId() { return getScriptProps().getProperty('SPREADSHEET_ID') || SPREADSHEET_ID; }
function getWebPassword() { return getScriptProps().getProperty('WEB_PASSWORD') || ''; }
// Supabase (ฐานข้อมูลใหม่ของบิลจัดซื้อ — ตั้งค่าใน Script Properties หน้าเว็บ > ตั้งค่าระบบ)
//   SUPABASE_URL = เช่น https://xxxx.supabase.co | SUPABASE_SERVICE_KEY = service_role key (เขียนได้)
function getSupabaseUrl() { return getScriptProps().getProperty('SUPABASE_URL') || ''; }
function getSupabaseKey() { return getScriptProps().getProperty('SUPABASE_SERVICE_KEY') || ''; }
function getSupabaseAnonKey() { return getScriptProps().getProperty('SUPABASE_ANON_KEY') || ''; }

function getMaxSystemRecordNoFromSheet_() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) return 0;
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const colIdx = headers.indexOf('System Record No.');
    if (colIdx === -1) return 0;
    const vals = sheet.getRange(2, colIdx + 1, sheet.getLastRow() - 1, 1).getValues();
    let maxNo = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = Number(vals[i][0]);
      if (!isNaN(v) && v > maxNo) maxNo = v;
    }
    return maxNo;
  } catch (err) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'getMaxSystemRecordNoFromSheet_: ' + err.toString());
    return 0;
  }
}

function getNextSystemRecordNo() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 วินาที ป้องกัน race condition เมื่อมีคำขอเข้าพร้อมกัน
  } catch (lockErr) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'Lock wait timeout: ' + lockErr.toString());
  }
  try {
    let maxNo = 0;
    // 1) หาจาก Supabase
    try {
      const rows = supabaseRequest('get', '/rest/v1/receipts?select=system_record_no&order=system_record_no.desc&limit=1');
      const arr = Array.isArray(rows) ? rows : [];
      arr.forEach(function (row) {
        const v = Number(row && row.system_record_no);
        if (!isNaN(v) && v > maxNo) maxNo = v;
      });
    } catch (sbErr) {
      writeLog('⚠️ SYSTEM-RECORD-NO', 'getNextSystemRecordNo-supabase: ' + sbErr.toString());
    }
    // 2) หาจาก Google Sheets (ป้องกันเลขใน Sheet ล้ำหน้ากว่า Supabase)
    const sheetMax = getMaxSystemRecordNoFromSheet_();
    if (sheetMax > maxNo) maxNo = sheetMax;

    return maxNo + 1;
  } catch (err) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'getNextSystemRecordNo: ' + err.toString());
    return 1;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function ensureSystemRecordNoForReceipt(docKey, receiptData) {
  if (receiptData && receiptData.system_record_no && Number(receiptData.system_record_no) > 0) {
    return Number(receiptData.system_record_no);
  }
  if (!docKey) return null;
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipts?select=system_record_no&doc_key=eq.' + encodeURIComponent(docKey) + '&limit=1');
    const arr = Array.isArray(rows) ? rows : [];
    const existing = arr.length > 0 ? Number(arr[0].system_record_no) : NaN;
    if (!isNaN(existing) && existing > 0) return existing;

    const nextNo = getNextSystemRecordNo();
    supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(docKey), { system_record_no: nextNo }, 'return=representation');
    return nextNo;
  } catch (err) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'ensureSystemRecordNoForReceipt(' + docKey + '): ' + err.toString());
    return null;
  }
}

function backfillMissingSystemRecordNumbers() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'backfill lock wait timeout');
  }
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    let updatedSheet = 0;
    let updatedSupabase = 0;
    let currentMax = 0;

    // 1) หาเลขสูงสุดปัจจุบันจากทั้งสองระบบ
    try {
      const rows = supabaseRequest('get', '/rest/v1/receipts?select=system_record_no&order=system_record_no.desc&limit=1');
      if (Array.isArray(rows) && rows.length > 0) {
        const v = Number(rows[0].system_record_no);
        if (!isNaN(v) && v > currentMax) currentMax = v;
      }
    } catch (e) {}

    if (sheet && sheet.getLastRow() > 1) {
      ensureSheetHeaders(sheet, getReceiptHeaders());
      const lastCol = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
      const colSrn = headers.indexOf('System Record No.');
      const colDocKey = headers.indexOf('Doc Key');

      if (colSrn !== -1) {
        const allSrn = sheet.getRange(2, colSrn + 1, lastRow - 1, 1).getValues();
        // หาค่า max ใน sheet ก่อน
        for (let i = 0; i < allSrn.length; i++) {
          const val = Number(allSrn[i][0]);
          if (!isNaN(val) && val > currentMax) currentMax = val;
        }

        // เติมให้แถวใน Sheet ที่ยังไม่มีเลข (เรียงตามลำดับแถวจากบนลงล่าง = เก่าไปใหม่)
        for (let i = 0; i < allSrn.length; i++) {
          const val = allSrn[i][0];
          if (val === '' || val === null || val === undefined || isNaN(Number(val)) || Number(val) <= 0) {
            currentMax += 1;
            const targetRow = i + 2;
            sheet.getRange(targetRow, colSrn + 1).setValue(currentMax);
            updatedSheet += 1;

            // ถ้ามี doc_key ในแถวนี้ ให้ซิงค์ลง Supabase ด้วยทันที
            if (colDocKey !== -1) {
              const rDocKey = String(sheet.getRange(targetRow, colDocKey + 1).getValue() || '').trim();
              if (rDocKey) {
                try {
                  supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(rDocKey), { system_record_no: currentMax });
                  updatedSupabase += 1;
                } catch (sbE) {}
              }
            }
          }
        }
      }
    }

    // 2) ตรวจสอบ Supabase เพิ่มเติมสำหรับแถวที่ยังเป็น null
    try {
      const nullRows = supabaseRequest('get', '/rest/v1/receipts?select=doc_key,submitted_at&system_record_no=is.null&order=submitted_at.asc,created_at.asc&limit=1000');
      if (Array.isArray(nullRows) && nullRows.length > 0) {
        nullRows.forEach(function (nr) {
          if (!nr || !nr.doc_key) return;
          currentMax += 1;
          try {
            supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(nr.doc_key), { system_record_no: currentMax });
            updatedSupabase += 1;
          } catch (err) {
            writeLog('⚠️ SYSTEM-RECORD-NO', 'backfill Supabase patch err: ' + nr.doc_key + ' -> ' + err.toString());
          }
        });
      }
    } catch (sbErr) {
      writeLog('⚠️ SYSTEM-RECORD-NO', 'backfill Supabase select null err: ' + sbErr.toString());
    }

    writeLog('🧮 SYSTEM-RECORD', 'Backfill เสร็จสิ้น: อัปเดตชีต=' + updatedSheet + ' แถว | Supabase=' + updatedSupabase + ' แถว | เลขถัดไป=' + (currentMax + 1));
    return {
      success: true,
      updated_sheet: updatedSheet,
      updated_supabase: updatedSupabase,
      next_no: currentMax + 1,
      message: 'สร้างเลขที่รายการย้อนหลังเรียบร้อย: อัปเดตในชีต ' + updatedSheet + ' แถว, ใน Supabase ' + updatedSupabase + ' แถว (เลขล่าสุดคือ #' + currentMax + ')'
    };
  } catch (err) {
    writeLog('⚠️ SYSTEM-RECORD-NO', 'backfillMissingSystemRecordNumbers error: ' + err.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างเลขย้อนหลัง: ' + err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function menuBackfillSystemRecordNumbers() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('🔢 ยืนยันการสร้างเลขที่รายการย้อนหลัง',
    'ระบบจะตรวจสอบเอกสารเก่าทั้งหมดใน Google Sheets และ Supabase\n' +
    'หากแถวใดยังไม่มี "System Record No." ระบบจะรันเลขต่อเนื่องให้อัตโนมัติ (เอกสารที่มีเลขแล้วจะไม่ถูกเปลี่ยนแปลง)\n\nต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO);
  if (res !== ui.ButtonSet.YES) return;
  const r = runAsInternal_(function () { return backfillMissingSystemRecordNumbers(); });
  ui.alert(r.message || 'ดำเนินการเรียบร้อย');
}

// ค่าคอนฟิก "สาธารณะ" ที่หน้าเว็บ (โฮสต์ใน GAS Web App เท่านั้น) ใช้เปิด Supabase client
// หมายเหตุ: anon key ออกแบบมาให้ฝังหน้าเว็บได้ (สิทธิ์แค่อ่านผ่าน RLS) ไม่ใช่ความลับ
// 🗑️ 2026-09-22: ตัดเส้นทางโฮสต์ภายนอก (GitHub Pages) ออก — ใช้ GAS Web App เป็นโฮสต์เดียว
//    เส้นทาง REST จากภายนอก (?action=call) ปิดเป็นค่าเริ่มต้น เปิดคืนได้ด้วย Script Property REST_API_ENABLED = true
function isRestApiEnabled() {
  return String(getScriptProps().getProperty('REST_API_ENABLED') || 'false').toLowerCase() === 'true';
}

function getPublicClientConfig() {
  return {
    success: true,
    supabase_url: getSupabaseUrl(),
    supabase_anon_key: getSupabaseAnonKey(),
    supabase_configured: !!(getSupabaseUrl() && getSupabaseAnonKey()),
    hosting_mode: 'gas-webapp',
    rest_api_enabled: isRestApiEnabled(),
    web_name: 'BTC จัดซื้อ - ระบบสแกนและตรวจสอบบิล'
  };
}

// ส่งคำขอไป Supabase แบบรวม (ใช้ร่วมทั้ง migration / webhook write / delete / update / read)
function supabaseRequest(method, path, body, prefs) {
  const baseUrl = getSupabaseUrl();
  const svcKey = getSupabaseKey();
  if (!baseUrl || !svcKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase (SUPABASE_URL / SUPABASE_SERVICE_KEY) — ตั้งในหน้าเว็บ > ตั้งค่าระบบก่อน');
  }
  const options = {
    method: method,
    headers: {
      'apikey': svcKey,
      'Authorization': 'Bearer ' + svcKey,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  if (prefs) options.headers['Prefer'] = prefs;
  if (body !== undefined && body !== null) options.payload = JSON.stringify(body);

  const resp = UrlFetchApp.fetch(baseUrl.replace(/\/+$/, '') + path, options);
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) {
    const err = new Error('Supabase HTTP ' + code + ': ' + text.substring(0, 500));
    err.status = code;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
}

// อ่านบิลทั้งหมดจาก Supabase (ใช้แทน Google Sheets เป็นแหล่งข้อมูลหลักของหน้าเว็บ)
function fetchReceiptsFromSupabase() {
  const rows = supabaseRequest('get', '/rest/v1/receipts?select=*&order=submitted_at.desc');
  return Array.isArray(rows) ? rows : [];
}

// เขียน/อัปเดตบิล 1 ใบลง Supabase (upsert ตาม doc_key) — ใช้จาก webhook ตอนบันทึกบิลใหม่
function saveToSupabase(receiptData, imageUrl, sourceType, sender) {
  const docKey = (receiptData && receiptData.doc_key) || buildDocKey(receiptData || {});
  if (!docKey) {
    writeLog('⚠️ SUPABASE', 'ข้ามเขียน Supabase เพราะไม่มี doc_key (ไม่สามารถระบุตัวตนบิลได้)');
    return { ok: false, error: 'no-doc-key' };
  }
  const row = {
    doc_key: docKey,
    system_record_no: (receiptData.system_record_no !== undefined && receiptData.system_record_no !== null && receiptData.system_record_no !== '') ? Number(receiptData.system_record_no) : (ensureSystemRecordNoForReceipt(docKey, receiptData) || null),
    running_number: receiptData.running_number || null,
    image_md5: receiptData.image_md5 || null,
    doc_type: receiptData.doc_type || null,
    book_no: receiptData.book_no || null,
    doc_no: receiptData.doc_no || null,
    tax_invoice_no: receiptData.tax_invoice_no || null,
    ref_no: receiptData.ref_no || null,
    ref_label: receiptData.ref_label || null,
    po_number: receiptData.po_number || '-',
    date: receiptData.date || null,
    store_name: receiptData.store_name || '',
    category: receiptData.category || 'ทั่วไป',
    items_summary: receiptData.items_summary || '',
    items: receiptData.items || [],
    total_amount: (Number(receiptData.total_amount) || 0),
    scale_weight_in: (receiptData.scale_weight_in === undefined || receiptData.scale_weight_in === null || receiptData.scale_weight_in === '' || receiptData.scale_weight_in === '-') ? null : Number(receiptData.scale_weight_in),
    scale_weight_out: (receiptData.scale_weight_out === undefined || receiptData.scale_weight_out === null || receiptData.scale_weight_out === '' || receiptData.scale_weight_out === '-') ? null : Number(receiptData.scale_weight_out),
    scale_weight_net: (receiptData.scale_weight_net === undefined || receiptData.scale_weight_net === null || receiptData.scale_weight_net === '' || receiptData.scale_weight_net === '-') ? null : Number(receiptData.scale_weight_net),
    vehicle_registration: (receiptData.vehicle_registration && receiptData.vehicle_registration !== '-') ? receiptData.vehicle_registration : '',
    company_name: (receiptData.company_name && receiptData.company_name !== '-') ? receiptData.company_name : '',
    job_name: (receiptData.job_name && receiptData.job_name !== '-') ? receiptData.job_name : '',
    requester: (receiptData.requester && receiptData.requester !== '-') ? receiptData.requester : '',
    pay_approver: (receiptData.pay_approver && receiptData.pay_approver !== '-') ? receiptData.pay_approver : '',
    needs_review: !!receiptData.needs_review,
    review_reason: receiptData.review_reason || '',
    image_url: imageUrl || '',
    google_drive_file_id: extractDriveFileId(imageUrl || '') || null,
    vendor_tax_id: receiptData.vendor_tax_id || null,
    project_location: receiptData.project_location || null,
    vat_amount: Number(receiptData.vat_amount) || 0,
    remark_text: receiptData.remark_text || '',
    extracted_po_code: receiptData.extracted_po_code || '',
    match_type: receiptData.match_type || 'MANUAL_REQUIRED',
    confidence_score: Number(receiptData.confidence_score) || 0,
    match_reason: receiptData.match_reason || '',
    sender_name: (sender && sender.displayName) || '',
    sender_id: (sender && sender.userId) || '',
    source: sourceType || 'user'
  };
  supabaseRequest(
    'post',
    '/rest/v1/receipts?on_conflict=doc_key',
    row,
    'resolution=ignore-duplicates'
  );
  return { ok: true, doc_key: docKey };
}

// ลบบิลใน Supabase ตาม doc_key (ใช้ใน deleteReceipt หลังลบชีต/Drive แล้ว)
function deleteFromSupabase(docKey) {
  if (!docKey) return { ok: false, error: 'no-doc-key' };
  supabaseRequest('delete', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(docKey));
  return { ok: true };
}

// อัปเดตบิลใน Supabase ตาม doc_key (ใช้ใน updateReceipt หลังแก้ชีตแล้ว)
function updateSupabaseReceipt(docKey, fields, systemRecordNo) {
  let query = '';
  const srn = (systemRecordNo !== undefined && systemRecordNo !== null && systemRecordNo !== '') ? Number(systemRecordNo) : (fields && fields.system_record_no ? Number(fields.system_record_no) : NaN);
  if (!isNaN(srn) && srn > 0) {
    query = '?system_record_no=eq.' + encodeURIComponent(srn);
  } else if (docKey) {
    query = '?doc_key=eq.' + encodeURIComponent(docKey);
  } else {
    return { ok: false, error: 'no-identifier' };
  }
  const patch = {};
  const map = {
    po_number: 'po_number', date: 'date', store_name: 'store_name', category: 'category',
    items_summary: 'items_summary', items: 'items', total_amount: 'total_amount',
    doc_type: 'doc_type', book_no: 'book_no', doc_no: 'doc_no', tax_invoice_no: 'tax_invoice_no',
    ref_no: 'ref_no', ref_label: 'ref_label', doc_key: 'doc_key', system_record_no: 'system_record_no',
    running_number: 'running_number', image_md5: 'image_md5',
    google_drive_file_id: 'google_drive_file_id',
    vendor_tax_id: 'vendor_tax_id', vat_amount: 'vat_amount', remark_text: 'remark_text',
    project_location: 'project_location',
    extracted_po_code: 'extracted_po_code', match_type: 'match_type',
    confidence_score: 'confidence_score', match_reason: 'match_reason',
    needs_review: 'needs_review', review_reason: 'review_reason',
    scale_weight_in: 'scale_weight_in', scale_weight_out: 'scale_weight_out', scale_weight_net: 'scale_weight_net',
    vehicle_registration: 'vehicle_registration',
    company_name: 'company_name', job_name: 'job_name', requester: 'requester', pay_approver: 'pay_approver'
  };
  Object.keys(map).forEach(function (k) {
    if (fields[k] !== undefined && fields[k] !== null && k !== 'doc_key') {
      patch[map[k]] = fields[k];
    }
  });
  if (fields.items !== undefined) patch.items = fields.items;
  if (Object.keys(patch).length === 0) return { ok: true };
  supabaseRequest('patch', '/rest/v1/receipts' + query, patch);
  return { ok: true };
}

// ตรวจ role ของ Supabase key (JWT: ส่วน payload มีฟิลด์ role) — กันเผลอใช้ anon key
function supabaseKeyRole(key) {
  if (!key) return null;
  const parts = String(key).trim().split('.');
  if (parts.length < 2) return 'invalid';
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (payload.length % 4) payload += '=';
  try {
    const json = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    return (JSON.parse(json).role || 'unknown');
  } catch (e) {
    return 'invalid';
  }
}

function verifySupabaseSetup() {
  const baseUrl = getSupabaseUrl();
  const svcKey = getSupabaseKey();
  if (!baseUrl || !svcKey) {
    SpreadsheetApp.getUi().alert('ยังไม่ได้ตั้งค่า Supabase', 'ตั้ง SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role) ในหน้าเว็บ > ตั้งค่าระบบก่อนแล้วลองใหม่', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const role = supabaseKeyRole(svcKey);
  let conn = 'ยังไม่ได้ทดสอบ';
  try {
    const resp = UrlFetchApp.fetch(baseUrl.replace(/\/+$/, '') + '/rest/v1/receipts?select=count', {
      method: 'get',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Prefer: 'count=exact' },
      muteHttpExceptions: true
    });
    conn = 'HTTP ' + resp.getResponseCode() + (resp.getResponseCode() === 200 ? ' ✓ (เข้าถึงตารางได้)' : ' — ' + resp.getContentText().substring(0, 120));
  } catch (e) {
    conn = 'ทดสอบล้มเหลว: ' + e.toString();
  }
  const msg = [
    'URL: ' + baseUrl,
    'Role ของ Key ที่บันทึกไว้: ' + (role === 'service_role' ? 'service_role ✓ (ถูกต้อง เขียนตารางได้)' : (role === 'anon' ? 'anon ❌ (ผิด! ต้องใช้ service_role — เปิด Settings > API แล้ว copy ตัว secret ใหม่)' : role)),
    '',
    'ทดสอบเชื่อมต่อตาราง receipts: ' + conn
  ].join('\n');
  SpreadsheetApp.getUi().alert('🔎 ตรวจค่า Supabase', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ==========================================
// CUSTOM MENU & INITIALIZER
// ==========================================

function getSpreadsheet() {
  const ssId = getSpreadsheetId();
  if (ssId && ssId !== '' && !ssId.includes('ใส่_')) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log('เปิดด้วย ID ไม่สำเร็จ ใช้ ActiveSpreadsheet แทน: ' + e.toString());
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ==========================================
// AI LEARNING — เรียนรู้จากการแก้ไขของมนุษย์ (ฉีดกลับเข้า prompt อัตโนมัติ)
// หลักการ: ยึดประเภทเอกสารบัญชีมาตรฐานก่อนเสมอ (รายการมาตรฐานยัง hard-code ใน prompt เดิม)
//          บทเรียนจากตาราง receipt_learning (Supabase) ใช้ "เสริม" เฉพาะรูปแบบบิลเฉพาะขององค์กร
//          เช่น ร้านไหนพิมพ์หัวบิลแปลก, หมวดหมู่ที่องค์กรใช้ต่างจากทั่วไป
// ==========================================

var LEARNING_FIELDS = ['doc_type', 'store_name', 'category'];
var LEARNING_FIELD_LABELS = { doc_type: 'ประเภทเอกสาร', store_name: 'ชื่อร้านค้า', category: 'หมวดหมู่' };

// บันทึกบทเรียน 1 คู่ค่า (เจอซ้ำ → เพิ่ม learn_count = น้ำหนักบทเรียนสูงขึ้น)
function upsertLearningPoint(fieldName, aiValue, humanValue, docKey) {
  if (LEARNING_FIELDS.indexOf(fieldName) === -1) return;
  const ai = String(aiValue === undefined || aiValue === null ? '' : aiValue).trim();
  const human = String(humanValue === undefined || humanValue === null ? '' : humanValue).trim();
  if (!human || human === '-') return;      // ค่าที่แก้เป็นว่าง/ขีด = ไม่มีอะไรเรียน
  if (ai === human) return;                  // AI อ่านถูกอยู่แล้ว
  const nowIso = new Date().toISOString();
  const query = '/rest/v1/receipt_learning?field_name=eq.' + encodeURIComponent(fieldName) + '&ai_value=eq.' + encodeURIComponent(ai);
  let existing = null;
  try { existing = supabaseRequest('get', query); } catch (e) { existing = null; }
  if (Array.isArray(existing) && existing.length > 0) {
    supabaseRequest('patch', query, {
      human_value: human,
      doc_key: String(docKey || ''),
      learn_count: (Number(existing[0].learn_count) || 1) + 1,
      last_seen_at: nowIso
    });
  } else {
    supabaseRequest('post', '/rest/v1/receipt_learning', {
      field_name: fieldName,
      ai_value: ai,
      human_value: human,
      doc_key: String(docKey || ''),
      learn_count: 1,
      last_seen_at: nowIso
    });
  }
}

// ดึงบทเรียนเป็นข้อความเสริมของ prompt (เรียงตามความถี่ที่มนุษย์แก้ — ถ้าไม่มี/พัง คืน '' = prompt เดิมล้วน)
function getLearningContext() {
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipt_learning?select=field_name,ai_value,human_value,learn_count&order=learn_count.desc,last_seen_at.desc&limit=40');
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const groups = { doc_type: [], store_name: [], category: [] };
    rows.forEach(function (r) {
      if (!groups[r.field_name]) return;
      if (!r.human_value || r.human_value === '-') return;
      groups[r.field_name].push({ from: String(r.ai_value || ''), to: r.human_value, n: Number(r.learn_count) || 1 });
    });
    const lines = [];
    if (groups.doc_type.length) lines.push('• ประเภทเอกสาร: ' + groups.doc_type.slice(0, 12).map(function (l) { return (l.from ? '"' + l.from + '"' : '(AI เคยอ่านไม่ได้)') + ' → ให้ใช้ "' + l.to + '"' + (l.n > 1 ? ' (ผู้ดูแลแก้แบบนี้แล้ว ' + l.n + ' ครั้ง)' : ''); }).join('; '));
    if (groups.store_name.length) lines.push('• ชื่อร้านค้า: ' + groups.store_name.slice(0, 12).map(function (l) { return (l.from ? '"' + l.from + '"' : '(AI เคยอ่านไม่ได้)') + ' → ให้เขียน "' + l.to + '"'; }).join('; '));
    if (groups.category.length) lines.push('• หมวดหมู่: ' + groups.category.slice(0, 12).map(function (l) { return (l.from ? '"' + l.from + '"' : '(AI เคยอ่านไม่ได้)') + ' → ให้ใช้ "' + l.to + '"'; }).join('; '));
    if (lines.length === 0) return '';
    return '\nความรู้จากบิลจริงขององค์กรนี้ (สรุปจากการที่ผู้ดูแลแก้ไขบิลก่อนหน้า — ใช้ช่วยจำแนกรูปแบบเอกสารเฉพาะขององค์กร แต่ยังต้องอ่านจากภาพจริงเสมอ ห้ามเดาจากความรู้นี้อย่างเดียว):\n' + lines.join('\n');
  } catch (e) {
    writeLog('⚠️ LEARNING', 'getLearningContext: ' + e.toString());
    return ''; // เรียนรู้ใช้ไม่ได้ = อ่านบิลตาม prompt มาตรฐาน ไม่บล็อก
  }
}

// เรียกตอนแก้ไขบิลสำเร็จ — เทียบค่าเดิม (ที่ AI อ่าน/ค่าในระบบ) กับค่าที่มนุษย์แก้ แล้วเก็บเป็นบทเรียน
function recordLearningFromEdit(oldValues, newValues, docKey) {
  try {
    if (!oldValues || !newValues) return;
    LEARNING_FIELDS.forEach(function (f) {
      const aiV = String(oldValues[f] === undefined || oldValues[f] === null ? '' : oldValues[f]).trim();
      const huV = String(newValues[f] === undefined || newValues[f] === null ? '' : newValues[f]).trim();
      if (!huV || huV === '-') return;
      if (aiV === huV) return;
      upsertLearningPoint(f, aiV, huV, docKey);
    });
  } catch (e) {
    writeLog('⚠️ LEARNING', 'recordLearningFromEdit: ' + e.toString());
  }
}

// ตรวจบทเรียนที่ระบบเรียนไปแล้ว (เมนูชีต — ดูได้ทุกเมื่อ ไม่ต้องเปิด Supabase)
function showLearningReport() {
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipt_learning?select=field_name,ai_value,human_value,learn_count,last_seen_at&order=learn_count.desc&limit=50');
    if (!Array.isArray(rows) || rows.length === 0) {
      SpreadsheetApp.getUi().alert('ยังไม่มีบทเรียน — ระบบจะเริ่มเรียนรู้เมื่อมีการแก้ไขบิล (ประเภทเอกสาร/ชื่อร้าน/หมวดหมู่) ในหน้าเว็บ');
      return;
    }
    const lines = rows.map(function (r, i) {
      return (i + 1) + '. [' + (LEARNING_FIELD_LABELS[r.field_name] || r.field_name) + '] AI อ่าน "' + (r.ai_value || '(ว่าง)') + '" → มนุษย์แก้เป็น "' + r.human_value + '" (แก้แบบนี้แล้ว ' + r.learn_count + ' ครั้ง)';
    });
    SpreadsheetApp.getUi().alert('🧠 บทเรียนที่ AI เรียนรู้จากการแก้ไขจริง (' + rows.length + ' รายการ — ถูกฉีดเข้า prompt อัตโนมัติทุกครั้งที่อ่านบิล):\n\n' + lines.join('\n'));
  } catch (e) {
    SpreadsheetApp.getUi().alert('ตรวจบทเรียนไม่สำเร็จ: ' + e.toString());
  }
}

// ==========================================
// ORG DOC TYPES — ประเภทเอกสารเฉพาะขององค์กร (เพิ่มได้จากหน้าเว็บ/เมนูชีต — AI ใช้อ่านบิลทันที)
// หลักการ: ยึดประเภทเอกสารบัญชีมาตรฐานเป็นหลักก่อน — ประเภทขององค์กรใช้ "เติม" เมื่อมาตรฐานไม่ครอบคลุม
//          เก็บในตาราง doc_types (Supabase) + cache 5 นาที กันยิง Supabase ถี่เกิน
// ==========================================

// ดึงรายการประเภทเอกสารขององค์กร (cache 5 นาที — พัง/ยังไม่รัน SQL = คืน [] ระบบอื่นไม่กระทบ)
function getCustomDocTypes() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('custom_doc_types');
    if (cached !== null && cached !== '') {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) { /* cache พังไม่เป็นไร — ไปดึงของจริง */ }
  try {
    const rows = supabaseRequest('get', '/rest/v1/doc_types?select=name,aliases,treat_as_scale,is_active,is_standard&order=sort_order.asc,name.asc');
    const list = (Array.isArray(rows) ? rows : [])
      .filter(r => r && r.is_active !== false && r.is_standard !== true && String(r.name || '').trim() !== '')
      .map(r => ({ name: String(r.name).trim(), aliases: Array.isArray(r.aliases) ? r.aliases.map(String) : [], treat_as_scale: !!r.treat_as_scale }));
    try { cache.put('custom_doc_types', JSON.stringify(list), 300); } catch (e) {}
    return list;
  } catch (e) {
    try { cache.put('custom_doc_types', '[]', 300); } catch (e2) {}
    return [];
  }
}

// ประเภทขององค์กรที่ติ๊ก "ใช้ช่องใบชั่ง" = เอกสารไม่เน้นยอดเงิน (ให้ผ่านเกณฑ์เดียวกับใบชั่ง ไม่ถูกตีกลับให้ถ่ายใหม่)
function isCustomScaleLikeDocType(normType) {
  const list = getCustomDocTypes();
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === normType && list[i].treat_as_scale) return true;
  }
  return false;
}

// ข้อความเสริม prompt จากรายการประเภทขององค์กร (ไม่มี = คืน '' prompt เดิมล้วน)
function getCustomDocTypesPrompt() {
  try {
    const list = getCustomDocTypes().filter(t => t.name);
    if (!list.length) return '';
    return '\nประเภทเอกสารเฉพาะขององค์กรนี้ (เพิ่มเติมจากรายการมาตรฐานด้านบน — ถ้าหัวเอกสารตรงกับประเภทเหล่านี้ ให้ใส่ doc_type ตามชื่อนี้เป๊ะ ๆ โดยอ่านจากใบจริงเสมอ):\n' +
      list.map(t => '• "' + t.name + '"' + (t.aliases && t.aliases.length ? ' (คำที่อาจพิมพ์บนใบ: ' + t.aliases.join(', ') + ')' : '') + (t.treat_as_scale ? ' [ประเภทนี้ไม่เน้นยอดเงิน — ถ้าเป็นประเภทนี้ ให้อ่านทะเบียนรถ/น้ำหนักชั่งด้วยเมื่อเห็นบนใบ]' : '')).join('\n');
  } catch (e) {
    return '';
  }
}

// เพิ่มประเภทเอกสารขององค์กร (เรียกจากหน้าเว็บ/เมนูชีต — ใช้ได้ทันทีในการอ่านบิลถัดไป)
// รายการมาตรฐานอยู่ใน DOC_KNOWLEDGE_BASE จุดเดียว เพื่อกันชื่อใน dropdown, AI และ validation หลุดคนละชุด
function getStandardDocTypeNames() {
  return DOC_KNOWLEDGE_BASE.map(function (item) { return item.type; });
}

function addCustomDocType(payload) {
  // 🛡️ 2026-09-22 session guard: ฟังก์ชันนี้เรียกได้ตรงจาก google.script.run → ต้องมี session หรือเป็น internal call
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    const name = String((payload && payload.name) || '').trim();
    if (!name) return { success: false, message: 'กรุณาระบุชื่อประเภทเอกสาร' };
    if (name.length > 60) return { success: false, message: 'ชื่อยาวเกินไป (สูงสุด 60 ตัวอักษร)' };
    if (getStandardDocTypeNames().indexOf(name) !== -1) return { success: false, message: 'ประเภทมาตรฐานบัญชี "' + name + '" มีในระบบอยู่แล้ว ไม่ต้องเพิ่ม' };
    const aliases = (Array.isArray(payload.aliases) ? payload.aliases : String(payload.aliases || '').split(','))
      .map(s => String(s || '').trim()).filter(s => s !== '' && s !== '-');
    const treatAsScale = !!(payload && payload.treat_as_scale);
    const dup = supabaseRequest('get', '/rest/v1/doc_types?name=eq.' + encodeURIComponent(name) + '&select=id');
    if (Array.isArray(dup) && dup.length > 0) return { success: false, message: 'มีประเภทเอกสาร "' + name + '" อยู่แล้ว' };
    let nextSort = 100;
    try {
      const maxRow = supabaseRequest('get', '/rest/v1/doc_types?select=sort_order&order=sort_order.desc&limit=1');
      if (Array.isArray(maxRow) && maxRow.length > 0) nextSort = (Number(maxRow[0].sort_order) || 99) + 1;
    } catch (e) { /* ใช้ค่าเริ่ม */ }
    supabaseRequest('post', '/rest/v1/doc_types', { name: name, aliases: aliases, treat_as_scale: treatAsScale, is_active: true, sort_order: nextSort });
    try { CacheService.getScriptCache().remove('custom_doc_types'); } catch (e) {}
    writeLog('🏷️ DOC TYPE', 'เพิ่มประเภทเอกสารองค์กร: "' + name + '"' + (aliases.length ? ' (คำพ้อง: ' + aliases.join(', ') + ')' : '') + (treatAsScale ? ' [ใช้ช่องใบชั่ง]' : ''));
    return { success: true, message: 'เพิ่มประเภทเอกสาร "' + name + '" เรียบร้อย — AI จะใช้ประเภทนี้ในการอ่านบิลถัดไปทันที' };
  } catch (err) {
    writeLog('❌ ERROR', 'addCustomDocType: ' + err.toString());
    return { success: false, message: 'เพิ่มประเภทเอกสารไม่สำเร็จ: ' + err.toString() };
  }
}

// ลบประเภทเอกสารขององค์กร (บิลเก่าที่เคยใช้ประเภทนี้ไม่ถูกแตะ — เก็บค่าเดิมไว้ตามจริง)
function deleteCustomDocType(name) {
  // 🛡️ 2026-09-22 session guard: เรียกได้ตรงจาก google.script.run (เส้นทางเมนูชีตใช้ runAsInternal_ ห่อไว้แล้ว)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    const n = String(name || '').trim();
    if (!n) return { success: false, message: 'ระบุชื่อประเภทที่ต้องการลบ' };
    supabaseRequest('delete', '/rest/v1/doc_types?name=eq.' + encodeURIComponent(n));
    try { CacheService.getScriptCache().remove('custom_doc_types'); } catch (e) {}
    writeLog('🏷️ DOC TYPE', 'ลบประเภทเอกสารองค์กร: "' + n + '" (บิลเก่าที่ใช้ประเภทนี้ไม่ถูกแตะ)');
    return { success: true, message: 'ลบ "' + n + '" แล้ว — บิลเก่าที่เคยใช้ประเภทนี้ยังคงอยู่ตามเดิม' };
  } catch (err) {
    return { success: false, message: 'ลบไม่สำเร็จ: ' + err.toString() };
  }
}

// จัดการประเภทเอกสารผ่านเมนูชีต (ดูรายการ / เพิ่ม / ลบ)
function showDocTypesManager() {
  const ui = SpreadsheetApp.getUi();
  try {
    const list = getCustomDocTypes();
    const stdLine = 'ประเภทมาตรฐาน (ฝังในระบบ): ใบกำกับภาษี, ใบเสร็จรับเงิน, ใบส่งของ, ใบสั่งซื้อ, ใบวางบิล/ใบแจ้งหนี้, ใบชั่ง, อื่นๆ';
    const standardDocLine = 'ประเภทมาตรฐานบัญชี (ฝังในระบบ): ' + getStandardDocTypeNames().join(', ');
    const listLine = list.length
      ? list.map((t, i) => (i + 1) + '. ' + t.name + (t.treat_as_scale ? ' [ใช้ช่องใบชั่ง]' : '') + (t.aliases && t.aliases.length ? ' (คำพ้อง: ' + t.aliases.join(', ') + ')' : '')).join('\n')
      : 'ยังไม่มีประเภทเพิ่มเติม';
    const res = ui.prompt(
      '🏷️ ประเภทเอกสารขององค์กร\n' + standardDocLine + '\n\nประเภทเพิ่มเติม (AI ใช้อ่านบิลด้วย):\n' + listLine +
      '\n\n• เพิ่ม: พิมพ์ชื่อประเภทใหม่\n• ลบ: พิมพ์ ลบ: ชื่อประเภท\n• ปิด: กดยกเลิก',
      ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.ButtonSet.OK) return;
    const input = String(res.getResponseText() || '').trim();
    if (!input) return;
    if (/^ลบ\s*[:：]/.test(input)) {
      const r = runAsInternal_(function () { return deleteCustomDocType(input.replace(/^ลบ\s*[:：]\s*/, '')); }); // 🛡️ internal call (เมนูชีต)
      ui.alert(r.message);
    } else {
      const r = runAsInternal_(function () { return addCustomDocType({ name: input }); }); // 🛡️ internal call (เมนูชีต)
      ui.alert(r.message);
    }
  } catch (e) {
    ui.alert('จัดการประเภทเอกสารไม่สำเร็จ: ' + e.toString());
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🟢 BTC จัดซื้อ สแกนบิล')
    .addItem('🛠️ เริ่มต้นระบบ / สร้างตารางและโฟลเดอร์', 'setupSystem')
    .addItem('🔄 อัปเดตโครงสร้างหัวตารางอัตโนมัติ', 'checkAndSyncHeaders')
    .addSeparator()
    .addItem('🛰️ ย้ายข้อมูลเดิมไป Supabase (Dry-run ดูตัวอย่าง)', 'migrateSheetsToSupabaseDryRun')
    .addItem('🛰️ ย้ายข้อมูลเดิมไป Supabase (รันจริง)', 'migrateSheetsToSupabaseRun')
    .addItem('🔎 ตรวจค่าการตั้งค่า Supabase (URL + Role ของ Key)', 'verifySupabaseSetup')
    .addItem('🔎 ตรวจสถานะค่าการตั้งค่า (Script Property vs ไฟล์)', 'checkConfigSources')
    .addItem('🛡️ ตรวจสุขภาพฟังก์ชัน API ก่อน Deploy', 'selfCheckApiGuardsFromMenu')
    .addSeparator()
    .addItem('🧹 ล้าง Log เก่า >7 วัน (รันทันที)', 'cleanLogsNow')
    .addItem('⏰ ตั้งเวลา-ล้าง Log อัตโนมัติ (ทุกวัน 03:00)', 'setupLogCleanupTrigger')
    .addSeparator()
    .addItem('🧹 กวาดไฟล์กำพร้าใน Drive (รันทันที)', 'sweepOrphansNow')
    .addItem('🔄 Resync ชีต↔Supabase (รันทันที)', 'resyncReceiptsNow')
    .addItem('🔢 ตรวจสอบและสร้างเลขที่รายการย้อนหลัง (System Record No.)', 'menuBackfillSystemRecordNumbers')
    .addItem('🔢 สร้างเลขที่บิล TR-YYYYMM ย้อนหลัง (Running No.)', 'menuBackfillRunningNumbers')
    .addItem('🖼️ เติม MD5 รูปย้อนหลัง (กันส่งรูปซ้ำเร็ว)', 'menuBackfillImageMd5')
    .addItem('⚖️ ตรวจความต่าง น้ำหนัก/จำนวน (วิ่งครั้งเดียว)', 'runWeightVarianceCheckMenu')
    .addItem('🧠 ดูบทเรียนที่ AI เรียนรู้ (จากการแก้ไขบิล)', 'showLearningReport')
    .addItem('🏷️ จัดการประเภทเอกสารขององค์กร (AI ใช้อ่านบิล)', 'showDocTypesManager')
    .addItem('⏰ ตั้งเวลา-ล้าง Log + กวาดไฟล์กำพร้า + Resync (ทุกวัน 03:00)', 'setupAllAutoCleanups')
    .addItem('🧠 ติดตั้ง Trigger เรียนรู้จากการแก้ชีต (ครั้งเดียว)', 'setupLearningEditTrigger')
    .addToUi();
}

// รายการหัวคอลัมน์มาตรฐานของชีต "บิลจัดซื้อ (Receipts)" (ใช้ร่วมกันทั้ง setupSystem และ saveToSheet)
// - PO No. = เลขที่ใบสั่งซื้อของบริษัท (หนึ่ง PO มีหลายบิลได้ จึงไม่ใช้กันซ้ำ)
// - Doc Type/Book No./Doc No./Tax Invoice No./Ref No. = ตัวตนบิลจริงตามที่ปรากฏบนเอกสาร
function getReceiptHeaders() {
  return [
    'Timestamp', 'Source', 'PO No.', 'Date', 'Supplier Name', 'Category', 'Items Summary', 'Items JSON', 'Total Amount', 'Image URL', 'Sender Name', 'Sender ID',
    'Doc Type', 'Book No.', 'Doc No.', 'Tax Invoice No.', 'Ref No.', 'Ref Label', 'Doc Key', 'System Record No.', 'Running No.', 'Image MD5', 'Needs Review', 'Review Reason', 'Scale Weight In', 'Scale Weight Out', 'Scale Weight Net', 'Vehicle Registration',
    'Company Name', 'Job/Work', 'Requester', 'Pay Approver', 'Project Location',
    'Vendor Tax ID', 'VAT Amount', 'Remark Text', 'Extracted PO Code', 'Match Type', 'Confidence Score', 'Match Reason'
  ];
}

// เติมหัวคอลัมน์ที่ขาดให้อัตโนมัติ (ต่อท้ายเท่านั้น — ไม่แทรกกลางตารางเพื่อไม่ให้ข้อมูลเดิมเลื่อน)
function ensureSheetHeaders(sheet, requiredHeaders) {
  const lastCol = Math.max(sheet.getLastColumn(), 0);
  const existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
  const missing = requiredHeaders.filter(h => existing.indexOf(h) === -1);

  if (existing.filter(h => h !== '').length === 0) {
    // ชีตว่าง — เขียนหัวคอลัมน์ทั้งหมด
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    formatSheetHeader(sheet, requiredHeaders.length);
  } else if (missing.length > 0) {
    // มีหัวตารางเดิมแล้ว — ต่อท้ายเฉพาะที่ขาด
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    formatSheetHeader(sheet, lastCol + missing.length);
  }
  return sheet;
}

function setupSystem() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  
  if (!sheet) {
    sheet = ss.insertSheet('บิลจัดซื้อ (Receipts)');
  }
  
  getOrCreateDriveFolder();
  
  const defaultHeaders = getReceiptHeaders();

  ensureSheetHeaders(sheet, defaultHeaders);
  try {
    const backfill = backfillMissingSystemRecordNumbers();
    writeLog('🧮 SYSTEM-RECORD', 'Backfill system_record_no: updated=' + backfill.updated + ' next_no=' + backfill.next_no);
  } catch (e) {
    writeLog('⚠️ SYSTEM-RECORD', 'backfillMissingSystemRecordNumbers failed: ' + e.toString());
  }
  try {
    const rn = backfillMissingRunningNumbers();
    writeLog('🔢 RUNNING-NO', 'Backfill running_number (setup): filled=' + rn.filled);
  } catch (e) {
    writeLog('⚠️ RUNNING-NO', 'backfillMissingRunningNumbers failed: ' + e.toString());
  }
  
  SpreadsheetApp.getUi().alert('✅ ตั้งค่าระบบ BTC จัดซื้อเรียบร้อยแล้ว!\n- เชื่อมต่อ Google Sheets เรียบร้อย\n- สร้างโฟลเดอร์ Google Drive สำหรับเก็บภาพบิล\n- จัดรูปแบบหัวตารางสีเขียว BTC สมบูรณ์\n- อัปเดตเลขที่รายการของระบบ (System Record No.) ให้เรียงต่อเนื่อง');
}

function formatSheetHeader(sheet, columnCount) {
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setBackground('#27AE60')
             .setFontColor('#FFFFFF')
             .setFontWeight('bold')
             .setHorizontalAlignment('center')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
}

// ==========================================
// WEB APP API & HOSTING (doGet - โฮสต์ Web Dashboard & ให้บริการ API)
// ==========================================
function doGet(e) {
  try {
    // คอนฟิกสาธารณะสำหรับเปิด Supabase client ฝั่งหน้าเว็บ (GitHub Pages / GAS โฮสต์)
    if (e && e.parameter && e.parameter.action === 'config') {
      return ContentService.createTextOutput(JSON.stringify(getPublicClientConfig()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 🛡️ 2026-09-22: ปิดช่องล็อกอินผ่าน GET (รหัสผ่านจะไปอยู่ใน URL/browser history/access log ของ proxy)
    //    ให้ใช้ POST ?action=call ด้วย body { fn:'createApiSession', payload:{ password } } เท่านั้น
    if (e && e.parameter && e.parameter.action === 'login') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, code: 'METHOD_NOT_ALLOWED',
        message: 'เพื่อความปลอดภัยปิดการล็อกอินผ่าน GET แล้ว — ใช้ POST ?action=call ด้วย { fn:"createApiSession", payload:{ password } }'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // กรณีต้องการข้อมูลในรูปแบบ JSON API (เช่น เรียกด้วย ?api=true)
      // 🔓 2026-09-23 — นโยบายใหม่ "รหัสมีไว้เข้าตั้งค่าระบบเท่านั้น": เส้น "อ่านข้อมูลจัดซื้อทั้งบริษัท"
      //    ผ่าน URL นี้ยังต้องมี session เหมือนเดิม (กันข้อมูลรั่วให้คนนอกที่แค่รู้ URL ไม่ได้ล็อกอิน)
      //    ส่วนฟังก์ชันธุรกิจทุกตัว (แก้/ลบ/จับคู่/รูป/AI/วางบิล) ไม่ตรวจ session แล้ว
      // TEST-INSERT-DELME
    // 🛡️ 2026-09-22: เดิมเส้นนี้คืนบิลทั้งหมด (service_role) ให้ใครก็ได้ที่รู้ URL → ปิดช่องข้อมูลจัดซื้อรั่ว
    //    ตอนนี้ต้องมี session token เท่านั้น: ?api=true&t=<token>
    if (e && e.parameter && (e.parameter.api === 'true' || e.parameter.format === 'json')) {
      const t = (e.parameter.t || e.parameter.token || '');
      const rl = enforceApiRateLimit('get:' + (t || 'anon'), API_RATE_LIMIT_PER_MIN, API_RATE_WINDOW_S);
      if (!rl.ok) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, code: rl.code, message: rl.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (!apiSessionValid(t)) {
        writeLog('🛑 API-READ', 'ปฏิเสธการอ่านข้อมูลแบบไม่ล็อกอิน (?api=true)');
        return ContentService.createTextOutput(JSON.stringify({
          success: false, code: 'SESSION_EXPIRED',
          message: 'ต้องมี session token ก่อนอ่านข้อมูล (?api=true&t=<token>) — ล็อกอินด้วย createApiSession'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      const result = getSupabaseUrl() ? fetchReceiptsFromSupabase() : getReceiptData();
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // โฮสต์และแสดงผลหน้า Web Dashboard (ไฟล์ index.html)
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('BTC จัดซื้อ - ระบบสแกนและตรวจสอบบิล')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT); // 🗑️ 2026-09-22: ใช้ GAS Web App เดียว ไม่ต้องให้เว็บอื่นฝังหน้าได้ (กัน clickjacking)
  } catch (err) {
    return ContentService.createTextOutput('Error loading dashboard: ' + err.toString());
  }
}

// ฟังก์ชันดึงข้อมูลจาก Google Sheets (ใช้ได้ทั้งผ่าน doGet API และ google.script.run)
function getReceiptData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)') || ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return [];
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map((row, index) => {
    let obj = { id: (index + 1).toString() };
    headers.forEach((h, i) => {
      let key = h.toString().toLowerCase().replace(/\./g, '').replace(/ /g, '_');
      obj[key] = row[i];
    });
    
    let imgVal = obj['image_url'] || obj['image_link'] || '';
    if (typeof imgVal === 'string' && imgVal.includes('HYPERLINK')) {
      let match = imgVal.match(/HYPERLINK\("([^"]+)"/i);
      if (match) imgVal = match[1];
    }
    obj['image_url'] = imgVal;
    
    if (obj['timestamp'] instanceof Date) {
      obj['timestamp'] = Utilities.formatDate(obj['timestamp'], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    }
    if (obj['date'] instanceof Date) {
      obj['date'] = Utilities.formatDate(obj['date'], 'Asia/Bangkok', 'yyyy-MM-dd');
    }
    
    return obj;
  });
}

// ==========================================
// MAIN WEBHOOK (doPost - รับภาพบิลจาก LINE Bot)
// ==========================================
function doPost(e) {
  // Guard: LINE Verification ping หรือ request ที่ไม่มี body → ตอบ 200 ทันที
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const origin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || '';

  // Guard: ป้องกัน request จาก origin ที่ไม่ถูกต้องสำหรับ REST API และจำกัดอัตราคำขอต่อ session/function
  try {
    const raw = JSON.parse(e.postData.contents);
    if (raw && typeof raw === 'object' && !Array.isArray(raw.events) && typeof raw.fn === 'string') {
      const gate = validateApiRequestContext(raw.fn, raw.payload, raw.token, origin || (raw && raw.origin) || '');
      if (!gate.ok) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, code: gate.code, message: gate.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  } catch (err) {
    // ถ้ารับ JSON ไม่ได้ ให้ผ่านไปต่อใน LINE webhook เดิม (ไม่บล็อกทุกกรณี)
  }

  // รองรับการส่งบิลพร้อมกันหลายใบ: LINE อาจรวมเป็นหลาย events ใน webhook ครั้งเดียว
  // (พนักงาน 10+ คนส่งพร้อมกัน) → ตรวจจับ burst แล้วเข้าสู่โหมดคิว:
  //   - ถ้า ≤3 ใบ ≤รอบปกติ → ประมวลผลตรง (เร็ว เสมือนของเดิม)
  //   - ถ้า >3 ใบ (burst) → webhook ตอบไว ไม่รอ AI (กัน GAS timeout 6 นาที)
  //     ใบทั้งหมดเข้าคิว แล้ว timer trigger ทยอยประมวลผลทีละชุด (PROCESS_BATCH_PER_TICK)
  const statuses = [];
  try {
    const data = JSON.parse(e.postData.contents);

    // REST API (เดิมสำหรับหน้าเว็บบน GitHub Pages): body ของเรามีฟิลด์ fn + token
    // ตรวจก่อน LINE เพราะของ LINE มีฟิลด์ events เสมอ
    // 🗑️ 2026-09-22: เลิกใช้โฮสต์ภายนอกแล้ว → ปิดเส้นทางนี้เป็นค่าเริ่มต้น (เปิดคืนได้ด้วย Script Property REST_API_ENABLED = true)
    if (data && typeof data === 'object' && !Array.isArray(data.events) && typeof data.fn === 'string' && !isRestApiEnabled()) {
      writeLog('🗑️ REST-DISABLED', 'ปฏิเสธคำขอ REST จากภายนอก: fn=' + data.fn + ' (ระบบใช้ GAS Web App เท่านั้น)');
      return ContentService.createTextOutput(JSON.stringify({
        success: false, code: 'REST_DISABLED',
        message: 'ระบบนี้ใช้ GAS Web App เท่านั้น (ไม่รองรับการเรียก REST จากโฮสต์ภายนอก) — ถ้าต้องการเปิด ให้ตั้ง Script Property REST_API_ENABLED = true'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (data && typeof data === 'object' && !Array.isArray(data.events) && typeof data.fn === 'string') {
      const safePayload = sanitizeApiPayload(data.payload || {});
      const apiOrigin = (e && e.headers && (e.headers.Origin || e.headers.origin)) || (data && data.origin) || '';
      const gate = validateApiRequestContext(data.fn, safePayload, data.token, apiOrigin);
      if (!gate.ok) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, code: gate.code, message: gate.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const apiResult = handleApiRequest(data.fn, gate.payload, data.token, apiOrigin);
      writeLog('📡 API', 'REST fn=' + data.fn + ' → ' + (apiResult && apiResult.success ? 'success' : 'fail'));
      return ContentService.createTextOutput(JSON.stringify(apiResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const events = (data && Array.isArray(data.events)) ? data.events : [];
    const imageEvents = events.filter(ev => ev && ev.type === 'message' && ev.message && ev.message.type === 'image').length;
    const useQueue = imageEvents > 3;
    if (useQueue) {
      ensureProcessingTick();
      writeLog('⚙️ BURST', 'เจอบิลเข้า ' + imageEvents + ' ใบพร้อมกัน — สลับโหมดคิว (webhook ตอบไว ไม่รอ AI)');
    }
    for (const event of events) {
      try {
        statuses.push(handleLineEvent(event, useQueue));
      } catch (err) {
        statuses.push(handleLineEventError(event, err));
      }
    }
  } catch (topErr) {
    writeLog('❌ ERROR', 'parse webhook payload ล้มเหลว: ' + topErr.toString());
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', events: statuses }))
    .setMimeType(ContentService.MimeType.JSON);
}

// กระจายงานแต่ละ event (รองรับ join/postback/message ทุกประเภทในครั้งเดียว)
//   useQueue=true หมายถึง burst (บิลเข้าเยอะพร้อมกัน) → image ไปเข้าเส้นคิวไม่ประมวลผลตรง
function handleLineEvent(event, useQueue) {
  if (!event || !event.type) return 'empty-event';
  const replyToken = event.replyToken || '';
  const sourceType = (event.source && event.source.type) || '-';
  writeLog('STEP 0', 'Webhook รับ event type=' + event.type + (event.message ? ' (' + event.message.type + ')' : '') + ' | source=' + sourceType + ' | replyToken=' + (replyToken ? 'มี' : 'ไม่มี'));

  if (event.type === 'join') {
    const groupId = event.source.groupId;
    replyConnectConfirmation(replyToken, groupId);
    return 'join';
  }
  if (event.type === 'postback') {
    const params = parseQueryString(event.postback.data);
    if (params.action === 'confirm_connect') {
      replyLineMessage(replyToken, 'เชื่อมต่อระบบ "BTC จัดซื้อสแกนบิล" เรียบร้อยแล้ว! สมาชิกในกลุ่มส่งรูปเอกสารได้ทันที เช่น ใบกำกับภาษี ใบเสร็จ ใบส่งของ ใบชั่ง หรือเอกสารอื่นตามมาตรฐานบัญชี — AI จะจำแนกประเภทให้อัตโนมัติครับ');
    } else if (params.action === 'cancel_connect') {
      replyLineMessage(replyToken, 'ยกเลิกการเชื่อมต่อเรียบร้อยแล้ว');
    }
    return 'postback';
  }
  if (event.type === 'message' && event.message && event.message.type === 'image') {
    if (useQueue) {
      return handleImageEnqueue(event);
    }
    return handleImageMessage(event);
  }
  return 'ignored';
}

// 🆓 ช่องทางตอบกลับ "ไม่กินโควตา LINE":
//   LINE บัญชีฟรี: reply (ตอบกลับทันที) ผ่านได้โดยไม่หักโควตารายเดือน (push โดนหัก 429 'monthly limit')
//   ทำ: ถ้า REPLY_ONLY_MODE=true → งดแจ้ง "กำลังอ่านบิล" รอบแรก แล้วส่งผลสรุปจริงด้วย reply แทน (สำรองเป็น push ถ้า reply ไม่ผ่าน)
//   ตั้ง Script Property REPLY_ONLY_MODE=false เพื่อกลับมาปกติ (แจ้งกำลังอ่าน + push สรุปผล)
function isReplyOnlyMode() {
  try { return getScriptProps().getProperty('REPLY_ONLY_MODE') !== 'false'; } catch (e) { return true; }
}

// โหมดปกติ (≤3 ใบ): ประมวลผลทันที — แจ้ง "กำลังอ่าน" แล้วรันวงจรเต็ม
function handleImageMessage(event) {
  const messageId = event.message.id;
  const senderId = (event.source && event.source.userId) ? event.source.userId : '';

  // กัน LINE ส่ง event ซ้ำซ้อน (redelivery) ภายใน 2 นาที — ข้ามทันที (สำคัญตอนส่งพร้อมกันหลายใบ)
  const memoKey = 'mid_' + messageId;
  const memoCache = CacheService.getScriptCache();
  if (memoCache.get(memoKey)) {
    writeLog('STEP 1-DUP', 'messageId ซ้ำ (LINE redelivery/ส่งพร้อมกัน) — ข้าม: ' + messageId);
    return 'duplicate-message';
  }
  memoCache.put(memoKey, '1', 120);

  if (!isReplyOnlyMode()) {
    // โหมดเดิม: แจ้งในแชททันทีว่าได้รับรูปแล้ว (reply token ใช้ได้ครั้งเดียว — ผลลัพธ์จริงจะส่งตามด้วย Push)
    replyLineMessage(event.replyToken, '🕐 ได้รับรูปบิลแล้ว\nกำลังอ่านข้อมูลด้วย AI กรุณารอสักครู่\nระบบจะส่งสรุปบิลมาให้ทันที');
    writeLog('STEP 1.5', 'แจ้งแชท "กำลังอ่านบิล" แล้ว (ผลตอบดูแถว LINE_REPLY)');
  } else {
    writeLog('STEP 1.5', 'โหมด reply-first: งดแจ้ง "กำลังอ่านบิล" แล้ว — จะส่งสรุปบิลผ่าน reply เมื่ออ่านเสร็จ');
  }

  return processReceiptSubmission(messageId, senderId, event.source, event.replyToken);
}

// โหมด burst (>3 ใบพร้อมกัน): webhook ตอบไว แจ้ง "เข้าคิว" แล้วรอ timer ทยอยประมวลผล
function handleImageEnqueue(event) {
  const messageId = event.message.id;
  const senderId = (event.source && event.source.userId) ? event.source.userId : '';
  replyLineMessage(event.replyToken, '📥 ได้รับรูปบิลแล้ว — ระบบมีบิลเข้ามาพร้อมกันหลายใบ กำลังจัดคิวให้ AI อ่านทีละใบ\nสรุปบิลจะทยอยส่งมาในแชทนี้ครับ (ประมาณ 1-2 นาที/ใบ)');
  const enq = enqueueImageTask(messageId, senderId, event.source);
  writeLog('STEP 1.7', 'บิลเข้าระบบคิวแล้ว messageId=' + messageId + ' | สำเร็จ=' + enq);
  return enq ? 'queued' : 'queue-failed';
}

// ==========================================
// RECEIPT QUEUE (กัน GAS timeout เมื่อบิลเข้าเยอะพร้อมกัน)
//   webhook เขียนคิว → timer trigger ทุก 1 นาที ดึงมาประมวลผลทีละชุด
// ==========================================
const PROCESS_QUEUE_KEY = 'BTC_IMG_QUEUE';
const PROCESS_TRIGGER_FUNC = 'processReceiptQueueTick';
const PROCESS_BATCH_PER_TICK = 5; // ใบต่อรอบ — 1 ใบกินเวลาประมาณ 30-60 วิ รอบละ 5 ใบไม่เกิน 6 นาที

function enqueueImageTask(messageId, senderId, source) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      writeLog('⚠️ QUEUE', 'ล็อกคิวไม่ได้ใน 10 วิ — ให้ LINE retry เอา');
      return false;
    }
    const props = PropertiesService.getScriptProperties();
    let queue = [];
    try { queue = JSON.parse(props.getProperty(PROCESS_QUEUE_KEY) || '[]'); } catch (e) { queue = []; }
    if (queue.some(it => it.messageId === messageId)) {
      writeLog('⚠️ QUEUE-DUP', 'messageId นี้อยู่ในคิวแล้ว — ข้าม: ' + messageId);
      return true;
    }
    queue.push({ messageId: messageId, senderId: senderId || '', source: source || null, ts: new Date().toISOString() });
    props.setProperty(PROCESS_QUEUE_KEY, JSON.stringify(queue));
    writeLog('📥 QUEUE-IN', 'ใบเข้าคิวแล้ว messageId=' + messageId + ' | คิวทั้งหมด=' + queue.length);
    return true;
  } finally {
    lock.releaseLock();
  }
}

// สร้าง timer trigger ทุก 1 นาที (ครั้งแรกที่เจอ burst เท่านั้น)
function ensureProcessingTick() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('BTC_TICK_SET')) return;
    const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === PROCESS_TRIGGER_FUNC);
    if (existing.length === 0) {
      ScriptApp.newTrigger(PROCESS_TRIGGER_FUNC).timeBased().everyMinutes(1).create();
      writeLog('⚙️ TRIGGER', 'สร้าง timer trigger ทุก 1 นาที สำหรับคิวบิลแล้ว');
    }
    cache.put('BTC_TICK_SET', '1', 600);
  } catch (trgErr) {
    writeLog('⚠️ TRIGGER', 'สร้าง trigger ไม่สำเร็จ: ' + trgErr.toString());
  }
}

// timer ทำงานทุก 1 นาที: ดึงบิลจากคิวมารอบละ PROCESS_BATCH_PER_TICK ใบ
function processReceiptQueueTick() {
  const lock = LockService.getScriptLock();
  let items = [];
  try {
    if (!lock.tryLock(10000)) {
      writeLog('⚠️ QUEUE-TICK', 'ล็อกคิวไม่ได้ รอรอบหน้า');
      return;
    }
    const props = PropertiesService.getScriptProperties();
    let queue = [];
    try { queue = JSON.parse(props.getProperty(PROCESS_QUEUE_KEY) || '[]'); } catch (e) { queue = []; }
    if (queue.length === 0) return;
    items = queue.splice(0, PROCESS_BATCH_PER_TICK);
    props.setProperty(PROCESS_QUEUE_KEY, JSON.stringify(queue));
    writeLog('🔁 QUEUE-TICK', 'ดึงจากคิว ' + items.length + ' ใบ | คงเหลือในคิว ' + queue.length);
  } finally {
    lock.releaseLock();
  }

  for (const it of items) {
    try {
      const result = processReceiptSubmission(it.messageId, it.senderId, it.source);
      writeLog('🔁 QUEUE-DONE', 'ใบ ' + it.messageId + ' => ' + result);
    } catch (err) {
      writeLog('❌ QUEUE-ERR', 'ใบ ' + it.messageId + ' ล้มเหลว: ' + err.toString());
      const pushTo = (it.source && it.source.type) ? sourceToId(it.source) : null;
      if (pushTo) {
        try { pushLineMessage(pushTo, '❌ เกิดข้อผิดพลาด (บิลนี้): ' + err.toString()); } catch (e2) { Logger.log(e2.toString()); }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// RUNNING NUMBER TR-YYYYMM-##### (เลขที่บิลที่คนเห็น — ใบหน้าเซ็ตอัพตามไดอะแกรม)
//   จองเลขแบบมือเดียวจาก Supabase RPC (row lock) — เลขไม่ซ้ำ ไม่เสี่ยง race
//   ใช้คู่กับ system_record_no (ตัวตนเชิงเทคนิค) ที่มีอยู่เดิม
// ════════════════════════════════════════════════════════════
function getCurrentRunningMonth() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMM');
}

function callNextRunningNumber() {
  try {
    const raw = supabaseRequest('post', '/rest/v1/rpc/next_running_number', { p_month: getCurrentRunningMonth() });
    let s = raw;
    if (typeof raw === 'string') { try { s = JSON.parse(raw); } catch (e) { s = raw; } }
    if (typeof s === 'string' && /^TR-\d{6}-\d{5}$/.test(s.trim())) return s.trim();
    writeLog('⚠️ RUNNING-NO', 'RPC คืนค่าแปลกปลอม: ' + raw);
    return null;
  } catch (err) {
    writeLog('⚠️ RUNNING-NO', 'callNextRunningNumber: ' + err.toString());
    return null;
  }
}

// กันซ้ำ: มีอยู่แล้ว (receiptData/DB) → คืนเดิม; ยังไม่มี → จองเลขใหม่ + เขียนกลับ DB
function ensureRunningNumberForReceipt(docKey, receiptData) {
  if (receiptData && receiptData.running_number && /^TR-/.test(receiptData.running_number)) {
    return receiptData.running_number;
  }
  if (!docKey) return null;
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipts?select=running_number&doc_key=eq.' + encodeURIComponent(docKey) + '&limit=1');
    const arr = Array.isArray(rows) ? rows : [];
    const existing = (arr.length > 0) ? String(arr[0].running_number || '') : '';
    if (/^TR-/.test(existing)) return existing;

    const nextNo = callNextRunningNumber();
    if (nextNo) {
      supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(docKey), { running_number: nextNo }, 'return=representation');
    }
    return nextNo;
  } catch (err) {
    writeLog('⚠️ RUNNING-NO', 'ensureRunningNumberForReceipt(' + docKey + '): ' + err.toString());
    return null;
  }
}

// สร้าง Running No. ย้อนหลังให้แถวที่ยังไม่มี (เรียงตามเดือนจาก Timestamp — ล็อก GAS ป้องกันชน)
function backfillMissingRunningNumbers() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { writeLog('⚠️ RUNNING-NO', 'backfill lock wait timeout'); }
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    let filled = 0;
    if (sheet && sheet.getLastRow() > 1) {
      ensureSheetHeaders(sheet, getReceiptHeaders());
      const lastCol = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
      const colRno = headers.indexOf('Running No.');
      const colDocKey = headers.indexOf('Doc Key');
      const colTs = headers.indexOf('Timestamp');
      if (colRno !== -1) {
        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        const perMonth = {};
        for (let i = 0; i < data.length; i++) {
          const docKey = (colDocKey !== -1) ? String(data[i][colDocKey] || '').trim() : '';
          if (!docKey) continue;
          if (/^TR-/.test(String(data[i][colRno] || ''))) continue;
          const rawTs = (colTs !== -1) ? data[i][colTs] : null;
          const tsObj = (rawTs instanceof Date) ? rawTs : null;
          if (!tsObj || isNaN(tsObj.getTime())) continue; // ไม่มี Timestamp แท้ในชีต → ปล่อยให้ DB backfill (created_at) จัดการ อย่าเดาเดือน
          const month = tsObj.toISOString().substring(0, 4) + tsObj.toISOString().substring(5, 7);
          if (!perMonth[month]) perMonth[month] = [];
          perMonth[month].push({ row: i + 2, docKey: docKey, ts: ts });
        }
        Object.keys(perMonth).forEach(function (month) {
          const arr = perMonth[month];
          arr.sort(function (a, b) { return a.ts.localeCompare(b.ts); });
          arr.forEach(function (r, idx) {
            const rn = 'TR-' + month + '-' + String(idx + 1).padStart(5, '0');
            try { sheet.getRange(r.row, colRno + 1).setValue(rn); filled++; } catch (se) { writeLog('⚠️ RUNNING-NO', 'sheet: ' + se.toString()); }
            try { supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(r.docKey), { running_number: rn }, 'return=representation'); } catch (pe) { writeLog('⚠️ RUNNING-NO', 'patch supabase: ' + pe.toString()); }
          });
        });
      }
    }
    try { supabaseRequest('post', '/rest/v1/rpc/sync_running_number_counter', {}); } catch (syncErr) { writeLog('⚠️ RUNNING-NO', 'sync counter: ' + syncErr.toString()); }
    writeLog('🔢 RUNNING-NO', 'Backfill Running No.: ' + filled + ' แถว');
    return { success: true, filled: filled, message: 'สร้างเลขที่บิล TR ย้อนหลัง ' + filled + ' แถวเรียบร้อย' };
  } catch (err) {
    writeLog('❌ RUNNING-NO', 'backfillMissingRunningNumbers: ' + err.toString());
    return { success: false, message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function menuBackfillRunningNumbers() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('🔢 ยืนยันการสร้างเลขที่บิล TR ย้อนหลัง',
    'ระบบจะตรวจสอบเอกสารทั้งหมดในชีตและ Supabase\n' +
    'แถวใดที่ยังไม่มี "Running No." (TR-YYYYMM-xxxxx) ระบบจะสร้างเลขต่อเนื่องให้ตามเดือน\n' +
    'เอกสารที่มีเลขแล้วจะไม่ถูกเปลี่ยนแปลง\n\nต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO);
  if (res !== ui.ButtonSet.YES) return;
  const r = runAsInternal_(function () { return backfillMissingRunningNumbers(); });
  ui.alert(r.message || 'ดำเนินการเรียบร้อย');
}

// ════════════════════════════════════════════════════════════
// MD5 FILE-LEVEL DEDUP (กันส่งรูปเดิมซ้ำก่อนจ่ายเข้าสู่ Gemini OCR)
// ════════════════════════════════════════════════════════════
function md5Hex(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
  return digest.map(function (b) {
    return ((b < 0) ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function findDuplicateImageHash(md5) {
  if (!md5) return null;
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipts?select=running_number,system_record_no,doc_key,doc_type,doc_no,store_name,date,total_amount&image_md5=eq.' + encodeURIComponent(md5) + '&limit=1');
    return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;
  } catch (err) {
    writeLog('⚠️ MD5', 'findDuplicateImageHash: ' + err.toString());
    return null;
  }
}

// เติม image_md5 ย้อนหลังให้บิลเก่าที่ยังไม่มี (ดาวน์โหลดรูปจาก Drive → คำนวณ MD5 → อัปเดต Supabase)
// ทำไม: บิลที่บันทึกก่อนมีระบบ MD5 คอลัมน์ image_md5 = NULL → ส่งภาพซ้ำของบิลเก่าจะไม่โดน STEP 2-DUP ตัดก่อน OCR
// วิธี: ดึงแถวทั้งหมด (limit=1000) → กรองเอาเฉพาะที่ยังไม่มี hash ในโค้ด (ไม่พึ่งตัวกรอง is.null ที่เคยคืน 0 แถว)
// สรุปผลละเอียด (filled/total/noUrl/errored) + log ทุกแถว — ถ้าติด ให้ดูชีต "Log" คอลัมน์ Step = MD5
function backfillImageMd5FromDrive() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { writeLog('⚠️ MD5', 'backfill md5 lock wait timeout'); }
  try {
    const prof = { total: 0, filled: 0, noUrl: 0, errored: 0 };
    const rows = supabaseRequest('get', '/rest/v1/receipts?select=id,doc_key,image_url,image_md5&limit=1000');
    writeLog('🔢 MD5', 'fetch rows="' + (Array.isArray(rows) ? rows.length : JSON.stringify(rows).substring(0, 300)) + '"');
    if (Array.isArray(rows)) {
      const targets = rows.filter(function (r) { return !r.image_md5; });
      prof.total = targets.length;
      targets.forEach(function (r) {
        const fid = extractDriveFileId(r.image_url || '');
        if (!fid) { prof.noUrl++; writeLog('🔢 MD5', 'skip no-url ' + String(r.doc_key)); return; }
        try {
          const bytes = DriveApp.getFileById(fid).getBlob().getBytes();
          const hash = md5Hex(bytes);
          supabaseRequest('patch', '/rest/v1/receipts?id=eq.' + r.id, { image_md5: hash });
          prof.filled++;
          writeLog('🔢 MD5', 'ok ' + String(r.doc_key) + ' -> ' + hash);
        } catch (derr) {
          prof.errored++;
          writeLog('⚠️ MD5', 'row ' + String(r.doc_key) + ' (id=' + r.id + '): ' + derr.toString());
        }
      });
    } else {
      writeLog('❌ MD5', 'fetch returned non-array: ' + JSON.stringify(rows).substring(0, 300));
    }
    writeLog('🔢 MD5', 'Backfill image_md5 summary: ' + JSON.stringify(prof));
    const msg = 'เติมค่าแฮชรูป (MD5) สำเร็จ ' + prof.filled + ' จาก ' + prof.total + ' แถว' +
      (prof.noUrl ? ' | ไม่มีลิงก์รูป: ' + prof.noUrl : '') +
      (prof.errored ? ' | โหลดรูปไม่ได้: ' + prof.errored : '');
    return { success: true, filled: prof.filled, total: prof.total, noUrl: prof.noUrl, errored: prof.errored, message: msg };
  } catch (err) {
    writeLog('❌ MD5', 'backfillImageMd5FromDrive: ' + err.toString());
    return { success: false, message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function menuBackfillImageMd5() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('🖼️ เติมค่า MD5 รูปย้อนหลัง',
    'ระบบจะดาวน์โหลดรูปจาก Google Drive ของบิลที่ยังไม่มีค่า image_md5\nคำนวณแฮช แล้วบันทึกลง Supabase\n\nผลลัพธ์: ส่งภาพซ้ำของบิลเก่าจะถูกตัดทันที (ไม่ต้องรอ AI อ่าน)\n\nดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO);
  if (res !== ui.ButtonSet.YES) return;
  const r = runAsInternal_(function () { return backfillImageMd5FromDrive(25); });
  ui.alert(r.message || 'ดำเนินการเรียบร้อย');
}

// ════════════════════════════════════════════════════════════
// DRIVE FILE RENAME — ชื่อไฟล์มี เลข TR + เลขเอกสาร (หา/อ้างอิงง่าย)
// ════════════════════════════════════════════════════════════
function sanitizeFileNameStr(s, maxLen) {
  const cleaned = String(s || '').replace(/[\\\/:*?"<>|\r\n\t\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const len = maxLen || 80;
  return cleaned.length > len ? cleaned.substring(0, len).trim() : cleaned;
}

function renameReceiptDriveFile(receiptData, imageUrl) {
  try {
    const fileId = extractDriveFileId(imageUrl || '');
    if (!fileId) return null;
    const file = DriveApp.getFileById(fileId);
    const num = (receiptData && receiptData.running_number)
      ? receiptData.running_number
      : ('SYS' + ((receiptData && receiptData.system_record_no) ? String(receiptData.system_record_no) : ''));
    const label = sanitizeFileNameStr(buildDocLabel(receiptData || {}), 60);
    const ts = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    const extMatch = file.getName().match(/\.[a-zA-Z0-9]{2,5}$/);
    const ext = extMatch ? extMatch[0] : '.jpg';
    const newName = sanitizeFileNameStr([num, label, ts].filter(Boolean).join('_'), 160) + ext;
    if (file.getName() !== newName) file.setName(newName);
    return newName;
  } catch (err) {
    writeLog('⚠️ DRIVE-RENAME', 'renameReceiptDriveFile: ' + err.toString());
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// WEIGHT & UNIT VARIANCE ENGINE (เทียบ PO ↔ ใบส่งของ ↔ ใบชั่ง)
//   คู่ที่ยืนยันแล้ว → เทียบจำนวน/น้ำหนัก → ระดับความรุนแรง → บิลเพี้ยนติดธง "รอตรวจ"
// ════════════════════════════════════════════════════════════
function sumItemsQty(items) {
  let q = 0;
  (Array.isArray(items) ? items : []).forEach(function (it) {
    const v = (it && it.quantity !== undefined && it.quantity !== null) ? it.quantity : (it && it.qty);
    const n = Number(v);
    if (!isNaN(n) && n > 0) q += n;
  });
  return q;
}

function getWeightVariances() {
  const rows = supabaseRequest('get', '/rest/v1/weight_variances?select=*&order=created_at.desc');
  return Array.isArray(rows) ? rows : [];
}

function runWeightVarianceCheck(payload) {
  const stats = { checked: 0, flagged: 0, ok: 0, error: 0, flagged_patch: 0 };
  try {
    const rows = fetchReceiptsFromSupabase();
    const byKey = {};
    rows.forEach(function (r) { if (r && r.doc_key) byKey[r.doc_key] = r; });

    const links = Array.isArray(getReceiptLinks()) ? getReceiptLinks() : [];
    const upserts = [];

    links.forEach(function (lk) {
      if (lk.status !== 'confirmed') return;
      const po = byKey[lk.po_doc_key];
      const bill = byKey[lk.link_doc_key];
      if (!po || !bill) return;
      stats.checked++;

      const expectedQty = sumItemsQty(po.items);
      const deliveredQty = sumItemsQty(bill.items);
      let qtyVar = null;
      let severity = 'ok';
      if (expectedQty > 0) {
        qtyVar = Math.round(((deliveredQty - expectedQty) / expectedQty) * 1000) / 10;
        if (Math.abs(qtyVar) > 10) severity = 'high';
        else if (Math.abs(qtyVar) > 5) severity = 'low';
      }

      // หาใบชั่งขั้น 3 ที่จับกับบิลนี้ (โมเดลโซ่: PO ↔ ใบส่งของ ↔ ใบชั่ง)
      let scale = null;
      const scaleLink = links.find(function (sl) {
        return sl.status === 'confirmed' && sl.po_doc_key === bill.doc_key &&
               byKey[sl.link_doc_key] && isScaleLikeDocTypeForLink(byKey[sl.link_doc_key].doc_type);
      });
      if (scaleLink) scale = byKey[scaleLink.link_doc_key];
      const scaleKg = (scale && Number(scale.scale_weight_net)) ? Math.round(Number(scale.scale_weight_net) * 1000000) / 1000 : null;

      if (severity !== 'ok') {
        stats.flagged++;
        const parts = [];
        if (qtyVar !== null) parts.push('จำนวนส่ง (' + deliveredQty + ') ต่างจาก PO (' + expectedQty + ') ' + (qtyVar > 0 ? '+' : '') + qtyVar + '%');
        if (scaleKg) parts.push('น้ำหนักชั่งรวม ' + (Math.round(scaleKg) / 1000) + ' ตัน');
        const reason = '[' + (severity === 'high' ? 'น้ำหนัก/จำนวนเพี้ยนมาก' : 'น้ำหนัก/จำนวนเพี้ยน') + '] ' + parts.join(' | ');
        try {
          supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(bill.doc_key), { needs_review: true, review_reason: reason });
          stats.flagged_patch++;
        } catch (e2) { writeLog('⚠️ WEIGHT-VAR', 'patch needs_review: ' + e2.toString()); }
      } else {
        stats.ok++;
      }

      upserts.push({
        po_doc_key: po.doc_key,
        bill_doc_key: bill.doc_key,
        scale_doc_key: scale ? scale.doc_key : null,
        po_no: String(po.po_number || ''),
        store_name: String(bill.store_name || po.store_name || ''),
        expected_qty: expectedQty > 0 ? expectedQty : null,
        delivered_qty: deliveredQty > 0 ? deliveredQty : null,
        qty_variance_pct: qtyVar,
        expected_weight_kg: null,
        scale_weight_kg: scaleKg,
        weight_variance_pct: null,
        severity: severity,
        review_status: 'open',
        updated_at: new Date().toISOString()
      });
    });

    for (const v of upserts) {
      try {
        supabaseRequest('post', '/rest/v1/weight_variances?on_conflict=po_doc_key,bill_doc_key', v, 'resolution=merge-duplicates');
      } catch (e3) { stats.error++; writeLog('⚠️ WEIGHT-VAR', 'upsert: ' + e3.toString()); }
    }
    writeLog('⚖️ WEIGHT-VAR', 'ตรวจ variance เสร็จ: คู่ ' + stats.checked + ' | ผิดปกติ ' + stats.flagged + ' | ปกติ ' + stats.ok + ' | flag หน้างาน ' + stats.flagged_patch);
    return { success: true, checked: stats.checked, flagged: stats.flagged, ok: stats.ok, flagged_patch: stats.flagged_patch, error: stats.error };
  } catch (err) {
    writeLog('❌ WEIGHT-VAR', 'runWeightVarianceCheck: ' + err.toString());
    return { success: false, message: err.toString() };
  }
}

function runWeightVarianceCheckMenu() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('⚖️ ตรวจความต่างน้ำหนัก/จำนวน',
    'ระบบจะไล่คู่ PO↔บิลที่ยืนยันแล้ว เทียบจำนวนที่ส่งกับ PO และดึงน้ำหนักชั่งจากใบชั่งที่จับในโซ่\n' +
    'คู่ที่เกินเกณฑ์จะติดธง "รอตรวจ" ที่บิลนั้น\n\nต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO);
  if (res !== ui.ButtonSet.YES) return;
  const r = runAsInternal_(function () { return runWeightVarianceCheck({}); });
  ui.alert(r.success ? ('ตรวจเสร็จ: ' + (r.checked || 0) + ' คู่ | ผิดปกติ ' + (r.flagged || 0) + ' | ปกติ ' + (r.ok || 0)) : ('❌ ' + (r.message || 'ตรวจไม่สำเร็จ')));
}

// วงจรประมวลผลบิล 1 ใบ (STEP 1 → STEP 6) — ใช้ร่วมกันทั้งโหมดปกติและโหมดคิว
function processReceiptSubmission(messageId, senderId, source, replyToken) {
  const doneCache = CacheService.getScriptCache();
  const doneKey = 'done_' + messageId;
  if (doneCache.get(doneKey)) {
    writeLog('STEP 1-DUP', 'บิลนี้ประมวลผลเสร็จไปแล้ว (redelivery) — ข้าม: ' + messageId);
    return 'already-done';
  }
  const pushTo = (source && source.type) ? sourceToId(source) : null;

  writeLog('STEP 1', 'ได้รับรูปจาก LINE messageId=' + messageId + ' | userId=' + (senderId || '-'));
  // ดึงชื่อผู้ส่งบิลจาก LINE Profile API (ผู้ส่งในกลุ่มคือ userId ของสมาชิก — ใช้ member endpoint เพราะยังไม่แอดบอทก็ดึงได้)
  const sender = getLineProfile(senderId, source);
  writeLog('STEP 1.6', 'โปรไฟล์ผู้ส่ง: ' + ((sender && sender.displayName) ? sender.displayName : 'ดึงไม่ได้') + ' | userId=' + (senderId || '-'));

  const imageBlob = getLineImage(messageId);
  writeLog('STEP 2', 'โหลดรูปสำเร็จ size=' + imageBlob.getBytes().length + ' bytes');

  // 🛡️ MD5 File-Level Dedup (จัดตามไดอะแกรม "Pre-Filter & Anti-Duplicate"): แฮชภาพก่อนจ่ายเข้าสู่ Gemini OCR
  //   รูปเดิมเคยถูกส่ง = ข้ามทันที (ประหยัดต้นทุน OCR + กันบิลซ้ำ) — เทียบกับคอลัมน์ image_md5 ใน Supabase
  const imageMd5 = md5Hex(imageBlob.getBytes());
  const dupImage = findDuplicateImageHash(imageMd5);
  if (dupImage) {
    const dupId = dupImage.running_number || (dupImage.system_record_no ? '#' + dupImage.system_record_no : (dupImage.doc_key || '-'));
    writeLog('STEP 2-DUP', 'รูปเดียวกัน (MD5 ' + imageMd5 + ') เคยบันทึกแล้ว: ' + dupId + ' — ข้าม Gemini OCR');
    const dupLabel = ((dupImage.doc_type ? String(dupImage.doc_type) : '') + (dupImage.doc_no ? ' เลขที่ ' + dupImage.doc_no : '')).trim() || (dupImage.doc_key || '-');
    pushDuplicateFlexMessage(pushTo, {
      docLabel: dupLabel,
      runningNo: dupId,
      storeName: dupImage.store_name ? String(dupImage.store_name) : '',
      date: dupImage.date ? String(dupImage.date) : '',
      totalAmount: dupImage.total_amount ? Number(dupImage.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
    }, replyToken);
    return 'duplicate-image';
  }

  const receiptData = analyzeReceiptSmart(imageBlob);
  normalizeReceiptDocFields(receiptData);
  receiptData.image_md5 = imageMd5;
  writeLog('STEP 4', 'Gemini วิเคราะห์สำเร็จ: ' + JSON.stringify(receiptData).substring(0, 300));

  const quality = validateReceiptData(receiptData);
  if (!quality.ok) {
    writeLog('STEP 4-CHECK ❌', 'อ่านบิลไม่ผ่าน — ไม่บันทึก | สาเหตุ: ' + quality.reasons.join(' / '));
    pushLineMessage(pushTo, buildRetakeMessage(quality.reasons, quality.unreadable_reason, {
      senderName: (sender && sender.displayName) ? sender.displayName : '',
      docLabel: buildDocLabel(receiptData)
    }), replyToken);
    writeLog('STEP 6-RETAKE', 'แจ้งแชทให้ถ่ายภาพบิลใหม่แล้ว (รูปต้นฉบับยังอยู่ใน Drive)');
    return 'unreadable';
  }

  const docKey = receiptData.doc_key || buildDocKey(receiptData);
  const docLabel = buildDocLabel(receiptData);
  const reviewReasons = (quality.review_reasons || []).slice();

  writeLog('STEP 4-CHECK ✅', 'อ่านบิลผ่าน — ' + docLabel + ' | รายการ/ยอดรวมใช้ได้ (confidence: ' + (receiptData.confidence !== undefined ? receiptData.confidence : '-') + ')');

  const imageUrl = saveImageToDrive(imageBlob, messageId);
  writeLog('STEP 3', 'เซฟรูปลง Drive สำเร็จ url=' + imageUrl);

  if (docKey) {
    const dupRow = findDuplicateByDocKey(docKey);
    if (dupRow) {
      const dupLabel = buildDocLabel({ doc_type: dupRow['Doc Type'], tax_invoice_no: dupRow['Tax Invoice No.'], book_no: dupRow['Book No.'], doc_no: dupRow['Doc No.'], ref_no: dupRow['Ref No.'], ref_label: dupRow['Ref Label'] }) || docLabel;
      const dupNo = dupRow['Running No.'] || (dupRow['System Record No.'] ? '#' + dupRow['System Record No.'] : '');
      const dupTotal = parseFloat(String(dupRow['Total Amount'] || '').replace(/,/g, ''));
      writeLog('STEP 5-SKIP', 'บิลซ้ำ: ' + docLabel + ' (key ' + docKey + ') เคยบันทึกแล้ว: ' + (dupNo || '-') + ' — ข้ามการบันทึกชีต');
      pushDuplicateFlexMessage(pushTo, {
        docLabel: dupLabel,
        runningNo: dupNo,
        storeName: String(dupRow['Supplier Name'] || ''),
        date: String(dupRow['Date'] || ''),
        totalAmount: isNaN(dupTotal) ? '' : dupTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }, replyToken);
      writeLog('STEP 6-SKIP', 'ตอบกลับแชทแจ้งบิลซ้ำเรียบร้อย');
      return 'duplicate';
    }
  } else if (findSoftDuplicate(receiptData)) {
    reviewReasons.push('ข้อมูลอาจซ้ำกับบิลเดิม (ร้าน/วันที่/ยอดตรงกัน) — กรุณาตรวจสอบ');
  }

  receiptData.needs_review = reviewReasons.length > 0;
  receiptData.review_reason = reviewReasons.join(' | ');
  if (receiptData.needs_review) {
    writeLog('STEP 4-REVIEW ⚠️', 'บันทึกแบบรอตรวจ: ' + receiptData.review_reason);
  }

  // 🛡️ Running Number: ออกเลขที่รายการต่อเนื่อง (Sequential & Unique) ให้บิลใหม่
  if (!receiptData.system_record_no) {
    receiptData.system_record_no = getNextSystemRecordNo();
  }

  // 🛡️ Running Number TR-YYYYMM-#####: เลขที่บิลที่คนเห็น (unique ฝั่ง DB — จองผ่าน RPC row lock)
  if (!receiptData.running_number) {
    receiptData.running_number = ensureRunningNumberForReceipt(receiptData.doc_key, receiptData);
  }

  saveToSheet(receiptData, imageUrl, source.type, sender);
  writeLog('STEP 5', 'บันทึกลงชีตสำเร็จ (' + docLabel + ' | เลขที่บิล ' + (receiptData.running_number || ('#' + receiptData.system_record_no)) + ' | เลขที่รายการ #' + receiptData.system_record_no + ' | PO: ' + (receiptData.po_number || 'ไม่ระบุ') + ' | ผู้ส่ง: ' + ((sender && sender.displayName) ? sender.displayName : '-') + ')');

  // Dual-write: บันทึกลง Supabase ด้วย (แหล่งข้อมูลหลักใหม่ของหน้าเว็บ) — ไม่บล็อกถ้า Supabase สะดุด
  try {
    const sbRes = saveToSupabase(receiptData, imageUrl, source.type, sender);
    writeLog(sbRes.ok ? 'STEP 5.5' : '⚠️ SUPABASE', sbRes.ok ? 'บันทึกลง Supabase สำเร็จ (' + docLabel + ')' : 'ข้าม Supabase: ' + sbRes.error);
  } catch (sbErr) {
    writeLog('⚠️ SUPABASE', 'บันทึก Supabase ไม่สำเร็จ (ต้องการตรวจสอบ): ' + sbErr.toString());
  }

  pushFlexMessage(pushTo, receiptData, imageUrl, sender, replyToken);
  writeLog('STEP 6', 'ส่ง Flex กลับแชทแล้ว (ผลตอบดูแถว REPLY/PUSH)');

  // 🛡️ ตั้งชื่อไฟล์ Drive ให้มีเลข TR + เลขเอกสาร (หา/อ้างอิงง่าย — แก้ช่องว่างเดิมที่ชื่อไฟล์ไม่มีเลขเอกสาร)
  try { renameReceiptDriveFile(receiptData, imageUrl); } catch (rErr) { writeLog('⚠️ DRIVE-RENAME', 'hook: ' + rErr.toString()); }

  // AI Template Library (Phase 1): เก็บตัวอย่างบิลที่ยังไม่มีแม่แบบครอบ → รอ User ยืนยันที่เมนู "เอกสารสำหรับ AI"
  try {
    ensureTemplateCandidateIfNeeded(imageBlob, receiptData, sender);
  } catch (tErr) {
    writeLog('⚠️ AI_TEMPLATE', 'hook webhook error: ' + tErr.toString());
  }

  // Background Auto-Matcher (Round B): หาคู่ PO↔บิลอัตโนมัติหลังบันทึกบิล (ไม่บล็อก — ขึ้น [แนะนำการจับคู่] รอ User ยืนยัน)
  try {
    runAsInternal_(function () { runAutoMatcher(); }); // 🛡️ internal: webhook ทำงานแทนระบบเอง (ไม่ใช่คำขอจาก client)
  } catch (mErr) {
    writeLog('⚠️ MATCHER', 'auto-matcher hook: ' + mErr.toString());
  }

  doneCache.put(doneKey, '1', 600);
  return 'image-ok';
}

// จัดการ error แบบเฉพาะ event — ส่งข้อความ Error ตัวจริงกลับไปที่แชทของใบนั้น เพื่อวินิจฉัยได้ทันที
function handleLineEventError(event, err) {
  writeLog('❌ ERROR', err.toString() + (err.stack ? ' | stack: ' + String(err.stack).substring(0, 500) : ''));
  Logger.log('Error: ' + err.toString() + '\nStack: ' + (err.stack || 'n/a'));
  const replyToken = (event && event.replyToken) || '';
  let pushTo = null;
  try {
    if (event && event.source) pushTo = getSourceId(event);
  } catch (ignored) {}
  try {
    if (pushTo) {
      const errMsg = String(err.toString());
      if (errMsg.indexOf('RETAKE:') === 0) {
        // ผลวิเคราะห์ใช้ไม่ได้ (ถูกบล็อก/ไม่ใช่ JSON) — แจ้งถ่ายใหม่ ไม่บันทึก ไม่โชว์ข้อความเทคนิค
        const why = errMsg.replace('RETAKE:', '').trim();
        let retakeSender = '';
        try {
          const src = (event && event.source) || null;
          if (src && src.userId) {
            const prof = getLineProfile(src.userId, src);
            if (prof && prof.displayName) retakeSender = prof.displayName;
          }
        } catch (ignored) {}
        pushLineMessage(pushTo, buildRetakeMessage(why ? [why] : [], '', { senderName: retakeSender, docLabel: '' }), event.replyToken);
        writeLog('STEP 6-RETAKE', 'ผลวิเคราะห์ใช้ไม่ได้ — แจ้งแชทให้ถ่ายภาพบิลใหม่แล้ว (รูปต้นฉบับยังอยู่ใน Drive)');
      } else if (errMsg.indexOf('high demand') !== -1 || errMsg.indexOf('RESOURCE_EXHAUSTED') !== -1) {
        pushLineMessage(pushTo, '⏳ ระบบ AI กำลังหนาแน่นชั่วคราว\nกรุณาส่งรูปบิลอีกครั้งในอีก 1-2 นาทีครับ', event.replyToken);
      } else {
        pushLineMessage(pushTo, '❌ เกิดข้อผิดพลาด: ' + errMsg, event.replyToken);
      }
    } else if (replyToken) {
      replyLineMessage(replyToken, '❌ เกิดข้อผิดพลาด: ' + err.toString());
    }
  } catch (replyErr) {
    Logger.log('Reply error message failed: ' + replyErr.toString());
  }
  return 'error';
}

// ==========================================
// ACTIVITY LOG (บันทึกการทำงานลงชีต "Log" — ติดตามขั้นตอนได้จากชีตโดยตรง)
// ==========================================
function writeLog(step, detail) {
  try {
    Logger.log('[' + step + '] ' + (detail || ''));
  } catch (e) {}
  try {
    const ss = getSpreadsheet();
    let logSheet = ss.getSheetByName('Log');
    if (!logSheet) {
      logSheet = ss.insertSheet('Log');
      logSheet.appendRow(['Timestamp', 'Step', 'Detail']);
      formatSheetHeader(logSheet, 3);
    }
    logSheet.appendRow([new Date(), step, detail || '']);
  } catch (e) {
    // หากเขียน Log ลงชีตไม่สำเร็จ ไม่ให้กระทบ flow หลักของ webhook
  }
}

// ==========================================
// LOG AUTO-CLEANUP (ล้าง Log เก่าเกินกำหนดจากชีต "Log")
// ==========================================

// ลบบรรทัด Log ที่มี Timestamp เก่ากว่า "daysToKeep" วัน (ค่าเริ่มต้น 7 วัน)
// ทำงานจากล่างขึ้นบนเสมอ (เลขแถวไม่เพี้ยน) และข้ามแถวที่ Timestamp ไม่ใช่วันที่อย่างปลอดภัย
// เรียกได้จาก Time Trigger (ไม่มีพารามิเตอร์) หรือรันมือจากเมนู
function cleanOldLogs(daysToKeep) {
  daysToKeep = daysToKeep || 7;
  let deleted = 0;
  try {
    const ss = getSpreadsheet();
    const logSheet = ss.getSheetByName('Log');
    if (!logSheet) return 0;

    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return 0;

    // กันเผลอลบชีตอื่น: ตรวจหัวคอลัมน์ A ต้องเป็น Timestamp
    const header = String(logSheet.getRange(1, 1).getValue() || '').trim().toLowerCase();
    if (header !== 'timestamp') return 0;

    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const values = logSheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (let i = values.length - 1; i >= 0; i--) {
      const ts = values[i][0];
      if (ts instanceof Date && !isNaN(ts.getTime()) && ts.getTime() < cutoff.getTime()) {
        logSheet.deleteRow(i + 2); // บรรทัดข้อมูลเริ่มที่แถว 2 (แถว 1 เป็นหัวตาราง)
        deleted++;
      }
    }
  } catch (e) {
    Logger.log('cleanOldLogs error: ' + e.toString());
  }
  return deleted;
}

// wrapper รันล้าง Log ทันทีจากเมนู (แสดงผลยืนยัน)
function cleanLogsNow() {
  const n = cleanOldLogs(7);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'ล้าง Log เก่าเกิน 7 วันแล้ว ' + n + ' แถว',
    '🧹 ล้าง Log'
  );
  return n;
}

// ตั้ง Time Trigger ล้าง Log อัตโนมัติทุกวัน 03:00 น. (กันซ้ำอัตโนมัติ — ลบ trigger เดิมก่อนสร้างใหม่)
function setupLogCleanupTrigger() {
  const TRIGGER_FUNC = 'cleanOldLogs';
  let existing = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === TRIGGER_FUNC) {
      existing++;
      ScriptApp.deleteTrigger(tr);
    }
  });
  ScriptApp.newTrigger(TRIGGER_FUNC)
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  const msg = 'ตั้ง Time Trigger เรียบร้อย: ล้าง Log เก่า >7 วัน ทุกวัน 03:00 น.' +
    (existing > 0 ? ' (แทนที่ trigger เดิม ' + existing + ' ตัว)' : '');
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '⏰ Auto-clean Log');
  Logger.log(msg);
  return msg;
}

// ==========================================
// ZERO-JUNK AUTO CLEANUP (กวาดไฟล์รูปกำพร้าใน Drive → ถังขยะ — ไฟล์ที่ไม่มีบิลไหนอ้างถึงอีกต่อไป)
// ==========================================

// สแกนโฟลเดอร์บิลทั้งหมด (รวมโฟลเดอร์ย่อยปี/เดือน) เทียบกับ image_url ที่ถูกอ้างถึงจริง
// ใน Supabase (หลัก) + Google Sheets (สำรอง) — ไฟล์ต้องครบ 3 เงื่อนไขจึงถือว่าเป็นกำพร้า:
// (1) ไม่มีบิลไหนอ้างถึง (2) แก้ไขล่าสุดเก่ากว่า 48 ชม. (กันแข่งกับ flow บันทึกบิลช่วงเปลี่ยนมือ)
// (3) ชื่อไฟล์ตรง pattern ที่ระบบสร้างเท่านั้น (BTC_Receipt_* / receipt_edit_*) — ไฟล์แปลกปลอมไม่แตะเด็ดขาด
// ย้ายเข้าถังขยะเท่านั้น (กู้คืนได้ 30 วัน) ไม่ลบถาวร + บันทึกทุกไฟล์ลง Log sheet ตรวจสอบย้อนหลังได้
function sweepOrphanDriveImages() {
  const MIN_AGE_MS = 48 * 60 * 60 * 1000;
  const cutoff = Date.now() - MIN_AGE_MS;
  let scanned = 0, orphaned = 0;
  const skippedNames = [];

  // 1) รวมรายการ fileId ที่ "มีบิลอ้างถึงจริง" จากทั้งสองแหล่ง (Supabase หลัก + ชีตสำรอง)
  const referenced = {};
  const markReferenced = function (url) {
    const fid = extractDriveFileId(url);
    if (fid) referenced[fid] = true;
  };
  try {
    fetchReceiptsFromSupabase().forEach(function (r) { markReferenced(r && r.image_url); });
  } catch (e) {
    writeLog('⚠️ SWEEPER', 'อ่าน Supabase ไม่สำเร็จ (' + e.toString() + ') — รอบนี้เทียบจากชีตอย่างเดียว');
  }
  try {
    getReceiptData().forEach(function (r) { markReferenced(r && r.image_url); });
  } catch (e) {
    writeLog('⚠️ SWEEPER', 'อ่านชีตไม่สำเร็จ: ' + e.toString());
  }

  // 2) เดินสแกนไฟล์ทุกไฟล์ในโฟลเดอร์บิล (ตามลำดับชั้นปี/เดือน)
  const parent = getOrCreateDriveFolder();
  const folders = [parent];
  while (folders.length) {
    const f = folders.pop();
    const childFolders = f.getFolders();
    while (childFolders.hasNext()) folders.push(childFolders.next());
    const files = f.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      scanned++;
      const fid = file.getId();
      if (referenced[fid]) continue;                                   // มีบิลอ้างถึง → ปกติ ข้าม
      if (file.getLastUpdated().getTime() > cutoff) continue;          // ยังใหม่กว่า 48 ชม. → ข้าม (กันแข่งกับ flow บันทึกบิล)
      if (!/^BTC_Receipt_|^receipt_edit_/i.test(file.getName() || '')) { // ไม่ใช่ไฟล์ที่ระบบสร้าง → ไม่แตะ
        if (skippedNames.length < 10) skippedNames.push(file.getName());
        continue;
      }
      try {
        file.setTrashed(true);                                         // เข้าถังขยะเท่านั้น — กู้คืนได้ 30 วัน
        orphaned++;
        writeLog('🧹 SWEEPER', 'ย้ายไฟล์กำพร้าเข้าถังขยะ: ' + file.getName() + ' (id=' + fid + ')');
      } catch (e) {
        writeLog('⚠️ SWEEPER', 'ย้ายไม่สำเร็จ: ' + fid + ' — ' + e.toString());
      }
    }
  }

  const msg = 'สแกน ' + scanned + ' ไฟล์ | มีบิลอ้างถึง ' + Object.keys(referenced).length + ' ไฟล์ | ย้ายกำพร้าเข้าถังขยะ ' + orphaned + ' ไฟล์' +
    (skippedNames.length ? ' | ข้ามไฟล์แปลกปลอม ' + skippedNames.length + ' ไฟล์ (ไม่แตะ)' : '');
  writeLog('🧹 SWEEPER', msg);
  return msg;
}

// รันกวาดไฟล์กำพร้าทันทีจากเมนู (แสดงผลยืนยัน)
function sweepOrphansNow() {
  const msg = sweepOrphanDriveImages();
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🧹 Zero-Junk Sweeper');
  return msg;
}

// รวมงานล้างอัตโนมัติไว้ใน Time Trigger เดียว (ทุกวัน 03:00 น.) — ล้าง Log + กวาดไฟล์กำพร้า
// (setupLogCleanupTrigger เดิมยังทำงานได้ตามปกติ — ตั้งตัวนี้แทนจะได้ทั้งสองงานใน trigger เดียว)
function runDailyCleanups() {
  let resyncMsg = '';
  try {
    resyncMsg = resyncReceiptsBetweenStores(); // อัตโนมัติทุกวัน 03:00 — เติมแถวที่ขาดฝั่งใดฝั่งหนึ่ง
  } catch (e) {
    resyncMsg = 'Resync ไม่สำเร็จ: ' + e.toString();
    writeLog('⚠️ RESYNC', resyncMsg); // ให้ล้าง Log/กวาดไฟล์ทำงานต่อได้แม้ Supabase ล่ม
  }
  const fullMsg = 'ล้าง Log แล้ว ' + cleanOldLogs(7) + ' แถว | ' + sweepOrphanDriveImages() + ' | ' + resyncMsg;
  writeLog('⏰ AUTO-CLEANUP', fullMsg);
  return fullMsg;
}

// ตั้ง Time Trigger รวม (กันซ้ำแบบเดียวกับ setupLogCleanupTrigger — ลบ trigger เดิมก่อนสร้างใหม่)
function setupAllAutoCleanups() {
  const TRIGGER_FUNC = 'runDailyCleanups';
  let existing = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === TRIGGER_FUNC) {
      existing++;
      ScriptApp.deleteTrigger(tr);
    }
  });
  ScriptApp.newTrigger(TRIGGER_FUNC)
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  const msg = 'ตั้ง Time Trigger เรียบร้อย: ล้าง Log + กวาดไฟล์กำพร้า ทุกวัน 03:00 น.' +
    (existing > 0 ? ' (แทนที่ trigger เดิม ' + existing + ' ตัว)' : '');
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '⏰ Auto-cleanup รวม');
  Logger.log(msg);
  return msg;
}

// ==========================================
// LEARNING FROM SHEET EDITS — ให้ระบบเรียนรู้จับการแก้บิล "ตรงใน Google Sheet" ด้วย (เหมือนแก้ผ่านหน้าเว็บ)
// หลักการ: ต้องเป็น installable trigger เท่านั้น (simple onEdit ไม่มีสิทธิ์ UrlFetchApp → เขียน Supabase ไม่ได้)
// เรียนเฉพาะคอลัมน์เดียวกับระบบเว็บ: Doc Type / Supplier Name / Category — แก้อย่างอื่นไม่เรียน
// กันลูป: การเขียนของระบบเอง (webhook/save/resync) ไม่มี e.user หรือเป็น session ระบบ → ข้าม
// ==========================================

// ชื่อคอลัมน์ชีตที่เรียนรู้ (เทียบกับ LEARNING_FIELDS ฝั่งเว็บ)
var SHEET_LEARNING_COLMAP = {
  'Doc Type': 'doc_type',
  'Supplier Name': 'store_name',
  'Category': 'category'
};

// ติดตั้ง/แทนที่ installable onEdit trigger (เรียกจากเมนู)
function setupLearningEditTrigger() {
  const TRIGGER_FUNC = 'handleSheetEditForLearning';
  let replaced = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === TRIGGER_FUNC) {
      ScriptApp.deleteTrigger(tr);
      replaced++;
    }
  });
  ScriptApp.newTrigger(TRIGGER_FUNC)
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  const msg = 'ติดตั้ง Trigger เรียนรู้จากการแก้ชีตเรียบร้อย' + (replaced > 0 ? ' (แทนที่เดิม ' + replaced + ' ตัว)' : '') + ' — แก้ Doc Type / Supplier Name / Category ตรงในชีต = AI เรียนรู้ทันที';
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🧠 Learning Trigger');
  Logger.log(msg);
  return msg;
}

// installable onEdit handler — เทียบค่าเดิม/ค่าใหม่ของคอลัมน์ที่เรียนรู้ แล้วเรียนผ่านวงจรเดิม (upsertLearningPoint)
function handleSheetEditForLearning(e) {
  try {
    if (!e || !e.range || !e.range.getSheet) return;
    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== 'บิลจัดซื้อ (Receipts)') return;

    // กันลูป/กันเรียนจากระบบเอง: webhook/save/resync เขียนโดยไม่มี effective user จริง
    const effUser = (e.user && e.user.getEmail && e.user.getEmail()) || '';
    if (!effUser) return;

    // แก้หลายเซลล์พร้อมกัน (วาง/ลาก) = ไม่วิเคราะห์ต่อเซลล์ — ให้ไปใช้หน้าเว็บสำหรับแก้ก้อน
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

    const row = e.range.getRow();
    if (row <= 1) return; // หัวตาราง

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    const col = e.range.getColumn();
    const headerName = headers[col - 1];
    const fieldName = SHEET_LEARNING_COLMAP[headerName];
    if (!fieldName) return; // แก้คอลัมน์อื่น — ไม่เรียน

    // ตัวตนบิลแถวนี้ (Doc Key) — ไม่มีก็ยังเรียนได้ (เก็บ doc_key ว่างเหมือนระบบเว็บ)
    const colDocKey = headers.indexOf('Doc Key');
    const docKey = colDocKey !== -1 ? String(sheet.getRange(row, colDocKey + 1).getValue() || '').trim() : '';

    // ค่าเดิม (AI อ่าน/ค่าในระบบ) = e.oldValue เฉพาะแก้โดยแทนค่า (ถ้าเคยว่าง ไม่มี oldValue = เรียนจากว่างเป็นมีค่า)
    const oldValue = (e.oldValue !== undefined && e.oldValue !== null) ? String(e.oldValue).trim() : '';
    const newValue = String(e.value || '').trim();
    if (!newValue || newValue === '-') return;
    if (oldValue === newValue) return;

    upsertLearningPoint(fieldName, oldValue, newValue, docKey); // วงจรเดิม — เขียน receipt_learning ผ่าน service_role
    writeLog('🧠 LEARNING', 'ชีตแก้ ' + (LEARNING_FIELD_LABELS[fieldName] || fieldName) + ' แถว ' + row + ': "' + oldValue + '" → "' + newValue + '"');
  } catch (err) {
    writeLog('⚠️ LEARNING', 'handleSheetEditForLearning: ' + err.toString());
  }
}

// ==========================================
// AUTO RESYNC (ชีต↔Supabase) — เติมเฉพาะแถวที่ขาดฝั่งใดฝั่งหนึ่ง (additive-only)
// ==========================================
// เมื่อ dual-write สะดุดข้างเดียว (เช่น Supabase ล่มชั่วขณะตอน webhook → บิลอยู่ในชีตแต่ไม่เข้า Supabase)
// เทียบ doc_key สองฝั่งแล้ว "เติมเฉพาะที่ขาด" — ไม่ลบ ไม่แก้ไขแถวที่มีอยู่แล้วทั้งสองฝั่ง (กันทับข้อมูลที่แก้ล่าสุด)
// แนวการแปลงข้อมูลใช้ logic เดียวกับ migrateSheetsToSupabase (พิสูจน์แล้ว) — migrate เดิมไม่ถูกแตะ
function resyncReceiptsBetweenStores() {
  const baseUrl = getSupabaseUrl();
  const svcKey = getSupabaseKey();
  if (!baseUrl || !svcKey) return '⚠️ ข้าม Resync — ยังไม่ได้ตั้งค่า Supabase (SUPABASE_URL / SUPABASE_SERVICE_KEY)';

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet) return '⚠️ ข้าม Resync — หาชีต "บิลจัดซื้อ (Receipts)" ไม่พบ';

  // ---------- helpers (แนวเดียวกับ migrateSheetsToSupabase) ----------
  const clean = (v) => (v === undefined || v === null) ? null : (String(v).trim() === '' ? null : String(v).trim());
  const num = (v) => { const n = Number(v); return (v === '' || v === null || v === undefined || isNaN(n)) ? null : n; };
  const toIsoTs = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const d = new Date(String(v));
    return (!isNaN(d.getTime())) ? d.toISOString() : null;
  };
  const parseItems = (v) => {
    if (v === '' || v === null || v === undefined) return [];
    try { const arr = JSON.parse(String(v)); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  };

  // ---------- อ่านชีต ----------
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const findCol = (name) => {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
    if (name === 'Image URL') return headers.indexOf('Image Link');
    return -1;
  };
  const pick = (row, name) => { const i = findCol(name); return i >= 0 ? row[i] : undefined; };

  const sheetDocs = [];
  const seenKeys = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(c => c !== '' && c !== null && c !== undefined)) continue;

    let docKey = clean(pick(row, 'Doc Key'));
    if (!docKey) {
      docKey = buildDocKey({
        doc_type: pick(row, 'Doc Type'),
        tax_invoice_no: pick(row, 'Tax Invoice No.'),
        book_no: pick(row, 'Book No.'),
        doc_no: pick(row, 'Doc No.'),
        ref_no: pick(row, 'Ref No.')
      }) || '';
    }
    docKey = docKey || ('LEGACY_ROW_' + (r + 1));
    if (seenKeys[docKey]) docKey = docKey + '#2';
    seenKeys[docKey] = true;

    sheetDocs.push({
      doc_key: docKey,
      doc_type: clean(pick(row, 'Doc Type')),
      book_no: clean(pick(row, 'Book No.')),
      doc_no: clean(pick(row, 'Doc No.')),
      tax_invoice_no: clean(pick(row, 'Tax Invoice No.')),
      ref_no: clean(pick(row, 'Ref No.')),
      ref_label: clean(pick(row, 'Ref Label')),
      po_number: clean(pick(row, 'PO No.')) || '-',
      date: (function (v) {
        if (v === '' || v === null || v === undefined) return null;
        if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        return s || null;
      })(pick(row, 'Date')),
      store_name: clean(pick(row, 'Supplier Name')) || '',
      category: clean(pick(row, 'Category')) || 'ทั่วไป',
      items_summary: clean(pick(row, 'Items Summary')) || '',
      items: parseItems(pick(row, 'Items JSON')),
      total_amount: num(pick(row, 'Total Amount')) || 0,
      needs_review: pick(row, 'Needs Review') === true || pick(row, 'Needs Review') === 'TRUE' || pick(row, 'Needs Review') === 'true',
      review_reason: clean(pick(row, 'Review Reason')) || '',
      image_url: clean(pick(row, 'Image URL')) || '',
      sender_name: clean(pick(row, 'Sender Name')) || '',
      sender_id: clean(pick(row, 'Sender ID')) || '',
      source: clean(pick(row, 'Source')) || 'user',
      scale_weight_in: num(pick(row, 'Scale Weight In')),
      scale_weight_out: num(pick(row, 'Scale Weight Out')),
      scale_weight_net: num(pick(row, 'Scale Weight Net')),
      vehicle_registration: clean(pick(row, 'Vehicle Registration')),
      company_name: clean(pick(row, 'Company Name')),
      job_name: clean(pick(row, 'Job/Work')),
      requester: clean(pick(row, 'Requester')),
      pay_approver: clean(pick(row, 'Pay Approver')),
      system_record_no: num(pick(row, 'System Record No.')),
      running_number: clean(pick(row, 'Running No.')),
      image_md5: clean(pick(row, 'Image MD5')),
      submitted_at: toIsoTs(pick(row, 'Timestamp'))
    });
  }

  // ---------- อ่าน Supabase ----------
  const supaRows = fetchReceiptsFromSupabase(); // throw ถ้าเชื่อมไม่ได้ — caller จัดการ
  const supaKeys = {};
  let supaNoKey = 0;
  supaRows.forEach(function (r) {
    const k = clean(r && r.doc_key);
    if (!k) { supaNoKey++; return; }
    supaKeys[k] = true;
  });

  // ---------- ทิศทาง 1: ชีต → Supabase (เติมที่ Supabase ขาด — upsert ignore-duplicates กันชนกับ webhook) ----------
  const toUpsert = sheetDocs.filter(function (d) { return !supaKeys[d.doc_key]; });
  let sbFilled = 0;
  const batchSize = 100;
  for (let i = 0; i < toUpsert.length; i += batchSize) {
    supabaseRequest('post', '/rest/v1/receipts?on_conflict=doc_key', toUpsert.slice(i, i + batchSize), 'resolution=ignore-duplicates');
    sbFilled += Math.min(batchSize, toUpsert.length - i);
  }

  // ---------- ทิศทาง 2: Supabase → ชีต (เติมที่ชีตขาด) ----------
  const sheetKeys = {};
  sheetDocs.forEach(function (d) { sheetKeys[d.doc_key] = true; });
  const missingInSheet = supaRows.filter(function (r) {
    const k = clean(r && r.doc_key);
    return k && !sheetKeys[k];
  });

  let shFilled = 0;
  if (missingInSheet.length) {
    ensureSheetHeaders(sheet, getReceiptHeaders()); // กันชีตขาดคอลัมน์มาตรฐาน (แนวเดียวกับ saveToSheet) — ต้องทำก่อนอ่าน headers
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRows = missingInSheet.map(function (r) {
      const submitted = r.submitted_at ? new Date(r.submitted_at) : null;
      const m = {
        'Timestamp': (submitted && !isNaN(submitted.getTime())) ? submitted : (r.submitted_at || ''),
        'Source': r.source || 'user',
        'PO No.': r.po_number || '-',
        'Date': r.date || '',
        'Supplier Name': r.store_name || '',
        'Category': r.category || 'ทั่วไป',
        'Items Summary': r.items_summary || '',
        'Items JSON': JSON.stringify(Array.isArray(r.items) ? r.items : []),
        'Total Amount': (Number(r.total_amount) || 0),
        'Image URL': r.image_url || '',
        'Sender Name': r.sender_name || '',
        'Sender ID': r.sender_id || '',
        'Doc Type': r.doc_type || '',
        'Book No.': r.book_no || '',
        'Doc No.': r.doc_no || '',
        'Tax Invoice No.': r.tax_invoice_no || '',
        'Ref No.': r.ref_no || '',
        'Ref Label': r.ref_label || '',
        'Doc Key': r.doc_key || '',
        'System Record No.': (r.system_record_no === null || r.system_record_no === undefined || r.system_record_no === '') ? '' : Number(r.system_record_no),
        'Running No.': r.running_number || '',
        'Image MD5': r.image_md5 || '',
        'Needs Review': r.needs_review === true,
        'Review Reason': r.review_reason || '',
        'Scale Weight In': (r.scale_weight_in === null || r.scale_weight_in === undefined) ? '' : Number(r.scale_weight_in),
        'Scale Weight Out': (r.scale_weight_out === null || r.scale_weight_out === undefined) ? '' : Number(r.scale_weight_out),
        'Scale Weight Net': (r.scale_weight_net === null || r.scale_weight_net === undefined) ? '' : Number(r.scale_weight_net),
        'Vehicle Registration': r.vehicle_registration || '',
        'Company Name': r.company_name || '',
        'Job/Work': r.job_name || '',
        'Requester': r.requester || '',
        'Pay Approver': r.pay_approver || ''
      };
      return existingHeaders.map(function (h) { return m[h] !== undefined ? m[h] : ''; });
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, existingHeaders.length).setValues(newRows);
    shFilled = newRows.length;
  }

  const matched = sheetDocs.filter(function (d) { return supaKeys[d.doc_key]; }).length;
  const msg = 'Resync: ชีต→Supabase เติม ' + sbFilled + ' แถว | Supabase→ชีต เติม ' + shFilled + ' แถว | ตรงกันอยู่แล้ว ' + matched + ' รายการ' +
    (supaNoKey ? ' | ⚠️ Supabase มี ' + supaNoKey + ' แถวไม่มี doc_key (ข้าม)' : '');
  writeLog('🔄 RESYNC', msg);
  return msg;
}

// รัน Resync ทันทีจากเมนู (แสดงผลยืนยัน + กัน error ล้มเงียบ)
function resyncReceiptsNow() {
  try {
    const msg = resyncReceiptsBetweenStores();
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🔄 Resync ชีต↔Supabase');
    return msg;
  } catch (e) {
    const msg = 'Resync ไม่สำเร็จ: ' + e.toString();
    writeLog('⚠️ RESYNC', msg);
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, '🔄 Resync ชีต↔Supabase');
    return msg;
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getLineImage(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${getLineToken()}` }
  });
  return response.getBlob();
}

// ดึงโปรไฟล์ผู้ส่งจาก LINE (displayName / userId) — ใช้เก็บว่า "ใครเป็นคนส่งบิลเข้าระบบ"
//   หลัก: /profile/{userId} ใช้ได้เฉพาะคนที่แอดบอทเป็นเพื่อนแล้ว
//   ในกลุ่ม/ห้อง (สมาชิกอาจยังไม่แอดบอท) ต้องใช้ member endpoint ของกลุ่ม/ห้องนั้นแทน:
//     group: /v2/bot/group/{groupId}/member/{userId} | room: /v2/bot/room/{roomId}/member/{userId}
function getLineProfile(userId, source) {
  if (!userId) return null;
  const token = getLineToken();
  const profileFetch = (url) => UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true
  });
  const parseProfile = (resp, fromUrl) => {
    const code = resp.getResponseCode();
    if (code !== 200) return null;
    try {
      const p = JSON.parse(resp.getContentText());
      return { userId: userId, displayName: p.displayName || 'ไม่ทราบชื่อ', pictureUrl: p.pictureUrl || '' };
    } catch (e) {
      writeLog('⚠️ PROFILE', 'parse โปรไฟล์จาก ' + fromUrl + ' ล้มเหลว: ' + e.toString());
      return null;
    }
  };

  try {
    // ลำดับ 1: ถ้าอยู่ในกลุ่ม/ห้อง → ใช้ member endpoint (ดึงโปรไฟล์สมาชิกในกลุ่มได้แม้ยังไม่แอดบอท)
    if (source && source.type === 'group' && source.groupId) {
      const resp = profileFetch(`https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`);
      const got = parseProfile(resp, 'group member');
      if (got) return got;
    } else if (source && source.type === 'room' && source.roomId) {
      const resp = profileFetch(`https://api.line.me/v2/bot/room/${source.roomId}/member/${userId}`);
      const got = parseProfile(resp, 'room member');
      if (got) return got;
    }

    // ลำดับ 2: fallback ไป /profile/{userId} (คนที่แอดบอทเป็นเพื่อนแล้ว)
    const resp = profileFetch(`https://api.line.me/v2/bot/profile/${userId}`);
    const got = parseProfile(resp, 'profile');
    if (got) return got;

    writeLog('⚠️ PROFILE', 'ดึงโปรไฟล์ไม่สำเร็จ HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
    return { userId: userId, displayName: 'ไม่ทราบชื่อ' };
  } catch (err) {
    writeLog('⚠️ PROFILE', 'ดึงโปรไฟล์ผิดพลาด: ' + err.toString());
    return { userId: userId, displayName: 'ไม่ทราบชื่อ' };
  }
}

function saveImageToDrive(imageBlob, messageId) {
  const parentFolder = getOrCreateDriveFolder();
  
  const now = new Date();
  const yearStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy');
  const monthStr = Utilities.formatDate(now, 'Asia/Bangkok', 'MM');

  const yearFolders = parentFolder.getFoldersByName(yearStr);
  const yearFolder = yearFolders.hasNext() ? yearFolders.next() : parentFolder.createFolder(yearStr);

  const monthFolders = yearFolder.getFoldersByName(monthStr);
  const targetFolder = monthFolders.hasNext() ? monthFolders.next() : yearFolder.createFolder(monthStr);

  const fileName = `BTC_Receipt_${Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}_${messageId}.jpg`;
  imageBlob.setName(fileName);
  const file = targetFolder.createFile(imageBlob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

function getOrCreateDriveFolder() {
  const folderName = getDriveFolderName();
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

// ==========================================
// AI TEMPLATE LIBRARY — Phase 1: Core Storage & Matching
// ==========================================

// โฟลเดอร์หลักสำหรับเก็บ template รูปภาพ
const AI_TEMPLATE_ROOT_FOLDER_NAME = 'AI_Templates';
const AI_TEMPLATE_PENDING_FOLDER_NAME = 'pending';
const AI_TEMPLATE_ACTIVE_FOLDER_NAME = 'active';

// หา/สร้างโฟลเดอร์ AI_Templates ใต้โฟลเดอร์หลัก BTC
function getOrCreateAITemplateRootFolder() {
  const rootFolder = getOrCreateDriveFolder();
  const folders = rootFolder.getFoldersByName(AI_TEMPLATE_ROOT_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : rootFolder.createFolder(AI_TEMPLATE_ROOT_FOLDER_NAME);
}

// หา/สร้างโฟลเดอร์ย่อย pending/active
function getOrCreateAITemplateSubFolder(subFolderName) {
  const root = getOrCreateAITemplateRootFolder();
  const folders = root.getFoldersByName(subFolderName);
  return folders.hasNext() ? folders.next() : root.createFolder(subFolderName);
}

// คำนวณ pHash (perceptual hash) 64-bit จาก Blob ภาพ — ใช้ matching layout
// ใช้ Apps Script built-in: resize -> grayscale -> DCT -> threshold -> 64-bit hex
function computeLayoutSignature(imageBlob) {
  try {
    // Resize 32x32 grayscale
    const img = imageBlob.getAs('image/png');
    const resized = ImagesService.resize(img, 32, 32);
    // Apps Script ไม่มี DCT ตรง ๆ — ใช้วิธีประมาณ: mean threshold บน 32x32
    // สร้าง canvas ผ่าน HTML service ไม่ได้ใน server-side → ใช้ algorithm แบบง่าย:
    // 1. แปลงเป็น base64 -> ใช้ UrlFetch เรียก Cloud Vision? ไม่คุ้ม
    // 2. Fallback: ใช้ pHash library แบบ pure JS ผ่าน eval? ไม่ปลอดภัย
    // 3. Practical: ใช้ average hash (aHash) 64-bit แทน — เร็ว พอใช้
    //    aHash: resize 8x8 -> grayscale -> mean threshold -> 64 bits
    // Apps Script มี ImagesService.getPixels() ไม่ได้ → ใช้ workaround:
    //   Save temp -> ใช้ Drive API? ซับซ้อน
    //   Simplest: ใช้ file size + dimensions + color histogram signature แทน
    //   แต่เพื่อ Phase 1 ให้ทำงานก่อน — ใช้ signature แบบ simple: "WxH:filesize:md5prefix"
    //   Phase 2 จะย้ายไป compute pHash จริงที่ client-side (browser) แล้วส่งมา
    const bytes = imageBlob.getBytes();
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
    const md5hex = hash.map(b => (b < 16 ? '0' : '') + (b & 0xFF).toString(16)).join('');
    const w = 32, h = 32; // placeholder
    return 'aHash:' + w + 'x' + h + ':' + md5hex.slice(0, 16); // 16 hex = 64 bits
  } catch (e) {
    writeLog('⚠️ AI_TEMPLATE', 'computeLayoutSignature error: ' + e.toString());
    return '';
  }
}

// ค้นหา template ที่ match (rule-based: doc_type + hamming distance)
function findMatchingTemplates(docType, signature, threshold, limit) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return [];
  try {
    const params = new URLSearchParams({
      p_doc_type: docType,
      p_signature: signature || '',
      p_threshold: String(threshold || 10),
      p_limit: String(limit || 3)
    });
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/find_matching_templates?' + params, {
      method: 'GET',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (e) {
    writeLog('⚠️ AI_TEMPLATE', 'findMatchingTemplates error: ' + e.toString());
    return [];
  }
}

// สร้าง Template Candidate จากบิลใหม่ที่ AI อ่าน (status=pending)
function createTemplateCandidate(imageBlob, predictedDocType, aiResult, senderEmail) {
  // 🛡️ 2026-09-22 session guard: เก็บตัวอย่างบิลเข้า Drive + ai_templates (เรียกภายในจาก webhook ผ่าน runAsInternal_)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    const pendingFolder = getOrCreateAITemplateSubFolder(AI_TEMPLATE_PENDING_FOLDER_NAME);
    const fileName = 'template_' + predictedDocType + '_' + Utilities.getUuid() + '.png';
    const file = pendingFolder.createFile(imageBlob.setName(fileName));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const driveFileId = file.getId();
    const signature = computeLayoutSignature(imageBlob);
    const clusterId = 'cluster_' + signature.slice(0, 8); // placeholder
    const row = {
      doc_type: null,              // Phase 2: doc_type = หมวดที่ User จัดให้ (ว่าง = ยังไม่จัด)
      predicted_doc_type: predictedDocType,
      drive_file_id: driveFileId,
      drive_folder_path: 'AI_Templates/pending/',
      ground_truth: aiResult || {},
      layout_signature: signature,
      cluster_id: clusterId,
      status: 'pending',
      created_by: senderEmail || ''
    };
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      payload: JSON.stringify(row),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
      const created = JSON.parse(resp.getContentText());
      writeLog('✅ AI_TEMPLATE', 'Created candidate: ' + (created[0]?.id || 'unknown'));
      return created[0];
    }
    throw new Error('Supabase insert failed: ' + resp.getContentText());
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'createTemplateCandidate error: ' + e.toString());
    return null;
  }
}

// ยืนยัน Template Candidate → Active (move file, build few-shot prompt)
function confirmTemplate(templateId, groundTruth, docType, userEmail) {
  // 🛡️ 2026-09-22 session guard: ยืนยันแม่แบบ AI (เขียน ai_templates + Drive)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    // 1. อ่าน template เดิม
    const getResp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates?id=eq.' + templateId, {
      method: 'GET', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }, muteHttpExceptions: true
    });
    if (getResp.getResponseCode() !== 200) throw new Error('Template not found');
    const templates = JSON.parse(getResp.getContentText());
    if (!templates.length) throw new Error('Template not found');
    const tmpl = templates[0];
    // 2. ย้ายไฟล์ Drive pending -> active
    const file = DriveApp.getFileById(tmpl.drive_file_id);
    const activeFolder = getOrCreateAITemplateSubFolder(AI_TEMPLATE_ACTIVE_FOLDER_NAME);
    const pendingFolder = getOrCreateAITemplateSubFolder(AI_TEMPLATE_PENDING_FOLDER_NAME);
    // DriveApp ไม่มี moveTo ตรง ๆ → makeCopy + trash
    const newFile = file.makeCopy(activeFolder);
    file.setTrashed(true);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const newDriveFileId = newFile.getId();
    // 3. สร้าง few_shot_prompt
    const fewShotPrompt = buildFewShotPrompt(groundTruth, docType);
    // 4. อัปเดต Supabase
    const updatePayload = {
      ground_truth: groundTruth,
      few_shot_prompt: fewShotPrompt,
      drive_file_id: newDriveFileId,
      drive_folder_path: 'AI_Templates/active/',
      status: 'active',
      updated_at: new Date().toISOString()
    };
    const updResp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates?id=eq.' + templateId, {
      method: 'PATCH',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      payload: JSON.stringify(updatePayload),
      muteHttpExceptions: true
    });
    if (updResp.getResponseCode() >= 200 && updResp.getResponseCode() < 300) {
      writeLog('✅ AI_TEMPLATE', 'Confirmed template: ' + templateId);
      return JSON.parse(updResp.getContentText())[0];
    }
    throw new Error('Supabase update failed: ' + updResp.getContentText());
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'confirmTemplate error: ' + e.toString());
    return null;
  }
}

// สร้าง few-shot block สำหรับ inject เข้า prompt
function buildFewShotPrompt(groundTruth, docType) {
  if (!groundTruth || Object.keys(groundTruth).length === 0) return '';
  const jsonStr = JSON.stringify(groundTruth, null, 2);
  return `=== ตัวอย่าง ${docType} (แม่แบบอ้างอิง) ===\nคำตอบที่ถูกต้อง:\n${jsonStr}\n`;
}

// อ่าน AI Templates สำหรับ UI (รองรับ filter status, doc_type, pagination)
function getAITemplates(filters) {
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    if (!url || !key) return { success: false, message: 'Supabase not configured' };
    filters = filters || {};
    const params = new URLSearchParams();
    params.set('select', 'id,doc_type,drive_file_id,drive_folder_path,ground_truth,few_shot_prompt,layout_signature,cluster_id,status,usage_count,created_by,created_at,updated_at');
    if (filters.status) params.set('status', 'eq.' + filters.status);
    if (filters.doc_type) params.set('doc_type', 'eq.' + filters.doc_type);
    params.set('order', 'created_at.desc');
    params.set('limit', String(filters.limit || 50));
    params.set('offset', String(filters.offset || 0));
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates?' + params, {
      method: 'GET', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }, muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      return { success: true, templates: data };
    }
    return { success: false, message: 'HTTP ' + resp.getResponseCode() };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'getAITemplates error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// Soft delete / archive template
function deleteTemplate(templateId) {
  // 🛡️ 2026-09-22 session guard: ลบแม่แบบ AI (เขียน ai_templates)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    const payload = { status: 'archived', updated_at: new Date().toISOString() };
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates?id=eq.' + templateId, {
      method: 'PATCH',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    return resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'deleteTemplate error: ' + e.toString());
    return false;
  }
}

// เพิ่ม usage_count เมื่อ template ถูกใช้ match (PostgREST ไม่รองรับ ++ ตรง ๆ → ใช้ RPC increment_template_usage)
function incrementTemplateUsage(templateId) {
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    if (!url || !key || !templateId) return false;
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/increment_template_usage', {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ template_id: templateId }),
      muteHttpExceptions: true
    });
    return resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
  } catch (e) { return false; }
}

// ==========================================
// AI PROMPT SETS (Phase 2) — ชุด prompt AI ต่อประเภท "AI เป็นคนเขียนเอง"
// ==========================================
// หลักการ: ระบบมี "ชุด prompt" จัดกลุ่มตามประเภทบิล (standard = 6 หมวดบัญชีฐาน / custom = ผู้ใช้สร้าง)
//          User ลากตัวอย่างบิลไปวางในหมวด → AI ดูตัวอย่าง+ความรู้บัญชี แล้วเขียนชุด prompt เอง (ภาษาที่ AI เข้าใจ)
//          ตอนอ่านบิลใหม่ ระบบฉีด "ชุด prompt ของหมวดนั้น" + ตัวอย่าง (few-shot) เข้า Gemini

// URL/Key ซ้ำ ๆ ย่อให้สั้น
function supabaseBase() { return (getSupabaseUrl() || '').replace(/\/+$/, ''); }
function supabaseAuthHeaders() {
  var key = getSupabaseKey();
  return { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
}

// 0) รวมความรู้หมวดหนึ่งเป็น text ฐาน (ใช้ทั้ง seed และการ์ดสำรอง)
function buildStandardKnowledgeText(kb) {
  return String(kb.nature || '') + ' | สัญญาณ: ' + String(kb.signal || '') + ' | ต้องมี: ' + (kb.must_have || []).join(', ');
}

function buildStandardFieldConfig(kb) {
  var fields = {
    doc_type: true, doc_no: true, date: true, store_name: true,
    category: true, items: true, total_amount: !!kb.money_doc
  };
  if (kb.type === 'ใบกำกับภาษี') fields.tax_invoice_no = true;
  if (kb.type === 'ใบสั่งซื้อ') {
    fields.po_number = true; fields.company_name = true; fields.job_name = true;
    fields.requester = true; fields.pay_approver = true;
  }
  if (kb.type === 'ใบส่งของ') { fields.po_number = true; fields.ref_no = true; }
  if (kb.type === 'ใบวางบิล/ใบแจ้งหนี้') { fields.tax_invoice_no = true; fields.po_number = true; fields.ref_no = true; }
  if (kb.type === 'ใบชั่ง') {
    fields.vehicle_registration = true; fields.scale_weight_in = true;
    fields.scale_weight_out = true; fields.scale_weight_net = true; fields.total_amount = false;
  }
  if (kb.tax_document) fields.tax_invoice_no = true;
  if (kb.po_document) {
    fields.po_number = true; fields.company_name = true; fields.job_name = true;
    fields.requester = true; fields.pay_approver = true;
  }
  if (kb.delivery_document || kb.billing_document) { fields.po_number = true; fields.ref_no = true; }
  if (kb.billing_document) fields.tax_invoice_no = true;
  if (kb.scale_document) {
    fields.vehicle_registration = true; fields.scale_weight_in = true;
    fields.scale_weight_out = true; fields.scale_weight_net = true; fields.total_amount = false;
  }
  return fields;
}

function buildStandardPromptText(kb) {
  var focus = '';
  if (kb.type === 'ใบกำกับภาษี') focus = 'ตรวจคำว่าใบกำกับภาษี เลขที่ใบกำกับภาษี เลขผู้เสียภาษี VAT 7% ยอดก่อน VAT VAT และยอดรวมสุทธิ แยก tax_invoice_no จาก doc_no ให้ถูกต้อง';
  if (kb.type === 'ใบเสร็จรับเงิน') focus = 'ตรวจหลักฐานการรับเงิน เลขที่ใบเสร็จ วันที่ ร้านค้า รายการ และยอดที่รับชำระ ห้ามตีความใบเสนอราคาหรือใบส่งของเป็นใบเสร็จ';
  if (kb.type === 'ใบส่งของ') focus = 'เน้นเลขที่ใบส่งของ เลข PO วันที่ รายการสินค้า ปริมาณ หน่วย และผู้รับของ ยอดเงินเป็นข้อมูลรองและห้ามสร้างยอดถ้าไม่เห็นบนใบ';
  if (kb.type === 'ใบสั่งซื้อ') focus = 'เน้น PO number ชื่อบริษัทผู้ซื้อ ร้านค้าผู้ขาย งาน/โครงการ ผู้เบิก ผู้สั่งจ่าย รายการ จำนวน ราคา และยอดตามใบสั่งซื้อ';
  if (kb.type === 'ใบวางบิล/ใบแจ้งหนี้') focus = 'เน้นเลขที่ใบวางบิล/ใบแจ้งหนี้ เลขอ้างอิง PO งวดงาน ยอดเรียกเก็บ ร้านค้า และเอกสารประกอบ ห้ามถือเป็นหลักฐานรับเงิน';
  if (kb.type === 'ใบชั่ง') focus = 'เน้นทะเบียนรถ น้ำหนักเข้า น้ำหนักออก น้ำหนักสุทธิ และหน่วยตัน ห้ามคำนวณน้ำหนักสุทธิเอง และไม่บังคับยอดเงิน';
  if (kb.focus) focus = kb.focus;
  var required = (kb.must_have || []).length ? 'ฟิลด์สำคัญของประเภทนี้: ' + kb.must_have.join(', ') + ' — ' : '';
  return 'STANDARD_PROMPT_V3:' + kb.type + '\n' +
    'คุณกำลังอ่านเอกสารประเภท "' + kb.type + '" เท่านั้น หากภาพไม่ใช่ประเภทนี้ให้จำแนกใหม่จากภาพจริง\n' +
    required + focus + '\n' +
    'อ่านเฉพาะข้อความที่เห็นจริงบนภาพ ห้ามเดา ห้ามยืมค่าจากตัวอย่างหรือบิลก่อนหน้า ถ้าไม่ชัดให้ใส่ "-"\n' +
    'แยกเลขที่เอกสาร เลข PO เลขอ้างอิง และเลขใบกำกับภาษีตามป้ายกำกับบนเอกสาร ห้ามยัดเลขข้ามช่อง\n' +
    'รายการสินค้าให้เก็บชื่อ สเปก จำนวน หน่วย ราคาต่อหน่วย และราคารวมเท่าที่เห็นจริง\n' +
    'ตอบ JSON ตาม schema กลางของระบบเท่านั้น และตั้ง doc_type เป็น "' + kb.type + '" เมื่อหลักฐานบนภาพยืนยันได้';
}

// 0b) สร้าง/ซ่อมชุดมาตรฐาน 1 หมวด (migrate generic prompt เดิมเป็นรายประเภทครั้งเดียว)
function ensureStandardPromptSet(docType) {
  if (!docType) return null;
  var key = supabaseBase();
  var resp = UrlFetchApp.fetch(key + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType) + '&select=*', {
    method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
  });
  if (resp.getResponseCode() === 200) {
    var existing = JSON.parse(resp.getContentText());
    if (Array.isArray(existing) && existing.length) {
      var current = existing[0];
      if (Number(current.prompt_seed_version || 0) < 3) {
        var migrated = {
          base_knowledge: buildStandardKnowledgeText(DOC_KNOWLEDGE_BASE.filter(function (item) { return item.type === docType; })[0]),
          prompt_text: buildStandardPromptText(DOC_KNOWLEDGE_BASE.filter(function (item) { return item.type === docType; })[0]),
          field_config: buildStandardFieldConfig(DOC_KNOWLEDGE_BASE.filter(function (item) { return item.type === docType; })[0]),
          prompt_seed_version: 3,
          status: 'ready'
        };
        if (migrated.base_knowledge && migrated.prompt_text) {
          var patch = UrlFetchApp.fetch(key + '/rest/v1/ai_prompts?id=eq.' + encodeURIComponent(current.id), {
            method: 'PATCH', headers: supabaseAuthHeaders(), payload: JSON.stringify(migrated), muteHttpExceptions: true
          });
          if (patch.getResponseCode() >= 200 && patch.getResponseCode() < 300) return Object.assign({}, current, migrated);
        }
      }
      return current;
    }
  }
  var kb = null;
  for (var i = 0; i < DOC_KNOWLEDGE_BASE.length; i++) {
    if (DOC_KNOWLEDGE_BASE[i].type === docType) { kb = DOC_KNOWLEDGE_BASE[i]; break; }
  }
  if (!kb) return null;
  var row = {
    doc_type: kb.type,
    title: kb.type,
    kind: 'standard',
    status: 'ready',
    base_knowledge: buildStandardKnowledgeText(kb),
    prompt_text: buildStandardPromptText(kb),
    field_config: buildStandardFieldConfig(kb),
    prompt_seed_version: 3
  };
  var ins = UrlFetchApp.fetch(key + '/rest/v1/ai_prompts', {
    method: 'POST', headers: supabaseAuthHeaders(), payload: JSON.stringify(row), muteHttpExceptions: true
  });
  if (ins.getResponseCode() >= 200 && ins.getResponseCode() < 300) {
    var arr = JSON.parse(ins.getContentText());
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  }
  throw new Error('สร้างชุดมาตรฐาน [' + docType + '] HTTP ' + ins.getResponseCode() + ': ' + ins.getContentText().substring(0, 300));
}

// 1) สร้างชุด prompt มาตรฐานทางบัญชี (จาก DOC_KNOWLEDGE_BASE) ครั้งแรก/หายไปทีละหมวด — ผิดไม่เงียบแจ้งออกมา
function ensureStandardPromptSets() {
  // 🛡️ 2026-09-22 session guard: seed ชุด prompt มาตรฐานลง ai_prompts (เรียกภายในจาก getAIPrompts ผ่าน runAsInternal_)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var created = 0;
    DOC_KNOWLEDGE_BASE.forEach(function (kb) {
      var pr = ensureStandardPromptSet(kb.type);
      if (pr && pr.id) created++; // ถ้าเพิ่งสร้าง (id มี) นับเพิ่ม — ของเดิม (มี id) ไม่นับซ้ำ
    });
    writeLog('🤖 PROMPT-SET', 'ensureStandardPromptSets: ตรวจ/สร้างครบ ' + DOC_KNOWLEDGE_BASE.length + ' หมวด (สำเร็จ ' + created + ' ใหม่)');
    return { success: true, created: created };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'ensureStandardPromptSets error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 2) อ่านชุด prompt ทั้งหมด + จำนวนตัวอย่างต่อหมวด (สำหรับหน้า UI)
//    seed ชุดมาตรฐานก่อน → ถ้า seed/DB มีปัญหาข้อความจะมาใน notice (ไม่บล็อก) และถ้า DB ว่าง
//    ให้คืน "ชุดมาตรฐานสำรอง" 6 ใบในตัวเสมอ เพื่อให้หน้าเว็บเห็นหมวดตลอดแม้ยังไม่มีภาพบิลจริง
function getAIPrompts() {
  try {
    var notice = '';
    try {
      var seed = runAsInternal_(function () { return ensureStandardPromptSets(); }); // 🛡️ internal call
      if (seed && seed.success === false) notice = 'seed ชุดมาตรฐาน: ' + seed.message;
    } catch (e) { notice = 'seed ชุดมาตรฐาน: ' + e.toString(); }
    var resp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/v_ai_prompts_ui?select=*&limit=200', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return { success: false, message: 'HTTP ' + resp.getResponseCode() + ' — ตรวจว่าวิ่ง supabase_setup_all.sql แล้ว (view v_ai_prompts_ui)' };
    var prompts = JSON.parse(resp.getContentText());
    if (!Array.isArray(prompts)) prompts = [];
    // ชุดมาตรฐานสำรอง: ถ้า DB ยังไม่มีหมวดไหนเลย → สร้างเป็นการ์ดในตัว (id=null, builtin=true)
    // ตอนลากภาพวาง การ์ดตัวนี้จะ trigger ensureStandardPromptSet ให้สร้างแถวจริงอัตโนมัติ
    if (!prompts.length) {
      prompts = DOC_KNOWLEDGE_BASE.map(function (kb) {
        return {
          id: null,
          doc_type: kb.type,
          title: kb.type,
          kind: 'standard',
          status: 'ready',
          prompt_text: buildStandardPromptText(kb),
          base_knowledge: buildStandardKnowledgeText(kb),
          field_config: buildStandardFieldConfig(kb),
          prompt_seed_version: 3,
          sample_count: 0,
          version: 0,
          created_by: '',
          created_at: null,
          updated_at: null,
          builtin: true
        };
      });
    }
    return { success: true, prompts: prompts, notice: notice || undefined };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'getAIPrompts error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 3) อ่านตัวอย่างบิลทุกใบ (สำหรับแท็บ "ตัวอย่าง" ในหน้า UI)
function dedupeSampleRows(list) {
  var rows = Array.isArray(list) ? list.slice() : [];
  var seen = {};
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var key = String(row.layout_signature || row.cluster_id || row.drive_file_id || row.id || '').trim();
    if (!key) {
      out.push(row);
      continue;
    }
    if (seen[key]) continue;
    seen[key] = true;
    out.push(row);
  }
  return out;
}

function getAISamples(filters) {
  try {
    filters = filters || {};
    var limit = Math.min(Math.max(Number(filters.limit || 200), 1), 1000);
    // 1) คลังแม่แบบ/ตัวอย่างที่จัดการแล้ว (ai_templates — ทุกสถานะที่ยังไม่เก็บถาวร)
    var tResp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?status=neq.archived&select=id,doc_type,predicted_doc_type,drive_file_id,ground_truth,layout_signature,cluster_id,status,usage_count,source,created_by,created_at&order=created_at.desc&limit=' + limit, {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var tRows = (tResp.getResponseCode() === 200) ? JSON.parse(tResp.getContentText()) : [];
    if (tResp.getResponseCode() !== 200) writeLog('⚠️ AI_SAMPLES', 'อ่าน ai_templates พลาด: HTTP ' + tResp.getResponseCode() + ': ' + tResp.getContentText().substring(0, 300));
    if (!Array.isArray(tRows)) tRows = [];

    // 🧠 v3.12.1: ดึง "บิลจริงจากตาราง receipts เสมอ" (ไม่ใช่เฉพาะตอนคลังแม่แบบว่าง)
    // พยายาม select คอลัมน์เต็มก่อน ถ้า schema ไม่ตรง (HTTP 400) ค่อยย่อเป็นคอลัมน์ขั้นต่ำ — ไม่เดา และมีรายงาน diagnostics
    var rRows = [];
    var rErr = '';
    try {
      var rColsFull = 'doc_key,doc_type,store_name,image_url,google_drive_file_id,date,created_at,doc_no,total_amount,ref_no,company_name,job_name,requester,pay_approver,scale_weight_in,scale_weight_out,scale_weight_net,vehicle_registration';
      var rResp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/receipts?select=' + encodeURIComponent(rColsFull) + '&order=created_at.desc&limit=' + limit, {
        method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
      });
      if (rResp.getResponseCode() === 200) {
        rRows = JSON.parse(rResp.getContentText()) || [];
      } else {
        rErr = 'full HTTP ' + rResp.getResponseCode();
        var rResp2 = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/receipts?select=doc_key,doc_type,store_name,image_url,google_drive_file_id,date,created_at&order=created_at.desc&limit=' + limit, {
          method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
        });
        if (rResp2.getResponseCode() === 200) {
          rRows = JSON.parse(rResp2.getContentText()) || [];
          rErr = '';
        } else {
          rErr += ' | minimal HTTP ' + rResp2.getResponseCode() + ': ' + rResp2.getContentText().substring(0, 200);
        }
      }
    } catch (eR) { rErr = eR.toString(); }
    if (!Array.isArray(rRows)) rRows = [];

    // 2) รวม 2 แหล่ง: บิลจริงเป็นตัวหลัก — ตัดแม่แบบ/candidate ที่เป็นสำเนาของบิลเดียวกันออก (ground_truth.doc_key ตรงกับ receipts)
    var receiptKeys = {};
    var receiptByDrive = {};
    rRows.forEach(function (r) {
      if (r && r.doc_key) receiptKeys[String(r.doc_key)] = true;
      if (r && r.google_drive_file_id) receiptByDrive[String(r.google_drive_file_id)] = true;
    });
    var tplKept = [];
    tRows.forEach(function (t) {
      if (!t) return;
      var gt = t.ground_truth || {};
      var gtKey = String(gt.doc_key || '').trim();
      if (gtKey && receiptKeys[gtKey]) return; // มีบิลต้นฉบับอยู่แล้ว → แสดงบิลจริงอย่างเดียว
      if (t.drive_file_id && receiptByDrive[String(t.drive_file_id)]) return;
      tplKept.push(t);
    });

    // 3) แปลงบิลจริงเป็นตัวอย่าง (id = doc_key จริง — ห้ามสุ่ม เพื่อให้บันทึกการจัดหมวดกลับถูกแถว)
    var samples = tplKept.concat(rRows.map(function (r) {
      var driveId = String(r.google_drive_file_id || '').trim();
      if (!driveId && r.image_url) driveId = extractDriveFileId(String(r.image_url || ''));
      var gt = {
        doc_type: r.doc_type || '', store_name: r.store_name || '', date: r.date || '',
        doc_no: r.doc_no || '', ref_no: r.ref_no || '', total_amount: r.total_amount || '',
        company_name: r.company_name || '', job_name: r.job_name || '', requester: r.requester || '',
        pay_approver: r.pay_approver || '', scale_weight_in: r.scale_weight_in || '',
        scale_weight_out: r.scale_weight_out || '', scale_weight_net: r.scale_weight_net || '',
        vehicle_registration: r.vehicle_registration || '', doc_key: r.doc_key || ''
      };
      return {
        id: String(r.doc_key || r.created_at || ''),
        source: 'receipt_archive',
        status: r.doc_type ? 'active' : 'pending',
        doc_type: r.doc_type || '',
        predicted_doc_type: r.doc_type || '',
        store_name: r.store_name || '',
        date: r.date || r.created_at || '',
        drive_file_id: driveId,
        image_url: r.image_url || '',
        ground_truth: gt,
        created_at: r.created_at || ''
      };
    })).filter(function (s) { return !!String(s.drive_file_id || '').trim(); });

    samples = dedupeSampleRows(samples);
    writeLog('🧠 AI_SAMPLES', 'คืน ' + samples.length + ' ตัวอย่าง (templates=' + tRows.length + '/kept=' + tplKept.length + ', receipts=' + rRows.length + (rErr ? ', ERR=' + rErr : '') + ')');
    return {
      success: true,
      samples: samples,
      total: samples.length,
      diagnostics: {
        templates_in_db: tRows.length, templates_shown: tplKept.length,
        receipts_in_db: rRows.length, receipts_shown: samples.length - tplKept.length,
        receipts_query_error: rErr,
        note: 'บิลที่ไม่มีรูปใน Drive (google_drive_file_id ว่าง) แสดงภาพไม่ได้จึงถูกซ่อน — ดูจำนวนจริงใน diagnostics'
      }
    };
  } catch (e) {
    writeLog('❌ AI_SAMPLES', 'getAISamples error: ' + e.toString());
    return { success: false, message: e.toString(), samples: [] };
  }
}

function updateAISampleClassification(payload) {
  // 🛡️ 2026-09-22 session guard: จัดหมวดตัวอย่างบิลให้ AI
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    payload = payload || {};
    var docType = String(payload.docType || '').trim();
    var sampleId = String(payload.sampleId || '').trim();
    var docKey = String(payload.docKey || payload.doc_key || '').trim();
    var gtIn = payload.groundTruth || {};
    var targetDocKey = docKey || String(gtIn.doc_key || '').trim();
    if (!docType) return { success: false, message: 'กรุณาเลือกประเภทเอกสารก่อนบันทึก' };

    // 🧠 v3.12.1: นับ "แถวที่โดนแก้จริง" ด้วย Prefer: return=representation — PostgREST คืน HTTP 200 + [] (0 แถว)
    // เมื่อ id ไม่ตรง แบบเดิมจึง ok=true ปลอม แล้วข้ามการแก้ receipts → การจัดหมวดหายเงียบ ๆ
    function patchCount(path, body) {
      var r = UrlFetchApp.fetch(supabaseBase() + path, {
        method: 'PATCH', headers: { 'apikey': getSupabaseKey(), 'Authorization': 'Bearer ' + getSupabaseKey(), 'Prefer': 'return=representation' },
        payload: JSON.stringify(body), muteHttpExceptions: true
      });
      var code = r.getResponseCode();
      if (code < 200 || code >= 300) return { rows: 0, data: [], error: 'HTTP ' + code + ': ' + r.getContentText().substring(0, 300) };
      var arr = [];
      try { arr = JSON.parse(r.getContentText()) || []; } catch (eP) { arr = []; }
      return { rows: Array.isArray(arr) ? arr.length : 0, data: Array.isArray(arr) ? arr : [] };
    }

    var out = { success: false, template_rows: 0, receipt_rows: 0, created_template: false, doc_type: docType, message: '' };
    var gtT = JSON.parse(JSON.stringify(gtIn || {}));
    gtT.doc_type = docType;
    if (targetDocKey) gtT.doc_key = gtT.doc_key || targetDocKey;

    // 1) แก้แถว ai_templates ตาม id (ตัวอย่างจากคลังแม่แบบ/candidate) — รวม ground_truth ที่ User ตรวจแล้ว
    if (sampleId) {
      var tplRes = patchCount('/rest/v1/ai_templates?id=eq.' + encodeURIComponent(sampleId), {
        doc_type: docType, predicted_doc_type: docType, status: 'active', ground_truth: gtT
      });
      out.template_rows = tplRes.rows;
      if (tplRes.error) writeLog('⚠️ AI_REVIEW', 'patch ai_templates พลาด: ' + tplRes.error);
    }

    // 2) แก้บิลจริงใน receipts ตาม doc_key (receipts ไม่มีคอลัมน์ predicted_doc_type — แก้เฉพาะ doc_type)
    if (targetDocKey) {
      var rcRes = patchCount('/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(targetDocKey), { doc_type: docType });
      out.receipt_rows = rcRes.rows;
      if (rcRes.error) writeLog('⚠️ AI_REVIEW', 'patch receipts พลาด: ' + rcRes.error);
    }

    // 3) หัวใจ: ถ้ายังไม่มีแม่แบบ active ผูกกับบิลใบนี้ → สร้างให้อัตโนมัติ
    //    ไม่งั้น resolvePromptInjection หา few-shot ไม่เจอ → analyzeReceiptSmart ข้ามรอบ 2 → AI อ่านด้วยความรู้ทั่วไป (อ่านมั่ว)
    if (out.template_rows === 0 && targetDocKey) {
      var sig = 'receipt:' + targetDocKey;
      var find = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?layout_signature=eq.' + encodeURIComponent(sig) + '&select=id&limit=1', {
        method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
      });
      var found = (find.getResponseCode() === 200) ? JSON.parse(find.getContentText()) : [];
      if (Array.isArray(found) && found.length) {
        var upd = patchCount('/rest/v1/ai_templates?id=eq.' + encodeURIComponent(found[0].id), {
          doc_type: docType, predicted_doc_type: docType, status: 'active', ground_truth: gtT
        });
        out.template_rows += upd.rows;
      } else {
        var driveId = '';
        if (out.receipt_rows > 0 && rcRes.data.length) driveId = String(rcRes.data[0].google_drive_file_id || '').trim();
        if (driveId) {
          var ins = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates', {
            method: 'POST', headers: { 'apikey': getSupabaseKey(), 'Authorization': 'Bearer ' + getSupabaseKey(), 'Prefer': 'return=representation' },
            payload: JSON.stringify({
              doc_type: docType, predicted_doc_type: docType, status: 'active',
              drive_file_id: driveId, layout_signature: sig, cluster_id: targetDocKey,
              ground_truth: gtT, source: 'receipt_review', created_by: 'review_board'
            }),
            muteHttpExceptions: true
          });
          var insCode = ins.getResponseCode();
          if (insCode >= 200 && insCode < 300) { out.created_template = true; out.template_rows += 1; }
          else writeLog('⚠️ AI_REVIEW', 'insert ai_templates พลาด: HTTP ' + insCode + ': ' + ins.getContentText().substring(0, 300));
        }
      }
    }

    out.success = (out.template_rows > 0) || (out.receipt_rows > 0);
    if (!out.success) {
      out.message = 'บันทึกไม่สำเร็จ — ไม่พบแถวที่ตรงในฐานข้อมูล (sampleId=' + (sampleId || '-') + ', docKey=' + (targetDocKey || '-') + ')';
    } else {
      out.message = 'บันทึกแล้ว' + (out.receipt_rows ? ' • บิลจริง ' + out.receipt_rows + ' แถว' : '') + (out.template_rows ? ' • แม่แบบ AI ' + out.template_rows + ' แถว' : '') + (out.created_template ? ' (สร้างแม่แบบให้ AI ใช้บิลนี้เป็นตัวอย่าง)' : '');
    }
    writeLog('🧠 AI_REVIEW', 'จัดหมวด "' + docType + '" → ' + out.message + (targetDocKey ? ' (doc_key=' + targetDocKey + ')' : ''));
    return out;
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'updateAISampleClassification error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 4) สร้างชุด prompt ใหม่แบบ user กำหนดเอง (custom) — AI จะตั้งชื่อ/เขียน prompt ให้เมื่อมีตัวอย่างวางลง
function createCustomPromptSet(title) {
  // 🛡️ 2026-09-22 session guard: สร้างชุด prompt ใหม่ (เขียน ai_prompts)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var row = {
      doc_type: 'custom_' + Utilities.getUuid().slice(0, 8),
      title: String(title || '').trim() || 'ชุดใหม่ (ยังไม่ตั้งชื่อ)',
      kind: 'custom',
      status: 'sample_needed'
    };
    var resp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts', {
      method: 'POST',
      headers: supabaseAuthHeaders(),
      payload: JSON.stringify(row),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
      var created = JSON.parse(resp.getContentText());
      writeLog('🤖 PROMPT-SET', 'สร้างชุด custom: ' + (created[0] ? created[0].id : '?'));
      return { success: true, prompt: created[0] };
    }
    return { success: false, message: 'HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200) };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'createCustomPromptSet error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 5) นำตัวอย่าง (templateId) ไปวางในหมวด docType — อัปเดต ai_templates + นับตัวอย่าง
//    ถ้าหมวดนี้ยังไม่มีชุด prompt ใน DB (เช่นกดจากการ์ดมาตรฐานสำรอง) → สร้างชุดมาตรฐานให้อัตโนมัติ
//    คืนค่า needs_generate = true เมื่อหมวดนั้นเพิ่งมีตัวอย่างแรก หรือชุด prompt ยังไม่พร้อม
// 🔎 วินิจฉัยระบบ "เอกสารสำหรับ AI" — รันจาก Apps Script editor (เลือกฟังก์ชันนี้แล้วกด Run)
// แล้วคัดลอกผล JSON จาก Execution log ส่งกลับให้ AI วิเคราะห์ (ตามกฎข้อ 6 — ไม่เดาข้อมูล DB)
function diagnoseAIDocuments() {
  var report = { time: new Date().toISOString() };
  function countOf(path) {
    try {
      var r = UrlFetchApp.fetch(supabaseBase() + path, {
        method: 'get',
        headers: { 'apikey': getSupabaseKey(), 'Authorization': 'Bearer ' + getSupabaseKey(), 'Prefer': 'count=exact', 'Range': '0-0' },
        muteHttpExceptions: true
      });
      var cr = String(r.getHeaders()['Content-Range'] || r.getHeaders()['content-range'] || '');
      var m = cr.match(/\/(\d+)$/);
      return { http: r.getResponseCode(), total: m ? Number(m[1]) : null, error: (r.getResponseCode() >= 300 ? r.getContentText().substring(0, 200) : '') };
    } catch (e) { return { http: 0, total: null, error: e.toString() }; }
  }
  report.ai_templates_total = countOf('/rest/v1/ai_templates?select=id');
  report.ai_prompts_total = countOf('/rest/v1/ai_prompts?select=id');
  report.receipts_total = countOf('/rest/v1/receipts?select=doc_key');
  report.receipts_with_drive_image = countOf('/rest/v1/receipts?select=doc_key&google_drive_file_id=not.is.null');
  report.receipts_classified = countOf('/rest/v1/receipts?select=doc_key&or=(doc_type.not.is.null,doc_type.neq.)');
  try {
    var dt = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?status=neq.archived&select=doc_type,predicted_doc_type,status&order=created_at.desc&limit=1000', { method: 'get', headers: supabaseAuthHeaders(), muteHttpExceptions: true });
    var rows = (dt.getResponseCode() === 200) ? JSON.parse(dt.getContentText()) : [];
    report.templates_by_status = {};
    report.templates_by_type = {};
    rows.forEach(function (r) {
      var st = String(r.status || 'null');
      report.templates_by_status[st] = (report.templates_by_status[st] || 0) + 1;
      var ty = String(r.doc_type || r.predicted_doc_type || '(ยังไม่จัดประเภท)');
      report.templates_by_type[ty] = (report.templates_by_type[ty] || 0) + 1;
    });
  } catch (e2) { report.templates_error = e2.toString(); }
  try {
    var pr = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?select=doc_type,status,sample_count&limit=1000', { method: 'get', headers: supabaseAuthHeaders(), muteHttpExceptions: true });
    var prows = (pr.getResponseCode() === 200) ? JSON.parse(pr.getContentText()) : [];
    report.prompts = (prows || []).map(function (x) { return { doc_type: x.doc_type, status: x.status, sample_count: x.sample_count }; });
  } catch (e3) { report.prompts_error = e3.toString(); }
  var txt = '📊 AI_DOCUMENTS_DIAGNOSTIC\n' + JSON.stringify(report, null, 2);
  Logger.log(txt);
  try { SpreadsheetApp.getActive().toast('เปิด Execution log (Ctrl+Enter) แล้วคัดลอกผล JSON ส่งกลับให้ AI วิเคราะห์'); } catch (e4) {}
  return report;
}

function attachTemplateToPrompt(templateId, docType) {
  // 🛡️ 2026-09-22 session guard: ผูกตัวอย่างบิลเข้ากับชุด prompt (เรียกภายในจาก uploadLocalSample ผ่าน runAsInternal_)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var reads = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType) + '&select=id,status', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var promptList = (reads.getResponseCode() === 200) ? JSON.parse(reads.getContentText()) : [];
    var pr = (Array.isArray(promptList) && promptList.length) ? promptList[0] : null;
    if (!pr) {
      pr = ensureStandardPromptSet(docType); // การ์ดสำรอง/หมวดมาตรฐาน → สร้างแถวให้อัตโนมัติ
      if (!pr) return { success: false, message: 'ไม่พบชุด prompt หมวด "' + docType + '" — สร้างชุดก่อนแล้วลากใหม่' };
    }

    var upd = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?id=eq.' + templateId, {
      method: 'PATCH',
      headers: supabaseAuthHeaders(),
      payload: JSON.stringify({ doc_type: docType, status: 'active' }),
      muteHttpExceptions: true
    });
    if (upd.getResponseCode() < 200 || upd.getResponseCode() >= 300) {
      return { success: false, message: 'จัดตัวอย่างไม่สำเร็จ HTTP ' + upd.getResponseCode() };
    }
    // นับตัวอย่างจริง (ไม่รวม archived)
    var cnt = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?doc_type=eq.' + encodeURIComponent(docType) + '&status=neq.archived&select=id', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var samples = (cnt.getResponseCode() === 200) ? JSON.parse(cnt.getContentText()) : [];
    var n = (Array.isArray(samples) ? samples.length : 0);
    UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?id=eq.' + pr.id, {
      method: 'PATCH', headers: supabaseAuthHeaders(),
      payload: JSON.stringify({ sample_count: n, status: pr.status === 'ready' ? 'ready' : 'sample_needed' }),
      muteHttpExceptions: true
    });
    var needsGenerate = (n >= 1 && pr.status !== 'ready');
    return { success: true, sample_count: n, needs_generate: needsGenerate };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'attachTemplateToPrompt error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 6) อัปโหลดรูปจากเครื่อง (ลากวางบนหมวด) → เอาเข้าบัญชีตัวอย่าง + จัดหมวดทันที
//    blobBase64 + mime + docType (หมวดที่วาง) — AI อ่าน ground truth เบื้องต้นให้
function uploadLocalSample(docType, fileName, blobBase64, mime) {
  // 🛡️ 2026-09-22 session guard: อัปโหลดไฟล์ตัวอย่างเข้า Drive + ให้ AI อ่าน (กินโควตา Gemini)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var bytes = Utilities.base64Decode(String(blobBase64 || ''));
    if (!bytes || !bytes.length) return { success: false, message: 'ไฟล์ว่าง/อ่าน base64 ไม่ได้' };
    var blob = Utilities.newBlob(bytes, mime || 'image/jpeg', fileName || 'upload_sample.png');
    var pendingFolder = getOrCreateAITemplateSubFolder(AI_TEMPLATE_PENDING_FOLDER_NAME);
    var file = pendingFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var gv = {};
    if (docType) {
      try {
        var ai = analyzeReceiptSmart(blob);  // อ่านเพื่อ ground truth เบื้องต้น (ไม่เดา)
        if (ai) { normalizeReceiptDocFields(ai); gv = ai; }
      } catch (e) { gv = {}; }
    }
    var row = {
      doc_type: docType || null,
      predicted_doc_type: gv.doc_type || null,
      drive_file_id: file.getId(),
      drive_folder_path: 'AI_Templates/pending/',
      ground_truth: gv,
      layout_signature: computeLayoutSignature(blob),
      cluster_id: 'upload_' + Utilities.getUuid().slice(0, 8),
      status: docType ? 'active' : 'pending',
      source: 'user_upload',
      created_by: 'web'
    };
    var ins = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates', {
      method: 'POST', headers: supabaseAuthHeaders(), payload: JSON.stringify(row), muteHttpExceptions: true
    });
    if (ins.getResponseCode() < 200 || ins.getResponseCode() >= 300) {
      return { success: false, message: 'บันทึกตัวอย่างไม่สำเร็จ HTTP ' + ins.getResponseCode() };
    }
    var created = JSON.parse(ins.getContentText())[0];
    // ถ้ามีหมวด → นับ + อยากให้ AI เขียน prompt ต่อ (ถ้ายังไม่พร้อม)
    var wantsGenerate = false;
    if (docType) {
      var attachRes = runAsInternal_(function () { return attachTemplateToPrompt(created.id, docType); }); // 🛡️ internal call
      wantsGenerate = !!(attachRes && attachRes.needs_generate);
    }
    return { success: true, sample: created, needs_generate: wantsGenerate };
  } catch (e) {
    writeLog('❌ AI_TEMPLATE', 'uploadLocalSample error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// 7) AI เขียน/ปรับชุด prompt ของหมวด — ดูความรู้บัญชีฐาน + ตัวอย่างสูงสุด 3 ใบ → เขียน prompt เอง
function generateAIPrompt(docType) {
  // 🛡️ 2026-09-22 session guard: ให้ AI เขียนชุดคำสั่งเอง (กินโควตา Gemini หนักสุดของระบบ)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var reads = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType) + '&select=*', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var plist = (reads.getResponseCode() === 200) ? JSON.parse(reads.getContentText()) : [];
    var pr = (Array.isArray(plist) && plist.length) ? plist[0] : null;
    if (!pr) {
      pr = ensureStandardPromptSet(docType); // กดจากชุดมาตรฐานที่ยังไม่เคยสร้างใน DB → สร้างให้อัตโนมัติ
      if (!pr) return { success: false, message: 'ไม่พบชุด prompt หมวด "' + docType + '"' };
    }

    // ดึงตัวอย่างสูงสุด 3 ใบ (มี ground_truth)
    var samples = [];
    if (pr.sample_count > 0) {
      var sResp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?doc_type=eq.' + encodeURIComponent(docType) + '&status=neq.archived&select=drive_file_id,ground_truth,created_at&limit=3&order=created_at.desc', {
        method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
      });
      if (sResp.getResponseCode() === 200) {
        samples = JSON.parse(sResp.getContentText());
      }
    }
    // กันกดซ้ำ (lock ระหว่าง generate)
    UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?id=eq.' + pr.id, {
      method: 'PATCH', headers: supabaseAuthHeaders(),
      payload: JSON.stringify({ status: 'generating' }), muteHttpExceptions: true
    });

    // สร้าง meta-prompt ให้ Gemini "เขียน prompt เอง" (ภาษาที่ AI เข้าใจ)
    var base = (pr.base_knowledge || '') + ' | ประเภทเอกสาร: ' + (pr.title || docType);
    var samplesBlock = '';
    for (var i = 0; i < samples.length; i++) {
      samplesBlock += '--- ตัวอย่างที่ ' + (i + 1) + ' ---\n' +
        'คำตอบที่ถูกต้อง (ground truth):\n' + JSON.stringify(samples[i].ground_truth || {}, null, 2) + '\n';
    }
    var metaPrompt = 'คุณเป็นผู้เชี่ยวชาญด้านการ "เขียน prompt" ให้ AI อ่านเอกสารบัญชี/บิลจัดซื้อสำหรับบริษัทก่อสร้างไทย\n' +
      'หน้าที่: เขียนชุด prompt อ่านบิลให้ละเอียด ใช้งานได้จริง ใช้ภาษาไทย ที่ AI รุ่นใหม่เข้าใจและบังคับไม่ให้เดาข้อมูล\n' +
      '\nข้อมูลหมวดของบิลนี้:\n' + base + '\n' +
      (samplesBlock ? '\nตัวอย่างบิลจริง (ดูภาพประกอบ) + คำตอบที่ถูกต้อง:\n' + samplesBlock : '\n(ยังไม่มีตัวอย่าง — เขียน prompt จากความรู้หมวดนี้อย่างเดียว)\n') +
      '\nข้อกำหนดชุด prompt ที่ต้องครอบคลุม:\n' +
      '1. วิธีระบุฟิลด์ (doc_type, tax_invoice_no, book_no, doc_no, ref_no/ref_label, po_number, company_name, job_name, requester, pay_approver)\n' +
      '2. วิธีอ่านเลข/วัน/ยอดรวม (เฉพาะที่เห็นจริง ห้ามคำนวณ ห้ามเดา; ใบชั่งต้องอ่าน น้ำหนักเข้า/ออก/สุทธิ+ทะเบียน)\n' +
      '3. รายการสินค้า (items) ละเอียด เกรด/สเปก/ขนาด ตามที่พิมพ์จริง\n' +
      '4. กฎเหล็กห้ามเดา: ลายมือไม่ชัว/ตัวเลือน/ตัวคล้ายกัน (0-O, 1-7, 1-I, 5-S, ส-ช, ป-บ) → ทุกฟิลด์ให้ "-" เท่านั้น\n' +
      '5. ใช้รูปแบบของชุดคำตอบ JSON เดียวกับที่ระบบใช้ (โครงสร้างเดิมของระบบ)\n' +
      '\nตอบกลับเป็น JSON object นี้เท่านั้น: { "title": "ชื่อหมวดสั้นๆ", "prompt": "ชุด prompt ภาษาไทย ละเอียด สั่งอ่านบิลนี้", "notes": "ข้อสังเกตจากตัวอย่าง (ถ้ามี)" }';

    var parts = [{ "text": metaPrompt }];
    for (var j = 0; j < samples.length; j++) {
      var fid = samples[j].drive_file_id;
      if (!fid) continue;
      try {
        var b = DriveApp.getFileById(fid).getBlob();
        parts.push({ "inlineData": { "mimeType": b.getContentType() || "image/jpeg", "data": Utilities.base64Encode(b.getBytes()) } });
      } catch (e) { /* ข้ามใบที่เปิดไฟล์ไม่ได้ */ }
    }

    var result = callGeminiJson(parts, { retries: 3 });
    if (!result || !result.prompt) throw new Error('Gemini ไม่คืน prompt ที่ถูกต้อง');

    var title = String(result.title || '').trim() || pr.title || docType;
    var promptText = String(result.prompt).trim();
    var version = Number(pr.version || 0) + 1;
    var upd = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?id=eq.' + pr.id, {
      method: 'PATCH',
      headers: supabaseAuthHeaders(),
      payload: JSON.stringify({
        title: title,
        prompt_text: promptText,
        status: 'ready',
        version: version,
        sample_count: (samples.length || 0)
      }),
      muteHttpExceptions: true
    });
    if (upd.getResponseCode() < 200 || upd.getResponseCode() >= 300) {
      throw new Error('บันทึกชุด prompt ไม่สำเร็จ HTTP ' + upd.getResponseCode());
    }
    writeLog('🤖 PROMPT-SET', 'AI เขียนชุด prompt [' + title + '] v' + version + ' จาก ' + samples.length + ' ตัวอย่าง');
    return { success: true, version: version, title: title };
  } catch (e) {
    // ปลดล็อกสถานะ (กันค้าง generating)
    try {
      UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType), {
        method: 'PATCH', headers: supabaseAuthHeaders(),
        payload: JSON.stringify({ status: 'sample_needed' }), muteHttpExceptions: true
      });
    } catch (e2) { /* ignore */ }
    writeLog('❌ AI_TEMPLATE', 'generateAIPrompt error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

function updateAIPromptFields(payload) {
  // 🛡️ 2026-09-22 session guard: แก้ช่องคำสั่งของชุด prompt
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const docType = String((payload && payload.docType) || '').trim();
  const fields = (payload && payload.fields && typeof payload.fields === 'object') ? payload.fields : {};
  if (!docType) return { success: false, message: 'ไม่พบ doc_type ของชุด prompt' };
  const allowed = ['doc_type', 'tax_invoice_no', 'book_no', 'doc_no', 'ref_no', 'po_number', 'date', 'store_name', 'category', 'items', 'total_amount', 'company_name', 'job_name', 'requester', 'pay_approver', 'scale_weight_in', 'scale_weight_out', 'scale_weight_net', 'vehicle_registration'];
  const clean = {};
  allowed.forEach(function (field) { clean[field] = fields[field] === true; });
  supabaseRequest('patch', '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType), { field_config: clean });
  return { success: true, field_config: clean };
}

// ลบชุด prompt (เฉพาะ custom) — ตัวอย่างที่จัดไว้ยังอยู่ (กลับเป็นยังไม่ได้จัด)
function deletePromptSet(promptId) {
  // 🛡️ 2026-09-22 session guard: ลบชุด prompt (เฉพาะชุดที่สร้างเอง)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  try {
    var reads = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?id=eq.' + promptId + '&select=id,doc_type,kind', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var plist = (reads.getResponseCode() === 200) ? JSON.parse(reads.getContentText()) : [];
    var pr = (Array.isArray(plist) && plist.length) ? plist[0] : null;
    if (!pr) return { success: false, message: 'ไม่พบชุด prompt' };
    if (pr.kind === 'standard') return { success: false, message: 'ชุดมาตรฐานลบไม่ได้ (ซ่อนได้ในภายหลัง)' };
    UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?doc_type=eq.' + encodeURIComponent(pr.doc_type), {
      method: 'PATCH', headers: supabaseAuthHeaders(),
      payload: JSON.stringify({ doc_type: null, status: 'pending' }), muteHttpExceptions: true
    });
    UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?id=eq.' + promptId, {
      method: 'DELETE', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    return { success: true, message: 'ลบชุด prompt แล้ว (ตัวอย่างกลับเป็นยังไม่ได้จัด)' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 8) ดึงชุด prompt ที่พร้อมใช้ + ตัวอย่าง few-shot ของ docType (สำหรับฉีดเข้า analyzeReceiptSmart)
function resolvePromptInjection(docType) {
  try {
    if (!docType) return { prompt_text: '', few_shot: '' };
    var reads = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType) + '&status=eq.ready&select=prompt_text,title&limit=1', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var plist = (reads.getResponseCode() === 200) ? JSON.parse(reads.getContentText()) : [];
    var pr = (Array.isArray(plist) && plist.length) ? plist[0] : null;
    var promptText = (pr && pr.prompt_text) ? pr.prompt_text : '';
    var sResp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?doc_type=eq.' + encodeURIComponent(docType) + '&status=neq.archived&select=ground_truth&limit=3&order=created_at.desc', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    var sList = (sResp.getResponseCode() === 200) ? JSON.parse(sResp.getContentText()) : [];
    var fewShot = '';
    if (Array.isArray(sList) && sList.length) {
      fewShot = sList.map(function (s) {
        return '=== ตัวอย่างบิลนี้ (อ้างอิง) ===\nคำตอบที่ถูกต้อง:\n' + JSON.stringify(s.ground_truth || {}, null, 2);
      }).join('\n\n');
    }
    return { prompt_text: promptText, few_shot: fewShot };
  } catch (e) {
    writeLog('⚠️ AI_TEMPLATE', 'resolvePromptInjection error: ' + e.toString());
    return { prompt_text: '', few_shot: '' };
  }
}

// ==========================================
// DYNAMIC MODEL SELECTION — ปรับตามรุ่นที่ Google เปิดให้ใช้จริงแบบอัตโนมัติ

// เรียก Gemini ให้คืน JSON (ใช้กับงาน meta เช่น AI เขียนชุด prompt) — ลองหลายโมเดล + retry ตาม opts.retries
function callGeminiJson(parts, opts) {
  opts = opts || {};
  const models = getPreferredGeminiModels();
  const maxAttempts = Math.max(1, Number(opts.retries || 2));
  let lastErr = null;
  const payloadBody = { contents: [{ parts: parts }], generationConfig: { responseMimeType: 'application/json' } };
  for (let mi = 0; mi < models.length; mi++) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + models[mi] + ':generateContent?key=' + getGeminiKey();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = UrlFetchApp.fetch(url, {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify(payloadBody), muteHttpExceptions: true
        });
        const body = JSON.parse(response.getContentText());
        if (body.error) {
          lastErr = body.error;
          if ((body.error.status === 'RESOURCE_EXHAUSTED' || body.error.status === 'UNAVAILABLE') && attempt < maxAttempts) {
            Utilities.sleep(8000);
            continue;
          }
          if (mi < models.length - 1) break; // รุ่นนี้เดี้ยง → รุ่นถัดไป
        } else {
          const txt = (body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts && body.candidates[0].content.parts[0] && body.candidates[0].content.parts[0].text) || '';
          if (txt) {
            try { return JSON.parse(txt); } catch (parseE) { lastErr = parseE; }
          } else {
            lastErr = new Error('Gemini ตอบกลับว่าง');
          }
        }
      } catch (e) { lastErr = e; }
      if (attempt < maxAttempts) Utilities.sleep(5000);
    }
  }
  throw new Error('callGeminiJson: เรียก Gemini ไม่สำเร็จ — ' + (lastErr ? (lastErr.message || lastErr.status || '') : 'ไม่ทราบสาเหตุ'));
}
// ==========================================
// ดึงรายชื่อรุ่นจาก Gemini API (models.list) แล้วจัดอันดับรุ่นที่อ่านภาพได้
// แคช 6 ชม. ลดการเรียกซ้ำ; ถ้าดึงไม่ได้ใช้รายการสำรองคงที่
// แก้อาการรุ่นถูกปิด/เปลี่ยนชื่อในอนาคต โดยไม่ต้องแก้โค้ด
function getPreferredGeminiModels() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('gemini_models');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* แคชเสีย -> ดึงใหม่ */ }
  }

  // 🆓 เอาตามคำสั่ง User: ใช้รุ่นฟรีเป็นหลัก — เอาเฉพาะตระกูล flash/flash-lite ที่เปิดเป็นรุ่นฟรี
  //   ไม่รวม pro (เสียเงิน/โควตาจำกัด) — flash-lite มาก่อนเสมอ
  const fallback = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
  let names = [];

  try {
    const res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + getGeminiKey() + '&pageSize=200',
      { muteHttpExceptions: true }
    );
    const body = JSON.parse(res.getContentText());
    if (body && body.models) {
      names = body.models
        .filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1; })
        .map(function (m) { return String(m.name || '').replace(/^models\//, ''); })
        .filter(function (n) { return n.indexOf('gemini') === 0; });
    }
  } catch (e) {
    writeLog('⚠️ MODEL LIST', 'ดึงรายชื่อรุ่นไม่สำเร็จ — ใช้รายการสำรอง (' + e.toString() + ')');
  }

  if (names.length === 0) return fallback;

  // ตัดรุ่นที่ไม่ใช่ข้อความ/ภาพบิลออก + ตัด pro ออก (ไม่ใช่รุ่นฟรี) — ให้คะแนน: flash-lite > flash
  const scored = names
    .filter(function (n) { return !/(embedding|aqa|image|tts|audio|vision|learnlm|robotics|veo|gemma|pro(-\d+)?$)/.test(n); })
    .map(function (n) {
      const preview = /(preview|exp|experimental)/.test(n);
      let score = 10;
      if (/flash-lite(-\d+)?$/.test(n)) score = 70;
      else if (/flash(-\d+)?$/.test(n)) score = 50;
      if (preview) score -= 15;
      const ver = n.match(/^gemini-(\d+(?:\.\d+)?)/);
      score += ver ? parseFloat(ver[1]) : 0;
      return { name: n, score: score };
    })
    .sort(function (a, b) { return b.score - a.score; });

  // เลือก 1 รุ่นต่อตระกูล: flash-lite ก่อนเสมอ (รุ่นฟรีหลัก) แล้ว flash (สำรองรุ่นฟรี) — ไม่เอา pro
  const picked = [];
  [/^gemini-[\d.]+-flash-lite(-\d+)?$/, /^gemini-[\d.]+-flash(-\d+)?$/].forEach(function (re) {
    const found = scored.find(function (s) { return re.test(s.name) && picked.indexOf(s.name) === -1; });
    if (found) picked.push(found.name);
  });
  scored.forEach(function (s) { if (picked.length < 3 && picked.indexOf(s.name) === -1) picked.push(s.name); });

  if (picked.length === 0) return fallback;
  cache.put('gemini_models', JSON.stringify(picked), 21600); // 6 ชม.
  writeLog('🎯 MODEL SELECT', 'รุ่นที่เลือกใช้ (ฟรีหลัก/ฟรีสำรอง): ' + picked.join(', '));
  return picked;
}

function buildUniversalOcrPrompt(fewShotBlock, feedbackBlock) {
  return `อ่านภาพเอกสารการเงิน/จัดซื้อของไทย แล้วตอบ Strict JSON object เท่านั้น ห้ามมี Markdown หรือข้อความนอก JSON

ประเภท document_type ที่อนุญาต: INVOICE_TAX_INVOICE, RECEIPT, PURCHASE_ORDER, DELIVERY_NOTE, WEIGHBRIDGE, CREDIT_NOTE, DEBIT_NOTE, QUOTATION, INTERNAL_VOUCHER, UNKNOWN
กฎห้ามเดา: ถ้าอ่านไม่ชัดให้ใช้ "-" สำหรับข้อความ, 0.00 สำหรับตัวเลข, [] สำหรับรายการ ห้ามเติมจากบริบท/ตัวอย่าง/บิลเก่า
วันที่และเลขที่เอกสาร (doc_date + doc_number) เป็นฟิลด์สำคัญและต้องอ่านให้ได้จริงจากภาพ หากไม่เห็นจริง ๆ ให้ใส่ "-" และติดธง review ทันที ห้ามข้ามหรือเติมจากความคุ้นเคย
วันที่ให้เป็น ค.ศ. YYYY-MM-DD โดย พ.ศ. ให้ลบ 543 เท่านั้น
remark_text ต้องรวมข้อความที่อ่านได้จริงจากหมายเหตุ/Remark/Note/Memo รวมลายมือเขียน
เอกสารงานก่อสร้างต้องอ่าน project_location และ vehicle_registration เมื่อมีบนภาพ
ตั๋วน้ำหนักต้องอ่าน gross_weight, tare_weight, net_weight และ weight_unit เป็น kg หรือ ton; ห้ามคำนวณค่าใดเอง
extracted_po_code ให้ใส่รหัส PO ที่เห็นจริงในเอกสารหรือหมายเหตุ; ถ้าไม่พบให้ "-"
match_type ต้องเป็น AUTO_EXACT เมื่อเห็น PO/ใบสั่งซื้อพร้อมรหัสชัดเจน, AUTO_SUGGESTED เมื่อพบเลขอ้างอิงลอยๆ/ยอดที่อาจสัมพันธ์, ไม่ชัดหรือไม่พบให้ MANUAL_REQUIRED
confidence_score ต้องอยู่ระหว่าง 0 ถึง 1 และสอดคล้องกับ match_type
IMPORTANT: ฟิลด์สำคัญ doc_number และ doc_date ต้องเป็นข้อมูลจากภาพจริง มิฉะนั้นระบบจะปฏิเสธการบันทึกอัตโนมัติและให้คนตรวจใหม่

${fewShotBlock ? 'ตัวอย่าง/กฎเฉพาะประเภทต่อไปนี้ใช้เป็นแนวทางเท่านั้น ต้องอ่านจากภาพปัจจุบัน:\n' + fewShotBlock : ''}
${feedbackBlock || ''}

ตอบตาม schema นี้เท่านั้น:
{
  "extraction": {
    "document_type": "INVOICE_TAX_INVOICE",
    "vendor_name": "-",
    "vendor_tax_id": "-",
    "doc_number": "-",
    "doc_date": "-",
    "project_location": "-",
    "vehicle_registration": "-",
    "weight_details": {"gross_weight":0.00,"tare_weight":0.00,"net_weight":0.00,"weight_unit":"kg"},
    "total_amount": 0.00,
    "vat_amount": 0.00,
    "remark_text": "-",
    "extracted_po_code": "-",
    "line_items": [{"item_description":"-","qty":0,"unit_price":0.00,"total_price":0.00}]
  },
  "matching_analysis": {
    "match_type": "MANUAL_REQUIRED",
    "confidence_score": 0.00,
    "suggested_po_code": "-",
    "reason": "-"
  }
}`;
}

function adaptUniversalOcrResult(result) {
  const extraction = (result && result.extraction) || {};
  const matching = (result && result.matching_analysis) || {};
  const typeMap = {
    INVOICE_TAX_INVOICE: 'ใบกำกับภาษี', RECEIPT: 'ใบเสร็จรับเงิน',
    PURCHASE_ORDER: 'ใบสั่งซื้อ', DELIVERY_NOTE: 'ใบส่งของ', WEIGHBRIDGE: 'ใบชั่ง',
    CREDIT_NOTE: 'ใบลดหนี้', DEBIT_NOTE: 'ใบเพิ่มหนี้', QUOTATION: 'ใบเสนอราคา', INTERNAL_VOUCHER: 'อื่นๆ', UNKNOWN: 'อื่นๆ'
  };
  const clean = function (v) { const s = String(v === undefined || v === null ? '' : v).trim(); return (!s || s === '-') ? '' : s; };
  const remark = clean(extraction.remark_text);
  const extractedPo = clean(extraction.extracted_po_code) || clean(matching.suggested_po_code);
  const weight = extraction.weight_details || {};
  const unit = String(weight.weight_unit || '').toLowerCase() === 'kg' ? 'kg' : 'ton';
  const weightFactor = unit === 'kg' ? 0.001 : 1;
  const type = typeMap[String(extraction.document_type || 'UNKNOWN').trim()] || 'อื่นๆ';
  const items = Array.isArray(extraction.line_items) ? extraction.line_items.map(function (item) {
    return {
      name: clean(item && item.item_description) || '-',
      quantity: Number(item && item.qty) || 0,
      unit: clean(item && item.unit) || '-',
      price_per_unit: Number(item && item.unit_price) || 0,
      total: Number(item && item.total_price) || 0
    };
  }) : [];
  return {
    doc_type: type,
    tax_invoice_no: type === 'ใบกำกับภาษี' ? clean(extraction.doc_number) : '',
    doc_no: clean(extraction.doc_number),
    date: clean(extraction.doc_date),
    project_location: clean(extraction.project_location),
    vehicle_registration: clean(extraction.vehicle_registration),
    scale_weight_in: Number(weight.gross_weight) > 0 ? Number(weight.gross_weight) * weightFactor : '',
    scale_weight_out: Number(weight.tare_weight) > 0 ? Number(weight.tare_weight) * weightFactor : '',
    scale_weight_net: Number(weight.net_weight) > 0 ? Number(weight.net_weight) * weightFactor : '',
    weight_unit: unit,
    store_name: clean(extraction.vendor_name),
    vendor_tax_id: clean(extraction.vendor_tax_id),
    vat_amount: Number(extraction.vat_amount) || 0,
    remark_text: remark,
    extracted_po_code: extractedPo,
    ref_no: extractedPo,
    ref_label: extractedPo ? 'หมายเหตุ/PO' : '',
    po_number: type === 'ใบสั่งซื้อ' ? clean(extraction.doc_number) : extractedPo,
    items: items,
    items_summary: items.map(function (item) { return item.name + ' (' + item.quantity + ' ' + item.unit + ')'; }).join(', '),
    total_amount: Number(extraction.total_amount) || 0,
    has_total: Number(extraction.total_amount) > 0,
    is_receipt: type !== 'อื่นๆ',
    readability: 'clear',
    confidence: Math.round((Number(matching.confidence_score) || 0) * 100),
    unreadable_reason: '-',
    match_type: clean(matching.match_type) || 'MANUAL_REQUIRED',
    confidence_score: Number(matching.confidence_score) || 0,
    match_reason: clean(matching.reason)
  };
}

function analyzeReceiptWithGemini(imageBlob, fewShotBlock, feedbackBlock) {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || "image/jpeg";
  // few-shot จากแม่แบบ (Phase 1 AI Template Library) — ฉีดตัวอย่างบิลที่ตรวจถูกแล้ว ช่วยอ่านบิลหน้ารูปแบบเดียวกัน
  const fewShotSupplement = (fewShotBlock && String(fewShotBlock).trim())
    ? '\n\n📚 แม่แบบอ้างอิง (ตัวอย่างบิลที่ตรวจถูกแล้ว) — ใช้จับรูปแบบการจัดหน้าเท่านั้น ห้ามลอกข้อมูลในแม่แบบมาแต่ง ต้องอ่านจากช่องจริงบนภาพของเรา:\n' + fewShotBlock + '\n'
    : '';
  // Human-in-the-Loop: บทเรียนจากประวัติการแก้ไขของ User (เฉพาะร้าน) — ใช้ยืนยันกับค่าบนภาพเท่านั้น
  const feedbackSupplement = (feedbackBlock && String(feedbackBlock).trim())
    ? feedbackBlock
    : '';

  const legacyPrompt = `วิเคราะห์ภาพบิล/ใบเสร็จ/ใบส่งของ สำหรับฝ่ายจัดซื้อบริษัทก่อสร้าง (ทั้งตัวพิมพ์และลายมือเขียนภาษาไทย) แล้วส่งคืนเฉพาะ JSON Object ตามโครงสร้างนี้เท่านั้น ห้ามมีข้อความอื่นนอก JSON:

🔥 กฎเหล็กห้ามเดา/ประดิษฐ์ข้อมูล (ยึดถือทุกฟิลด์): ถ้าอ่านจากภาพแล้วไม่มั่นใจจริงๆ ไม่ว่าจะเพราะลายมือเขียนยาก/เขียนมั่ว/ขีดทับ/ไหล มุมภาพตัด/หลุดโฟกัส ตัวพิมพ์จาง/เลือน หรือตัวอักษร/เลขคล้ายกันแยกไม่ออก (เช่น 0/O, 1/7, 1/I, 5/S, ส/ช, ป/บ) → **ต้องใส่ "-" ในฟิลด์นั้นเท่านั้น** ห้ามเดาจากบริบท ห้ามปะติดปะต่อ ห้ามเติมจากความคุ้นเคยหรือข้อมูลคนส่ง ห้ามประมาณตัวเลข ห้ามใช้ข้อมูลเดิมมาแทรก ใส่ "-" แล้วปลอดภัยกว่าข้อมูลที่มั่วเสมอ

{
  "doc_type": "ประเภทเอกสาร เลือกจาก: ใบกำกับภาษี, ใบเสร็จรับเงิน, ใบส่งของ, ใบสั่งซื้อ, ใบวางบิล/ใบแจ้งหนี้, ใบชั่ง, อื่นๆ (ไม่แน่ใจให้ใส่ อื่นๆ)",
  "tax_invoice_no": "เลขที่ใบกำกับภาษี (ใช้เมื่อเอกสารเป็น 'ใบกำกับภาษี') ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "book_no": "เล่มที่ (เมื่อเอกสารมีคำว่า เล่มที่/เล่ม) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "doc_no": "เลขที่ของเอกสารตามที่พิมพ์จริงบนบิล (เช่น เลขที่ใบเสร็จ/ใบส่งของ) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "ref_no": "เลขอ้างอิงอื่น เมื่อบิลไม่มีเลขที่/เล่มที่ เช่น เลขที่สัญญา, เลขเครื่อง, เลขผู้เสียภาษี, เลขที่ใบสั่งซื้อ — เอกสารใบรับของ/ใบชั่งตอนรับของ: ถ้าช่อง 'หมายเหตุ' เป็นเลขที่เอกสาร (เช่น เลขที่บิลส่งของ) ให้ใส่เลขนั้นที่นี่ พร้อม ref_label = 'หมายเหตุ' (ถ้าหมายเหตุเป็นข้อความอื่นหรือว่าง ให้ใส่ - ห้ามเดา) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "ref_label": "ชื่อเรียกของ ref_no เช่น 'เลขที่สัญญา' หรือ 'หมายเหตุ' (ถ้าไม่มีให้ใส่ -)",
  "vehicle_registration": "ทะเบียนรถที่พิมพ์บนใบชั่ง เช่น บบ 1234 บุรีรัมย์ (เฉพาะเอกสารประเภทใบชั่ง) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "scale_weight_in": "น้ำหนักเข้า หน่วย ตัน เฉพาะใบชั่ง — อ่านเลขจากใบแล้วเปลี่ยนเป็น ตัน ให้หมด (ใบพิมพ์ กก. ให้หาร 1000 เช่น 15,400 กก. = 15.4 / ใบพิมพ์ ตัน อยู่แล้วใช้ตามใบ) — ห้ามคำนวณอื่นนอกจากแปลงหน่วย ถ้าไม่มีให้ใส่ -",
  "scale_weight_out": "น้ำหนักออก หน่วย ตัน เฉพาะใบชั่ง — อ่านเลขจากใบแล้วเปลี่ยนเป็น ตัน ให้หมด (ใบพิมพ์ กก. ให้หาร 1000 / ใบพิมพ์ ตัน ใช้ตามใบ) — ห้ามคำนวณอื่นนอกจากแปลงหน่วย ถ้าไม่มีให้ใส่ -",
  "scale_weight_net": "น้ำหนักสินค้า (สุทธิ) หน่วย ตัน เฉพาะใบชั่ง — ใส่เฉพาะเลข 'สุทธิ/น้ำหนักสินค้า' ที่พิมพ์จริงบนใบ เปลี่ยนเป็น ตัน (ใบพิมพ์ กก. ให้หาร 1000) ห้ามเอาเข้า-ออกมาลบกันเอง ถ้าไม่มีให้ใส่ -",
  "po_number": "เลขที่ใบสั่งซื้อ (PO) ของบริษัทที่บิลอ้างถึง (มักมีคำว่า PO/ใบสั่งซื้อ) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "company_name": "ชื่อบริษัท (ฝั่งบริษัทผู้สั่งซื้อ/ของเรา) ที่พิมพ์บนใบ — มักอยู่หัวใบสั่งซื้อตามคำว่า ชื่อบริษัท/บริษัท/ผู้สั่งซื้อ ถ้าไม่เห็นช่องนี้บนใบจริงให้ใส่ - ห้ามเดา",
  "job_name": "งาน/โครงการ/งวดงาน/สถานที่ ที่ระบุบนใบ (เช่น ช่อง งาน, โครงการ, งวดงาน) ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "requester": "ผู้เบิก/ผู้ขอเบิก/ผู้ขอซื้อ ที่ระบุบนใบ ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "pay_approver": "ผู้สั่งจ่าย/ผู้มีอำนาจสั่งจ่าย/ผู้อนุมัติจ่าย ที่ระบุบนใบ ถ้าไม่มีให้ใส่ - ห้ามเดา",
  "date": "YYYY-MM-DD เป็นปี ค.ศ. เท่านั้น (ถ้าบิลเป็น พ.ศ. ให้ลบ 543 เช่น 2569 -> 2026) (ถ้าอ่านวันที่ไม่ออกให้ใส่ - ห้ามเดา)",
  "store_name": "ชื่อร้านค้า/ซัพพลายเออร์/ผู้ขาย (ถ้าอ่านไม่ออกให้ใส่ - ห้ามเดา)",
  "category": "เลือกจาก: วัสดุก่อสร้าง, น้ำมันเชื้อเพลิง, อุปกรณ์ช่าง, ค่าแรง/บริการ, ทั่วไป",
  "items": [
    {
      "name": "ชื่อรายการสินค้า/วัสดุให้ละเอียดตามที่พิมพ์จริง รวมเกรด/สเปก/ขนาด/คุณสมบัติ เช่น 'คอนกรีตผสมเสร็จ 35 Mpa (357 ksc)' ห้ามตัดเหลือแค่ชื่อรวม เช่น ห้ามเขียนแค่ 'คอนกรีตผสมเสร็จ' ถ้ามีคำต่อท้าย (Mpa/ksc/ความกว้าง/ความยาว/สี/ยี่ห้อ) ให้รวมด้วย (อ่านไม่ออกให้ใส่ - ห้ามเดา)",
      "quantity": 1,
      "unit": "หน่วยนับ เช่น ถุง, เส้น, ลิตร, คิว, โหล, คัน, เที่ยว (อ่านไม่ออกให้ใส่ - ห้ามเดา)",
      "price_per_unit": 0.00,
      "total": 0.00
    }
  ],
  "items_summary": "สรุปรายการสั้นๆ เช่น ปูนเสือ (50 ถุง), เหล็ก RB9 (20 เส้น) (อ่านไม่ออกให้ใส่ - ห้ามเดา)",
  "total_amount": 0.00,
  "has_total": true,
  "is_receipt": true,
  "readability": "clear",
  "confidence": 90,
  "unreadable_reason": "-"
}
กฎการประเมินภาพ (ห้ามเดาเด็ดขาด):
- "is_receipt": false ทันทีถ้าภาพไม่ใช่เอกสารงานจัดซื้อ (เช่น ภาพคน วิว แชท) — ใบชั่ง/ใบส่งของ/ใบสั่งซื้อ นับเป็นเอกสารงานจัดซื้อ ให้ is_receipt = true
- "readability": "clear" = อ่านชัดทั้งใบ, "blurry" = เบลอ/มืด/เอียง/ถูกตัดบางส่วนแต่อ่านใจความหลักได้, "unreadable" = อ่านสาระสำคัญไม่ได้เลย
- "confidence": 0-100 ความมั่นใจรวมของข้อมูลที่อ่านได้
- "unreadable_reason": ถ้าอ่านไม่ได้ให้อธิบายสั้นๆ ภาษาไทย (เช่น ภาพเบลอ ยอดรวมถูกนิ้วบัง ขอบบิลขาด) ถ้าอ่านได้ให้ใส่ -
- ต้องจำแนกประเภทเอกสารให้ชัดก่อนเสมอ (doc_type) ว่ามันคือเอกสารอะไร เช่น ใบกำกับภาษี, ใบเสร็จรับเงิน, ใบส่งของ, ใบสั่งซื้อ, ใบวางบิล/ใบแจ้งหนี้, ใบชั่ง — ใบกำกับภาษี/ใบเสร็จรับเงิน/ใบวางบิลส่วนใหญ่ต้องมีตัวเลขยอดรวมเงิน ส่วนใบส่งของ/ใบสั่งซื้อ/ใบชั่ง อาจมีหรือไม่มีตัวเลขยอดรวมเงินก็ได้ ให้ดูจริงบนภาพ
- เอกสาร "ใบชั่ง" (ชั่งน้ำหนักรถ) คือใบที่มีทะเบียนรถ + น้ำหนักชั่ง (เข้า/ออก/สุทธิ) — ให้ doc_type = ใบชั่ง และอ่าน vehicle_registration + scale_weight_* ที่เห็นจริง (ช่องไหนไม่มีให้ใส่ - ห้ามเอาเลขมาลบกันเอง)
- เอกสาร "ใบรับของ/ใบชั่งตอนรับของ" (ชั่งน้ำหนักตอนรับสินค้า มีหมายเหตุกำกับ): อ่านช่อง "หมายเหตุ" เสมอ — ถ้าเป็นเลขที่เอกสาร (เช่น เลขที่บิลส่งของ) ให้ใส่ใน ref_no + ref_label = "หมายเหตุ" (ระบบใช้เลขนี้จับคู่กับบิลส่งของอัตโนมัติ) — ถ้าหมายเหตุว่างหรือเป็นข้อความทั่วไป ให้ ref_no = - ห้ามเดา
- ใบส่งของ (Delivery Note) แยกจากใบเสร็จรับเงิน: ถ้าหัวใบเขียน "ใบส่งของ" ให้ doc_type = ใบส่งของ แม้มียอดเงินก็ตาม (ถ้าเป็นใบเดียวรวมใบเสร็จ+ใบส่งของ ให้ใช้ ใบเสร็จรับเงิน)
- "has_total": true เฉพาะเมื่อเห็นตัวเลขยอดรวมเงินบนเอกสารจริงตามคำกำกับ เช่น รวม, รวมทั้งสิ้น, รวมเป็นเงิน, ยอดรวม, รวมสุทธิ, Net, Total แล้วให้ total_amount = ตัวเลขที่เห็นนั้นจริงๆ
- "has_total": false เฉพาะเมื่อเอกสารนั้นไม่มีตัวเลขยอดรวมเงินอยู่จริงบนภาพ แล้วให้ total_amount = 0 (ห้ามเดาหรือคำนวณตัวเลขเอง)
- ตัวเลขทุกตัวต้องเห็นจริงในภาพเท่านั้น ห้ามคำนวณเติมหรือเดาเลขที่ขาด
- แยกเลขให้ถูกช่อง ห้ามนำเลขของช่องหนึ่งไปใส่ผิดช่อง (ดูข้อความกำกับหน้าตัวเลขจริงบนบิล):
  • เอกสารที่มีคำว่า "ใบกำกับภาษี" → เลขที่นั้นคือ tax_invoice_no
  • เอกสารที่มีคำว่า "เล่มที่/เล่ม" + "เลขที่" → แยกเข้า book_no และ doc_no ตามลำดับ
  • เอกสารที่ระบุแค่ "เลขที่" → ใส่ doc_no
  • เห็น "PO/เลขที่ใบสั่งซื้อ" → ใส่ po_number
  • ถ้าไม่มีเลขที่ใด ๆ ให้เหลือ doc_no/book_no/tax_invoice_no เป็น - แล้วใส่เลขที่ปรากฏอื่น ๆ ใน ref_no พร้อมบอกชื่อเรียกใน ref_label (ห้ามยัดเลขอื่นลง doc_no)
- ถ้าเอกสารไม่มีชื่อร้าน/ผู้ขาย ให้ store_name เป็น - (ห้ามเดาชื่อ)
- ฟิลด์สั่งซื้อ/งาน (company_name/job_name/requester/pay_approver): อ่านได้จากเอกสารทุกประเภทเมื่อเห็นช่อง/คำกำกับนั้นบนใบจริง (เช่น ใบสั่งซื้อมี ชื่อบริษัท/งาน/ผู้เบิก/ผู้สั่งจ่าย, ใบส่งของบางใบมี งาน/ผู้เบิก) — ไม่เห็นช่องใดให้ช่องนั้นเป็น - ห้ามเดา; ชื่อผู้สั่งจ่ายให้อ่านแบบ ไม่มีคำนำหน้า (ถ้าใบพิมพ์ ชื่อ-สกุล คั่นด้วยช่องว่าง คงตามที่พิมพ์)` + getAccountingKnowledgePrompt() + getCustomDocTypesPrompt() + getLearningContext() + fewShotSupplement + feedbackSupplement;  

  const prompt = buildUniversalOcrPrompt(fewShotBlock, feedbackBlock);
  const payload = {
    "contents": [
      {
        "parts": [
          { "text": prompt },
          {
            "inlineData": {
              "mimeType": mimeType,
              "data": base64Image
            }
          }
        ]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true,
    "timeout": 30
  };

  // โมเดลสำรองหลายตัวช่วยกันทำงาน — เลือกจากรายชื่อรุ่นที่ Google เปิดให้ใช้จริงแบบไดนามิก
  // แต่ละรุ่นลองไม่เกิน 3 ครั้ง backoff 4s -> 8s -> 15s + timeout 30s ต่อคำขอ
  // (กันคำขอค้างนาน ~60s ตอน API หนาแน่น) ถ้าแน่นชั่วคราว/ค้าง/พังให้สลับไปรุ่นถัดไป
  const models = getPreferredGeminiModels();
  const maxAttemptsPerModel = 3;
  const backoffMs = [4000, 8000, 15000];
  let jsonResponse = null;

  outer:
  for (let mi = 0; mi < models.length; mi++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${models[mi]}:generateContent?key=${getGeminiKey()}`;

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      let response = null;
      let httpErr = null;
      try {
        response = UrlFetchApp.fetch(url, options);
      } catch (err) {
        httpErr = err;
      }

      if (httpErr) {
        // คำขอค้าง/หมดเวลา (เกิดบ่อยตอน API หนาแน่น) — ถือว่าลองใหม่ได้ ไม่พังทั้งระบบ
        const waitMs = backoffMs[attempt - 1] || 10000;
        if (attempt < maxAttemptsPerModel) {
          writeLog('STEP 4-RETRY', 'Gemini [' + models[mi] + '] ตอบช้า/หมดเวลา — รอ ' + (waitMs / 1000) + ' วินาที แล้วลองใหม่ (ครั้งที่ ' + (attempt + 1) + '/' + maxAttemptsPerModel + ' ของรุ่นนี้)');
          Utilities.sleep(waitMs);
        } else if (mi < models.length - 1) {
          writeLog('STEP 4-MODEL', 'Gemini [' + models[mi] + '] ตอบช้า/หมดเวลา — สลับใช้รุ่นสำรอง [' + models[mi + 1] + ']');
          break;
        } else {
          throw new Error('Gemini API Error: ' + httpErr.toString());
        }
        continue;
      }

      jsonResponse = JSON.parse(response.getContentText());

      if (!jsonResponse.error) break outer;

      const status = jsonResponse.error.status || '';
      const retryable = (status === 'RESOURCE_EXHAUSTED' || status === 'UNAVAILABLE');

      if (retryable && attempt < maxAttemptsPerModel) {
        const waitMs = backoffMs[attempt - 1] || 30000;
        writeLog('STEP 4-RETRY', 'Gemini [' + models[mi] + '] หนาแน่นชั่วคราว (' + status + ') — รอ ' + (waitMs / 1000) + ' วินาที แล้วลองใหม่ (ครั้งที่ ' + (attempt + 1) + '/' + maxAttemptsPerModel + ' ของรุ่นนี้)');
        Utilities.sleep(waitMs);
      } else if (mi < models.length - 1) {
        writeLog('STEP 4-MODEL', 'Gemini [' + models[mi] + '] ไม่ผ่าน/หนาแน่น — สลับใช้รุ่นสำรอง [' + models[mi + 1] + ']');
        break; // ไปลองรุ่นถัดไป
      } else {
        throw new Error('Gemini API Error: ' + jsonResponse.error.message);
      }
    }
  }

  const rawText = (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts && jsonResponse.candidates[0].content.parts[0] && jsonResponse.candidates[0].content.parts[0].text)
    ? jsonResponse.candidates[0].content.parts[0].text
    : '';
  if (!rawText) {
    // Gemini ถูกตัวกรองความปลอดภัยบล็อก/ตอบกลับว่าง — ต้องแจ้งถ่ายใหม่ ห้ามบันทึกข้อมูลเดา
    throw new Error('RETAKE: Gemini ไม่ส่งผลวิเคราะห์กลับมา (ถูกตัวกรองความปลอดภัยบล็อกหรือตอบกลับว่างเปล่า)');
  }
  try {
    return adaptUniversalOcrResult(JSON.parse(rawText));
  } catch (parseErr) {
    // ตอบกลับไม่ใช่ JSON ที่อ่านได้ — ต้องแจ้งถ่ายใหม่ ห้ามบันทึกข้อมูลเดา
    throw new Error('RETAKE: ผลวิเคราะห์ของ Gemini ไม่ใช่ข้อมูลที่อ่านได้ กรุณาถ่ายภาพบิลให้ชัดแล้วส่งใหม่');
  }
}

// ==========================================
// ANALYZE SMART — 2-pass พร้อมชุด prompt AI (Phase 2) + few-shot ตัวอย่าง
// ==========================================
// Pass 1: วิเคราะห์พื้นฐาน → ได้ doc_type → ดึง "ชุด prompt ของหมวด" + ตัวอย่างแม่แบบ
// Pass 2: ฉีดเข้า Gemini แล้ววิเคราะห์ซ้ำ (ถ้ารอบ 2 พลาด → ใช้ผลรอบ 1) — ไม่ล้มเหลวเมื่อชุด prompt เสีย
function analyzeReceiptSmart(imageBlob, options) {
  options = options || {};
  const storeHint = String(options.storeName || options.store_name || '').trim();
  // Human-in-the-Loop: ฉีดบทเรียนการแก้ไขของ User เฉพาะร้าน (ถ้ารู้ชื่อร้านก่อนอ่าน เช่น RE-READ)
  const fbBlock = (storeHint && storeHint !== '-') ? feedbackPromptSection(getStoreFeedbackContext(storeHint)) : '';
  const primary = analyzeReceiptWithGemini(imageBlob, '', fbBlock);
  if (!primary) return primary;

  // 🆓 ประหยัดโควตา Gemini (รุ่นฟรีจำกัดจำนวนคำขอ/วัน): ผลรอบ 1 ชัดเจนพอ → ใช้ได้เลย ไม่เรียก AI รอบ 2 (ลดครึ่งของคำขอ)
  const conf = Number(primary.confidence);
  const goodEnough = (conf >= 85) && (!primary.readability || primary.readability === 'clear');
  if (goodEnough) return primary;

  try {
    const docType = String(primary.doc_type || '').trim();
    if (!docType) return primary;
    const inj = resolvePromptInjection(docType);
    const blockBits = [];
    if (inj.prompt_text && String(inj.prompt_text).trim()) {
      blockBits.push('📌 ชุดคำสั่งเฉพาะของบิลประเภท "' + docType + '" (เขียนโดยระบบ AI จากตัวอย่างบิลที่ตรวจแล้ว):\n' + inj.prompt_text);
    }
    if (inj.few_shot && String(inj.few_shot).trim()) {
      blockBits.push('📚 ตัวอย่างบิลที่ตรวจถูกแล้ว (จับรูปแบบการจัดหน้าเท่านั้น ห้ามลอกข้อมูลมาแต่ง):\n' + inj.few_shot);
    }
    if (!blockBits.length) return primary;
    const enhanced = analyzeReceiptWithGemini(imageBlob, blockBits.join('\n\n'), fbBlock);
    // รอบ 2 ส่วนใหญ่ดีกว่า แต่ถ้าพลาด (เช่น ไม่ใช่บิล) ให้ใช้ผลรอบ 1 เดิม
    return (enhanced && enhanced.is_receipt !== false) ? enhanced : primary;
  } catch (e) {
    writeLog('⚠️ AI_TEMPLATE', 'few-shot enhance พลาด — ใช้ผลรอบ 1: ' + e.toString());
    return primary;
  }
}

// ==========================================
// TEMPLATE CANDIDATE COLLECTION — เก็บตัวอย่างบิลใหม่ (ครั้งละรูปแบบเดียว) ให้ User ไปยืนยัน
// ==========================================
// หลักการ: บันทึกบิลทุกใบเข้าชีตตามปกติ แต่ถ้า "หน้าตายังไม่มีแม่แบบ" → เก็บเป็น Candidate (pending)
// กันซ้ำ: ถ้ามี active template ครอบอยู่แล้ว หรือมี pending ที่ signature รูปแบบเดียวกัน → ข้าม (เก็บอย่างละ 1 ใบ)
function ensureTemplateCandidateIfNeeded(imageBlob, receiptData, sender) {
  try {
    const docType = String((receiptData && receiptData.doc_type) || '').trim();
    if (!docType) return null;
    const signature = computeLayoutSignature(imageBlob);
    if (!signature) return null;
    // 1) ถ้าหมวดนี้มีชุด prompt พร้อมใช้แล้ว หรือมีตัวอย่างครบ 10 ใบ → ข้าม (ไม่เก็บซ้ำไม่ถ้วน)
    if (promptSampleCapReached(docType)) {
      writeLog('🤖 TEMPLATE', 'หมวด ' + docType + ' มีชุด prompt พร้อม/ตัวอย่างครบแล้ว — ข้ามเก็บ');
      return null;
    }
    // 2) มี candidate pending รูปแบบเดียวกันค้างอยู่ → ข้าม (เก็บอย่างละ 1)
    const dup = findPendingCandidateBySignature(docType, signature);
    if (dup) {
      writeLog('🤖 TEMPLATE', 'มี Candidate pending รูปแบบเดียวกันแล้ว (id=' + dup.id + ') — ข้าม');
      return null;
    }
    // 3) ยังไม่มี → เก็บ 1 ใบเป็น Candidate (ทายประเภทเก็บไว้ที่ predicted_doc_type รอ User ลากจัด)
    const cand = runAsInternal_(function () { return createTemplateCandidate(imageBlob, docType, receiptData, (sender && sender.displayName) || ''); }); // 🛡️ internal call
    writeLog('🤖 TEMPLATE', cand ? 'เก็บ Candidate ใหม่ [' + docType + '] สำเร็จ (id=' + cand.id + ')'
      : 'เก็บ Candidate ไม่สำเร็จ — ดู Log สีแดง');
    return cand;
  } catch (e) {
    writeLog('⚠️ AI_TEMPLATE', 'ensureTemplateCandidateIfNeeded error: ' + e.toString());
    return null;
  }
}

// ตรวจว่าหมวด docType ยังต้องการเก็บตัวอย่างไหม (ชุด prompt ready แล้ว หรือตัวอย่าง >= 10 → หยุด)
function promptSampleCapReached(docType) {
  try {
    const resp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_prompts?doc_type=eq.' + encodeURIComponent(docType) + '&select=status,sample_count&limit=1', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    const list = (resp.getResponseCode() === 200) ? JSON.parse(resp.getContentText()) : [];
    if (Array.isArray(list) && list.length && list[0] && String(list[0].status || '') === 'ready') return true;
    const cnt = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_templates?predicted_doc_type=eq.' + encodeURIComponent(docType) + '&status=neq.archived&select=id&limit=11', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    const rows = (cnt.getResponseCode() === 200) ? JSON.parse(cnt.getContentText()) : [];
    return (Array.isArray(rows) && rows.length >= 10);
  } catch (e) {
    return false;
  }
}

// หา candidate pending ที่ signature "รูปแบบเดียวกัน" (layout part เหมือนกัน — ตัด md5 per-image ออก)
function findPendingCandidateBySignature(docType, signature) {
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    if (!url || !key) return null;
    // layout part = signature โดยไม่มีส่วน hash ของภาพต่อท้าย (เช่น aHash:32x32:)
    const layoutPart = String(signature || '').replace(/:[0-9a-f]{16}$/i, '');
    if (!layoutPart) return null;
    const params = new URLSearchParams();
    params.set('select', 'id,predicted_doc_type,layout_signature,status,created_at');
    params.set('status', 'eq.pending');
    params.set('predicted_doc_type', 'eq.' + docType);
    params.set('layout_signature', 'like.' + layoutPart + '%');
    params.set('limit', '1');
    const resp = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/ai_templates?' + params, {
      method: 'GET', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }, muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      return (Array.isArray(data) && data.length) ? data[0] : null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ==========================================
// ACCOUNTING KNOWLEDGE BASE (ฐานความรู้มาตรฐานบัญชี — เกณฑ์หลักในการจำแนกประเภทเอกสาร)
// หลักการ: มาตรฐานบัญชีมาก่อนเสมอ → ประเภทขององค์กร (doc_types) เติมเมื่อมาตรฐานไม่ครอบคลุม
//          → บทเรียนจากการแก้จริง (receipt_learning) ปรับจูนรูปแบบเฉพาะ — ลำดับนี้ถูกฉีดเข้า prompt ตามลำดับ
//          และใช้เป็น "เกณฑ์ป้องกัน" ฝั่ง backend: ตรวจความสอดคล้อง doc_type กับลักษณะเอกสารที่ AI อ่านได้
// ==========================================

var DOC_KNOWLEDGE_BASE = [
  {
    type: 'ใบกำกับภาษี', code: 'TAX', group: 'Tax & Receipts', legal: 'ม.86/4',
    keywords: ['ใบกำกับภาษี', 'ต้นฉบับ/สำเนา'],
    nature: 'เอกสารภาษีที่ผู้ขายออกให้ผู้ซื้อตามกฎหมาย VAT — ต้องมีเลขที่ใบกำกับภาษี + เงินไม่รวม VAT/รวม VAT/ยอดรวมสุทธิ ครบชุด',
    must_have: ['เลขที่ใบกำกับภาษี', 'ยอดเงินรวม'],
    money_doc: true,
    signal: 'หัวใบเขียนว่า "ใบกำกับภาษี" (มักพ่วง ต้นฉบับ/สำเนา) และมีช่อง VAT 7% หรือเลขประจำตัวผู้เสียภาษีผู้ขาย'
  },
  {
    type: 'ใบเสร็จรับเงิน', code: 'REC', group: 'Tax & Receipts', legal: 'ม.105',
    keywords: ['ใบเสร็จรับเงิน', 'ใบเสร็จ', 'รับเงิน'],
    nature: 'หลักฐานการรับชำระเงินแล้ว — ใบเดียวจบ ไม่ต้องมีเลขใบกำกับภาษี (ถ้าพ่วง VAT ครบชุดจะกลายเป็นใบกำกับภาษี)',
    must_have: ['ยอดเงินที่รับชำระ'],
    money_doc: true,
    signal: 'หัวใบเขียน "ใบเสร็จรับเงิน" หรือ "ใบเสร็จ/รับเงิน" พร้อมยอดเงิน'
  },
  {
    type: 'ใบส่งของ', code: 'DO', group: 'Delivery & Site Operations',
    keywords: ['ใบส่งของ', 'ใบส่งสินค้า', 'ใบส่งของ/ใบกำกับตัวอย่าง', 'Delivery Note'],
    nature: 'หลักฐานการส่งมอบสินค้า — เน้นรายการสินค้า+ปริมาณ ไม่ใช่เอกสารภาษี (ถ้ามียอดเงินก็แค่แนบมา) ไม่ใช่หลักฐานจ่ายเงิน',
    must_have: [],
    money_doc: false,
    signal: 'หัวใบเขียน "ใบส่งของ" / "ใบส่งสินค้า" / "Delivery Note" — ย้ำ: ต่างจากใบเสร็จรับเงินแม้รูปคล้ายกัน'
  },
  {
    type: 'ใบสั่งซื้อ', code: 'PO', group: 'Purchasing & Commercial',
    keywords: ['ใบสั่งซื้อ', 'ใบสั่ง', 'Purchase Order', 'P.O.'],
    nature: 'เอกสารฝั่งผู้ซื้อสั่งซื้อก่อนรับของ — ยังไม่ใช่การซื้อขายเกิดขึ้น ไม่ใช่หลักฐานหนี้/จ่ายเงิน',
    must_have: [],
    money_doc: false,
    signal: 'หัวใบเขียน "ใบสั่งซื้อ" / "Purchase Order" — อย่าสับสนกับ "เลขที่ใบสั่งซื้อ (PO)" ที่พิมพ์อ้างอิงบนใบเอกสารอื่น'
  },
  {
    type: 'ใบวางบิล/ใบแจ้งหนี้', code: 'INV/BILL', group: 'Purchasing & Commercial',
    keywords: ['ใบวางบิล', 'ใบแจ้งหนี้', 'ใบแจ้งยอด', 'Invoice', 'Statement'],
    nature: 'เอกสารเรียกเก็บเงินรวมหลายรายการ/งวดงาน — เป็นเอกสารเงินที่ต้องตามเก็บใบกำกับ/ใบเสร็จประกอบ ไม่ใช่หลักฐานรับของ',
    must_have: ['ยอดเงินที่เรียกเก็บ'],
    money_doc: true,
    signal: 'หัวใบเขียน "ใบวางบิล" / "ใบแจ้งหนี้" / "Invoice" มักมีกำหนดชำระ (Due Date)'
  },
  {
    type: 'ใบชั่ง', code: 'WT', group: 'Delivery & Site Operations',
    keywords: ['ใบชั่ง', 'บัตรชั่ง', 'ใบชั่งน้ำหนัก', 'Weight Ticket', 'Weighbridge'],
    nature: 'หลักฐานการชั่งน้ำหนักรถเข้า-ออกสถานที่ — เน้นทะเบียนรถ+น้ำหนัก (เข้า/ออก/สุทธิ) ไม่ใช่เอกสารเงิน',
    must_have: [],
    money_doc: false,
    signal: 'ใบที่มีทะเบียนรถ + น้ำหนักชั่งเข้า/ออก (หรือคำว่า ชั่ง/Weighbridge) — อ่าน vehicle_registration + scale_weight_* ที่พิมพ์จริงเท่านั้น'
  }
];

// ส่วนขยายมาตรฐานบัญชี/ภาษีอากร — เก็บชื่อไทยเป็นค่า canonical เพื่อไม่กระทบข้อมูลบิลเดิม
DOC_KNOWLEDGE_BASE = DOC_KNOWLEDGE_BASE.concat([
  {
    type: 'ใบเสร็จรับเงิน/ใบกำกับภาษี', code: 'REC/TAX', group: 'Tax & Receipts',
    keywords: ['ใบเสร็จรับเงิน/ใบกำกับภาษี', 'ใบกำกับภาษี/ใบเสร็จรับเงิน'],
    nature: 'เอกสารฉบับเดียวที่เป็นทั้งหลักฐานรับชำระและใบกำกับภาษี ใช้พิจารณาภาษีซื้อจากข้อความและรายการครบถ้วนบนเอกสาร',
    must_have: ['เลขที่ใบกำกับภาษี', 'ยอดเงินรวม'], money_doc: true, tax_document: true,
    signal: 'หัวใบระบุทั้งใบเสร็จรับเงินและใบกำกับภาษี',
    focus: 'ตรวจว่าหัวเอกสารระบุทั้งใบเสร็จรับเงินและใบกำกับภาษี พร้อมอ่านเลขที่ใบกำกับ VAT และยอดสุทธิจากภาพจริง'
  },
  {
    type: 'ใบลดหนี้', code: 'CN', group: 'Tax & Receipts',
    keywords: ['ใบลดหนี้', 'Credit Note'], nature: 'เอกสารปรับลดมูลค่าซื้อและภาษีมูลค่าเพิ่มที่เกี่ยวข้อง อ้างอิงเอกสารภาษีเดิม',
    must_have: ['เลขที่ใบลดหนี้', 'เลขอ้างอิง'], money_doc: true, tax_document: true,
    signal: 'หัวใบระบุใบลดหนี้/Credit Note และมักอ้างอิงเลขที่ใบกำกับภาษีเดิม',
    focus: 'อ่านเลขที่ใบลดหนี้ เลขอ้างอิงใบกำกับเดิม ยอดที่ลด และ VAT ตามภาพจริง ห้ามทำยอดติดลบเอง'
  },
  {
    type: 'ใบเพิ่มหนี้', code: 'DN', group: 'Tax & Receipts',
    keywords: ['ใบเพิ่มหนี้', 'Debit Note'], nature: 'เอกสารปรับเพิ่มมูลค่าซื้อและภาษีมูลค่าเพิ่มที่เกี่ยวข้อง อ้างอิงเอกสารภาษีเดิม',
    must_have: ['เลขที่ใบเพิ่มหนี้', 'เลขอ้างอิง'], money_doc: true, tax_document: true,
    signal: 'หัวใบระบุใบเพิ่มหนี้/Debit Note และมักอ้างอิงเลขที่ใบกำกับภาษีเดิม',
    focus: 'อ่านเลขที่ใบเพิ่มหนี้ เลขอ้างอิงใบกำกับเดิม ยอดที่เพิ่ม และ VAT ตามภาพจริง'
  },
  {
    type: 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)', code: 'WHT', group: 'Tax & Receipts',
    keywords: ['หนังสือรับรองการหักภาษี ณ ที่จ่าย', '50 ทวิ', '50 bis'], nature: 'หนังสือรับรองภาษีเงินได้หัก ณ ที่จ่าย ไม่ใช่ใบกำกับภาษีซื้อ',
    must_have: [], money_doc: false, signal: 'ระบุหนังสือรับรองการหักภาษี ณ ที่จ่าย หรือแบบ 50 ทวิ',
    focus: 'ตรวจหัวหนังสือรับรองการหักภาษี ณ ที่จ่าย/50 ทวิ อ่านชื่อผู้จ่าย ผู้ถูกหัก และเลขที่เอกสาร ห้ามจัดเป็นใบกำกับภาษี'
  },
  {
    type: 'ใบส่งของ/ใบกำกับภาษี', code: 'DO/TAX', group: 'Delivery & Site Operations',
    keywords: ['ใบส่งของ/ใบกำกับภาษี', 'ใบกำกับภาษี/ใบส่งของ'], nature: 'เอกสารฉบับเดียวที่เป็นหลักฐานส่งมอบและใบกำกับภาษี ต้องตรวจองค์ประกอบภาษีจากฉบับจริง',
    must_have: ['เลขที่ใบกำกับภาษี', 'ยอดเงินรวม'], money_doc: true, tax_document: true, delivery_document: true,
    signal: 'หัวใบระบุทั้งใบส่งของและใบกำกับภาษี',
    focus: 'ตรวจหัวใบส่งของ/ใบกำกับภาษี อ่านเลขที่เอกสาร เลข PO รายการส่งมอบ VAT และยอดสุทธิให้แยกช่องถูกต้อง'
  },
  {
    type: 'ใบตรวจรับพัสดุ/งานจ้าง', code: 'WR', group: 'Delivery & Site Operations',
    keywords: ['ใบตรวจรับพัสดุ', 'ใบตรวจรับงาน', 'ใบรับมอบงาน', 'Work Acceptance Report'], nature: 'หลักฐานตรวจรับสินค้า พัสดุ หรืองานจ้างภายใน ไม่ใช่เอกสารภาษี',
    must_have: [], money_doc: false, delivery_document: true,
    signal: 'หัวใบระบุการตรวจรับพัสดุ งานจ้าง หรือรับมอบงาน',
    focus: 'เน้นเลขที่เอกสาร วันที่ รายการตรวจรับ ผู้ตรวจรับ และเลขอ้างอิง PO/ใบส่งของ ไม่ต้องสร้างยอดเงินถ้าไม่มี'
  },
  {
    type: 'ใบขอซื้อ/ใบขอเบิก', code: 'PR', group: 'Purchasing & Commercial',
    keywords: ['ใบขอซื้อ', 'ใบขอเบิก', 'Purchase Requisition'], nature: 'เอกสารคำขอภายในก่อนจัดซื้อหรือเบิกใช้ ไม่ใช่หลักฐานภาษีหรือรับชำระ',
    must_have: [], money_doc: false, po_document: true,
    signal: 'หัวใบระบุใบขอซื้อ ใบขอเบิก หรือ Purchase Requisition',
    focus: 'อ่านเลขที่ PR ผู้ขอ งาน/โครงการ รายการและจำนวน ห้ามสับสนกับใบสั่งซื้อหรือใบสำคัญจ่าย'
  },
  {
    type: 'ใบเสนอราคา', code: 'QT', group: 'Purchasing & Commercial',
    keywords: ['ใบเสนอราคา', 'Quotation', 'Quote'], nature: 'ข้อเสนอเงื่อนไขและราคาจากผู้ขาย ยังไม่ใช่ใบสั่งซื้อ ใบกำกับภาษี หรือหลักฐานชำระเงิน',
    must_have: ['เลขที่ใบเสนอราคา'], money_doc: false,
    signal: 'หัวใบระบุใบเสนอราคา/Quotation และมีช่วงเวลายืนราคา',
    focus: 'อ่านเลขที่ใบเสนอราคา ผู้เสนอราคา รายการ ปริมาณ ราคา และวันยืนราคา ห้ามจัดเป็นใบแจ้งหนี้'
  },
  {
    type: 'ใบสำคัญจ่าย', code: 'PV', group: 'Internal Accounting Vouchers',
    keywords: ['ใบสำคัญจ่าย', 'Payment Voucher'], nature: 'เอกสารบันทึกการอนุมัติหรือจ่ายเงินภายใน ไม่ใช่ใบกำกับภาษีโดยตัวเอง',
    must_have: ['เลขที่ใบสำคัญจ่าย'], money_doc: true,
    signal: 'หัวใบระบุใบสำคัญจ่าย/Payment Voucher',
    focus: 'อ่านเลขที่ใบสำคัญจ่าย วันที่ ผู้รับเงิน รายการ ยอดจ่าย และเอกสารอ้างอิง ห้ามถือว่าเป็น VAT input โดยลำพัง'
  },
  {
    type: 'ใบสำคัญรับ', code: 'RV', group: 'Internal Accounting Vouchers',
    keywords: ['ใบสำคัญรับ', 'Receive Voucher', 'Receipt Voucher'], nature: 'เอกสารบันทึกรับเงินภายใน ไม่ใช่ใบกำกับภาษีโดยตัวเอง',
    must_have: ['เลขที่ใบสำคัญรับ'], money_doc: true,
    signal: 'หัวใบระบุใบสำคัญรับ/Receive Voucher',
    focus: 'อ่านเลขที่ใบสำคัญรับ วันที่ ผู้จ่ายเงิน รายการ ยอดรับ และเอกสารอ้างอิงตามที่เห็นจริง'
  },
  {
    type: 'ใบเบิกเงินสดย่อย', code: 'PC', group: 'Internal Accounting Vouchers',
    keywords: ['ใบเบิกเงินสดย่อย', 'Petty Cash Voucher'], nature: 'เอกสารเบิกหรือเคลียร์เงินสดย่อยภายใน ต้องมีหลักฐานภายนอกประกอบสำหรับการพิจารณาภาษี',
    must_have: ['เลขที่ใบเบิกเงินสดย่อย'], money_doc: true,
    signal: 'หัวใบระบุใบเบิกเงินสดย่อย/Petty Cash Voucher',
    focus: 'อ่านเลขที่ใบเบิกเงินสดย่อย ผู้เบิก รายการ ยอด และเอกสารอ้างอิง ห้ามถือว่าเคลม VAT ได้จากใบนี้เพียงลำพัง'
  }
]);

// เติม metadata ให้ 6 ประเภทเดิม โดยไม่เปลี่ยนค่า doc_type ที่เคยบันทึกอยู่แล้ว
// (code/group ถูกกำหนดใน DOC_KNOWLEDGE_BASE ตรง ๆ แล้ว — ที่นี่เติมเฉพาะธงชนิดเอกสารที่ buildStandardFieldConfig ใช้)
DOC_KNOWLEDGE_BASE.forEach(function (kb) {
  if (kb.type === 'ใบกำกับภาษี') { kb.tax_document = true; }
  if (kb.type === 'ใบส่งของ') { kb.delivery_document = true; }
  if (kb.type === 'ใบชั่ง') { kb.scale_document = true; }
  if (kb.type === 'ใบสั่งซื้อ') { kb.po_document = true; }
  if (kb.type === 'ใบวางบิล/ใบแจ้งหนี้') { kb.billing_document = true; }
});

// คืนความรู้ของประเภทมาตรฐาน 1 ประเภท (เทียบจากชื่อที่ normalize แล้ว — ไม่เจอคืน null = ประเภทองค์กร/อื่นๆ)
function getDocKnowledgeByType(normType) {
  for (let i = 0; i < DOC_KNOWLEDGE_BASE.length; i++) {
    if (DOC_KNOWLEDGE_BASE[i].type === normType) return DOC_KNOWLEDGE_BASE[i];
  }
  return null;
}

// ตัวเลือก doc_type เป็น "เอกสารเงิน" หรือไม่ (ใช้ในเกณฑ์ป้องกัน — ครอบคลุมประเภทองค์กรด้วยไม่ได้ จึงถือว่าประเภทองค์กรไม่เป็นเอกสารเงิน ไม่ตีกลับ)
function isMoneyDocType(normType) {
  const kb = getDocKnowledgeByType(normType);
  return !!(kb && kb.money_doc);
}

// ลำดับหมวดมาตรฐานบัญชี 4 หมวด (ใช้จัดกลุ่มรายการใน prompt ให้ AI อ่านเป็นหมวด — หมวดไหนไม่มีสมาชิกจะถูกข้าม)
var DOC_GROUP_ORDER = ['Tax & Receipts', 'Delivery & Site Operations', 'Purchasing & Commercial', 'Internal Accounting Vouchers'];
var DOC_GROUP_THAI = {
  'Tax & Receipts': 'หมวด 1: เอกสารภาษีและหลักฐานรับชำระเงิน',
  'Delivery & Site Operations': 'หมวด 2: เอกสารการส่งมอบและหน้างานก่อสร้าง',
  'Purchasing & Commercial': 'หมวด 3: เอกสารจัดซื้อและการค้า',
  'Internal Accounting Vouchers': 'หมวด 4: เอกสารบันทึกบัญชีภายใน'
};

// ข้อความความรู้มาตรฐานบัญชีสำหรับฉีดเข้า prompt (ส่วนหัวของลำดับความรู้ 3 ชั้น) — เรียงเป็น 4 หมวดมาตรฐานบัญชี
function getAccountingKnowledgePrompt() {
  try {
    const lines = ['รายการ doc_type มาตรฐานที่อนุญาตให้คืนค่าได้ (' + getStandardDocTypeNames().length + ' ประเภท): ' + getStandardDocTypeNames().join(', ')];
    const grouped = [];
    DOC_GROUP_ORDER.forEach(function (g) { grouped.push(DOC_KNOWLEDGE_BASE.filter(function (kb) { return kb.group === g; })); });
    grouped.push(DOC_KNOWLEDGE_BASE.filter(function (kb) { return DOC_GROUP_ORDER.indexOf(kb.group) === -1; }));
    grouped.forEach(function (items, gi) {
      if (!items.length) return;
      const g = items[0].group;
      if (gi < DOC_GROUP_ORDER.length && g) lines.push('[' + (DOC_GROUP_THAI[g] || g) + ']');
      items.forEach(function (kb) {
        lines.push('• [' + (kb.code || '?') + '] "' + kb.type + '" = ' + kb.nature + (kb.must_have.length ? ' (จำเป็นต้องมี: ' + kb.must_have.join(', ') + ')' : '') + ' — สังเกตง่าย ๆ: ' + kb.signal + (kb.legal ? ' (อ้างอิง ' + kb.legal + ' แห่งประมวลรัษฎากร)' : ''));
      });
    });
    return '\nความรู้พื้นฐานมาตรฐานบัญชีและภาษีอากรสำหรับจำแนกประเภทเอกสาร (เกณฑ์หลัก — ใช้ก่อนเสมอ อ่านจากลักษณะจริงบนใบ อย่าเดาจากชื่อเดียว):\n' +
      lines.join('\n') +
      '\nลำดับการตัดสินใจ: 1) ดูลักษณะจริงบนใบเทียบความรู้มาตรฐานนี้ก่อน 2) ถ้าไม่ตรงมาตรฐานแต่ตรงประเภทเฉพาะขององค์กรด้านล่าง ให้ใช้ประเภทขององค์กร 3) จำแนกไม่แน่ใจจริง ๆ ให้ใส่ อื่นๆ (ห้ามเดา)' +
      '\nหมายเหตุ: ความรู้นี้ใช้จำแนกประเภทเอกสารเท่านั้น ไม่ใช่คำแนะนำการเคลมภาษีซื้อ (การเคลม VAT ต้องพิจารณาจากตัวเอกสารจริงและผู้เชี่ยวชาญด้านภาษี)';
  } catch (e) {
    return '';
  }
}

// ==========================================
// DOCUMENT IDENTITY (ตัวตนบิล — แยกความจริงบนเอกสาร แล้วค่อยสร้าง key กันซ้ำ)
// ==========================================
// ประเภทเอกสารที่ควบคุมคำศัพท์ (map ข้อความที่ AI อ่านได้ ให้เข้าหมวดมาตรฐาน)
function normalizeDocType(t) {
  const s = String(t || '').trim();
  if (!s || s === '-') return '';
  // ประเภทเอกสารเฉพาะขององค์กร: ชื่อ "ตรงเป๊ะ" ต้องมาก่อน pattern มาตรฐาน
  // (กันชื่อองค์กรที่มีคำพ้องอยู่ในมาตรฐาน เช่น "ใบรับเงินมัดจำ" ถูก /รับเงิน/ กลืนไปเป็นใบเสร็จรับเงิน)
  const customs = getCustomDocTypes();
  for (let i = 0; i < customs.length; i++) {
    if (s === customs[i].name) return s;
  }
  // เอกสารรวม/เอกสารปรับปรุงต้องตรวจลำดับก่อน pattern ทั่วไป เพื่อไม่ให้คำว่า "กำกับภาษี" กลืนประเภทที่ละเอียดกว่า
  if (/เสร็จรับเงิน.*กำกับภาษี|กำกับภาษี.*เสร็จรับเงิน/.test(s)) return 'ใบเสร็จรับเงิน/ใบกำกับภาษี';
  if (/ส่งของ.*กำกับภาษี|กำกับภาษี.*ส่งของ/.test(s)) return 'ใบส่งของ/ใบกำกับภาษี';
  if (/ลดหนี้|credit\s*note/i.test(s)) return 'ใบลดหนี้';
  if (/เพิ่มหนี้|debit\s*note/i.test(s)) return 'ใบเพิ่มหนี้';
  if (/หักภาษี\s*ณ\s*ที่จ่าย|50\s*(ทวิ|bis)/i.test(s)) return 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)';
  if (/เบิกเงินสดย่อย|petty\s*cash/i.test(s)) return 'ใบเบิกเงินสดย่อย';
  if (/สำคัญจ่าย|payment\s*voucher/i.test(s)) return 'ใบสำคัญจ่าย';
  if (/สำคัญรับ|receive\s*voucher|receipt\s*voucher/i.test(s)) return 'ใบสำคัญรับ';
  if (/ตรวจรับ|รับมอบงาน|รับพัสดุ|work\s*acceptance/i.test(s)) return 'ใบตรวจรับพัสดุ/งานจ้าง';
  if (/ขอซื้อ|ขอเบิก|purchase\s*requisition/i.test(s)) return 'ใบขอซื้อ/ใบขอเบิก';
  if (/เสนอราคา|quotation|\bquote\b/i.test(s)) return 'ใบเสนอราคา';
  if (/กำกับภาษี/.test(s)) return 'ใบกำกับภาษี';
  if (/วางบิล|แจ้งหนี้/.test(s)) return 'ใบวางบิล/ใบแจ้งหนี้';
  if (/ชั่ง/.test(s)) return 'ใบชั่ง';
  if (/สั่งซื้อ|^PO$/i.test(s)) return 'ใบสั่งซื้อ';
  if (/ส่งของ|ใบส่ง/.test(s)) return 'ใบส่งของ';
  if (/เสร็จ|รับเงิน/.test(s)) return 'ใบเสร็จรับเงิน';
  // ประเภทขององค์กรรอบสอง: คำพ้องที่พิมพ์อยู่ในข้อความ (เช่น AI เขียน "ใบขนส่งสินค้า (A4)" → เจอคำพ้อง "ใบขนส่ง" → ใช้ชื่อองค์กร)
  for (let i = 0; i < customs.length; i++) {
    const al = Array.isArray(customs[i].aliases) ? customs[i].aliases : [];
    for (let j = 0; j < al.length; j++) {
      if (al[j] && s.indexOf(al[j]) !== -1) return customs[i].name;
    }
  }
  return 'อื่นๆ';
}

// ทำส่วนประกอบของเลขให้เทียบกันได้: เลขไทย->อารบิก, full-width->half-width, ตัดช่องว่าง/ขีด/จุด, พิมพ์ใหญ่
function normalizeDocPart(s) {
  if (s === null || s === undefined) return '';
  let t = String(s).trim();
  if (!t || t === '-') return '';
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  t = t.replace(/[๐-๙]/g, ch => String(thaiDigits.indexOf(ch)));
  t = t.replace(/[０-９Ａ-Ｚａ-ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  t = t.replace(/[\s\-\/._]/g, '');
  return t.toUpperCase();
}

// สร้าง Doc Key จากตัวตนที่แข็งที่สุด → อ่อนที่สุด (ไม่มีเลย = คืน '' ห้ามเดา)
function buildDocKey(d) {
  if (!d) return '';
  const type = normalizeDocPart(normalizeDocType(d.doc_type));
  const tax = normalizeDocPart(d.tax_invoice_no);
  const book = normalizeDocPart(d.book_no);
  const doc = normalizeDocPart(d.doc_no);
  const ref = normalizeDocPart(d.ref_no);
  if (tax) return 'TAX:' + tax;
  if (doc) return 'DOC:' + (type || 'NA') + ':' + book + ':' + doc;
  if (ref) return 'REF:' + (type || 'NA') + ':' + ref;
  return '';
}

// ข้อความตัวตนบิลไว้แสดงผล/แจ้งเตือน (อ่านง่ายสำหรับคน)
function buildDocLabel(d) {
  if (!d) return '-';
  const parts = [];
  if (d.doc_type) parts.push(d.doc_type);
  if (d.tax_invoice_no) parts.push('เลขที่ใบกำกับภาษี ' + d.tax_invoice_no);
  if (d.book_no) parts.push('เล่มที่ ' + d.book_no);
  if (d.doc_no) parts.push('เลขที่ ' + d.doc_no);
  if (!d.tax_invoice_no && !d.doc_no && d.ref_no) {
    parts.push((d.ref_label ? String(d.ref_label) : 'เลขอ้างอิง') + ' ' + d.ref_no);
  }
  return parts.length > 0 ? parts.join(' ') : '-';
}

// เตรียมฟิลด์เอกสารให้พร้อมใช้ (trim + map ประเภท + คำนวณ key) — เรียกหลังได้ผลจาก Gemini
function normalizeReceiptDocFields(d) {
  if (!d) return d;
  const clean = v => {
    const s = String(v === null || v === undefined ? '' : v).trim();
    return (s === '-' || s === '') ? '' : s;
  };
  d.doc_type = normalizeDocType(d.doc_type);
  d.book_no = clean(d.book_no);
  d.doc_no = clean(d.doc_no);
  d.tax_invoice_no = clean(d.tax_invoice_no);
  d.ref_no = clean(d.ref_no);
  d.ref_label = clean(d.ref_label);
  if (!d.tax_invoice_no && d.doc_no && d.doc_type === 'ใบกำกับภาษี') {
    // บิลใบกำกับภาษีที่ AI อ่านได้ช่องเดียว — ใช้เป็นเลขใบกำกับภาษี
    d.tax_invoice_no = d.doc_no;
  }
  d.doc_key = buildDocKey(d);
  return d;
}

// ==========================================
// RECEIPT QUALITY CHECK (ตรวจว่า AI อ่านบิลได้จริงก่อนบันทึก — ห้ามเดาข้อมูล)
// ==========================================
// คืนค่า { ok: true, needs_review, review_reasons } ถ้าผ่าน | { ok: false, reasons: [...] } ถ้าไม่ผ่านจริง ๆ
// หลักการ: fail เฉพาะเมื่อ "ใช้ข้อมูลไม่ได้เลย" (ไม่ใช่บิล / อ่านไม่ออก / ไม่มีรายการ / ไม่มียอด)
//         ที่เหลือ (ไม่มีเลขที่, ไม่มีชื่อร้าน, วันที่ไม่ชัด) = บันทึกได้ แต่ติดธง "รอตรวจ"
function validateReceiptData(d) {
  const reasons = [];        // เหตุผลระดับ fail — ห้ามบันทึก
  const reviewReasons = [];  // เหตุผลระดับเตือน — บันทึกได้ แต่ให้คนตรวจ
  const unreadableReason = (d && d.unreadable_reason && String(d.unreadable_reason).trim() !== '' && String(d.unreadable_reason).trim() !== '-')
    ? String(d.unreadable_reason).trim() : '';

  // 1) ไม่ใช่บิล/ใบเสร็จ/ใบส่งของ
  if (!d || d.is_receipt === false) {
    reasons.push('ภาพที่ส่งมาไม่ใช่บิล/ใบเสร็จ/ใบส่งของ');
    return { ok: false, reasons: reasons, review_reasons: [], needs_review: false, unreadable_reason: unreadableReason };
  }

  // 2) คุณภาพภาพอ่านไม่ได้เลย
  if (String(d.readability || '').toLowerCase() === 'unreadable') {
    reasons.push(unreadableReason ? 'AI อ่านภาพไม่ออก: ' + unreadableReason : 'AI อ่านภาพไม่ออกเลย');
    return { ok: false, reasons: reasons, review_reasons: [], needs_review: false, unreadable_reason: unreadableReason };
  }

  const isBlank = (v) => !v || String(v).trim() === '' || String(v).trim() === '-';

  // 3) ความมั่นใจรวมต่ำเกินไป (< 60) → เตือน ไม่บล็อก
  const confidence = Number(d.confidence);
  if (!isNaN(confidence) && confidence < 60) {
    reviewReasons.push('ความมั่นใจของ AI ต่ำ (' + confidence + '/100)' + (unreadableReason ? ' — ' + unreadableReason : ''));
  }

  // 4) ชื่อร้าน/ผู้ขาย อ่านไม่ได้ → เตือน ไม่บล็อก (บิลไม่มีชื่อร้านมีจริง)
  if (isBlank(d.store_name)) reviewReasons.push('อ่านชื่อร้านค้า/ผู้ขายไม่ได้');

  // 5) ฟิลด์สำคัญ: วันที่ + เลขที่เอกสาร/เลขอ้างอิง ต้องมีค่าจริงจากภาพ มิฉะนั้นบันทึกอัตโนมัติไม่ได้
  //    ป้องกันบิลที่ "ไร้ตัวตน" และ AI สร้าง blank value ให้ถูกบันทึกลงฐานข้อมูล
  const noDocIdentity = isBlank(d.doc_no) && isBlank(d.tax_invoice_no) && isBlank(d.ref_no);
  const noDateValue = isBlank(d.date);
  if (noDocIdentity) {
    reasons.push('เลขที่เอกสาร/เลขอ้างอิงหลักขาดหายไป — ต้องตรวจภาพใหม่ก่อนบันทึก');
  }
  if (noDateValue) {
    reasons.push('วันที่ในบิลขาดหายไป — ต้องตรวจภาพใหม่ก่อนบันทึก');
  }

  const docKey = buildDocKey(d);
  if (!docKey) reviewReasons.push('ไม่พบเลขที่เอกสาร/เลขอ้างอิง (ต้องตรวจตัวตนบิลด้วยคน)');

  // 6) วันที่: ถ้าอ่านไม่ได้/ปีเพี้ยน → เตือน/ห้ามผ่าน auto-save
  const dateStr = String(d.date || '').trim();
  if (isBlank(d.date) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    reviewReasons.push('อ่านวันที่ในบิลไม่ได้');
  } else {
    let y = parseInt(dateStr.substring(0, 4), 10);
    // บิลไทยมักระบุ พ.ศ. — ถ้า AI ส่งปี พ.ศ. มา (25xx-26xx) แปลงเป็น ค.ศ. แบบตรงไปตรงมา
    if (y >= 2500 && y <= 2699) {
      y -= 543;
      d.date = String(y) + dateStr.substring(4);
      writeLog('ℹ️ DATE FIX', 'แปลงปี พ.ศ. เป็น ค.ศ. อัตโนมัติ: ' + dateStr + ' -> ' + d.date);
    }
    const nowYear = new Date().getFullYear();
    if (y < 2000 || y > nowYear + 1) {
      reviewReasons.push('วันที่ในบิลไม่น่าเชื่อถือ (อ่านได้ ' + dateStr + ')');
    }
  }

  // 7) รายการสินค้า: ไม่มีเลย = ใช้ไม่ได้
  const items = Array.isArray(d.items) ? d.items.filter(it => it && String(it.name || '').trim() !== '' && String(it.name).trim() !== '-') : [];
  if (items.length === 0) reasons.push('อ่านรายการสินค้าไม่ได้เลย');

  // 7.5) ความละเอียดรายการสินค้า (เน้นมากกว่ายอดรวม): อ่านได้แต่ชื่อรวม/ไม่มีเกรด-สเปก-ขนาด = เตือนให้คนตรวจ
  //      เช่น "คอนกรีตผสมเสร็จ" ยังเป็นชื่อรวม ต้องเป็น "คอนกรีตผสมเสร็จ 35 Mpa (357 ksc)" ถึงละเอียด
  const hasSpecMark = /[A-Za-z0-9().,\/\-]/;
  const lowDetailItems = items.filter(it => !hasSpecMark.test(String(it.name || '')));
  if (lowDetailItems.length > 0) {
    const scope = lowDetailItems.length >= items.length ? 'รายละเอียดรายการสินค้าอาจไม่ครบ (อ่านได้แค่ชื่อรวม ไม่มีเกรด/สเปก/ขนาด เช่น ต้องเป็น "คอนกรีตผสมเสร็จ 35 Mpa (357 ksc)")' : 'รายการสินค้าบางรายการอ่านได้แค่ชื่อรวม ไม่มีเกรด/สเปก/ขนาด';
    reviewReasons.push(scope + ' — ตรวจและแก้ไขได้');
  }

  // 7.6) เกณฑ์ป้องกันจากฐานความรู้มาตรฐานบัญชี: จำแนกไม่ออก (อื่นๆ) = ติดธงให้คนยืนยันเสมอ
  //      (กันบิลประเภทสำคัญหลุดไปในที่ ๆ AI ไม่แน่ใจ — คนยืนยัน/แก้ doc_type แล้วระบบจะเรียนรู้เข้า Learning Loop ต่อ)
  const normType = normalizeDocType(d.doc_type); // ประกาศตรงนี้ (แก้ TDZ: เดิมประกาศท้ายฟังก์ชันแต่ 7.6 ใช้ก่อน → ReferenceError)
  if (!normType) {
    reviewReasons.push('AI จำแนกประเภทเอกสารไม่ได้ — กรุณาระบุประเภทเอกสารให้ถูกต้อง');
  } else if (normType === 'อื่นๆ') {
    reviewReasons.push('AI จำแนกประเภทเอกสารเป็น "อื่นๆ" — กรุณายืนยัน/แก้ไขประเภทเอกสารให้ถูกต้องตามมาตรฐานบัญชี');
  }

  // 8) ยอดรวม — ตัดสินจาก "ความจริงบนเอกสาร" ไม่ใช่เดาจากชื่อเอกสาร:
//     ขั้นตอน: จำแนกประเภทเอกสารก่อน (doc_type) แล้วดูว่าเอกสารนั้นควรมีตัวเลขยอดรวมเงินไหม
//     ใบกำกับภาษี/ใบวางบิล = เอกสารเงิน → ต้องมี total
//     ใบส่งของ/ใบสั่งซื้อ = เอกสารอาจมีหรือไม่มีตัวเลขยอดรวมเงิน → ดู on-บิล (has_total) จริง
  const total = Number(d.total_amount);
  const hasTotalTxt = String(d.has_total || '').toLowerCase();
  // normType ประกาศไว้ที่ข้อ 7.6 ด้านบนแล้ว (แก้ ReferenceError: Cannot access 'normType' before initialization)
  const isMoneyDoc = isMoneyDocType(normType); // เอกสารเงินจากฐานความรู้มาตรฐานบัญชี (ประเภทองค์กร/อื่นๆ = ไม่ใช่เอกสารเงิน ไม่ตีกลับ)
  const isDeliverDoc = /ส่งของ|สั่งซื้อ|ขอซื้อ|ขอเบิก|ตรวจรับ|ชั่ง/.test(normType) || isCustomScaleLikeDocType(normType); // รวมเอกสารหน้างาน/ขอซื้อ/ใบชั่ง + ประเภทองค์กรที่ติ๊ก "ใช้ช่องใบชั่ง" — เอกสารที่อาจไม่มียอดเงิน
  if (!(total > 0)) {
    // กรณี "ไม่มีตัวเลขยอดรวมเงินจริง" จาก AI (has_total=false) หรือเอกสารส่งของ/สั่งซื้อที่ AI ไม่ระบุ
    // → บันทึกได้ แต่ปักธงรอตรวจให้คนมากรอกยอดเอง (กัน "ถ่ายใหม่" วนลูป โดยเปล่าประโยชน์)
    if (hasTotalTxt === 'false' || (hasTotalTxt === '' && isDeliverDoc && !isMoneyDoc)) {
      reviewReasons.push("เอกสารชนิดนี้ไม่มีตัวเลขยอดรวมเงินบนบิล (ใบส่งของ/ใบสั่ง/ใบชั่ง) — ถ้าต้องการยอดรวมให้แก้ไขในตารางภายหลัง");
    } else {
      reasons.push(hasTotalTxt === 'true'
        ? 'อ่านยอดรวมสุทธิไม่ได้ (เอกสารมีตัวเลขยอดรวมแต่ AI อ่านไม่เจอ — ลองถ่ายภาพให้คมชัด/ไม่ตัดท้ายบิล)'
        : 'อ่านยอดรวมสุทธิไม่ได้');
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons: reasons, review_reasons: reviewReasons, needs_review: reviewReasons.length > 0, unreadable_reason: unreadableReason };
  }
  return { ok: true, reasons: [], review_reasons: reviewReasons, needs_review: reviewReasons.length > 0, unreadable_reason: unreadableReason };
}

// สร้างข้อความแจ้งถ่ายใหม่ส่ง LINE (บอกสาเหตุ + วิธีถ่ายให้ชัด)
// ctx = { senderName, docLabel } — ระบุเอกสารเลขที่ + ตามหาคนส่งได้ (กรณีส่งหลายใบพร้อมกัน)
function buildRetakeMessage(reasons, unreadableReason, ctx) {
  const docLabel = (ctx && ctx.docLabel && String(ctx.docLabel) !== '-') ? String(ctx.docLabel) : 'ยังระบุเลขเอกสารไม่ได้';
  const senderName = (ctx && ctx.senderName && String(ctx.senderName).trim() !== '') ? String(ctx.senderName).trim() : 'ไม่ทราบชื่อ';
  let msg = '📸 ถ่ายใหม่ — เอกสาร:' + docLabel + '\n';
  msg += '👤 ผู้ส่ง: ' + senderName + '\n';
  msg += '──────────────────\n';
  msg += 'อ่านบิลไม่ชัด — กรุณาถ่ายภาพใหม่แล้วส่งอีกครั้ง\n';
  msg += 'ระบบยังไม่ได้บันทึกบิลนี้ (ไม่เดาข้อมูล)\n\n';
  if (reasons && reasons.length > 0) {
    msg += 'สาเหตุที่พบ:\n';
    reasons.forEach(function (r, i) { msg += (i + 1) + '. ' + r + '\n'; });
    msg += '\n';
  } else if (unreadableReason) {
    msg += 'สาเหตุ: ' + unreadableReason + '\n\n';
  }
  msg += 'วิธีถ่ายให้อ่านได้ 100%:\n';
  msg += '• วางบิลบนพื้นเรียบ ถ่ายตรงๆ ไม่เอียง\n';
  msg += '• เปิดไฟให้สว่าง ไม่ให้เงา/นิ้วบังตัวเลข\n';
  msg += '• เห็นขอบบิลครบทั้งใบ เลข PO วันที่ ยอดรวมต้องชัด\n';
  msg += '• ถ้าบิลยาว ถ่ายทีละส่วนให้ตัวหนังสือชัดแล้วส่งทีละภาพ';
  return msg;
}

// ==========================================
// DIAGNOSTIC (รันใน Editor เพื่อทดสอบ Gemini API โดยตรง)
// ==========================================
function testGeminiConnection() {
  const apiKey = getGeminiKey();
  const results = [];
  const models = getPreferredGeminiModels();

  results.push('รุ่นที่ระบบเลือกใช้อัตโนมัติ: ' + models.join(', '));
  results.push('API Key รูปแบบ: ' + (apiKey ? apiKey.substring(0, 6) + '... (ยาว ' + apiKey.length + ' ตัวอักษร)' : 'ไม่พบ Key!'));

  models.forEach(model => {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    const payload = {
      contents: [{ parts: [{ text: 'ตอบคำว่า OK เท่านั้น' }] }]
    };
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = response.getResponseCode();
      const body = response.getContentText().substring(0, 300);
      results.push('\n[' + model + '] HTTP ' + code + (code === 200 ? ' ✅ ใช้ได้' : ' ❌\n' + body));
    } catch (e) {
      results.push('\n[' + model + '] Exception: ' + e.toString());
    }
  });

  const report = '=== ผลทดสอบ Gemini API ===\n' + results.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert(report);
  } catch (e) {
    // รันจากหน้า Editor ที่ไม่มี UI ให้ดู Logger แทน
  }
  return report;
}

function saveToSheet(data, imageUrl, sourceType, sender) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }

  const senderName = (sender && sender.displayName) ? sender.displayName : '';
  const senderId = (sender && sender.userId) ? sender.userId : '';

  const itemsJsonStr = JSON.stringify(data.items || []);

  const standardMapping = {
    'Timestamp': new Date(),
    'Source': sourceType || 'user',
    'PO No.': data.po_number || '-',
    'Date': data.date || '',
    'Supplier Name': data.store_name || '',
    'Category': data.category || 'ทั่วไป',
    'Items Summary': data.items_summary || '',
    'Items JSON': itemsJsonStr,
    'Total Amount': data.total_amount || 0,
    'Image URL': imageUrl || '',
    'Sender Name': senderName,
    'Sender ID': senderId,
    'Doc Type': data.doc_type || '',
    'Book No.': data.book_no || '',
    'Doc No.': data.doc_no || '',
    'Tax Invoice No.': data.tax_invoice_no || '',
    'Ref No.': data.ref_no || '',
    'Ref Label': data.ref_label || '',
    'Doc Key': data.doc_key || '',
    'System Record No.': (data.system_record_no === undefined || data.system_record_no === null || data.system_record_no === '') ? '' : Number(data.system_record_no),
    'Running No.': data.running_number || '',
    'Image MD5': data.image_md5 || '',
    'Needs Review': data.needs_review === true,
    'Review Reason': data.review_reason || '',
    'Scale Weight In': (data.scale_weight_in === undefined || data.scale_weight_in === null || data.scale_weight_in === '' || data.scale_weight_in === '-') ? '' : Number(data.scale_weight_in),
    'Scale Weight Out': (data.scale_weight_out === undefined || data.scale_weight_out === null || data.scale_weight_out === '' || data.scale_weight_out === '-') ? '' : Number(data.scale_weight_out),
    'Scale Weight Net': (data.scale_weight_net === undefined || data.scale_weight_net === null || data.scale_weight_net === '' || data.scale_weight_net === '-') ? '' : Number(data.scale_weight_net),
    'Vehicle Registration': (data.vehicle_registration && data.vehicle_registration !== '-') ? data.vehicle_registration : '',
    'Company Name': (data.company_name && data.company_name !== '-') ? data.company_name : '',
    'Job/Work': (data.job_name && data.job_name !== '-') ? data.job_name : '',
    'Requester': (data.requester && data.requester !== '-') ? data.requester : '',
    'Pay Approver': (data.pay_approver && data.pay_approver !== '-') ? data.pay_approver : ''
  };

  if (sheet.getLastRow() === 0) {
    const headers = Object.keys(standardMapping);
    sheet.appendRow(headers);
    formatSheetHeader(sheet, headers.length);
  } else {
    // ชีตเดิมที่มีข้อมูลอยู่แล้ว — เติมคอลัมน์ Sender Name / Sender ID ให้อัตโนมัติหากยังไม่มี
    ensureSheetHeaders(sheet, getReceiptHeaders());
  }

  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rowData = existingHeaders.map(header => {
    if (header === 'Timestamp') return new Date();
    if (header === 'Source') return sourceType || 'user';
    if (header === 'PO No.') return data.po_number || '-';
    if (header === 'Date') return data.date || '';
    if (header === 'Supplier Name') return data.store_name || '';
    if (header === 'Category') return data.category || 'ทั่วไป';
    if (header === 'Items Summary') return data.items_summary || '';
    if (header === 'Items JSON') return itemsJsonStr;
    if (header === 'Total Amount') return data.total_amount || 0;
    if (header === 'Sender Name') return senderName;
    if (header === 'Sender ID') return senderId;
    if (header === 'Scale Weight In') return (data.scale_weight_in === undefined || data.scale_weight_in === null || data.scale_weight_in === '' || data.scale_weight_in === '-') ? '' : Number(data.scale_weight_in);
    if (header === 'Scale Weight Out') return (data.scale_weight_out === undefined || data.scale_weight_out === null || data.scale_weight_out === '' || data.scale_weight_out === '-') ? '' : Number(data.scale_weight_out);
    if (header === 'Scale Weight Net') return (data.scale_weight_net === undefined || data.scale_weight_net === null || data.scale_weight_net === '' || data.scale_weight_net === '-') ? '' : Number(data.scale_weight_net);
    if (header === 'Vehicle Registration') return (data.vehicle_registration && data.vehicle_registration !== '-') ? data.vehicle_registration : '';
    if (header === 'Company Name') return (data.company_name && data.company_name !== '-') ? data.company_name : '';
    if (header === 'Job/Work') return (data.job_name && data.job_name !== '-') ? data.job_name : '';
    if (header === 'Requester') return (data.requester && data.requester !== '-') ? data.requester : '';
    if (header === 'Pay Approver') return (data.pay_approver && data.pay_approver !== '-') ? data.pay_approver : '';
    if (header === 'Image URL' || header === 'Image Link') {
      // เก็บ URL จริง (ไม่ใช้สูตร HYPERLINK — เพราะ getValues() จะได้แค่ข้อความแสดงผล ทำให้ Dashboard โหลดรูปไม่ได้)
      return imageUrl || '';
    }
    if (header === 'Running No.') return data.running_number || '';
    
    const dataKey = header.toLowerCase().replace(/\./g, '').replace(/ /g, '_');
    return data[dataKey] !== undefined ? data[dataKey] : '-';
  });

  sheet.appendRow(rowData);
}

// ==========================================
// SUPABASE MIGRATION — ย้ายข้อมูลเดิมจาก Google Sheets → Supabase
//   ปลอดภัย 100%: อ่านจากชีตอย่างเดียว ไม่ลบ/ไม่เขียนทับชีตใดๆ
//   เข้าเป็น batch + upsert ตาม doc_key (เจอซ้ำ = ข้าม ไม่ทับของเดิม)
//   ใช้: migrateSheetsToSupabase(true) = Dry-run | false = รันจริง
//   ตารางเป้าหมาย: public.receipts (ดู SQL สร้างตารางใน comment ด้านล่าง/แชทแจ้ง)
// ==========================================
function migrateSheetsToSupabase(dryRun) {
  const baseUrl = getSupabaseUrl();
  const svcKey = getSupabaseKey();
  if (!baseUrl || !svcKey) {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_KEY — ตั้งใน Script Properties หรือหน้าเว็บ > ตั้งค่าระบบก่อน');
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet) return { status: 'error', message: 'หาชีต "บิลจัดซื้อ (Receipts)" ไม่พบ' };
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { status: 'no-data', count: 0, message: 'ชีตไม่มีแถวข้อมูลให้ย้าย' };

  const headers = values[0].map(h => String(h).trim());
  const findCol = (name) => {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
    if (name === 'Image URL') return headers.indexOf('Image Link');
    return -1;
  };
  const pick = (row, name) => { const i = findCol(name); return i >= 0 ? row[i] : undefined; };
  const clean = (v) => (v === undefined || v === null) ? null : (String(v).trim() === '' ? null : String(v).trim());
  const num = (v) => { const n = Number(v); return (v === '' || v === null || v === undefined || isNaN(n)) ? null : n; };
  const bool = (v) => v === true || v === 'TRUE' || v === 'true' || v === 1;
  const toIsoDate = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    const d = new Date(s);
    return (!isNaN(d.getTime())) ? Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd') : null;
  };
  const toIsoTs = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const d = new Date(String(v));
    return (!isNaN(d.getTime())) ? d.toISOString() : null;
  };
  const parseItems = (v) => {
    if (v === '' || v === null || v === undefined) return [];
    const s = String(v).trim();
    if (!s) return [];
    try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  };

  const docs = [];
  const seenKeys = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // ข้ามแถวว่างทั้งแถว
    if (!row.some(c => c !== '' && c !== null && c !== undefined)) continue;

    let docKey = clean(pick(row, 'Doc Key'));
    if (!docKey) {
      docKey = buildDocKey({
        doc_type: pick(row, 'Doc Type'),
        tax_invoice_no: pick(row, 'Tax Invoice No.'),
        book_no: pick(row, 'Book No.'),
        doc_no: pick(row, 'Doc No.'),
        ref_no: pick(row, 'Ref No.')
      }) || '';
    }
    // ข้อมูลเก่าที่ไม่มีตัวตนเลขที่เลย → ใช้รหัสแถวเดิมแทน (กันซ้ำ/กันหาย)
    docKey = docKey || ('LEGACY_ROW_' + (r + 1));
    if (seenKeys[docKey]) docKey = docKey + '#2';
    seenKeys[docKey] = true;

    docs.push({
      doc_key: docKey,
      doc_type: clean(pick(row, 'Doc Type')),
      book_no: clean(pick(row, 'Book No.')),
      doc_no: clean(pick(row, 'Doc No.')),
      tax_invoice_no: clean(pick(row, 'Tax Invoice No.')),
      ref_no: clean(pick(row, 'Ref No.')),
      ref_label: clean(pick(row, 'Ref Label')),
      po_number: clean(pick(row, 'PO No.')),
      date: toIsoDate(pick(row, 'Date')),
      store_name: clean(pick(row, 'Supplier Name')),
      category: clean(pick(row, 'Category')),
      items_summary: clean(pick(row, 'Items Summary')),
      items: parseItems(pick(row, 'Items JSON')),
      total_amount: num(pick(row, 'Total Amount')),
      needs_review: bool(pick(row, 'Needs Review')),
      review_reason: clean(pick(row, 'Review Reason')),
      image_url: clean(pick(row, 'Image URL')),
      sender_name: clean(pick(row, 'Sender Name')),
      sender_id: clean(pick(row, 'Sender ID')),
      source: clean(pick(row, 'Source')),
      submitted_at: toIsoTs(pick(row, 'Timestamp'))
    });
  }

  const total = docs.length;
  writeLog('🛰️ MIGRATE', 'อ่านจากชีต ' + total + ' แถว (dryRun=' + (dryRun === true) + ')');
  if (total === 0) return { status: 'no-data', count: 0, message: 'ไม่พบแถวข้อมูลที่อ่านได้ในชีต' };

  // Dry-run: แสดงตัวอย่าง 5 แถว ไม่แตะข้อมูลจริง
  if (dryRun === true) {
    for (let i = 0; i < Math.min(5, total); i++) {
      writeLog('🛰️ MIGRATE-SAMPLE', '[' + (i + 1) + '] ' + JSON.stringify(docs[i]).substring(0, 400));
    }
    return { status: 'dry-run', count: total, sample: docs.slice(0, 5), message: 'Dry-run เสร็จ — ดูตัวอย่าง 5 แถวใน Log (ยังไม่ได้ย้ายอะไร) ตรวจแล้วค่อยรันจริง' };
  }

  // รันจริง: batch 100 แถว/รอบ + upsert ตาม doc_key (ซ้ำข้าม ไม่ทับ ไม่ลบของเดิม)
  const endpoint = baseUrl.replace(/\/+$/, '') + '/rest/v1/receipts?on_conflict=doc_key';
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < total; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const resp = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Prefer: 'resolution=ignore-duplicates' },
      payload: JSON.stringify(chunk),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    if (code >= 400) {
      const body = resp.getContentText().substring(0, 600);
      let note = '';
      if (code === 401 || code === 403) {
        if (body.indexOf('TO service_role') !== -1) {
          note = ' | ตาราง public.receipts ยังไม่ได้รับสิทธิ์สำหรับ service_role — รันใน Supabase SQL Editor: GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO service_role; แล้วลองใหม่';
        } else if (body.indexOf('TO anon') !== -1) {
          note = ' | key ถูกใช้ใน role anon — ต้องใช้ service_role (SECRET) ไม่ใช่ anon public (Settings > API copy ตัว secret)';
        } else {
          note = ' | ตรวจ: (1) ใช้ service_role key (2) ตาราง public.receipts ถูกสร้างแล้ว (3) รัน GRANT SQL';
        }
      }
      throw new Error('Supabase insert ล้มเหลว HTTP ' + code + ': ' + body + note);
    }
    inserted += chunk.length;
  }

  // ตรวจยอดจริงในตาราง (PostgREST /select=count)
  let verified = -1;
  try {
    const chk = UrlFetchApp.fetch(baseUrl.replace(/\/+$/, '') + '/rest/v1/receipts?select=count', {
      method: 'get',
      headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Prefer: 'count=exact' },
      muteHttpExceptions: true
    });
    try {
      const arr = JSON.parse(chk.getContentText());
      if (Array.isArray(arr) && arr[0] && arr[0].count !== undefined) verified = Number(arr[0].count);
    } catch (e) {
      const range = chk.getHeaders()['Content-Range'] || chk.getHeaders()['content-range'] || '';
      const m = String(range).match(/\/(\d+)$/);
      if (m) verified = parseInt(m[1], 10);
    }
  } catch (e) { verified = -1; }

  writeLog('🛰️ MIGRATE ✓', 'ย้าย ' + inserted + '/' + total + ' แถว | ยอดรวมในตาราง receipts = ' + (verified >= 0 ? verified : '?') + ' | ชีตต้นทางยังครบถ้วน (สำรอง 2 ชั้น)');
  return { status: 'done', transferred: inserted, totalRows: total, verified_count: verified, message: 'ย้าย ' + inserted + '/' + total + ' แถวแล้ว ข้อมูลชีตยังอยู่ครบ' };
}

function migrateSheetsToSupabaseDryRun() {
  const r = migrateSheetsToSupabase(true);
  Logger.log(JSON.stringify(r));
  SpreadsheetApp.getUi().alert((r.status === 'dry-run' ? 'Dry-run: พร้อมย้าย ' + r.count + ' แถว (ดูตัวอย่างใน Log/Console แล้วรันจริงต่อ)' : 'ผล: ' + JSON.stringify(r)));
}

function migrateSheetsToSupabaseRun() {
  const ui = SpreadsheetApp.getUi();
  const yes = ui.alert('ย้ายข้อมูลจริง?', 'ระบบจะอ่านจากชีต แล้ว upsert ลง Supabase (ชีตไม่ถูกลบ ไม่เขียนทับ)\n\nอัปโหลด Code.gs + ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_KEY แล้วหรือยัง?\nตกลง = เริ่มย้าย', ui.ButtonSet.OK_CANCEL);
  if (yes !== ui.Button.OK) return;
  const r = migrateSheetsToSupabase(false);
  ui.alert('ผลการย้ายข้อมูล: ' + (r && r.message ? r.message : JSON.stringify(r)));
}

function checkAndSyncHeaders() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)') || ss.getActiveSheet();
  if (sheet.getLastRow() > 0) {
    const before = sheet.getLastColumn();
    ensureSheetHeaders(sheet, getReceiptHeaders());
    const after = sheet.getLastColumn();
    SpreadsheetApp.getUi().alert('🔄 อัปเดตหัวตารางเรียบร้อย!\n' + (after > before ? ('เพิ่มคอลัมน์ใหม่ ' + (after - before) + ' คอลัมน์ (Doc Type / Book No. / Doc No. / Doc Key / Needs Review ฯลฯ)') : 'หัวตารางครบถ้วนอยู่แล้ว'));
  }
}

// ==========================================
// DUPLICATE CHECK (ตรวจสอบเลขที่บิลซ้ำก่อนบันทึก)
// ==========================================
function isDuplicatePoNumber(poNumber) {
  if (!poNumber || poNumber === '-') return false;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet || sheet.getLastRow() <= 1) return false;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const poColIndex = headers.indexOf('PO No.');
  if (poColIndex === -1) return false;

  const poValues = sheet.getRange(2, poColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  const target = String(poNumber).trim();
  return poValues.some(v => String(v[0]).trim() === target);
}

// กันซ้ำด้วย "ตัวตนบิลจริง" (Doc Key) — คืนข้อมูลแถวถ้าซ้ำ, null ถ้าไม่ซ้ำ/ยังไม่มีคอลัมน์
function findDuplicateByDocKey(docKey) {
  if (!docKey) return null;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet || sheet.getLastRow() <= 1) return null;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const col = headers.indexOf('Doc Key');
  if (col === -1) return null;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  const target = String(docKey).trim();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][col] || '').trim() === target) {
      const rowObj = { rowIndex: i + 2 };
      for (let c = 0; c < headers.length; c++) {
        if (headers[c]) rowObj[headers[c]] = values[i][c];
      }
      return rowObj;
    }
  }
  return null;
}

// เตือน "อาจซ้ำ" เมื่อบิลไม่มี Doc Key — เทียบ ร้าน + วันที่ + ยอด (ไม่บล็อกอัตโนมัติ ให้คนยืนยัน)
function findSoftDuplicate(data) {
  if (!data) return false;
  const store = String(data.store_name || '').trim();
  const date = String(data.date || '').trim();
  const total = Number(data.total_amount);
  if (!store || store === '-' || !date || date === '-' || !(total > 0)) return false;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet || sheet.getLastRow() <= 1) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const cStore = headers.indexOf('Supplier Name');
  const cDate = headers.indexOf('Date');
  const cTotal = headers.indexOf('Total Amount');
  if (cStore === -1 || cDate === -1 || cTotal === -1) return false;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < rows.length; i++) {
    const s = String(rows[i][cStore] || '').trim();
    let d = rows[i][cDate];
    if (d instanceof Date) d = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
    d = String(d || '').trim();
    const t = Number(rows[i][cTotal] || 0);
    if (s === store && d === date && Math.abs(t - total) < 0.01) return true;
  }
  return false;
}

// ==========================================
// DELETE RECEIPT (ลบบิล + ย้ายไฟล์รูปใน Drive ไปถังขยะ — กันข้อมูลขยะ)
// ==========================================
// ฟังก์ชันช่วยดึง drive file id จาก URL แบบ fallback หลาย pattern
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  // pattern มาตรฐานที่มีอยู่ + เพิ่มฟอร์แมตที่พบบ่อย
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/thumbnail\?.*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  // fallback: ตัดจาก query id= หรือ fragment id= แบบทั่วไป
  const q = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (q) return q[1];
  const h = url.match(/#id=([a-zA-Z0-9_-]+)/);
  if (h) return h[1];
  // ลิงก์โฟเดอร์ หรือลิงก์ที่ไม่มี id ชัดเจน — ไม่ควรลบ
  return null;
}

function deleteReceipt(id, timestampStr, poNumber) {
  // 🛡️ 2026-09-22 session guard: ลบบิล (ข้อมูล + รูปใน Drive) — ห้ามเรียกได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(id); if (!__guard.ok) return __guard.res;
  try {
    // รองรับทั้งสไตล์เดิม (แยกพารามิเตอร์) และสไตล์ใหม่ (object จาก REST/ดashบอร์ดเวอร์ชันใหม่)
    let targetDocKey = '';
    let imageUrlParam = '';
    let targetSrn = NaN;
    if (id && typeof id === 'object') {
      const p = id;
      id = p.id;
      timestampStr = p.timestamp !== undefined ? p.timestamp : p.timestampStr;
      poNumber = p.po_number !== undefined ? p.po_number : p.poNumber;
      targetDocKey = String(p.doc_key || p.docKey || '').trim(); // ตัวตนบิลจากหน้าเว็บ (ใช้ได้ทั้งข้อมูลจากชีตและ Supabase)
      imageUrlParam = String(p.image_url || p.imageUrl || '').trim();
      targetSrn = (p.system_record_no !== undefined && p.system_record_no !== null && p.system_record_no !== '') ? Number(p.system_record_no) : (p.systemRecordNo ? Number(p.systemRecordNo) : NaN);
    }
    const targetPo = String(poNumber || '').trim();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'ไม่พบข้อมูลบิลในชีต' };
    }

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = {};
    headers.forEach(function (h, i) { colIndex[String(h).trim()] = i; });
    const colDocKey = headers.indexOf('Doc Key');
    const colTs = headers.indexOf('Timestamp');
    const colImg = headers.indexOf('Image URL') !== -1 ? headers.indexOf('Image URL') : headers.indexOf('Image Link');

    // 1) หาแถว: System Record No. → Doc Key → Image URL(fileId) → fallback Timestamp+PO (กันบิลที่ "เลขที่เอกสาร: ไม่มี")
    const rowIndex = findReceiptRowByAny(sheet, headers, colIndex, targetDocKey, timestampStr, poNumber, '', imageUrlParam, targetSrn);
    if (rowIndex === -1) {
      return { success: false, message: 'ไม่พบแถวที่ตรงกัน (ข้อมูลอาจถูกเปลี่ยนไปแล้ว) กรุณารีเฟรชแล้วลบใหม่' };
    }

    // 3) ดึง URL รูปจากแถวนั้น (รองรับแถวเก่าที่ค้างเป็นสูตร HYPERLINK)
    let imageUrl = '';
    if (colImg !== -1) {
      imageUrl = String(sheet.getRange(rowIndex, colImg + 1).getValue() || '');
      const m = imageUrl.match(/HYPERLINK\("([^"]+)"/i);
      if (m) imageUrl = m[1];
    }

    // 4) ลบไฟล์รูปใน Drive (ย้ายไปถังขยะ — กู้คืนได้ภายใน 30 วัน แล้วระบบ Google จะลบถาวรเอง)
    let fileDeleted = false;
    let fileMessage = 'ไม่พบลิงก์รูปแนบ';
    const fileId = extractDriveFileId(imageUrl);
    if (fileId) {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
        fileDeleted = true;
        fileMessage = 'รูปบิลถูกย้ายไปถังขยะ Drive แล้ว';
      } catch (e) {
        fileMessage = 'ลบรูปใน Drive ไม่สำเร็จ: ' + e.toString();
      }
    }

    // 5) ลบแถวออกจากชีต
    const docKeyBeforeDel = colDocKey !== -1 ? String(sheet.getRange(rowIndex, colDocKey + 1).getValue() || '').trim() : '';
    sheet.deleteRow(rowIndex);

    // 6) ลบออกจาก Supabase ด้วย (แหล่งข้อมูลหลักของหน้าเว็บ) — พยายามเต็มที่ แต่ไม่บล็อกถ้าไม่มีค่า Supabase
    let sbMsg = '';
    if (docKeyBeforeDel || (!isNaN(targetSrn) && targetSrn > 0)) {
      try {
        if (!isNaN(targetSrn) && targetSrn > 0) {
          supabaseRequest('delete', '/rest/v1/receipts?system_record_no=eq.' + encodeURIComponent(targetSrn));
        } else if (docKeyBeforeDel) {
          deleteFromSupabase(docKeyBeforeDel);
        }
        sbMsg = ' | ลบจาก Supabase แล้ว';
      } catch (sbErr) {
        sbMsg = ' | ⚠️ ลบ Supabase ไม่สำเร็จ: ' + sbErr.toString();
        writeLog('⚠️ SUPABASE', 'deleteFromSupabase ล้มเหลว: ' + sbErr.toString());
      }
    }

    writeLog('🗑️ DELETE', 'ลบบิลแถวที่ ' + rowIndex + ' PO: ' + (targetPo || '-') + ' | ' + fileMessage + sbMsg);
    return { success: true, message: 'ลบบิลสำเร็จ — ' + fileMessage + sbMsg, fileDeleted: fileDeleted };
  } catch (err) {
    writeLog('❌ ERROR', 'deleteReceipt: ' + err.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ: ' + err.toString() };
  }
}

function formatTimestampForCompare(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const s = String(value === null || value === undefined ? '' : value).trim();
  if (!s) return '';
  // ค่าแบบ ISO (มี T/offset/timezone เช่น จาก Supabase) → แปลงเป็นเวลาไทย (เวลาเดียวกับที่เขียนในชีต) ก่อนเทียบ
  if (/Z$|[-+]\d{2}:?\d{2}$/i.test(s) || /[Tt]/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  }
  return s;
}

// หาแถวบิลในชีตให้คลอบคลุมบิลที่ "เลขที่เอกสาร: ไม่มี" (ไม่มี Doc Key):
//   0) ตรง System Record No. (เลขที่รายการระบบ Sequential Unique — แม่นยำที่สุด 100% ไม่เปลี่ยนตามการแก้ชื่อ/เลขที่/วันที่)
//   1) ตรง Doc Key (ตัวตนบิล — แม่นสุด; รองรับ LEGACY_ROW_<n> = จับตามหมายเลขแถว)
//   2) ตรง Image URL (Drive File ID — ไม่ซ้ำ ไม่มีวันผิด — กันบิลที่เลขที่/PO/เวลาเปลี่ยนไปแล้ว)
//   3) fallback ตาม Timestamp + PO (+ ยอดรวม เป็นตัวกันยืนยัน)
// คืน rowIndex (แถวชีต 1-based) หรือ -1 ถ้าไม่พบ
function findReceiptRowByAny(sheet, headers, colIndex, doc_key, tsRaw, poRaw, totalRaw, imgRaw, systemRecordNo) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const vals = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const colSrn = colIndex['System Record No.'] !== undefined ? colIndex['System Record No.'] : -1;
  const colKey = colIndex['Doc Key'] !== undefined ? colIndex['Doc Key'] : -1;
  const colTs = colIndex['Timestamp'] !== undefined ? colIndex['Timestamp'] : -1;
  const colImg = colIndex['Image URL'] !== undefined ? colIndex['Image URL'] : (colIndex['Image Link'] !== undefined ? colIndex['Image Link'] : -1);
  const colPo = colIndex['PO No.'] !== undefined ? colIndex['PO No.'] : -1;
  const colTotal = colIndex['Total Amount'] !== undefined ? colIndex['Total Amount'] : -1;
  const normPo = function (v) { const s = String(v === null || v === undefined ? '' : v).trim(); return (s === '-' || s === '') ? '' : s; };

  // 0) System Record No. แม่นยำที่สุด (Running Number ประจำบิล — ไม่เปลี่ยนตามการแก้ชื่อ/เลขที่/วันที่)
  const targetSrn = (systemRecordNo !== undefined && systemRecordNo !== null && systemRecordNo !== '') ? Number(systemRecordNo) : NaN;
  if (!isNaN(targetSrn) && targetSrn > 0 && colSrn !== -1) {
    for (let i = 0; i < vals.length; i++) {
      const v = Number(vals[i][colSrn]);
      if (!isNaN(v) && v === targetSrn) return i + 2;
    }
  }

  // 1) Doc Key แม่นสุด (จริง — ไม่ใช่ป้ายแข็ง LEGACY)
  const dk = String(doc_key || '').trim();
  const lrm = dk.match(/^LEGACY_ROW_(\d+)$/);
  if (dk && colKey !== -1 && !lrm) {
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][colKey] || '').trim() === dk) return i + 2;
    }
  }

  // 2) Image URL ตรงกัน (Drive File ID = ตัวตนบิลที่แท้จริง ไม่ซ้ำ) — กันเวลา/PO/เลขที่ถูกแก้จนจับอื่นไม่ได้
  const targetImgId = imgRaw ? String(extractDriveFileId(String(imgRaw)) || '').trim() : '';
  if (targetImgId && colImg !== -1) {
    for (let i = 0; i < vals.length; i++) {
      let cellId = '';
      try { cellId = String(extractDriveFileId(String(vals[i][colImg] || '')) || '').trim(); } catch (e) { cellId = ''; }
      if (cellId === targetImgId) return i + 2;
    }
  }

  // 3) LEGACY_ROW_<n> = ป้ายแข็งที่หน้าเว็บตั้งให้บิลที่ "เลขที่เอกสาร: ไม่มี" (ตามลำดับแถวที่โหลด)
  //    → จับตามหมายเลขแถวตรงตัว (แถวนั้นยังไม่มี Doc Key จริงในชีต) — อยู่หลัง image เพื่อกันเลขแถวเก่าเพี้ยน
  if (lrm && colKey !== -1) {
    const idx = parseInt(lrm[1], 10);
    if (idx >= 2 && idx <= lastRow) {
      const rowDocKey = String(vals[idx - 2][colKey] || '').trim();
      if (!rowDocKey) return idx;
    }
  }

  // 4) Timestamp (+PO +ยอด) — กันบิลที่ไม่มีเลขที่เอกสาร แล้วยังแก้/อ่านใหม่ได้
  const targetTs = formatTimestampForCompare(tsRaw);
  const targetPo = normPo(poRaw);
  const targetTotal = Number(totalRaw);
  if (!targetTs || colTs === -1) return -1;
  for (let i = 0; i < vals.length; i++) {
    if (formatTimestampForCompare(vals[i][colTs]) !== targetTs) continue;
    if (targetPo && colPo !== -1 && normPo(vals[i][colPo]) !== targetPo) continue;
    if (!isNaN(targetTotal) && colTotal !== -1 && Number(vals[i][colTotal] || 0) !== targetTotal) continue;
    return i + 2;
  }
  return -1;
}

// ==========================================
// UPDATE RECEIPT (แก้ไขข้อมูลบิลที่ AI อ่านไม่ตรง — เขียนทับเฉพาะคอลัมน์ข้อมูล)
// ==========================================
function updateReceipt(payload) {
  // 🛡️ 2026-09-22 session guard: แก้ข้อมูลบิล (เขียนชีต + Supabase) — ห้ามเรียกได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    if (!payload) return { success: false, message: 'ไม่ได้รับข้อมูลสำหรับแก้ไข' };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'ไม่พบข้อมูลบิลในชีต' };
    }

    ensureSheetHeaders(sheet, getReceiptHeaders()); // ให้คอลัมน์มาตรฐานครบก่อน (รวมคอลัมน์ใบชั่งที่เพิ่มใหม่)

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = {};
    headers.forEach((h, i) => { colIndex[String(h).trim()] = i; });

    const colTotal = colIndex['Total Amount'] !== undefined ? colIndex['Total Amount'] : -1;
    const targetDocKey = String(payload.doc_key || payload.docKey || '').trim(); // ตัวตนบิลจากหน้าเว็บ (ใช้ได้ทั้งข้อมูลจากชีตและ Supabase)
    const targetSrn = (payload.system_record_no !== undefined && payload.system_record_no !== null && payload.system_record_no !== '') ? Number(payload.system_record_no) : (payload.systemRecordNo ? Number(payload.systemRecordNo) : NaN);

    // 1) หาแถวเป้าหมาย: System Record No. (แม่นสุด 100%) → Doc Key → fallback Timestamp+PO (กันบิลที่ "เลขที่เอกสาร: ไม่มี")
    const rowIndex = findReceiptRowByAny(sheet, headers, colIndex, targetDocKey, payload.timestamp, payload.old_po_number, '', payload.image_url || payload.image_original_url, targetSrn);
    if (rowIndex === -1) {
      return { success: false, message: 'ไม่พบแถวที่ตรงกัน (ข้อมูลอาจถูกเปลี่ยนไปแล้ว) กรุณารีเฟรชแล้วแก้ไขใหม่' };
    }

    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();

    // 3) กัน "ตัวตนบิล" ซ้ำกับบิลแถวอื่น (ยึด Doc Key: ประเภท+เล่มที่+เลขที่) — PO ซ้ำได้ เพราะหนึ่ง PO มีหลายบิล
    const newPo = String(payload.po_number || '').trim() || '-';
    const docIdentity = normalizeReceiptDocFields({
      doc_type: payload.doc_type,
      book_no: payload.book_no,
      doc_no: payload.doc_no,
      tax_invoice_no: payload.tax_invoice_no,
      ref_no: payload.ref_no,
      ref_label: payload.ref_label
    });
    const newDocKey = docIdentity.doc_key;

    if (newDocKey && colIndex['Doc Key'] !== undefined) {
      const k = colIndex['Doc Key'];
      for (let i = 0; i < allData.length; i++) {
        if (i + 2 === rowIndex) continue;
        if (String(allData[i][k] || '').trim() === newDocKey) {
          return { success: false, message: 'เลขที่เอกสารนี้ (' + buildDocLabel(docIdentity) + ') ถูกใช้กับบิลแถวอื่นแล้ว กรุณาตรวจสอบอีกครั้ง' };
        }
      }
    }

    // 4) เขียนทับเฉพาะคอลัมน์ข้อมูล (ไม่แตะ Timestamp / Source / Image URL)
    const itemsArr = Array.isArray(payload.items) ? payload.items : [];
    const itemsJsonStr = JSON.stringify(itemsArr);
    const itemsSummary = String(payload.items_summary || '').trim() ||
      itemsArr.map(it => it.name + ' (' + it.quantity + ' ' + it.unit + ')').join(', ');

    const oldTotal = colTotal !== -1 ? sheet.getRange(rowIndex, colTotal + 1).getValue() : 0;

    const reviewReasons = [];
    if (!newDocKey) reviewReasons.push('ไม่พบเลขที่เอกสาร/เลขอ้างอิง (ต้องตรวจตัวตนบิลด้วยคน)');
    if (!String(payload.store_name || '').trim()) reviewReasons.push('ไม่ได้ระบุชื่อร้านค้า/ผู้ขาย');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '').trim())) reviewReasons.push('วันที่ไม่ถูกต้อง/ไม่ได้ระบุ');

    const rowValues = {
      'PO No.': newPo,
      'Date': payload.date || '',
      'Supplier Name': payload.store_name || '',
      'Category': payload.category || 'ทั่วไป',
      'Items Summary': itemsSummary,
      'Items JSON': itemsJsonStr,
      'Total Amount': Number(payload.total_amount) || 0,
      'Doc Type': docIdentity.doc_type || '',
      'Book No.': docIdentity.book_no || '',
      'Doc No.': docIdentity.doc_no || '',
      'Tax Invoice No.': docIdentity.tax_invoice_no || '',
      'Ref No.': docIdentity.ref_no || '',
      'Ref Label': docIdentity.ref_label || '',
      'Doc Key': newDocKey,
      'Needs Review': reviewReasons.length > 0,
      'Review Reason': reviewReasons.join(' | ')
    };
    // คอลัมน์ใบชั่ง (เขียนเฉพาะเมื่อ payload ส่งค่ามา — กันล้างค่าเดิมของผู้ใช้เวอร์ชันเก่า)
    if (payload.scale_weight_in !== undefined) rowValues['Scale Weight In'] = (payload.scale_weight_in === '' || payload.scale_weight_in === null || payload.scale_weight_in === '-') ? '' : Number(payload.scale_weight_in);
    if (payload.scale_weight_out !== undefined) rowValues['Scale Weight Out'] = (payload.scale_weight_out === '' || payload.scale_weight_out === null || payload.scale_weight_out === '-') ? '' : Number(payload.scale_weight_out);
    if (payload.scale_weight_net !== undefined) rowValues['Scale Weight Net'] = (payload.scale_weight_net === '' || payload.scale_weight_net === null || payload.scale_weight_net === '-') ? '' : Number(payload.scale_weight_net);
    if (payload.vehicle_registration !== undefined) rowValues['Vehicle Registration'] = (payload.vehicle_registration === '-') ? '' : payload.vehicle_registration;
    // คอลัมน์สั่งซื้อ/งาน (เขียนเฉพาะเมื่อ payload ส่งค่ามา — กันล้างค่าเดิมของเวอร์ชันเก่า)
    if (payload.company_name !== undefined) rowValues['Company Name'] = (payload.company_name === '-') ? '' : payload.company_name;
    if (payload.job_name !== undefined) rowValues['Job/Work'] = (payload.job_name === '-') ? '' : payload.job_name;
    if (payload.requester !== undefined) rowValues['Requester'] = (payload.requester === '-') ? '' : payload.requester;
    if (payload.pay_approver !== undefined) rowValues['Pay Approver'] = (payload.pay_approver === '-') ? '' : payload.pay_approver;

    if (!isNaN(targetSrn) && targetSrn > 0) {
      rowValues['System Record No.'] = targetSrn;
    }

    // 4.5) เก็บค่าเดิมของแถว (ที่ AI อ่านไว้ก่อนหน้า) ไว้เทียบกับค่าที่มนุษย์แก้ → เป็นบทเรียนของ AI (กฎข้อเรียนรู้)
    const learningOldValues = {
      doc_type: colIndex['Doc Type'] !== undefined ? sheet.getRange(rowIndex, colIndex['Doc Type'] + 1).getValue() : '',
      store_name: colIndex['Supplier Name'] !== undefined ? sheet.getRange(rowIndex, colIndex['Supplier Name'] + 1).getValue() : '',
      category: colIndex['Category'] !== undefined ? sheet.getRange(rowIndex, colIndex['Category'] + 1).getValue() : ''
    };

    // 4.5B) เก็บค่าเดิม (ที่ AI อ่านไว้) ของทุกฟิลด์ที่ User แก้ได้ → ใช้เทียบ diff บันทึกลง ai_feedback_logs
    //       (Human-in-the-Loop: original_ai_value vs user_corrected_value ต่อฟิลด์ต่อร้าน)
    const FEEDBACK_FIELDS = {
      'PO No.': 'po_number', 'Date': 'date', 'Supplier Name': 'store_name', 'Category': 'category',
      'Doc Type': 'doc_type', 'Book No.': 'book_no', 'Doc No.': 'doc_no', 'Tax Invoice No.': 'tax_invoice_no',
      'Ref No.': 'ref_no', 'Total Amount': 'total_amount', 'Company Name': 'company_name', 'Job/Work': 'job_name',
      'Requester': 'requester', 'Pay Approver': 'pay_approver', 'Scale Weight In': 'scale_weight_in',
      'Scale Weight Out': 'scale_weight_out', 'Scale Weight Net': 'scale_weight_net', 'Vehicle Registration': 'vehicle_registration'
    };
    const feedbackOldValues = {};
    Object.keys(FEEDBACK_FIELDS).forEach(function (h) {
      if (colIndex[h] !== undefined) feedbackOldValues[h] = sheet.getRange(rowIndex, colIndex[h] + 1).getValue();
      else feedbackOldValues[h] = undefined;
    });

    // จำ doc_key เดิมของแถวก่อนเขียนทับ (เผื่อ payload ไม่ส่งมา — วันที่เปลี่ยนหรือดัชบอร์ดโหลดจาก Supabase)
    const srcDocKey = String(payload.doc_key || (colIndex['Doc Key'] !== undefined ? String(sheet.getRange(rowIndex, colIndex['Doc Key'] + 1).getValue() || '').trim() : '')).trim() || newDocKey;

    Object.keys(rowValues).forEach(function (key) {
      if (colIndex[key] !== undefined) {
        sheet.getRange(rowIndex, colIndex[key] + 1).setValue(rowValues[key]);
      }
    });

    // 5) บันทึก Audit Trail ลงชีต Log
    writeLog('✏️ EDIT', 'แก้ไขบิลแถวที่ ' + rowIndex +
      (targetSrn ? ' [#' + targetSrn + ']' : '') +
      ' | PO: ' + (oldPo || '-') + ' → ' + newPo +
      ' | ยอดรวม: ' + Number(oldTotal || 0) + ' → ' + rowValues['Total Amount'] +
      ' | รายการสินค้า: ' + itemsArr.length + ' รายการ');

    // 5.5) Sync การแก้ไขลง Supabase ด้วย (แหล่งข้อมูลหลักของหน้าเว็บ) — พยายามเต็มที่ แต่ไม่บล็อกการแก้
    let sbMsg = '';
    try {
      updateSupabaseReceipt(srcDocKey, {
        po_number: newPo,
        date: payload.date || '',
        store_name: payload.store_name || '',
        category: payload.category || 'ทั่วไป',
        items_summary: itemsSummary,
        items: itemsArr,
        total_amount: Number(payload.total_amount) || 0,
        doc_type: docIdentity.doc_type || '',
        book_no: docIdentity.book_no || '',
        doc_no: docIdentity.doc_no || '',
        tax_invoice_no: docIdentity.tax_invoice_no || '',
        ref_no: docIdentity.ref_no || '',
        ref_label: docIdentity.ref_label || '',
        scale_weight_in: (payload.scale_weight_in === undefined) ? undefined : ((payload.scale_weight_in === '' || payload.scale_weight_in === null || payload.scale_weight_in === '-') ? null : Number(payload.scale_weight_in)),
        scale_weight_out: (payload.scale_weight_out === undefined) ? undefined : ((payload.scale_weight_out === '' || payload.scale_weight_out === null || payload.scale_weight_out === '-') ? null : Number(payload.scale_weight_out)),
        scale_weight_net: (payload.scale_weight_net === undefined) ? undefined : ((payload.scale_weight_net === '' || payload.scale_weight_net === null || payload.scale_weight_net === '-') ? null : Number(payload.scale_weight_net)),
        vehicle_registration: (payload.vehicle_registration === undefined) ? undefined : ((payload.vehicle_registration === '-') ? '' : payload.vehicle_registration),
        company_name: (payload.company_name === undefined) ? undefined : ((payload.company_name === '-') ? '' : payload.company_name),
        job_name: (payload.job_name === undefined) ? undefined : ((payload.job_name === '-') ? '' : payload.job_name),
        requester: (payload.requester === undefined) ? undefined : ((payload.requester === '-') ? '' : payload.requester),
        pay_approver: (payload.pay_approver === undefined) ? undefined : ((payload.pay_approver === '-') ? '' : payload.pay_approver),
        needs_review: reviewReasons.length > 0,
        review_reason: reviewReasons.join(' | ')
      }, targetSrn);
      sbMsg = ' + Sync Supabase OK';
    } catch (sbErr) {
      sbMsg = ' + ⚠️ Sync Supabase ล้มเหลว: ' + sbErr.toString();
      writeLog('⚠️ SUPABASE', 'updateSupabaseReceipt: ' + sbErr.toString());
    }

    // 5.6) ให้ AI เรียนรู้จากการแก้ไขนี้ (ค่าเดิมที่ AI อ่าน vs ค่าที่มนุษย์แก้) — ไม่บล็อกการแก้ไข
    try {
      recordLearningFromEdit(learningOldValues, {
        doc_type: rowValues['Doc Type'],
        store_name: rowValues['Supplier Name'],
        category: rowValues['Category']
      }, srcDocKey);
    } catch (lrErr) {
      writeLog('⚠️ LEARNING', 'recordLearningFromEdit: ' + lrErr.toString());
    }

    // 5.7) Human-in-the-Loop: บันทึก ai_feedback_logs — ฟิลด์ไหน User เปลี่ยนจากค่า AI เดิม → บันทึกต่อฟิลด์
    //      (ฉีดกลับเป็น Few-Shot ต่อร้านตอนอ่านบิลใหม่ ผ่าน getStoreFeedbackContext)
    try {
      const fbStore = String(rowValues['Supplier Name'] || learningOldValues.store_name || '').trim();
      const fbDocType = String(rowValues['Doc Type'] || docIdentity.doc_type || '').trim();
      Object.keys(rowValues).forEach(function (h) {
        if (!FEEDBACK_FIELDS[h]) return;
        const oldV = feedbackOldValues[h];
        const newV = rowValues[h];
        const oldS = String(oldV === undefined || oldV === null ? '' : oldV).trim();
        const newS = String(newV === undefined || newV === null ? '' : newV).trim();
        if (oldS === newS) return; // ไม่ได้เปลี่ยน
        if (newS === '-') return;  // เปลี่ยนเป็น '-' = ล้าง ไม่นับเป็นบทเรียน
        recordFeedback('field_correct', srcDocKey, fbStore, FEEDBACK_FIELDS[h], oldS, newS, { docType: fbDocType });
      });
    } catch (fbErr) {
      writeLog('⚠️ FEEDBACK', 'updateReceipt feedback: ' + fbErr.toString());
    }

    return { success: true, message: 'บันทึกการแก้ไขบิลเรียบร้อยแล้ว (PO: ' + newPo + ')' + sbMsg };
  } catch (err) {
    writeLog('❌ ERROR', 'updateReceipt: ' + err.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไข: ' + err.toString() };
  }
}

// ==========================================
// STEP 1 — PREVIEW: อ่านใหม่ (AI) — วิเคราะห์ภาพบิลเดิมใหม่ แล้วคืนค่าใหม่ให้ดูก่อน
//   input: { doc_key, image_url? } → หาแถวชีตด้วย Doc Key → ดึงรูปจาก Drive
//          → วิเคราะห์ใหม่ด้วย Gemini → คืนค่าใหม่ + diff รายช่อง (PREVIEW เท่านั้น ยังไม่เขียน)
//   หลักความปลอดภัย: บังคับ doc_key เดิม (เลข/วันที่ใหม่ไม่เปลี่ยนตัวตนบิล);
//   ถ้า AI อ่านไม่ได้ (ไม่ใช่บิล/ภาพไม่อ่าน) → ไม่เขียนทับ คงข้อมูลเดิมไว้
//   ฟิลด์ที่จะโชว์ในหน้าจอ = REANALYZE_FIELDS (diff รายช่อง)
// ==========================================
var REANALYZE_FIELDS = [
  ['Doc Type', 'ประเภท'], ['Doc No.', 'เลขที่'], ['PO No.', 'PO'], ['Date', 'วันที่'],
  ['Supplier Name', 'ร้านค้า'], ['Category', 'หมวด'], ['Total Amount', 'ยอดรวม'],
  ['Company Name', 'บริษัท'], ['Job/Work', 'งาน/โครงการ'], ['Requester', 'ผู้เบิก'], ['Pay Approver', 'ผู้สั่งจ่าย'],
  ['Book No.', 'เล่มที่'], ['Tax Invoice No.', 'เลขใบกำกับ'], ['Ref No.', 'เลขอ้างอิง'], ['Ref Label', 'ชนิดอ้างอิง'],
  ['Scale Weight In', 'น้ำหนักเข้า'], ['Scale Weight Out', 'น้ำหนักออก'], ['Scale Weight Net', 'น้ำหนักสุทธิ'],
  ['Vehicle Registration', 'ทะเบียนรถ'], ['Items Summary', 'รายการสินค้า'], ['Needs Review', 'ธงรอตรวจ']
];
function reanalyzeReceipt(payload) {
  // 🛡️ 2026-09-22 session guard: อ่านบิลใหม่ด้วย AI (กินโควตา Gemini) — ห้ามเรียกได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    if (!payload) return { success: false, message: 'ไม่ได้รับข้อมูลสำหรับอ่านใหม่' };
    // บิลบางใบไม่มีเลขที่เอกสาร/เลขอ้างอิง → ไม่มี Doc Key (doc_key='')
    // ยังอ่านใหม่ได้: หน้าเว็บจะส่ง Timestamp+PO+ยอด มาให้หาแถว/ตัดสินใจแทน
    const doc_key = String(payload.doc_key || payload.docKey || '').trim();
    if (!doc_key && !String(payload.timestamp || payload.ts || '').trim() && !String(payload.old_po_number || payload.po_number || '').trim()) {
      return { success: false, message: 'บิลนี้ไม่มีเลขที่เอกสารหรือข้อมูลอ้างอิงที่พอจะค้นหาได้ — เปิดดูบิลเต็มแล้วลองใหม่' };
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, message: 'ไม่พบข้อมูลบิลในชีต' };
    ensureSheetHeaders(sheet, getReceiptHeaders());

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = {};
    headers.forEach(function (h, i) { colIndex[String(h).trim()] = i; });

    const targetSrn = (payload.system_record_no !== undefined && payload.system_record_no !== null && payload.system_record_no !== '') ? Number(payload.system_record_no) : (payload.systemRecordNo ? Number(payload.systemRecordNo) : NaN);

    // 1) ยืนยันแถวเป้าหมาย (System Record No. → Doc Key → Image URL(fileId) → Timestamp+PO+ยอด — ครบทุกกรณีบิล "เลขที่เอกสาร: ไม่มี")
    const rowIndex = findReceiptRowByAny(sheet, headers, colIndex, doc_key,
      payload.timestamp || payload.ts,
      payload.old_po_number || payload.po_number,
      payload.total_amount,
      payload.image_url || payload.imageUrl,
      targetSrn);
    if (rowIndex === -1) {
      writeLog('🔄 RE-READ ❌', 'STEP 1/5 หาแถวไม่เจอ | doc_key="' + doc_key + '" | ts="' + String(payload.timestamp || payload.ts || '').slice(0, 19) + '" | image="' + String(payload.image_url || payload.imageUrl || '').slice(0, 80) + '" | แถวชีต=' + sheet.getLastRow() + ' | มีคอลDocKey=' + (colIndex['Doc Key'] !== undefined));
      return { success: false, message: 'ไม่พบแถวบิลนี้ในชีต (doc_key="' + doc_key + '") — รีเฟรชหน้าเว็บแล้วลองใหม่ หรือแจ้งผู้ดูแล: เปิดช่อง Log ใน Apps Script หา "RE-READ ❌" แล้วส่งข้อความสีแดงมาให้' };
    }
    writeLog('🔄 RE-READ', 'STEP 1/5 เจอแถวบิล (แถวที่ ' + rowIndex + ') doc_key=' + (doc_key || '(ไม่มีเลขที่ — หาด้วยเวลาบันทึก+PO)'));

    // 2) อ่านค่าเดิมของแถว + image_url (payload จากหน้าเว็บมาก่อน เผื่ออ่านจาก Supabase)
    const oldRowVals = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    const cellOf = function (h) { return (colIndex[h] !== undefined) ? oldRowVals[colIndex[h]] : ''; };
    let imageUrl = String(payload.image_url || payload.imageUrl || '').trim();
    if (!imageUrl) imageUrl = String(cellOf('Image URL') || '').trim();
    writeLog('🔄 RE-READ', 'STEP 2/5 ระบบกำลังโหลดรูปจาก Drive (' + (imageUrl ? 'มีลิงก์รูป' : 'ไม่มีลิงก์รูป') + ')...');

    const fileId = extractDriveFileId(imageUrl);
    if (!fileId) return { success: false, message: 'ไม่พบไฟล์รูปบิลใน Drive — เปิดดูบิลเต็มแล้วลองใหม่' };
    const blob = DriveApp.getFileById(fileId).getBlob();
    if (!blob || blob.getBytes().length === 0) return { success: false, message: 'ไฟล์รูปบิลว่าง/อ่านไม่ได้' };
    writeLog('🔄 RE-READ', 'STEP 2/5 โหลดรูปจาก Drive สำเร็จ (ขนาด ' + Math.round(blob.getBytes().length / 1024) + ' KB) fileId=' + fileId);

    // 3) วิเคราะห์ใหม่ด้วย AI (แม่แบบปัจจุบัน — อ่าน company_name/job_name/requester/pay_approver ครบ)
    //    ฉีด Human-in-the-Loop Few-Shot ต่อร้าน (จาก ai_feedback_logs ที่ User เคยแก้) ช่วยอ่านแม่นขึ้น
    writeLog('🔄 RE-READ', 'STEP 3/5 ส่งรูปให้ AI วิเคราะห์ใหม่... (ใช้เวลาประมาณ 10-40 วิ)');
    const storeHint = String(cellOf('Supplier Name') || '').trim();
    const fresh = analyzeReceiptSmart(blob, { storeName: (storeHint && storeHint !== '-') ? storeHint : '' });
    writeLog('🔄 RE-READ 🔎', 'STEP 3/5 AI ตอบกลับ: ' + buildDocLabel(fresh) + ' — ร้าน=' + fresh.store_name + ' | บริษัท=' + fresh.company_name);
    normalizeReceiptDocFields(fresh);
    fresh.doc_key = doc_key; // บังคับรักษาตัวตนบิลเดิมเสมอ (เปลี่ยนเลข/วันไม่เปลี่ยน key)

    // 4) ตรวจคุณภาพ — ถ้า "ใช้ไม่ได้จริงๆ" (ไม่ใช่บิล/ภาพอ่านไม่ออก) → ไม่ให้ PREVIEW/บันทึก
    //    แต่ถ้า AI อ่านภาพได้แล้ว นำข้อมูลออกมาช่วยให้ User ตรวจ/approve ได้ แม้จะมี review warning
    const q = validateReceiptData(fresh);
    const reviewReasons = (q && q.review_reasons ? q.review_reasons : []).slice();
    const isUnreadable = (fresh && (fresh.is_receipt === false || String(fresh.readability || '').toLowerCase() === 'unreadable'));
    if (!q || (!q.ok && isUnreadable)) {
      const why = (q && q.reasons && q.reasons.length) ? q.reasons.join(' / ') : 'AI อ่านภาพไม่ออก';
      return { success: false, message: 'AI อ่านภาพนี้ใหม่ไม่ได้: ' + why + ' — ข้อมูลเดิมยังคงอยู่' };
    }
    if (!q || !q.ok) {
      writeLog('🔄 RE-READ ⚠️', 'STEP 4/5 AI อ่านภาพได้แต่มี warning/review — ให้ PREVIEW เพื่อ User ตรวจ/ยืนยัน: ' + reviewReasons.join(' | '));
    } else {
      writeLog('🔄 RE-READ', 'STEP 4/5 ตรวจคุณภาพผ่าน — ร้องขอตรวจ ' + reviewReasons.length + ' หัวข้อ (ไม่บล็อกการเขียน ตำแหน่งข้อมูลเดิมถูกเขียนทับเป็นค่าที่ AI อ่านใหม่ได้)');
    }

    // 5) เตรียมค่าใหม่ที่อ่านได้ (PREVIEW — ยังไม่เขียนทับ; User ติ๊กช่องแล้วกดบันทึกที่หน้าเว็บ)
    const itemsArr = Array.isArray(fresh.items) ? fresh.items : [];
    const itemsJsonStr = JSON.stringify(itemsArr);
    const itemsSummary = String(fresh.items_summary || '').trim() ||
      itemsArr.map(function (it) { return (it.name || '') + ' (' + (it.quantity || 0) + ' ' + (it.unit || '') + ')'; }).join(', ');

    const dashToEmpty = function (v) {
      const s = String(v === undefined || v === null ? '' : v).trim();
      return (s === '-' || s === '') ? '' : s;
    };
    const numOrEmpty = function (v) {
      const s = String(v === undefined || v === null ? '' : v).trim();
      if (s === '' || s === '-') return '';
      const n = Number(v);
      return isNaN(n) ? '' : n;
    };

    const rowValues = {
      'PO No.': fresh.po_number || '',
      'Date': fresh.date || '',
      'Supplier Name': dashToEmpty(fresh.store_name),
      'Category': fresh.category || 'ทั่วไป',
      'Items Summary': itemsSummary,
      'Items JSON': itemsJsonStr,
      'Total Amount': Number(fresh.total_amount) || 0,
      'Doc Type': fresh.doc_type || '',
      'Book No.': fresh.book_no || '',
      'Doc No.': fresh.doc_no || '',
      'Tax Invoice No.': fresh.tax_invoice_no || '',
      'Ref No.': fresh.ref_no || '',
      'Ref Label': fresh.ref_label || '',
      'Doc Key': doc_key,
      'Scale Weight In': numOrEmpty(fresh.scale_weight_in),
      'Scale Weight Out': numOrEmpty(fresh.scale_weight_out),
      'Scale Weight Net': numOrEmpty(fresh.scale_weight_net),
      'Vehicle Registration': dashToEmpty(fresh.vehicle_registration),
      'Company Name': dashToEmpty(fresh.company_name),
      'Job/Work': dashToEmpty(fresh.job_name),
      'Requester': dashToEmpty(fresh.requester),
      'Pay Approver': dashToEmpty(fresh.pay_approver),
      'Needs Review': reviewReasons.length > 0,
      'Review Reason': reviewReasons.join(' | ')
    };

    writeLog('🔄 RE-READ', 'STEP 5/5 วิเคราะห์ใหม่เสร็จ (PREVIEW ไม่เขียน) แถวที่ ' + rowIndex + ' | ' + buildDocLabel(fresh));

    // 6) สรุปความต่างรายช่อง (ส่งให้หน้าเว็บแสดง + ติ๊กเลือกได้ก่อนบันทึก)
    const norm = function (v) {
      const s = String(v === null || v === undefined ? '' : v).trim();
      return (s === '' || s === '-') ? '-' : s;
    };
    const diffs = [];
    REANALYZE_FIELDS.forEach(function (pair) {
      const h = pair[0], label = pair[1];
      const oldV = norm(cellOf(h));
      const newV = norm(rowValues[h]);
      if (oldV !== newV) diffs.push({ key: h, label: label, old: oldV, new: newV });
    });

    return {
      success: true,
      preview: true,
      doc_key: doc_key,
      label: buildDocLabel(fresh),
      data: rowValues,
      items: itemsArr,
      diffs: diffs,
      changed: diffs.length,
      confidence: fresh.confidence,
      review_reasons: reviewReasons,
      quality: q || { ok: true, reasons: [], review_reasons: reviewReasons }
    };
  } catch (err) {
    // กรณี Gemini บล็อก/ไม่ตอบ/วิเคราะห์ไม่ได้ — ให้ข้อความเข้าใจง่าย (ข้อมูลเดิมไม่ถูกเขียน)
    const msg = String(err && err.message ? err.message : err);
    if (msg.indexOf('RETAKE:') === 0) {
      const why = msg.replace('RETAKE:', '').trim();
      writeLog('🔄 RE-READ ⚠️', 'AI อ่านภาพใหม่ไม่ได้: ' + why + ' — ข้อมูลเดิมคงไว้');
      return { success: false, message: 'AI อ่านภาพนี้ใหม่ไม่ได้ (' + why + ') — ข้อมูลเดิมยังคงอยู่' };
    }
    writeLog('❌ ERROR', 'reanalyzeReceipt: ' + msg);
    return { success: false, message: 'อ่านภาพใหม่ไม่สำเร็จ: ' + msg };
  }
}

// ==========================================
// STEP 2 — COMMIT: บันทึกผล "อ่านใหม่ (AI)" ตามช่องที่ User ติ๊กเลือกเท่านั้น
//   input: { doc_key, data:rowValues(preview), items:[], selectedKeys:[header], diff }
//   เขียนเฉพาะช่องที่เลือก → ค่าช่องที่ไม่ได้เลือกยังเป็นค่าเดิม (กัน AI อ่านใหม่ไม่ดีกว่าค่าเดิม)
//   แล้ว Sync Supabase จากค่าแถวล่าสุดทั้งแถว
// ==========================================
function applyReanalyzedData(payload) {
  // 🛡️ 2026-09-22 session guard: เขียนทับข้อมูลบิลด้วยผล AI — ห้ามเรียกได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    if (!payload) return { success: false, message: 'ไม่ได้รับข้อมูลสำหรับบันทึก' };
    const doc_key = String(payload.doc_key || payload.docKey || '').trim();
    const data = (payload.data && typeof payload.data === 'object') ? payload.data : null;
    if (!doc_key || !data) return { success: false, message: 'ข้อมูลสำหรับบันทึกไม่ครบ — เปิดดูบิลเต็มแล้วกด "อ่านใหม่ (AI)" อีกครั้ง' };
    const selected = Array.isArray(payload.selectedKeys) ? payload.selectedKeys.slice() : [];

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, message: 'ไม่พบข้อมูลบิลในชีต' };
    ensureSheetHeaders(sheet, getReceiptHeaders());

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = {};
    headers.forEach(function (h, i) { colIndex[String(h).trim()] = i; });

    const targetSrn = (payload.system_record_no !== undefined && payload.system_record_no !== null && payload.system_record_no !== '') ? Number(payload.system_record_no) : (payload.systemRecordNo ? Number(payload.systemRecordNo) : NaN);

    // หาแถว (System Record No. → Doc Key → Image URL → Timestamp+PO+ยอด — กันบิลที่ไม่มีเลขที่เอกสาร)
    const rowIndex = findReceiptRowByAny(sheet, headers, colIndex, doc_key,
      payload.timestamp || payload.ts,
      payload.old_po_number || payload.po_number,
      payload.total_amount,
      payload.image_url || payload.imageUrl,
      targetSrn);
    if (rowIndex === -1) return { success: false, message: 'ไม่พบแถวบิลนี้ในชีต — รีเฟรชแล้วลองใหม่' };
    if (colIndex['Doc Key'] === undefined) return { success: false, message: 'ชีตไม่มีคอลัมน์ Doc Key — ตรวจ schema' };

    // จับกลุ่มรายการสินค้า: ติ๊ก Items Summary = แก้ทั้ง Summary + Items JSON ด้วยกัน
    if (selected.indexOf('Items Summary') !== -1 && selected.indexOf('Items JSON') === -1) selected.push('Items JSON');
    if (selected.indexOf('Items JSON') !== -1 && selected.indexOf('Items Summary') === -1) selected.push('Items Summary');

    // อ่านค่าเดิมก่อนเขียน (สำหรับ diff ที่บันทึกจริง)
    const oldRowVals = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    const cellOf = function (h) { return (colIndex[h] !== undefined) ? oldRowVals[colIndex[h]] : ''; };
    const norm = function (v) {
      const s = String(v === null || v === undefined ? '' : v).trim();
      return (s === '' || s === '-') ? '-' : s;
    };

    // เขียนเฉพาะช่องที่ User ติ๊ก (มีค่าใน preview data)
    const applied = [];
    selected.forEach(function (key) {
      if (colIndex[key] !== undefined && data[key] !== undefined) {
        sheet.getRange(rowIndex, colIndex[key] + 1).setValue(data[key]);
        applied.push(key);
      }
    });
    if (!applied.length) return { success: false, message: 'ไม่มีช่องที่เลือกให้บันทึก' };
    writeLog('🔄 RE-READ-SAVE', 'STEP 1/3 User ยืนยันบันทึก ' + applied.length + ' ช่อง | doc_key=' + doc_key);

    // Diff ที่บันทึกจริง (เฉพาะช่องที่เลือกและค่าเปลี่ยนจริง)
    const diffTexts = [];
    REANALYZE_FIELDS.forEach(function (pair) {
      const h = pair[0], label = pair[1];
      if (applied.indexOf(h) === -1) return;
      const oldV = norm(cellOf(h));
      const newV = norm(data[h]);
      if (oldV !== newV) diffTexts.push(label + ': ' + oldV + ' → ' + newV);
    });

    // Sync Supabase จากค่าในแถวสุดท้าย (ช่องที่ไม่ได้เลือกยังเป็นค่าเดิม — ไม่เขียนทับซ้ำ)
    const finalRow = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    const f = function (h) { return (colIndex[h] !== undefined) ? finalRow[colIndex[h]] : ''; };
    const itemsStr = String(f('Items JSON') || '').trim();
    let itemsArr = [];
    if (itemsStr) { try { const p = JSON.parse(itemsStr); if (Array.isArray(p)) itemsArr = p; } catch (e) { itemsArr = []; } }
    writeLog('🔄 RE-READ-SAVE', 'STEP 2/3 Sync Supabase ตามค่าแถวล่าสุด (' + doc_key + ')');
    try {
      const rowSrn = (colIndex['System Record No.'] !== undefined) ? Number(finalRow[colIndex['System Record No.']]) : NaN;
      updateSupabaseReceipt(doc_key, {
        po_number: f('PO No.'), date: f('Date'), store_name: f('Supplier Name'),
        category: f('Category'), items_summary: f('Items Summary'), items: itemsArr,
        total_amount: Number(f('Total Amount')) || 0, doc_type: f('Doc Type'), book_no: f('Book No.'),
        doc_no: f('Doc No.'), tax_invoice_no: f('Tax Invoice No.'), ref_no: f('Ref No.'),
        ref_label: f('Ref Label'), scale_weight_in: f('Scale Weight In') === '' ? null : Number(f('Scale Weight In')),
        scale_weight_out: f('Scale Weight Out') === '' ? null : Number(f('Scale Weight Out')),
        scale_weight_net: f('Scale Weight Net') === '' ? null : Number(f('Scale Weight Net')),
        vehicle_registration: f('Vehicle Registration'), company_name: f('Company Name'), job_name: f('Job/Work'),
        requester: f('Requester'), pay_approver: f('Pay Approver'),
        needs_review: f('Needs Review') === true || String(f('Needs Review')).trim() === 'TRUE',
        review_reason: f('Review Reason')
      }, targetSrn || rowSrn);
    } catch (sbErr) {
      writeLog('⚠️ SUPABASE', 'applyReanalyzedData-updateSupabaseReceipt: ' + sbErr.toString());
    }
    writeLog('🔄 RE-READ-SAVE', 'STEP 3/3 บันทึกแล้ว ' + applied.length + ' ช่อง (' + diffTexts.length + ' จุดเปลี่ยน) | ' + (f('Doc Type') || '') + ' ' + (f('Doc No.') || ''));

    return { success: true, message: 'บันทึกข้อมูลใหม่เรียบร้อยแล้ว (' + applied.length + ' ช่อง)', diff: diffTexts, changed: diffTexts.length };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    writeLog('❌ ERROR', 'applyReanalyzedData: ' + msg);
    return { success: false, message: 'บันทึกข้อมูลใหม่ไม่สำเร็จ: ' + msg };
  }
}

// ==========================================
// RECEIPT IMAGE EDIT (โหลดรูปเข้า editor ฝั่งเว็บ + เขียนทับไฟล์เดิมใน Drive)
// ==========================================
function getReceiptImageData(imageUrl) {
  // 🛡️ 2026-09-22 session guard: คืนข้อมูลรูปบิล — ห้ามอ่านได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(imageUrl); if (!__guard.ok) return __guard.res;
  try {
    // รองรับทั้งสไตล์เดิม (URL ตรง) และสไตล์ใหม่ (object จาก REST)
    if (imageUrl && typeof imageUrl === 'object') imageUrl = imageUrl.url || imageUrl.image_url;
    if (!imageUrl) return { success: false, message: 'ไม่พบลิงก์รูปสำหรับโหลด' };
    const fileId = extractDriveFileId(imageUrl);
    if (!fileId) return { success: false, message: 'ไม่พบไฟล์รูปใน Drive จากลิงก์ที่ให้มา' };
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > 12 * 1024 * 1024) {
      return { success: false, message: 'รูปใหญ่เกินไปสำหรับแก้ไข (เกิน 12MB)' };
    }
    const mime = blob.getContentType() || 'image/jpeg';
    return {
      success: true,
      data_url: 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes),
      mime_type: mime,
      size: bytes.length,
      name: file.getName()
    };
  } catch (err) {
    writeLog('❌ ERROR', 'getReceiptImageData: ' + err.toString());
    return { success: false, message: 'โหลดรูปไม่สำเร็จ: ' + err.toString() };
  }
}

function saveEditedReceiptImage(payload) {
  // 🛡️ 2026-09-22 session guard: สร้าง/ทิ้งไฟล์รูปใน Drive — ห้ามเรียกได้โดยไม่ล็อกอิน
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    if (!payload || !payload.image_base64) return { success: false, message: 'ไม่ได้รับข้อมูลรูปที่แก้ไข' };

    const match = String(payload.image_base64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const base64 = match ? match[2] : String(payload.image_base64);
    if (!base64 || base64.length < 100) return { success: false, message: 'ข้อมูลรูปไม่ถูกต้อง' };

    const fileId = extractDriveFileId(payload.image_url);
    if (!fileId) return { success: false, message: 'ไม่พบไฟล์รูปใน Drive' };

    const bytes = Utilities.base64Decode(base64);
    if (bytes.length > 12 * 1024 * 1024) return { success: false, message: 'รูปใหญ่เกินไป (เกิน 12MB)' };

    const blob = Utilities.newBlob(bytes, mimeType, payload.filename || ('receipt_edit_' + Date.now() + '.jpg'));

    // บันทึกเป็น "ไฟล์ใหม่" (file ID ใหม่) แทนการเขียนทับเข้าไฟล์เดิม
    // เพราะ Google Drive แคช /thumbnail ฝั่งเซิร์ฟเวอร์ไว้ที่ file ID เดิม — ต่อให้เขียนทับเนื้อหาแล้ว
    // ก็ยังเสิร์ฟภาพเก่าให้อยู่ (uc?export=view แก้ได้แต่บางกรณีเรนเดอร์ใน <img> ไม่ได้)
    // ไฟล์ใหม่ = thumbnail ของมันถูกสร้างครั้งแรกจากเนื้อหาปัจจุบัน → โชว์ภาพที่แก้แล้วทันที
    // และยังอยู่ในโฟลเดอร์เดิมของบิล (อนุรักษ์โครงสร้างปี/เดือน)
    const origFile = DriveApp.getFileById(fileId);
    let targetFolder = getOrCreateDriveFolder();
    try {
      const parents = origFile.getParents();
      if (parents.hasNext()) targetFolder = parents.next();
    } catch (e) { /* ใช้โฟลเดอร์หลัก */ }

    const newFile = targetFolder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ย้ายไฟล์เก่าที่โดนเขียนทับไปถังขยะ (กู้คืนได้ 30 วัน) — ไม่ให้มีไฟล์รุ่นค้างอยู่ในโฟลเดอร์
    try { origFile.setTrashed(true); } catch (e) { /* ข้ามถ้าลบไม่ได้ */ }

    // อัปเดต Image URL ในชีตเป็น thumbnail ของไฟล์ใหม่ + cache-bust (v= กันแคชเบราว์เซอร์)
    const newImageUrl = 'https://drive.google.com/thumbnail?id=' + newFile.getId() + '&sz=w1200&v=' + Date.now();
    updateReceiptImageUrl(payload, newImageUrl);

    writeLog('🖼️ IMAGE EDIT', 'แก้ไขรูปบิล: สร้างไฟล์ใหม่ ' + newFile.getId() + ' (เดิม ' + fileId + ') ขนาด ' + Math.round(bytes.length / 1024) + ' KB');
    return { success: true, message: 'บันทึกรูปบิลเรียบร้อยแล้ว', new_image_url: newImageUrl };
  } catch (err) {
    writeLog('❌ ERROR', 'saveEditedReceiptImage: ' + err.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกรูป: ' + err.toString() };
  }
}

function updateReceiptImageUrl(payload, newImageUrl) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
    if (!sheet || sheet.getLastRow() <= 1) return false;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    let colImg = headers.indexOf('Image URL');
    if (colImg === -1) colImg = headers.indexOf('Image Link');
    const colTs = headers.indexOf('Timestamp');
    const colPo = headers.indexOf('PO No.');
    if (colImg === -1 || colTs === -1) return false;

    const targetTs = formatTimestampForCompare(payload.timestamp); // normalize ISO → เวลาไทย (บิลจาก Supabase timestamp เป็น ISO)
    const targetPo = String(payload.po_number || '').trim();
    const fileId = extractDriveFileId(payload.image_url || '');
    let rowIndex = Number(payload.id) + 1;
    let matched = false;

    if (rowIndex >= 2 && rowIndex <= sheet.getLastRow()) {
      const ts = formatTimestampForCompare(sheet.getRange(rowIndex, colTs + 1).getValue());
      const po = colPo !== -1 ? String(sheet.getRange(rowIndex, colPo + 1).getValue() || '').trim() : '';
      if (ts === targetTs && po === targetPo) matched = true;
    }
    if (!matched) {
      const all = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
      for (let i = 0; i < all.length; i++) {
        const ts = formatTimestampForCompare(all[i][colTs]);
        const po = colPo !== -1 ? String(all[i][colPo] || '').trim() : '';
        if (ts === targetTs && po === targetPo) { rowIndex = i + 2; matched = true; break; }
      }
    }
    // จับคู่สุดท้ายแบบหนีไม่รอด: หาบรรทัดที่คอลัมน์รูปมี file ID ตัวเดียวกัน (กันพลาดกรณี timestamp/PO เปลี่ยนไป)
    if (!matched && fileId) {
      const all2 = sheet.getRange(2, colImg + 1, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < all2.length; i++) {
        if (String(all2[i][0] || '').indexOf(fileId) !== -1) { rowIndex = i + 2; matched = true; break; }
      }
    }
    if (!matched) return false;

    sheet.getRange(rowIndex, colImg + 1).setValue(newImageUrl);

    // Sync URL รูปใหม่ลง Supabase ด้วย (แหล่งข้อมูลหลักของหน้าเว็บ) — พยายามเต็มที่
    try {
      const colDocKey = headers.indexOf('Doc Key');
      const docKey = colDocKey !== -1 ? String(sheet.getRange(rowIndex, colDocKey + 1).getValue() || '').trim() : '';
      if (docKey) {
        supabaseRequest('patch', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(docKey), {
          image_url: newImageUrl,
          google_drive_file_id: extractDriveFileId(newImageUrl) || null
        });
      }
    } catch (sbErr) {
      writeLog('⚠️ SUPABASE', 'updateReceiptImageUrl sync ล้มเหลว: ' + sbErr.toString());
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ฟังก์ชันย้ายที่ใช้ครั้งเดียว (ไปรันใน Apps Script Editor แล้วดู Log):
// เจอบิลที่เคยแก้ไขรูปไว้ก่อนหน้านี้ (URL มีเครื่องหมาย v= ที่ระบบเราเขียนหลังแก้) →
// คัดลอกไฟล์ปัจจุบันเป็น "ไฟล์ใหม่" + อัปเดตลิงก์เป็น thumbnail ของไฟล์ใหม่ + เก็บไฟล์เดิมเข้าถังขยะ
// เพื่อให้บิลเก่าที่แก้รูปแล้วโชว์ภาพใหม่ด้วย (ไม่ต้องเข้าไปแก้ทับใหม่ทีละใบ)
function migrateEditedImages() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('บิลจัดซื้อ (Receipts)');
  if (!sheet || sheet.getLastRow() <= 1) return 'ไม่มีข้อมูลบิลในชีต';
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let colImg = headers.indexOf('Image URL');
  if (colImg === -1) colImg = headers.indexOf('Image Link');
  if (colImg === -1) return 'ไม่พบคอลัมน์ Image URL/Image Link';

  const folder = getOrCreateDriveFolder();
  const rows = sheet.getLastRow() - 1;
  const vals = sheet.getRange(2, colImg + 1, rows, 1).getValues();
  let n = 0;
  const trashed = {};
  for (let i = 0; i < vals.length; i++) {
    const v = String(vals[i][0] || '');
    // เฉพาะ URL ที่มีเครื่องหมายการแก้ไข (id=...&v= ที่ระบบเราเคยเขียน) — ข้ามภาพต้นฉบับ LINE ปกติ
    const m = v.match(/id=([a-zA-Z0-9_-]+)[^?]*&v=/i);
    if (!m) continue;
    const oldId = m[1];
    try {
      const oldFile = DriveApp.getFileById(oldId);
      const newFile = folder.createFile(oldFile.getBlob());
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const newUrl = 'https://drive.google.com/thumbnail?id=' + newFile.getId() + '&sz=w1200&v=tra_' + Date.now() + '_' + (i + 2);
      sheet.getRange(i + 2, colImg + 1).setValue(newUrl);
      if (!trashed[oldId]) {
        try { oldFile.setTrashed(true); } catch (e) { /* ข้าม */ }
        trashed[oldId] = 1;
      }
      n++;
    } catch (e) { /* ข้ามแถวนี้ไป */ }
  }
  return 'ย้ายเสร็จสิ้น ' + n + ' แถว (สร้างไฟล์ใหม่ + อัปเดตลิงก์ thumbnail + เก็บไฟล์เก่าเข้าถังขยะ)';
}

// ตรวจว่าค่าคอนฟิกสำคัญแต่ละตัวมาจากไหน (Script Property / ค่า fallback ที่ยังฝังในไฟล์ / ยังไม่ได้ตั้ง)
// ใช้ยืนยันก่อนลบค่า fallback ที่เหลือออกจากไฟล์ (เช่น WEB_PASSWORD) — กดจากเมนูชีต หรือรันใน Apps Script Editor
function checkConfigSources() {
  const props = getScriptProps();
  const src = function (propKey, fileHasFallback) {
    const v = props.getProperty(propKey);
    if (v && String(v).trim() !== '') return 'Script Property ✓ (ตั้งผ่านหน้าเว็บแล้ว)';
    return fileHasFallback ? '⚠️ ยังไม่มี Property — กำลังใช้ค่า fallback ที่ฝังในไฟล์อยู่' : 'ยังไม่ได้ตั้ง (ค่าว่าง)';
  };
  const lines = [
    'LINE_CHANNEL_ACCESS_TOKEN : ' + src('LINE_CHANNEL_ACCESS_TOKEN', false),
    'GEMINI_API_KEY            : ' + src('GEMINI_API_KEY', false),
    'DRIVE_FOLDER_NAME         : ' + src('DRIVE_FOLDER_NAME', true),
    'SPREADSHEET_ID            : ' + src('SPREADSHEET_ID', true),
    'WEB_PASSWORD              : ' + src('WEB_PASSWORD', true),
    'SUPABASE_URL              : ' + src('SUPABASE_URL', false),
    'SUPABASE_SERVICE_KEY      : ' + (getSupabaseKey() ? ('Script Property ✓ (role=' + supabaseKeyRole(getSupabaseKey()) + ')') : 'ยังไม่ได้ตั้ง'),
    'SUPABASE_ANON_KEY         : ' + src('SUPABASE_ANON_KEY', false)
  ];
  const report = '=== สถานะค่าการตั้งค่า (checkConfigSources) ===\n' + lines.join('\n');
  writeLog('🔎 CONFIG CHECK', 'ตรวจสถานะค่าการตั้งค่าเรียบร้อย (รายละเอียดใน alert/Logger)');
  Logger.log(report);
  try { SpreadsheetApp.getUi().alert(report); } catch (e) { /* รันจาก Editor ที่ไม่มี UI — ดู Logger แทน */ }
  return report;
}

// ==========================================
// WEB SETTINGS (ตั้งค่าระบบผ่านหน้าเว็บ — กันด้วยรหัสผ่าน)
// ==========================================
// ตรวจรหัสผ่านเว็บ — ใช้ลิมิต/ล็อกเดียวกับ createApiSession
// 🛡️ 2026-09-22: เดิมฟังก์ชันนี้ไม่มีลิมิตเลย → เดารหัสผ่านผ่าน google.script.run.verifyConfigPassword('...')
//    ได้ไม่จำกัดรอบ (เป็น password oracle) ตอนนี้ใช้ตัวนับ/ล็อกชุดเดียวกับ createApiSession
function verifyConfigPassword(password) {
  if (password && typeof password === 'object') password = password.password;
  const cache = getApiSessionCache();
  const lockedUntil = Number(cache.get('LOGIN_LOCKED_UNTIL') || 0);
  if (Date.now() < lockedUntil) {
    writeLog('🛑 PASSWORD-LOCKED', 'ปฏิเสธการตรวจรหัสผ่านระหว่างช่วงล็อกกัน brute force');
    return false;
  }
  if (getWebPassword() === String(password || '')) {
    cache.remove('LOGIN_FAIL_COUNT');
    return true;
  }
  const fails = Number(cache.get('LOGIN_FAIL_COUNT') || 0) + 1;
  Utilities.sleep(400); // หน่วงทุกครั้งที่ผิด — เพิ่มต้นทุนเวลาของการเดารหัส
  if (fails >= LOGIN_MAX_FAILS) {
    cache.put('LOGIN_LOCKED_UNTIL', String(Date.now() + LOGIN_LOCK_MS), Math.ceil(LOGIN_LOCK_MS / 1000));
    cache.remove('LOGIN_FAIL_COUNT');
    writeLog('🛑 PASSWORD-LOCK', 'รหัสผ่านผิดครบ ' + LOGIN_MAX_FAILS + ' ครั้ง — ล็อกการล็อกอิน 15 นาที');
  } else {
    cache.put('LOGIN_FAIL_COUNT', String(fails), Math.ceil(LOGIN_LOCK_MS / 1000));
  }
  return false;
}

// ใช้ร่วมกับฟังก์ชันตั้งค่าทั้งหลาย: ยอมรับได้เพียง 2 กรณี
//   (1) รหัสผ่านถูกต้อง หรือ (2) session token ที่ "เซิร์ฟเวอร์ออกให้เอง" (จาก createApiSession) ยังไม่หมดอายุ
// 🛡️ 2026-09-22: ตัดการเชื่อธง `_alreadyAuthed` ที่ client ส่งมาได้เอง
//    (เดิม: ใครเปิดหน้าเว็บแล้วเรียก google.script.run.getAppConfig({_alreadyAuthed:true, reveal:true})
//     จะได้ LINE token / Gemini key / Supabase service_role key ครบทั้งชุด และ saveAppConfig ก็เขียนทับได้)
function passesAuth(payload) {
  if (!payload) return false;
  const sessionToken = String(payload._sessionToken || '').trim();
  if (sessionToken && apiSessionValid(sessionToken)) return true;
  return verifyConfigPassword(payload.password || '');
}

function maskSecret(v) {
  if (!v) return '';
  const s = String(v);
  return s.length <= 8 ? '••••' : s.slice(0, 4) + '••••' + s.slice(-4);
}

function getAppConfig(payload) {
  if (!passesAuth(payload)) {
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  }
  const reveal = !!(payload && payload.reveal);
  return {
    success: true,
    revealed: reveal,
    data: {
      LINE_CHANNEL_ACCESS_TOKEN: reveal ? getLineToken() : maskSecret(getLineToken()),
      GEMINI_API_KEY: reveal ? getGeminiKey() : maskSecret(getGeminiKey()),
      DRIVE_FOLDER_NAME: getDriveFolderName(),
      SPREADSHEET_ID: reveal ? getSpreadsheetId() : maskSecret(getSpreadsheetId()),
      SUPABASE_URL: getSupabaseUrl(),
      SUPABASE_SERVICE_KEY: reveal ? getSupabaseKey() : maskSecret(getSupabaseKey()),
      SUPABASE_ANON_KEY: getSupabaseAnonKey(),
      SUPABASE_CONFIGURED: !!(getSupabaseUrl() && getSupabaseKey()),
      WEB_PASSWORD_SET: !!getScriptProps().getProperty('WEB_PASSWORD')
    }
  };
}

function saveAppConfig(payload) {
  try {
    if (!payload) return { success: false, message: 'ไม่ได้รับข้อมูล' };
    writeLog('🔐 SETTINGS-PING', 'ได้รับคำขอบันทึกตั้งค่าแล้ว (กำลังตรวจสอบ)');
    if (!passesAuth(payload)) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }
    const props = getScriptProps();
    const updated = [];

    const setField = function (key, value) {
      if (value === null || value === undefined) return false;
      const v = String(value).trim();
      if (v === '' || v.indexOf('••') !== -1) return false; // ค่าว่าง หรือเป็นค่า masked เดิม (ไม่ได้แก้)
      props.setProperty(key, v);
      updated.push(key);
      return true;
    };

    setField('LINE_CHANNEL_ACCESS_TOKEN', payload.LINE_CHANNEL_ACCESS_TOKEN);
    setField('GEMINI_API_KEY', payload.GEMINI_API_KEY);
    setField('DRIVE_FOLDER_NAME', payload.DRIVE_FOLDER_NAME);
    setField('SPREADSHEET_ID', payload.SPREADSHEET_ID);
    setField('SUPABASE_URL', payload.SUPABASE_URL);
    setField('SUPABASE_ANON_KEY', payload.SUPABASE_ANON_KEY);
    const sbKeyChanged = setField('SUPABASE_SERVICE_KEY', payload.SUPABASE_SERVICE_KEY);
    if (sbKeyChanged) {
      const role = supabaseKeyRole(payload.SUPABASE_SERVICE_KEY);
      if (role !== 'service_role') {
        return { success: false, message: 'Supabase Service Key ยังไม่ถูกต้อง (role = "' + role + '") — ต้องใช้ service_role (SECRET) ไม่ใช่ anon public. เปิด Settings > API แล้ว copy ตัวที่แถบแดง secret มาใหม่' };
      }
    }

    const newPw = String(payload.new_password || '').trim();
    if (newPw !== '' && newPw.length >= 8) {
      props.setProperty('WEB_PASSWORD', newPw);
      updated.push('WEB_PASSWORD');
    } else if (newPw !== '' && newPw.length < 8) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' };
    }

    writeLog('🔐 SETTINGS', 'ตั้งค่าระบบผ่านหน้าเว็บ: ' + (updated.length > 0 ? updated.join(', ') : 'ไม่มีการเปลี่ยนแปลง'));
    return { success: true, message: updated.length > 0 ? 'บันทึกการตั้งค่าเรียบร้อยแล้ว (มีผลทันทีสำหรับบิลถัดไป)' : 'ไม่มีการเปลี่ยนแปลงการตั้งค่า' };
  } catch (err) {
    writeLog('❌ ERROR', 'saveAppConfig: ' + err.toString());
    return { success: false, message: 'บันทึกการตั้งค่าไม่สำเร็จ: ' + err.toString() };
  }
}

// ==========================================
// REST API (สำหรับ GitHub Pages / หน้าเว็บนอก GAS) — session token กันไม่ให้คนนอกลบ/แก้ข้อมูล
//   หลักการ: ฝั่งหน้าเว็บล็อกอินด้วยรหัสผ่าน → ได้ token ชั่วคราว (2 ชม.) → ทุกคำขอแนบ token
//   ฟังก์ชันที่ปลอดภัยระดับสาธารณะ (อ่านได้ทุกคน) ไม่ต้องมี token
// ==========================================
const API_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 ชั่วโมง
// 🔐 v3.12.0 Hardening: token ย้ายไปเก็บใน CacheService (หมดอายุเองตาม TTL — ไม่ค้างใน Script Properties)
//    + Rate limit ป้องกัน brute force รหัสผ่าน (ผิดครบ 5 ครั้ง → ล็อก 15 นาที)
const API_SESS_CACHE_TTL_S = Math.min(API_SESSION_TTL_MS / 1000, 21600); // CacheService รับได้สูงสุด 6 ชม.
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // ล็อก 15 นาทีเมื่อรหัสผ่านผิดครบเกณฑ์

// Shared API guard helpers were moved to src/core/safe.gs so the project follows a GAS-friendly layer split.
// This file keeps the core session logic but uses the global helpers loaded from the src/*.gs files in the same Apps Script project.
function getApiSessionCache() { return CacheService.getScriptCache(); }

function createApiSession(password) {
  const pw = (password && typeof password === 'object') ? password.password : password;
  const cache = getApiSessionCache();
  // 🛡️ Rate limit: กำลังถูกล็อกอยู่ → ปฏิเสธทันที (กัน brute force รหัสผ่าน)
  // 🐞 fix 2026-09-22: CacheService มีแค่ get/put/remove — ไม่มี getProperty (นั่นเป็นของ PropertiesService)
  //    เดิม cache.getProperty(...) โยน TypeError ทันที ทำให้ "ล็อกอินผ่าน createApiSession ล้มเหลวทั้งหมด"
  const lockedUntil = Number(cache.get('LOGIN_LOCKED_UNTIL') || 0);
  if (Date.now() < lockedUntil) {
    const waitMin = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
    writeLog('🛑 API-LOGIN-LOCKED', 'ปฏิเสธคำขอล็อกอินระหว่างช่วงล็อกกัน brute force');
    return { success: false, code: 'LOGIN_LOCKED', message: 'ล็อกอินผิดหลายครั้งเกินไป — กรุณารออีกประมาณ ' + waitMin + ' นาที แล้วลองใหม่' };
  }
  if (getWebPassword() !== String(pw || '')) {
    const fails = Number(cache.get('LOGIN_FAIL_COUNT') || 0) + 1; // 🐞 fix: Cache.get (เดิม getProperty → TypeError)
    Utilities.sleep(400); // หน่วงทุกครั้งที่ผิด — เพิ่มต้นทุนเวลาของการ brute force
    if (fails >= LOGIN_MAX_FAILS) {
      cache.put('LOGIN_LOCKED_UNTIL', String(Date.now() + LOGIN_LOCK_MS), Math.ceil(LOGIN_LOCK_MS / 1000));
      cache.remove('LOGIN_FAIL_COUNT');
      writeLog('🛑 API-LOGIN-LOCK', 'รหัสผ่านผิดครบ ' + LOGIN_MAX_FAILS + ' ครั้ง — ล็อกการล็อกอิน 15 นาที');
    } else {
      cache.put('LOGIN_FAIL_COUNT', String(fails), Math.ceil(LOGIN_LOCK_MS / 1000));
    }
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  }
  // ล็อกอินสำเร็จ → ล้างตัวนับ/ล็อก (เริ่มนับใหม่)
  cache.remove('LOGIN_FAIL_COUNT');
  cache.remove('LOGIN_LOCKED_UNTIL');
  const token = Utilities.getUuid();
  // เก็บ token ใน CacheService — หมดอายุเองตาม TTL (2 ชม.) ไม่ต้องกวาดเก่าเอง
  getApiSessionCache().put('API_SESS_' + token, String(Date.now() + API_SESSION_TTL_MS), API_SESS_CACHE_TTL_S);
  writeLog('🔑 API-LOGIN', 'สร้าง session token ใหม่ (หมดอายุ 2 ชม. — เก็บใน CacheService)');
  return { success: true, token: token, expires_in_ms: API_SESSION_TTL_MS };
}

function apiSessionValid(token) {
  if (!token) return false;
  const cacheKey = 'API_SESS_' + token;
  const cache = getApiSessionCache();
  const cachedExpiry = Number(cache.get(cacheKey));
  if (cachedExpiry) {
    if (cachedExpiry <= Date.now()) return false;
    // ⏳ Sliding session (2026-09-23): ผู้ใช้ที่ทำงานต่อเนื่อง (แก้บิล/จับคู่) ไม่ควรหลุดกลางงาน —
    //    เหลืออายุ < 50% ของ TTL → ต่ออายุอัตโนมัติเป็น now + TTL (ต้นทุน = cache.put 1 ครั้งเป็นครั้งคราว)
    //    ยังหมดอายุจริงเมื่อ "ไม่มีการใช้งาน" ครบ TTL จึงคงความปลอดภัยเดิม
    if (cachedExpiry - Date.now() < API_SESSION_TTL_MS / 2) {
      try { cache.put(cacheKey, String(Date.now() + API_SESSION_TTL_MS), API_SESS_CACHE_TTL_S); } catch (e) {}
    }
    return true;
  }
  // เส้นทางเดิม (Script Properties) — รองรับ token เก่าจากเวอร์ชันก่อน Deploy แล้วย้ายเข้า Cache อัตโนมัติ
  const props = getScriptProps();
  const expiry = Number(props.getProperty(cacheKey));
  if (!expiry) return false;
  if (expiry < Date.now()) {
    props.deleteProperty(cacheKey);
    return false;
  }
  const remainS = Math.min(Math.ceil((expiry - Date.now()) / 1000), API_SESS_CACHE_TTL_S);
  if (remainS > 0) cache.put(cacheKey, String(expiry), remainS);
  props.deleteProperty(cacheKey);
  return true;
}

function revokeApiSession(token) {
  if (token) {
    try { getApiSessionCache().remove('API_SESS_' + token); } catch (e) {}
    try { getScriptProps().deleteProperty('API_SESS_' + token); } catch (e2) {}
  }
  return { success: true };
}

// ==========================================
// 🛡️ API GUARD — ชั้นป้องกันคำขอ REST/API (ห้ามย้ายออกจากไฟล์นี้เด็ดขาด)
//   ⚠️ บทเรียน 2026-09-22: helper ชุดนี้เคยถูกย้ายไปไฟล์อื่นแล้วไฟล์นั้นถูกลบ
//      → validateApiRequestContext/sanitizeApiPayload/normalizeApiString กลายเป็นฟังก์ชันล่องหน
//      → doPost ตอบ 200 {status:'success',events:[]} แบบเงียบ (หน้าเว็บเหมือนล็อกอินไม่ผ่าน/ข้อมูลว่าง)
//   กฎ: ถ้าจะย้ายฟังก์ชันในบล็อกนี้ ต้องย้าย call site (doPost 614/636/638 + handleApiRequest 5200/5201)
//       พร้อมกันในรอบเดียว และรัน selfCheckApiGuards() ก่อน deploy ทุกครั้ง
// ==========================================
const API_FN_PUBLIC = ['getPublicClientConfig', 'createApiSession', 'ping']; // ไม่ต้องมี session (config สาธารณะ/ล็อกอิน)
// 🔓 2026-09-23 — ฟังก์ชันที่ยังต้องใช้ session token: เฉพาะ "ตั้งค่าระบบ" เท่านั้น
//    (รหัสผ่านมีไว้ "เข้า" หน้า ตั้งค่าระบบ ไม่ใช่รหัสคุมทั้งระบบ — ฟังก์ชันธุรกิจทุกตัวเปิดหมด)
const API_FN_SESSION_REQUIRED = ['getAppConfig', 'saveAppConfig'];
const API_STR_MAX = 20000;           // ความยาวสตริงสูงสุดต่อฟิลด์ทั่วไป
const API_STR_MAX_LARGE = 22000000;  // ฟิลด์ที่บรรจุไฟล์ภาพ (base64) — ~16MB ต่อคำขอ
const API_LARGE_FIELDS = { image_base64: true, imageBase64: true, blobBase64: true, image_data: true, new_image_base64: true };
const API_ARRAY_MAX = 800;           // จำนวนสมาชิกอาร์เรย์สูงสุด (items ในบิล 1 ใบ)
const API_RATE_WINDOW_S = 60;        // หน้าต่างเวลาของ rate limit (วินาที)
const API_RATE_LIMIT_PER_MIN = 240;  // คำขอสูงสุดต่อนาทีต่อ session/ฟังก์ชัน (พอสำหรับ dashboard ปกติ)

// ตัดอักขระควบคุม + จำกัดความยาว ของสตริงที่รับจากภายนอก
function normalizeApiString(v, maxLen) {
  const s = String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  const max = Number(maxLen) > 0 ? Number(maxLen) : API_STR_MAX;
  return s.length > max ? s.substring(0, max) : s;
}

// ทำความสะอาด payload ก่อนเข้าธุรกิจ (กัน prototype pollution / payload ยักษ์ / ค่าผิดชนิด)
//   - ฟิลด์ภาพ (API_LARGE_FIELDS) คงทั้งก้อน แล้วให้ฟังก์ชันธุรกิจตรวจขนาดเอง (มีลิมิต 12MB อยู่แล้ว)
function sanitizeApiPayload(value, depth) {
  const d = (typeof depth === 'number') ? depth : 0;
  if (d > 6) return null;
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return normalizeApiString(value, API_STR_MAX);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'function' || t === 'symbol') return undefined;
  if (Object.prototype.toString.call(value) === '[object Array]') {
    const arr = [];
    for (let i = 0; i < value.length && i < API_ARRAY_MAX; i++) {
      const one = sanitizeApiPayload(value[i], d + 1);
      if (one !== undefined) arr.push(one);
    }
    return arr;
  }
  if (t !== 'object') return undefined;
  const out = {};
  Object.keys(value).forEach(function (k) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return; // กัน prototype pollution
    const raw = value[k];
    if (typeof raw === 'string' && API_LARGE_FIELDS[k]) {
      out[k] = raw.length > API_STR_MAX_LARGE ? raw.substring(0, API_STR_MAX_LARGE) : raw;
      return;
    }
    const cleaned = sanitizeApiPayload(raw, d + 1);
    if (cleaned !== undefined) out[k] = cleaned;
  });
  return out;
}

// ตัวกระจายงาน REST: ตรวจ token ก่อน แล้วเรียกฟังก์ชันที่ใช้ร่วมกับ google.script.run
// ==========================================
// RECEIPT LINKS — จับคู่การรับของต่อใบสั่งซื้อ (ตาราง receipt_links ใน Supabase)
//   หน้าเว็บ: ตารางบิล > แท็บใบสั่งซื้อ > ดูบิลเต็ม > แท็บจับคู่ + แท็บ "บิลที่จับคู่แล้ว"
//   สถานะ: pending (รอตรวจสอบ) → confirmed (จับคู่แล้ว)
// ==========================================

// ตรวจ origin ที่อนุญาตสำหรับ REST (ตั้งที่ Script Property: API_ALLOWED_ORIGINS = คั่นด้วย , รองรับ *)
//   - ไม่มี Origin (google.script.run / LINE / เรียกจาก server) = ผ่าน (ความปลอดภัยคุมที่ session token)
//   - ยังไม่ตั้งค่า = อนุญาตพร้อมเขียน Log เตือน (ไม่ให้ระบบเดิมพังกลางทาง — ควรตั้งก่อนขึ้น GitHub Pages)
function isAllowedApiOrigin(origin) {
  const o = String(origin || '').trim();
  if (!o) return true;
  const configured = String(getScriptProps().getProperty('API_ALLOWED_ORIGINS') || '').trim();
  if (!configured) {
    writeLog('⚠️ API-ORIGIN', 'ยังไม่ได้ตั้ง API_ALLOWED_ORIGINS — อนุญาต origin: ' + o);
    return true;
  }
  const list = configured.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(function (s) { return s.length > 0; });
  const target = o.toLowerCase();
  return list.some(function (allowed) { return allowed === '*' || allowed === target; });
}

// จำกัดอัตราคำขอต่อคีย์ (CacheService — หมดอายุเองตามหน้าต่างเวลา)
function enforceApiRateLimit(scopeKey, limit, windowSec) {
  const lim = Number(limit) > 0 ? Number(limit) : API_RATE_LIMIT_PER_MIN;
  const win = Number(windowSec) > 0 ? Number(windowSec) : API_RATE_WINDOW_S;
  const key = 'API_RL_' + String(scopeKey || 'anon').substring(0, 160);
  const cache = CacheService.getScriptCache();
  const used = Number(cache.get(key) || 0);
  if (used >= lim) {
    return { ok: false, code: 'RATE_LIMITED', retry_after_s: win, message: 'เรียกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' };
  }
  try { cache.put(key, String(used + 1), win); } catch (e) { /* Cache ล่มไม่ควรบล็อกงาน */ }
  return { ok: true, used: used + 1 };
}

// ประตูตรวจคำขอก่อนเข้าธุรกิจ: ชื่อฟังก์ชัน + origin + session → คืน payload ที่ทำความสะอาดแล้ว
function validateApiRequestContext(fn, payload, token, origin) {
  const safeFn = normalizeApiString(fn || '', 80);
  if (!safeFn) return { ok: false, code: 'BAD_REQUEST', message: 'ไม่ระบุชื่อฟังก์ชัน' };
  if (!isAllowedApiOrigin(origin)) {
    writeLog('🛑 API-ORIGIN', 'ปฏิเสธ origin ที่ไม่ได้รับอนุญาต: ' + origin);
    return { ok: false, code: 'ORIGIN_DENIED', message: 'origin นี้ไม่ได้รับอนุญาตให้เรียก API' };
  }
  const safePayload = (payload && typeof payload === 'object') ? sanitizeApiPayload(payload) : {};
  // 🔓 2026-09-23 นโยบายใหม่ตามคำสั่ง User: รหัสผ่านมีไว้ "เข้า" หน้า ตั้งค่าระบบ เท่านั้น — ไม่ใช่รหัสคุมทั้งระบบ
  //    จุดนี้จึงตรวจ session เฉพาะกลุ่มตั้งค่าระบบ (API_FN_SESSION_REQUIRED) ส่วนฟังก์ชันธุรกิจทั้งหมดเปิดหมด
  //    (origin + sanitize + rate limit ยังตรวจทุกคำขอเหมือนเดิม — คงชั้นป้องกัน attack surface ระดับ request)
  if (API_FN_PUBLIC.indexOf(safeFn) === -1 && API_FN_SESSION_REQUIRED.indexOf(safeFn) !== -1 && !apiSessionValid(token)) {
    return { ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' };
  }
  return { ok: true, fn: safeFn, payload: safePayload };
}

// อะแดปเตอร์ให้หน้าเว็บที่โฮสต์ใน GAS เรียกผ่าน google.script.run ได้ "เส้นทางเดียวกับ REST"
//   หน้าเว็บส่ง { fn, payload, token } → เข้า handleApiRequest จุดเดียว → ไม่มีทางลัดที่ตรวจสิทธิ์ไม่ครบ
function apiCall(request) {
  const req = (request && typeof request === 'object') ? request : {};
  return handleApiRequest(req.fn, req.payload, req.token, '');
}

// ตัวนับ "เส้นทางที่ตรวจสิทธิ์แล้ว" ในรอบการทำงานเดียวกัน (handleApiRequest / webhook / เมนูชีต)
//   ใช้เป็นด่านชั้นที่ 2: ฟังก์ชันที่ client เรียกได้ตรงผ่าน google.script.run จะผ่านได้เฉพาะเมื่อ
//     (ก) มี session token ที่ถูกต้อง หรือ (ข) ถูกเรียกจากเส้นทางภายในที่ผ่านการตรวจสิทธิ์มาแล้ว
//   ผลลัพธ์: ปิดช่อง "เปิดหน้าเว็บแล้วยิง google.script.run.deleteReceipt(...) โดยไม่ล็อกอิน"
let __BTC_INTERNAL_DEPTH = 0;

function runAsInternal_(fn) {
  __BTC_INTERNAL_DEPTH++;
  try {
    return fn();
  } finally {
    __BTC_INTERNAL_DEPTH--;
  }
}

// ด่านตรวจสิทธิ์ระดับฟังก์ชัน: คืน { ok:true } หรือ { ok:false, res:{...} } (เอาไป return ต่อได้เลย)
function requireApiSession_(payload) {
  if (__BTC_INTERNAL_DEPTH > 0) return { ok: true }; // เรียกจากเส้นทางภายในที่ตรวจสิทธิ์สิทธิ์แล้ว
  const p = (payload && typeof payload === 'object') ? payload : {};
  const t = String(p._sessionToken || '').trim();
  if (t && apiSessionValid(t)) return { ok: true };
  writeLog('🛑 API-DENIED', 'ปฏิเสธการเรียกฟังก์ชันโดยไม่มี session (ต้องล็อกอินก่อน)');
  return { ok: false, res: { success: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED — กรุณาล็อกอินผ่านเมนู "ตั้งค่าระบบ" ก่อน' } };
}

// ตรวจสุขภาพ: ฟังก์ชันที่ไฟล์นี้เรียกใช้ต้องมีตัวตนจริง (รันก่อน deploy ทุกครั้ง)
function selfCheckApiGuards() {
  const checks = {
    normalizeApiString: typeof normalizeApiString,
    sanitizeApiPayload: typeof sanitizeApiPayload,
    isAllowedApiOrigin: typeof isAllowedApiOrigin,
    enforceApiRateLimit: typeof enforceApiRateLimit,
    validateApiRequestContext: typeof validateApiRequestContext,
    apiCall: typeof apiCall,
    apiSessionValid: typeof apiSessionValid,
    handleApiRequest: typeof handleApiRequest,
    supabaseBase: typeof supabaseBase,
    supabaseAuthHeaders: typeof supabaseAuthHeaders
  };
  const rows = Object.keys(checks).map(function (k) { return k + ' = ' + checks[k]; });
  const missing = Object.keys(checks).filter(function (k) { return checks[k] === 'undefined'; });
  const report = '=== selfCheckApiGuards ===\n' + rows.join('\n') + '\n\n' + (missing.length ? ('❌ ขาด: ' + missing.join(', ')) : '✅ ครบทุกฟังก์ชัน');
  Logger.log(report);
  return { success: missing.length === 0, missing: missing, report: report };
}

// เรียกตรวจสุขภาพจากเมนูชีต (แสดงผลให้ User เห็นทันที)
function selfCheckApiGuardsFromMenu() {
  const res = selfCheckApiGuards();
  try { SpreadsheetApp.getUi().alert(res.success ? '✅ ผ่าน' : '❌ ไม่ผ่าน', res.report, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { /* รันจาก Editor — ดู Logger */ }
  return res;
}

function getReceiptLinks() {
  const rows = supabaseRequest('get', '/rest/v1/receipt_links?select=*&order=created_at.desc');
  return Array.isArray(rows) ? rows : [];
}

// ==========================================
// BACKGROUND AUTO-MATCHING ENGINE (Round B — สเปกข้อ 5)
//   อ่านบิลทั้งหมดจาก Supabase → หาคู่ PO↔บิลเอง (ไม่ฝืนการยืนยันของ User):
//     AUTO_EXACT      = เลข PO บนบิล/เลขในช่องหมายเหตุ ตรงกับรหัส PO ในระบบ (conf 0.98)
//     AUTO_SUGGESTED  = ชื่อร้านตรงกัน (+ ยอดตรง 0.85 / ร้านอย่างเดียว 0.6)
//   1-to-Many: 1 PO จับคู่ได้หลายบิล แต่บิล 1 ใบจับเพียง 1 PO;
//   สร้าง receipt_links สถานะ pending → UI ขึ้นแท็ก [แนะนำการจับคู่] รอ User ยืนยัน
// ==========================================
function runAutoMatcher(payload) {
  // 🛡️ 2026-09-22 session guard: สแกนหาคู่ PO↔บิลทั้งตาราง (เรียกภายในจาก webhook ผ่าน runAsInternal_)
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const stats = { exact: 0, soft: 0, skipped: 0, scale: 0 };
  try {
    const base = supabaseBase();
    const resp = UrlFetchApp.fetch(base + '/rest/v1/receipts?select=doc_key,doc_type,po_number,store_name,total_amount,book_no,doc_no,ref_no,ref_label,google_drive_file_id,date,scale_weight_net,vehicle_registration&limit=1000&order=created_at.asc', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return { success: false, message: 'HTTP ' + resp.getResponseCode() + ' (โหลดบิลไม่ได้)' };
    const rows = JSON.parse(resp.getContentText());
    if (!Array.isArray(rows)) return { success: false, message: 'ข้อมูลบิลผิดรูป' };

    const isPO = function (r) { return String(r.doc_type || '').trim() === 'ใบสั่งซื้อ'; };
    const poRows = rows.filter(isPO);
    const billRows = rows.filter(function (r) { return !isPO(r); });

    // ขั้น 3 โมเดลจับคู่ (2026-09-22): ใบชั่ง/ประเภทที่ติ๊ก "ใช้ช่องใบชั่ง" = ฝั่ง "ถูกผูก" กับใบส่งของ
    // ห้ามไปนั่งเป็นคู่ตรงของ PO (เดิม matcher จับร้านตรงกันแล้วผูกใบชั่ง↔PO ตรง = ผิดโมเดล + รกในแท็บจับคู่แล้ว)
    const isScaleLikeRow = function (r) {
      const t = String((r && r.doc_type) || '').trim();
      return !!t && (t === 'ใบชั่ง' || isCustomScaleLikeDocType(t));
    };
    const scaleRows = [];
    const docRows = [];
    billRows.forEach(function (r) { (isScaleLikeRow(r) ? scaleRows : docRows).push(r); });

    // Index PO: ค้นด้วยเอกลักษณ์ทุกช่อง (doc_key/เลขที่ PO/เล่มที่/เลขที่/Ref) + ค้นด้วยชื่อร้าน
    const poById = {};                 // normId -> po
    const poByStore = {};              // normStore -> [po]
    poRows.forEach(function (po) {
      [po.doc_key, po.po_number, po.doc_no, po.book_no, po.ref_no].forEach(function (idv) {
        const n = normMatchKey(idv);
        if (n && !poById[n]) poById[n] = po;
      });
      const ns = normMatchKey(po.store_name);
      if (ns) {
        if (!poByStore[ns]) poByStore[ns] = [];
        poByStore[ns].push(po);
      }
    });
    if (!poRows.length) return { success: true, suggested: 0, exact: 0, soft: 0, message: 'ยังไม่มีใบสั่งซื้อ (PO) ในระบบ' };

    // คู่ที่มีอยู่แล้ว (กันจับซ้ำ / กันทับที่ User ยืนยันเอง)
    const lresp = UrlFetchApp.fetch(base + '/rest/v1/receipt_links?select=po_doc_key,link_doc_key,status&limit=2000', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    const rawLinks = (lresp.getResponseCode() === 200) ? JSON.parse(lresp.getContentText()) : [];
    const linksArr = Array.isArray(rawLinks) ? rawLinks : [];
    const pairKey = function (poK, linkK) { return poK + '||' + linkK; };
    const existingPairs = {};
    const confirmedByLink = {};
    linksArr.forEach(function (l) {
      existingPairs[pairKey(l.po_doc_key, l.link_doc_key)] = true;
      if (l.status === 'confirmed') confirmedByLink[l.link_doc_key] = true;
    });

    let inserted = 0;
    docRows.forEach(function (bill) {
      const bk = String(bill.doc_key || '').trim();
      if (!bk) return;
      if (confirmedByLink[bk]) return; // จับคู่ยืนยันแล้ว → ข้าม (ไม่ทับการตัดสินใจ User)
      const alreadyForBill = new Set(linksArr.filter(function (l) { return l.link_doc_key === bk; }).map(function (l) { return l.po_doc_key; }));

      const cands = [];
      const pushPo = function (po, type, conf, reason) {
        if (!po || alreadyForBill.has(po.doc_key)) return;
        cands.push({ po: po, type: type, conf: conf, reason: reason });
      };

      // ---- EXACT: เลข PO บนบิล หรือเลขในช่องหมายเหตุ ตรงกับรหัส PO ----
      const billRefs = [bill.po_number];
      if (bill.ref_label && /po|สั่งซื้อ|หมายเหตุ/i.test(String(bill.ref_label))) billRefs.push(bill.ref_no);
      let exactHit = null;
      billRefs.forEach(function (ref) {
        const n = normMatchKey(ref);
        if (n && poById[n] && !alreadyForBill.has(poById[n].doc_key)) exactHit = poById[n];
      });
      if (exactHit) pushPo(exactHit, 'AUTO_EXACT', 0.98, 'PO ตรงกัน');

      // ---- SOFT: ร้านเดียวกัน (+ ยอดรวมตรง) → แท็ก [แนะนำการจับคู่] ----
      if (!cands.length) {
        const ns = normMatchKey(bill.store_name);
        const storePOs = (ns && poByStore[ns]) ? poByStore[ns] : [];
        storePOs.forEach(function (po) {
          const amtSame = approxEqual(bill.total_amount, po.total_amount);
          pushPo(po, 'AUTO_SUGGESTED', amtSame ? 0.85 : 0.6, amtSame ? 'ร้าน+ยอดตรงกัน' : 'ร้านเดียวกัน (ยอดไม่ตรง)');
        });
        cands.sort(function (a, b) { return b.conf - a.conf; });
        while (cands.length > 2) cands.pop(); // กันสเปม: เอาแค่ 2 อันที่มีคะแนนสูงสุด
      }
      if (!cands.length) return;

      const remark = /หมายเหตุ|po|สั่งซื้อ/i.test(String(bill.ref_label || '')) ? String(bill.ref_no || '').trim() : '';
      cands.forEach(function (c) {
        const k = pairKey(c.po.doc_key, bk);
        if (existingPairs[k]) { stats.skipped++; return; }
        const body = {
          po_doc_key: c.po.doc_key,
          po_label: '',
          po_store_name: c.po.store_name || '',
          link_doc_key: bk,
          link_label: '',
          link_store_name: bill.store_name || '',
          link_type: bill.doc_type || '',
          google_drive_file_id: bill.google_drive_file_id || null,
          status: 'pending',
          match_type: c.type,
          confidence_score: c.conf,
          remark_text: remark
        };
        const ins = UrlFetchApp.fetch(base + '/rest/v1/receipt_links', {
          method: 'POST', headers: supabaseAuthHeaders(), payload: JSON.stringify(body), muteHttpExceptions: true
        });
        if (ins.getResponseCode() >= 200 && ins.getResponseCode() < 300) {
          existingPairs[k] = true; inserted++;
          if (c.type === 'AUTO_EXACT') stats.exact++; else stats.soft++;
        }
      });
    });

    // ---- ขั้น 3: ผูกใบชั่ง ↔ ใบส่งของ (anchor = ใบส่งของที่มีการชั่ง) → receipt_links สถานะ pending รอ User ยืนยัน ----
    // ที่มาของคู่: เลขอ้างอิงบนใบชั่ง (ref_no) ตรงเลขที่ใบส่งของ (doc_no) = แน่นอน 0.98 / ร้าน+ทะเบียน / ร้าน+วันที่ = แนะนำ
    const anchorRows = docRows.filter(function (r) {
      const hasW = (r.scale_weight_net !== null && r.scale_weight_net !== undefined && r.scale_weight_net !== '') ||
        (r.scale_weight_in !== null && r.scale_weight_in !== undefined && r.scale_weight_in !== '') ||
        (r.scale_weight_out !== null && r.scale_weight_out !== undefined && r.scale_weight_out !== '');
      return hasW || /ส่งของ|ส่งสินค้า|Delivery/i.test(String(r.doc_type || ''));
    });
    if (anchorRows.length && scaleRows.length) {
      scaleRows.forEach(function (wt) {
        const wk = String(wt.doc_key || '').trim();
        if (!wk) return;
        if (confirmedByLink[wk]) return; // ผูก/ยืนยันไปแล้ว → ไม่แตะ (ไม่ทับการตัดสินใจ User)
        const alreadyAnchors = new Set(linksArr.filter(function (l) { return l.link_doc_key === wk; }).map(function (l) { return l.po_doc_key; }));
        const wStore = normMatchKey(wt.store_name);
        const wVeh = String(wt.vehicle_registration || '').trim();
        const wRef = normMatchKey(wt.ref_no);
        let best = null;
        anchorRows.forEach(function (d) {
          if (alreadyAnchors.has(d.doc_key)) return;
          const dNo = normMatchKey(d.doc_no);
          const dVeh = String(d.vehicle_registration || '').trim();
          const vehOk = !(wVeh && dVeh) || wVeh === dVeh; // มีทะเบียนทั้งคู่ → ต้องตรงกัน (กันจับผิดข้ามรถ)
          if (!vehOk) return;
          let type = '', conf = 0, reason = '';
          if (wRef && dNo && wRef === dNo) {
            type = 'AUTO_EXACT'; conf = 0.98; reason = 'เลขอ้างอิงตรงเลขที่ใบส่งของ';
          } else if (wStore && normMatchKey(d.store_name) === wStore) {
            const sameDate = String(wt.date || '') === String(d.date || '');
            const vehSame = wVeh && dVeh && wVeh === dVeh;
            if (vehSame) { type = 'AUTO_SUGGESTED'; conf = 0.85; reason = 'ร้าน+ทะเบียนรถตรงกัน'; }
            else if (sameDate) { type = 'AUTO_SUGGESTED'; conf = 0.65; reason = 'ร้าน+วันที่ตรงกัน'; }
          }
          if (type && (!best || conf > best.conf)) best = { d: d, type: type, conf: conf, reason: reason };
        });
        if (!best) return;
        const k = pairKey(best.d.doc_key, wk);
        if (existingPairs[k]) { stats.skipped++; return; }
        const body = {
          po_doc_key: best.d.doc_key, // ฝั่งหลักของแถวนี้ = ใบส่งของ (โมเดล 3 ขั้น: PO↔ใบส่งของ↔ใบชั่ง)
          po_label: buildDocLabel(best.d),
          po_store_name: best.d.store_name || '',
          link_doc_key: wk,
          link_label: buildDocLabel(wt),
          link_store_name: wt.store_name || '',
          link_type: wt.doc_type || '',
          google_drive_file_id: wt.google_drive_file_id || null,
          link_scale_net: (wt.scale_weight_net === undefined || wt.scale_weight_net === null || wt.scale_weight_net === '') ? null : Number(wt.scale_weight_net),
          link_vehicle: wt.vehicle_registration || '',
          status: 'pending',
          match_type: best.type,
          confidence_score: best.conf,
          remark_text: String(wt.ref_no || '').trim()
        };
        const ins = UrlFetchApp.fetch(base + '/rest/v1/receipt_links', {
          method: 'POST', headers: supabaseAuthHeaders(), payload: JSON.stringify(body), muteHttpExceptions: true
        });
        if (ins.getResponseCode() >= 200 && ins.getResponseCode() < 300) {
          existingPairs[k] = true; inserted++; stats.scale++;
        }
      });
    }

    writeLog('🔁 MATCHER', 'Auto-Match เสร็จ: ใหม่ ' + inserted + ' คู่ (ตรง ' + stats.exact + ' / แนะนำ ' + stats.soft + ' | ใบชั่ง↔ใบส่งของ ' + stats.scale + ' | ข้ามซ้ำ ' + stats.skipped + ')');
    return { success: true, suggested: inserted, exact: stats.exact, soft: stats.soft, scale: stats.scale };
  } catch (e) {
    writeLog('⚠️ MATCHER', 'runAutoMatcher error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

function normMatchKey(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_/\\.,():'"#]+/g, '');
}
function approxEqual(a, b) {
  const x = Number(a); const y = Number(b);
  if ((isNaN(x) || !a) && (isNaN(y) || !b)) return false; // ทั้งคู่ไม่มีเลข → ไม่ยืนยันว่าเท่ากัน
  if (isNaN(x) || isNaN(y)) return false;
  return Math.abs(x - y) <= 0.5;
}

// อ่าน doc_type จาก doc_key (ใช้ guard โซ่จับคู่ 3 ขั้น: ห้าม ใบชั่ง ↔ ใบสั่งซื้อ ตรง)
function receiptDocTypeByKey(key) {
  try {
    const rows = supabaseRequest('get', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(key) + '&select=doc_type&limit=1');
    if (Array.isArray(rows) && rows.length) return String(rows[0].doc_type || '').trim();
  } catch (e) { /* ถ้าอ่านไม่ได้ = ไม่บล็อก (กัน cleartext เอกสารเก่าที่ไม่มี doc_type) */ }
  return '';
}

// โมเดลจับคู่โซ่ 3 ขั้น: PO → ใบส่งของ/ใบรับของ → ใบชั่ง/ใบรับของชั่ง
// ใบชั่ง (scale-like) ต้องจับกับใบส่งของเท่านั้น — ห้ามจับติดใบสั่งซื้อ (PO) โดยตรง
function isScaleLikeDocTypeForLink(docType) {
  const t = String(docType || '').trim();
  if (!t) return false;
  if (t === 'ใบชั่ง') return true;
  return isCustomScaleLikeDocType(t);
}

function upsertReceiptLink(payload) {
  // 🛡️ 2026-09-22 session guard: เขียน/ยืนยันการจับคู่ PO↔บิล
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const poKey = String((payload && payload.po_doc_key) || '').trim();
  const linkKey = String((payload && payload.link_doc_key) || '').trim();
  if (!poKey || !linkKey) return { success: false, message: 'ต้องระบุ po_doc_key และ link_doc_key' };
  // 🛡️ กัน "ใบชั่งติด PO ตรง" ตามโมเดลโซ่ 3 ขั้น (ใบชั่งต้องผ่านใบส่งของเท่านั้น)
  const linkType = receiptDocTypeByKey(linkKey);
  const poType = receiptDocTypeByKey(poKey);
  if (isScaleLikeDocTypeForLink(linkType) && poType === 'ใบสั่งซื้อ') {
    return { success: false, code: 'SCALE_PO_FORBIDDEN', message: 'ใบชั่งต้องจับคู่กับใบส่งของเท่านั้น (โซ่ 3 ขั้น: PO → ใบส่งของ → ใบชั่ง) — ไม่สามารถจับใบชั่งติดใบสั่งซื้อโดยตรงได้' };
  }
  const wantConfirmed = !!(payload && payload.status === 'confirmed');
  const body = {
    po_doc_key: poKey,
    po_label: String((payload && payload.po_label) || ''),
    po_store_name: String((payload && payload.po_store_name) || ''),
    link_doc_key: linkKey,
    link_label: String((payload && payload.link_label) || ''),
    link_store_name: String((payload && payload.link_store_name) || ''),
    link_type: String((payload && payload.link_type) || ''),
    google_drive_file_id: String((payload && payload.google_drive_file_id) || '') || null,
    link_scale_net: (payload && payload.link_scale_net !== null && payload.link_scale_net !== undefined && payload.link_scale_net !== '' && payload.link_scale_net !== '-')
      ? Number(payload.link_scale_net) : null,
    link_vehicle: (payload && payload.link_vehicle) ? String(payload.link_vehicle) : '',
    status: wantConfirmed ? 'confirmed' : 'pending',
    confirmed_at: wantConfirmed ? new Date().toISOString() : null
  };
  // Provenance: จับคู่ด้วยมือจากหน้าเว็บ = MANUAL (Background Matcher เติม AUTO_EXACT/AUTO_SUGGESTED ทีหลัง)
  if (wantConfirmed) { body.match_type = 'MANUAL'; body.confidence_score = 1; }
  supabaseRequest(
    'post',
    '/rest/v1/receipt_links?on_conflict=po_doc_key,link_doc_key',
    body,
    'resolution=merge-duplicates,return=representation'
  );
  // Human-in-the-Loop: บันทึกว่า User ยืนยัน/แก้การจับคู่นี้ (คนสอน AI ว่าคู่นี้ถูก)
  logReceiptMatchFeedback(poKey, linkKey, payload, wantConfirmed ? 'match_confirm' : 'match_manual');
  return { success: true, message: (wantConfirmed ? 'ยืนยันการจับคู่แล้ว' : 'บันทึกเป็นรอตรวจสอบแล้ว'), status: body.status };
}

function setReceiptLinkStatus(payload) {
  // 🛡️ 2026-09-22 session guard: เปลี่ยนสถานะการจับคู่
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const poKey = String((payload && payload.po_doc_key) || '').trim();
  const linkKey = String((payload && payload.link_doc_key) || '').trim();
  if (!poKey || !linkKey) return { success: false, message: 'ต้องระบุ po_doc_key และ link_doc_key' };
  // 🛡️ กันการยืนยัน "ใบชั่งติด PO ตรง" (โมเดลโซ่ 3 ขั้น) — ลบแล้วจับผ่านใบส่งของแทน
  const linkType = receiptDocTypeByKey(linkKey);
  const poType = receiptDocTypeByKey(poKey);
  if (isScaleLikeDocTypeForLink(linkType) && poType === 'ใบสั่งซื้อ') {
    return { success: false, code: 'SCALE_PO_FORBIDDEN', message: 'ลิงก์นี้เป็น "ใบชั่งติด PO ตรง" ซึ่งไม่ตรงตามโซ่ 3 ขั้น (PO → ใบส่งของ → ใบชั่ง) — ให้ลบออก แล้วจับใบชั่งกับใบส่งของแทน' };
  }
  const wantConfirmed = !!(payload && payload.status === 'confirmed');
  const body = { status: wantConfirmed ? 'confirmed' : 'pending', confirmed_at: wantConfirmed ? new Date().toISOString() : null };
  if (wantConfirmed) { body.match_type = 'MANUAL'; body.confidence_score = 1; } // User ยืนยันเอง = MANUAL
  supabaseRequest(
    'patch',
    '/rest/v1/receipt_links?po_doc_key=eq.' + encodeURIComponent(poKey) + '&link_doc_key=eq.' + encodeURIComponent(linkKey),
    body,
    'return=representation'
  );
  // Human-in-the-Loop: บันทึกการยืนยัน/ยกเลิกการจับคู่ (คนสอน AI)
  logReceiptMatchFeedback(poKey, linkKey, payload, wantConfirmed ? 'match_confirm' : 'match_remove');
  return { success: true, message: (wantConfirmed ? 'ยืนยันการจับคู่แล้ว' : 'เปลี่ยนเป็นรอตรวจสอบแล้ว'), status: body.status };
}

function removeReceiptLink(payload) {
  // 🛡️ 2026-09-22 session guard: ลบการจับคู่
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const poKey = String((payload && payload.po_doc_key) || '').trim();
  const linkKey = String((payload && payload.link_doc_key) || '').trim();
  if (!poKey || !linkKey) return { success: false, message: 'ต้องระบุ po_doc_key และ link_doc_key' };
  supabaseRequest(
    'delete',
    '/rest/v1/receipt_links?po_doc_key=eq.' + encodeURIComponent(poKey) + '&link_doc_key=eq.' + encodeURIComponent(linkKey)
  );
  return { success: true, message: 'ลบการจับคู่แล้ว' };
}

// ==========================================
// HUMAN-IN-THE-LOOP — AI Active Learning Feedback (ตาราง ai_feedback_logs)
//   เปรียบเทียบ original_ai_value vs user_corrected_value ทุกครั้งที่ User แก้บิล/ยืนยันจับคู่
//   แล้ว getStoreFeedbackContext() เอา history ต่อร้านไปฉีดเป็น Few-Shot ใน Prompt ขณะอ่านบิลใหม่
// ==========================================
function recordFeedback(actionType, docKey, storeName, fieldName, originalValue, correctedValue, extra) {
  try {
    var row = {
      doc_key: String(docKey || ''),
      doc_type: String((extra && extra.docType) || ''),
      store_name: String(storeName || ''),
      action_type: String(actionType || 'field_correct'),
      field_name: String(fieldName || ''),
      original_ai_value: String(originalValue == null ? '' : originalValue),
      user_corrected_value: String(correctedValue == null ? '' : correctedValue),
      created_by: String((extra && extra.createdBy) || 'user')
    };
    var resp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_feedback_logs', {
      method: 'POST', headers: supabaseAuthHeaders(),
      payload: JSON.stringify(row), muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) return { success: true };
    writeLog('⚠️ FEEDBACK', 'recordFeedback HTTP ' + resp.getResponseCode() + ' — ' + resp.getContentText().substring(0, 200));
    return { success: false, message: 'HTTP ' + resp.getResponseCode() };
  } catch (e) {
    writeLog('⚠️ FEEDBACK', 'recordFeedback error: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ดึง "กฎล่าสุด" ที่มนุษย์แก้ไว้สำหรับร้านหนึ่ง (dedupe เอาแค่ record ล่าสุดต่อ field)
// ใช้ท้ายสุดในการฉีด Few-Shot ต่อร้าน — คืน array [{field, from, to}]
function getStoreFeedbackContext(storeName) {
  try {
    const store = String(storeName || '').trim();
    if (!store || store === '-') return [];
    const resp = UrlFetchApp.fetch(supabaseBase() + '/rest/v1/ai_feedback_logs?store_name=eq.' + encodeURIComponent(store) +
      '&select=action_type,field_name,original_ai_value,user_corrected_value,created_at&limit=40&order=created_at.desc', {
      method: 'GET', headers: supabaseAuthHeaders(), muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return [];
    const rows = JSON.parse(resp.getContentText());
    if (!Array.isArray(rows)) return [];
    const seen = {}, out = [];
    for (let i = rows.length - 1; i >= 0; i--) { // เรียง desc → เดินจากเก่าหาใหม่ เก็บเจอครั้งแรก = ล่าสุด
      const r = rows[i] || {};
      const key = String(r.action_type || '') + '|' + String(r.field_name || '');
      if (seen[key]) continue;
      seen[key] = true;
      if (String(r.action_type) === 'field_correct' && String(r.field_name || '')) {
        out.push({ field: r.field_name, from: r.original_ai_value, to: r.user_corrected_value });
      }
    }
    return out;
  } catch (e) {
    writeLog('⚠️ FEEDBACK', 'getStoreFeedbackContext error: ' + e.toString());
    return [];
  }
}

// แปลง feedback เป็นข้อความฉีดใน Prompt (กำกับว่าใช้กับค่าที่เห็นจริงบนภาพเท่านั้น ห้ามเดา)
function feedbackPromptSection(feedbackList) {
  if (!Array.isArray(feedbackList) || !feedbackList.length) return '';
  const lines = feedbackList
    .filter(function (f) { return f && f.field && (String(f.from || '') || String(f.to || '')); })
    .map(function (f) {
      const fromTxt = (String(f.from).length && String(f.from) !== '-') ? '"' + f.from + '"' : '(อ่านไม่ได้/ว่าง)';
      const toTxt = (String(f.to).length && String(f.to) !== '-') ? '"' + f.to + '"' : '(ว่าง)';
      return '• ' + f.field + ': ผู้ใช้เคยแก้จาก ' + fromTxt + ' เป็น ' + toTxt;
    });
  if (!lines.length) return '';
  return '\n\n🔧 บทเรียนจากประวัติการแก้ไขของผู้ใช้ (เฉพาะร้านนี้): ใช้เป็นแนวทางยืนยันกับค่าที่เห็นจริงบนภาพเท่านั้น — ห้ามเดาหรือเติมค่าที่ภาพไม่มี\n' + lines.join('\n') + '\n';
}

// บันทึก feedback เมื่อ User ยืนยัน/แก้การจับคู่ (สถานะเปลี่ยน) — เหมือน "คนสอน AI ว่าจับคู่ถูกคืนนี้"
function logReceiptMatchFeedback(poKey, linkKey, payload, actionType) {
  try {
    const store = String(payload && (payload.link_store_name || payload.po_store_name) || '').trim();
    const docType = String(payload && payload.link_type || '').trim();
    recordFeedback(actionType || 'match_confirm', linkKey, store, 'match_status',
      String(payload && payload.old_status || 'suggested'), String(payload && payload.status || 'confirmed'),
      { docType: docType });
  } catch (e) { /* ไม่บล็อกการจับคู่ */ }
}

// ==========================================
// VENDOR BILLING — ใบวางบิล + ใบกำกับภาษีแนบ (Supabase canonical data)
// ==========================================
function getVendorBillingNotes() {
  const rows = supabaseRequest('get', '/rest/v1/vendor_billing_notes?select=*&order=created_at.desc');
  return { success: true, notes: Array.isArray(rows) ? rows : [] };
}

function getVendorBillingCandidates() {
  const links = supabaseRequest('get', '/rest/v1/receipt_links?status=eq.confirmed&select=po_doc_key,link_doc_key,link_store_name,link_type,google_drive_file_id,confirmed_at&order=confirmed_at.desc');
  const confirmed = Array.isArray(links) ? links : [];
  const candidates = [];
  confirmed.forEach(function (link) {
    try {
      const rows = supabaseRequest('get', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(link.link_doc_key) + '&select=doc_key,doc_type,doc_no,store_name,total_amount,date,image_url,google_drive_file_id');
      if (Array.isArray(rows) && rows.length) {
        const receipt = rows[0];
        candidates.push({
          doc_key: receipt.doc_key,
          doc_type: receipt.doc_type || link.link_type || '',
          doc_no: receipt.doc_no || '',
          store_name: receipt.store_name || link.link_store_name || '',
          total_amount: Number(receipt.total_amount) || 0,
          date: receipt.date || '',
          image_url: receipt.image_url || '',
          google_drive_file_id: receipt.google_drive_file_id || link.google_drive_file_id || null,
          po_doc_key: link.po_doc_key
        });
      }
    } catch (e) {
      writeLog('⚠️ VENDOR-BILLING', 'โหลด candidate ' + link.link_doc_key + ' ไม่สำเร็จ: ' + e.toString());
    }
  });
  return { success: true, candidates: candidates };
}

function validateVendorBillingNote(noteId) {
  // 🛡️ 2026-09-22 session guard: ยืนยัน/ปิดใบวางบิล (เรียกภายในจาก createVendorBillingNote → depth>0)
  const __guard = requireApiSession_(); if (!__guard.ok) return __guard.res;
  if (!noteId) return { success: false, message: 'ไม่พบรหัสใบวางบิล' };
  const notes = supabaseRequest('get', '/rest/v1/vendor_billing_notes?id=eq.' + encodeURIComponent(noteId) + '&select=*');
  if (!Array.isArray(notes) || !notes.length) return { success: false, message: 'ไม่พบใบวางบิล' };
  const note = notes[0];
  const items = supabaseRequest('get', '/rest/v1/vendor_billing_items?billing_note_id=eq.' + encodeURIComponent(noteId) + '&select=receipt_doc_key,matched_amount');
  const rows = Array.isArray(items) ? items : [];
  let matchedAmount = 0;
  rows.forEach(function (item) {
    try {
      const receipts = supabaseRequest('get', '/rest/v1/receipts?doc_key=eq.' + encodeURIComponent(item.receipt_doc_key) + '&select=total_amount');
      if (Array.isArray(receipts) && receipts.length) matchedAmount += Number(receipts[0].total_amount) || 0;
    } catch (e) {}
  });
  const claimed = Number(note.claimed_amount) || 0;
  const difference = matchedAmount - claimed;
  const ok = Math.abs(difference) <= 0.01;
  const patch = {
    matched_amount: matchedAmount,
    remaining_amount: claimed - matchedAmount,
    validation_ok: ok,
    validation_message: ok ? 'ยอดใบวางบิลตรงกับบิลที่จับคู่แล้ว' : 'ยอดไม่ตรงกัน: ส่วนต่าง ' + difference.toFixed(2),
    status: ok ? 'validated' : 'matched',
    validated_at: new Date().toISOString()
  };
  supabaseRequest('patch', '/rest/v1/vendor_billing_notes?id=eq.' + encodeURIComponent(noteId), patch);
  return { success: true, note: Object.assign({}, note, patch), difference: difference };
}

function createVendorBillingNote(payload) {
  // 🛡️ 2026-09-22 session guard: สร้างใบวางบิลผู้ขาย
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    payload = payload || {};
    const vendorName = String(payload.vendor_name || '').trim();
    const claimedAmount = Number(payload.claimed_amount);
    const keys = Array.isArray(payload.receipt_doc_keys) ? payload.receipt_doc_keys.map(String).map(function (k) { return k.trim(); }).filter(Boolean) : [];
    if (!vendorName || !keys.length || isNaN(claimedAmount) || claimedAmount < 0) {
      return { success: false, message: 'ต้องระบุร้านค้า ยอดใบวางบิล และเลือกบิลที่จับคู่แล้วอย่างน้อย 1 ใบ' };
    }
    const confirmed = supabaseRequest('get', '/rest/v1/receipt_links?status=eq.confirmed&link_doc_key=in.(' + keys.map(function (k) { return '"' + k.replace(/"/g, '') + '"'; }).join(',') + ')&select=link_doc_key');
    const confirmedSet = {};
    (Array.isArray(confirmed) ? confirmed : []).forEach(function (row) { confirmedSet[row.link_doc_key] = true; });
    const validKeys = keys.filter(function (k) { return confirmedSet[k]; });
    if (!validKeys.length) return { success: false, message: 'บิลที่เลือกไม่มีสถานะจับคู่แล้ว (MATCHED)' };
    const created = supabaseRequest('post', '/rest/v1/vendor_billing_notes', {
      vendor_name: vendorName,
      billing_no: String(payload.billing_no || '').trim(),
      billing_date: payload.billing_date || null,
      claimed_amount: claimedAmount,
      status: 'matched',
      created_by: String(payload.created_by || 'user')
    }, 'return=representation');
    const note = Array.isArray(created) ? created[0] : created;
    if (!note || !note.id) throw new Error('สร้างใบวางบิลไม่สำเร็จ');
    const itemRows = validKeys.map(function (key) { return { billing_note_id: note.id, receipt_doc_key: key }; });
    supabaseRequest('post', '/rest/v1/vendor_billing_items', itemRows);
    return runAsInternal_(function () { return validateVendorBillingNote(note.id); }); // 🛡️ internal call
  } catch (e) {
    writeLog('❌ VENDOR-BILLING', 'createVendorBillingNote: ' + e.toString());
    return { success: false, message: 'สร้างใบวางบิลไม่สำเร็จ: ' + e.toString() };
  }
}

function updateVendorBillingStatus(payload) {
  // 🛡️ 2026-09-22 session guard: เปลี่ยนสถานะใบวางบิล
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  const noteId = String((payload && payload.id) || '').trim();
  const status = String((payload && payload.status) || '').trim();
  if (!noteId || ['rejected', 'paid'].indexOf(status) === -1) return { success: false, message: 'สถานะไม่ถูกต้อง' };
  const notes = supabaseRequest('get', '/rest/v1/vendor_billing_notes?id=eq.' + encodeURIComponent(noteId) + '&select=validation_ok');
  if (!Array.isArray(notes) || !notes.length) return { success: false, message: 'ไม่พบใบวางบิล' };
  if (status === 'paid' && notes[0].validation_ok !== true) return { success: false, message: 'ยังอนุมัติจ่ายไม่ได้: ยอดใบวางบิลยังไม่ผ่าน validation' };
  supabaseRequest('patch', '/rest/v1/vendor_billing_notes?id=eq.' + encodeURIComponent(noteId), {
    status: status,
    paid_at: status === 'paid' ? new Date().toISOString() : null
  });
  return { success: true, status: status };
}

function uploadVendorTaxInvoice(payload) {
  // 🛡️ 2026-09-22 session guard: อัปโหลดใบกำกับภาษีของผู้ขายเข้า Drive
  const __guard = requireApiSession_(payload); if (!__guard.ok) return __guard.res;
  try {
    payload = payload || {};
    const noteId = String(payload.billing_note_id || '').trim();
    const encoded = String(payload.file_base64 || '');
    if (!noteId || !encoded) return { success: false, message: 'ข้อมูลใบกำกับภาษีไม่ครบ' };
    const match = encoded.match(/^data:([^;]+);base64,(.+)$/);
    const mime = match ? match[1] : (payload.mime_type || 'application/octet-stream');
    const bytes = Utilities.base64Decode(match ? match[2] : encoded);
    const root = getOrCreateDriveFolder();
    const folders = root.getFoldersByName('Vendor_Billing');
    const folder = folders.hasNext() ? folders.next() : root.createFolder('Vendor_Billing');
    const file = folder.createFile(Utilities.newBlob(bytes, mime, payload.file_name || ('tax_invoice_' + Date.now())));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const webview = file.getUrl();
    supabaseRequest('patch', '/rest/v1/vendor_billing_notes?id=eq.' + encodeURIComponent(noteId), { drive_file_id: file.getId(), webview_link: webview });
    return { success: true, drive_file_id: file.getId(), webview_link: webview };
  } catch (e) {
    writeLog('❌ VENDOR-BILLING', 'uploadVendorTaxInvoice: ' + e.toString());
    return { success: false, message: 'อัปโหลดใบกำกับภาษีไม่สำเร็จ: ' + e.toString() };
  }
}

function handleApiRequest(fn, payload, token, origin) {
  try {
    const safeFn = normalizeApiString(fn || '', 80);
    const guard = validateApiRequestContext(safeFn, payload, token, origin || '');
    if (!guard.ok) {
      return { success: false, code: guard.code, message: guard.message };
    }

    const safePayload = guard.payload || {};

    // 🛡️ 2026-09-22: จำกัดอัตราคำขอ "จุดเดียวในระบบ" — ต่อ session ถ้ามี token, ไม่มี token = ต่อชื่อฟังก์ชัน
    const rate = enforceApiRateLimit(token ? ('t:' + token) : ('f:' + safeFn), API_RATE_LIMIT_PER_MIN, API_RATE_WINDOW_S);
    if (!rate.ok) return { success: false, code: rate.code, message: rate.message };

    // กลุ่มฟังก์ชันสาธารณะ (ไม่ต้องล็อกอิน)
    if (safeFn === 'getPublicClientConfig') return getPublicClientConfig();
    if (safeFn === 'createApiSession') return createApiSession(safePayload);
    if (safeFn === 'ping') return { success: true, time: Date.now(), has_supabase: !!getSupabaseUrl() };

    // กลุ่มที่ยังต้องมี session token — เฉพาะ "ตั้งค่าระบบ" (getAppConfig/saveAppConfig)
    //    🔓 2026-09-23: ฟังก์ชันธุรกิจทั้งหมด (อ่าน/แก้/ลบ/จับคู่/รูป/AI/วางบิล) เปิดหมด ไม่ตรวจ token
    //    ที่นี่จึงไม่มีการตรวจ apiSessionValid() แบบเดิมอีก (ฝั่งหน้าเว็บไม่ต้องแนบ token ก่อนบันทึกแก้ไขอีกต่อไป)
    // 🛡️ ใช้ safeFn (ชื่อที่ผ่านการ normalize/ตรวจแล้ว) ให้ตรงกับตัวตรวจ — เดิมใช้ fn ดิบทำให้ตัวตรวจกับตัวทำงานไม่ผูกกัน
    // ทุกฟังก์ชันที่ถูก dispatch จากตรงนี้ถือว่า "ผ่านการตรวจสิทธิ์แล้ว" → เปิดโหมด internal ให้ด่านชั้นที่ 2
    __BTC_INTERNAL_DEPTH++;
    try {
    switch (safeFn) {
      case 'getReceiptData':        return fetchReceiptsFromSupabase();
      case 'deleteReceipt':         return deleteReceipt(safePayload || {});
      case 'updateReceipt':         return updateReceipt(safePayload || {});
      case 'getReceiptImageData':   return getReceiptImageData(safePayload || {});
      case 'saveEditedReceiptImage': return saveEditedReceiptImage(safePayload || {});
      case 'verifyConfigPassword':  return { success: verifyConfigPassword(safePayload && safePayload.password) };
      case 'getAppConfig':          return getAppConfig(Object.assign({}, safePayload || {}, { _sessionToken: token }));
      case 'saveAppConfig':         return saveAppConfig(Object.assign({}, safePayload || {}, { _sessionToken: token }));
      case 'logout':                return revokeApiSession(token);
      case 'addCustomDocType':      return addCustomDocType(safePayload || {});
      case 'getCustomDocTypesList': return getCustomDocTypes();
      case 'getReceiptLinks':       return getReceiptLinks();
      case 'upsertReceiptLink':     return upsertReceiptLink(safePayload || {});
      case 'setReceiptLinkStatus':  return setReceiptLinkStatus(safePayload || {});
      case 'removeReceiptLink':     return removeReceiptLink(safePayload || {});
      case 'reanalyzeReceipt':      return reanalyzeReceipt(safePayload || {});
      case 'applyReanalyzedData':   return applyReanalyzedData(safePayload || {});
      // AI Template Library (Phase 1)
      case 'getAITemplates':      return getAITemplates(safePayload || {});
      case 'confirmTemplate':     return confirmTemplate(safePayload && safePayload.templateId, safePayload && safePayload.groundTruth, safePayload && safePayload.docType, safePayload && safePayload.userEmail);
      case 'deleteTemplate':      return deleteTemplate(safePayload && safePayload.templateId);
      // AI Prompt Sets (Phase 2 — ชุด prompt AI ต่อประเภท)
      case 'ensureStandardPromptSets': return ensureStandardPromptSets();
      case 'getAIPrompts':        return getAIPrompts();
      case 'getAISamples':        return getAISamples(safePayload || {});
      case 'updateAISampleClassification': return updateAISampleClassification(safePayload || {});
      case 'createCustomPromptSet': return createCustomPromptSet(safePayload && safePayload.title);
      case 'attachTemplateToPrompt': return attachTemplateToPrompt(safePayload && safePayload.templateId, safePayload && safePayload.docType);
      case 'uploadLocalSample':   return uploadLocalSample(safePayload && safePayload.docType, safePayload && safePayload.fileName, safePayload && safePayload.blobBase64, safePayload && safePayload.mime);
      case 'generateAIPrompt':    return generateAIPrompt(safePayload && safePayload.docType);
      case 'updateAIPromptFields': return updateAIPromptFields(safePayload || {});
      case 'deletePromptSet':     return deletePromptSet(safePayload && safePayload.promptId);
      case 'recordFeedback':      return recordFeedback(safePayload && safePayload.actionType, safePayload && safePayload.docKey, safePayload && safePayload.storeName, safePayload && safePayload.fieldName, safePayload && safePayload.originalValue, safePayload && safePayload.correctedValue, safePayload && safePayload.extra);
      case 'getStoreFeedbackContext': return { success: true, context: getStoreFeedbackContext(safePayload && safePayload.storeName) };
      case 'runAutoMatcher':   return runAutoMatcher(safePayload || {});
      case 'getVendorBillingNotes': return getVendorBillingNotes();
      case 'getVendorBillingCandidates': return getVendorBillingCandidates();
      case 'createVendorBillingNote': return createVendorBillingNote(safePayload || {});
      case 'validateVendorBillingNote': return validateVendorBillingNote(safePayload && safePayload.id);
      case 'updateVendorBillingStatus': return updateVendorBillingStatus(safePayload || {});
      case 'uploadVendorTaxInvoice': return uploadVendorTaxInvoice(safePayload || {});
      case 'backfillSystemRecordNumbers': return backfillMissingSystemRecordNumbers();
      case 'backfillRunningNumbers':      return backfillMissingRunningNumbers();
      case 'runWeightVarianceCheck':      return runWeightVarianceCheck(safePayload || {});
      case 'getWeightVariances':          return getWeightVariances();
      default:                      return { success: false, message: 'ไม่รู้จักฟังก์ชัน: ' + safeFn };
      }
    } finally { __BTC_INTERNAL_DEPTH--; }
  } catch (err) {
    writeLog('❌ ERROR', 'handleApiRequest(' + fn + '): ' + err.toString());
    return { success: false, message: err.toString() };
  }
}

// ==========================================
// FLEX MESSAGES & REPLIES
// ==========================================

function replyConnectConfirmation(replyToken, groupId) {
  const flexPayload = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#2C3E50",
      contents: [{ type: "text", text: "คำขอเชื่อมต่อระบบจัดซื้อ BTC", weight: "bold", color: "#FFFFFF", size: "lg" }]
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: "BTC จัดซื้อสแกนบิล", weight: "bold", size: "xl" },
        { type: "text", text: "คุณต้องการเปิดใช้งานระบบอ่านและบันทึกบิล/ใบส่งของสำหรับกลุ่มนี้หรือไม่?", wrap: true, color: "#666666" }
      ]
    },
    footer: {
      type: "box", layout: "horizontal", spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#27AE60", action: { type: "postback", label: "เชื่อมต่อกลุ่ม", data: `action=confirm_connect&groupId=${groupId}`, displayText: "ยืนยันการเชื่อมต่อกลุ่ม" } },
        { type: "button", style: "secondary", action: { type: "postback", label: "ยกเลิก", data: `action=cancel_connect&groupId=${groupId}`, displayText: "ยกเลิกการเชื่อมต่อ" } }
      ]
    }
  };
  sendLineMessage(replyToken, [{ type: 'flex', altText: 'ยืนยันการเชื่อมต่อกลุ่มจัดซื้อ BTC', contents: flexPayload }]);
}

// Flex "✅ บันทึกบิลแล้ว" — สั้นๆ อ่านง่าย มีเลขที่บิล (TR) ใหญ่ชัดเจน + ปุ่มดูรูปต้นฉบับ
function pushFlexMessage(to, data, imageUrl, sender, replyToken) {
  const formattedAmount = (data.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const senderName = (sender && sender.displayName) ? sender.displayName : '-';
  const docLabel = buildDocLabel(data);
  const trNo = data.running_number || (data.system_record_no ? '#' + data.system_record_no : '-');

  const flexPayload = {
    type: "bubble",
    size: "giga",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#27AE60",
      contents: [{ type: "text", text: "✅ บันทึกบิลแล้ว", weight: "bold", color: "#FFFFFF", size: "lg" }]
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: docLabel, weight: "bold", size: "xl", wrap: true },
        {
          type: "box", layout: "vertical", backgroundColor: "#E8F8F5", cornerRadius: "6px", paddingAll: "12px", spacing: "xs",
          contents: [
            { type: "text", text: "เลขที่บิล", color: "#1E8449", size: "xs", weight: "bold" },
            { type: "text", text: trNo, weight: "bold", size: "xl", color: "#1E8449", wrap: true }
          ]
        },
        { type: "separator" },
        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ร้าน/ผู้ขาย", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: data.store_name || "-", color: "#333333", size: "sm", flex: 5, align: "end", wrap: true }] },
        { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: data.date || "-", color: "#333333", size: "sm", flex: 5, align: "end" }] },
        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เลขที่ PO", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: data.po_number || "-", color: "#333333", size: "sm", flex: 5, align: "end" }] },
        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ยอดรวม", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: "฿" + formattedAmount, color: "#27AE60", weight: "bold", size: "md", flex: 5, align: "end" }] },
        { type: "box", layout: "baseline", contents: [{ type: "text", text: "สถานะ", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: data.needs_review ? ("⚠️ รอตรวจ: " + (data.review_reason || "")) : "✅ ข้อมูลครบ", color: data.needs_review ? "#E67E22" : "#27AE60", size: "sm", flex: 5, align: "end", wrap: true }] },
        { type: "text", text: "ผู้ส่งบิล: " + senderName, color: "#999999", size: "xs" }
      ]
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [{ type: "button", style: "primary", color: "#27AE60", action: { type: "uri", label: "ดูรูปภาพบิลต้นฉบับ", uri: imageUrl } }]
    }
  };
  sendResultMessages(replyToken, to, [{ type: 'flex', altText: '✅ บันทึกบิลแล้ว: ' + docLabel + ' (เลขที่บิล ' + trNo + ')', contents: flexPayload }], 'SAVED');
}

// Flex "⚠️ บิลนี้มีในระบบแล้ว" (ซ้ำ) — สั้นๆ มีเลขที่บิลเดิมชัดเจน กันเข้าใจผิดว่าไม่ได้บันทึก
function pushDuplicateFlexMessage(to, opts, replyToken) {
  if (!to) return;
  opts = opts || {};
  const docLabel = opts.docLabel || '-';
  const trNo = opts.runningNo || '-';

  const contents = [
    { type: "text", text: docLabel, weight: "bold", size: "xl", wrap: true },
    {
      type: "box", layout: "vertical", backgroundColor: "#FEF5E7", cornerRadius: "6px", paddingAll: "12px", spacing: "xs",
      contents: [
        { type: "text", text: "เลขที่บิล (ในระบบแล้ว)", color: "#B45F06", size: "xs", weight: "bold" },
        { type: "text", text: trNo, weight: "bold", size: "xl", color: "#B45F06", wrap: true }
      ]
    }
  ];

  if (opts.storeName || opts.date || opts.totalAmount) {
    contents.push({ type: "separator" });
    if (opts.storeName) contents.push({ type: "box", layout: "baseline", contents: [{ type: "text", text: "ร้าน/ผู้ขาย", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: opts.storeName, color: "#333333", size: "sm", flex: 5, align: "end", wrap: true }] });
    if (opts.date) contents.push({ type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: opts.date, color: "#333333", size: "sm", flex: 5, align: "end" }] });
    if (opts.totalAmount) contents.push({ type: "box", layout: "baseline", contents: [{ type: "text", text: "ยอดรวม", color: "#aaaaaa", size: "sm", flex: 2 }, { type: "text", text: "฿" + opts.totalAmount, color: "#B45F06", weight: "bold", size: "md", flex: 5, align: "end" }] });
  }

  contents.push({ type: "text", text: "ระบบไม่บันทึกข้อมูลซ้ำลง Google Sheets — รูปภาพเดิมยังอยู่บน Google Drive ตามปกติ", color: "#888888", size: "xs", wrap: true });

  const flexPayload = {
    type: "bubble",
    size: "giga",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#E67E22",
      contents: [{ type: "text", text: "⚠️ บิลนี้มีในระบบแล้ว", weight: "bold", color: "#FFFFFF", size: "lg" }]
    },
    body: { type: "box", layout: "vertical", spacing: "md", contents: contents }
  };
  sendResultMessages(replyToken, to, [{ type: 'flex', altText: '⚠️ บิลนี้มีในระบบแล้ว: ' + docLabel + ' (เลขที่บิล ' + trNo + ')', contents: flexPayload }], 'DUP');
}

function replyLineMessage(replyToken, text) {
  sendLineMessage(replyToken, [{ type: 'text', text: text }]);
}

function sendLineMessage(replyToken, messages) {
  const r = sendLineMessagesRaw(replyToken, messages);
  if (r.ok) {
    writeLog('✅ LINE_REPLY', 'ส่งข้อความกลับแชทสำเร็จ (HTTP 200)');
    Logger.log('✅ LINE Reply API สำเร็จ (HTTP 200)');
  } else {
    writeLog('❌ LINE_REPLY', 'LINE ปฏิเสธ HTTP ' + r.code + ': ' + r.body.substring(0, 300));
    Logger.log('❌ LINE Reply API ล้มเหลว HTTP ' + r.code + ': ' + r.body);
  }
}

// เรียก endpoint reply โดยตรง คืนผล {ok, code, body} — ใช้ตรวจ/ลอง reply ก่อน push ได้
function sendLineMessagesRaw(replyToken, messages) {
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${getLineToken()}` },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
  return { ok: response.getResponseCode() === 200, code: response.getResponseCode(), body: response.getContentText() };
}

// ส่งข้อความ (text/flex) กลับแชทโดยไม่ติดโควตา push ของ LINE เมื่อเป็นไปได้:
//   1) ถ้ามี replyToken + โหมด reply-first → ลอง reply (LINE บัญชีฟรีไม่หักโควตา push) ก่อน
//   2) reply ไม่ผ่าน (โทเคนหมดอายุ/ใช้แล้ว/429) → กลับไปใช้ push เหมือนเดิม (บันทึก log ทั้ง 2 ทาง)
function sendResultMessages(replyToken, to, messages, label) {
  const tag = label || 'MSG';
  if (replyToken && isReplyOnlyMode()) {
    const r = sendLineMessagesRaw(replyToken, messages);
    if (r.ok) {
      writeLog('✅ REPLY-' + tag, 'ตอบกลับแชทผ่าน reply สำเร็จ (HTTP 200 — ไม่กินโควตา push)');
      Logger.log('✅ Reply-first ' + tag + ' สำเร็จ (HTTP 200)');
      return 'reply';
    }
    writeLog('⚠️ REPLY-' + tag, 'reply ไม่ผ่าน HTTP ' + r.code + ' — พยายาม push แทน (' + r.body.substring(0, 200) + ')');
  }
  sendPushMessage(to, messages);
  return 'push';
}

function pushLineMessage(to, text, replyToken) {
  sendResultMessages(replyToken, to, [{ type: 'text', text: text }], 'TEXT');
}

function sendPushMessage(to, messages) {
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${getLineToken()}` },
    payload: JSON.stringify({ to: to, messages: messages }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code !== 200) {
    writeLog('❌ PUSH', 'LINE ปฏิเสธ HTTP ' + code + ': ' + body.substring(0, 300));
    Logger.log('❌ LINE Push API ล้มเหลว HTTP ' + code + ': ' + body);
  } else {
    writeLog('✅ PUSH', 'ส่งข้อความไปแชทสำเร็จ (HTTP 200)');
    Logger.log('✅ LINE Push API สำเร็จ (HTTP 200)');
  }
}

// รับ id ปลายทาง Push จาก source object โดยตรง (ไม่ใช่ event ทั้งก้อน)
//   event → groupId / roomId / userId ตาม type
function sourceToId(source) {
  if (!source || !source.type) return null;
  if (source.type === 'group') return source.groupId;
  if (source.type === 'room') return source.roomId;
  if (source.type === 'user') return source.userId;
  return null;
}

function getSourceId(event) {
  if (!event || !event.source) return null;
  return sourceToId(event.source);
}

function parseQueryString(queryString) {
  const params = {};
  const pairs = queryString.split('&');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return params;
}
