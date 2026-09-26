// v3.16.0 — ลบระบบ "ตัวอย่าง" ออกจากระบบทั้งหมด (index-based cuts ปลอดภัย)
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const removed = [];

function cutIdx(src, start, end, label) {
  removed.push(label + ' (' + (end - start) + ' chars)');
  return src.slice(0, start) + src.slice(end);
}

// 1) aiModeSamplesView ทั้งบล็อก: จาก comment "<!-- ตัวอย่าง view -->" ถึงก่อน "<!-- Vendor Billing Page"
{
  const start = html.indexOf('<!-- ตัวอย่าง view -->');
  const end = html.indexOf('<!-- Vendor Billing Page');
  if (start !== -1 && end !== -1 && end > start) html = cutIdx(html, start, end, 'aiModeSamplesView ทั้งบล็อก');
  else console.log('WARN samplesView: start=' + start + ' end=' + end);
}

// 2) templateModal ทั้งบล็อก: จาก comment/div เปิด ถึงก่อน <div id="uploadSampleModal"
{
  const c = html.indexOf('<!-- Template Modal');
  const a = html.indexOf('<div id="templateModal"');
  const start = (c !== -1 && c < a) ? c : a;
  const end = html.indexOf('<div id="uploadSampleModal"');
  if (start !== -1 && end !== -1 && end > start) html = cutIdx(html, start, end, 'templateModal HTML');
  else console.log('WARN templateModal: start=' + start + ' end=' + end);
}

// 3) uploadSampleModal ทั้งบล็อก: จาก comment/div เปิด ถึง marker ปิด — หา comment/div ถัดไปหลังจบ modal
{
  const c = html.indexOf('<!-- Upload Sample Modal');
  const a = html.indexOf('<div id="uploadSampleModal"');
  const start = (c !== -1 && c < a) ? c : a;
  // จบ: หา "</div>\r\n\r\n        <script" หรือ div/comment ถัดไป — ใช้ตัวช่วย: หา "</div>" ที่ปิด modal (ระดับเดียวกับเปิด)
  // ปลอดภัยสุด: ตัดจาก start ถึงก่อน comment หรือ <div id= ถัดไปที่ 'ไม่ใช่' ลูกของ modal
  // modal นี้มีลูก id ขึ้นต้น uploadSample... — หา index ของ <div แรกหลังจากที่ไม่มี uploadSample อีก
  let pos = start;
  let end = -1;
  const re = /<div id="([a-zA-Z]+)"/g;
  re.lastIndex = start + 10;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].indexOf('uploadSample') !== 0) { end = m.index; break; }
  }
  // ถ้าไม่มี div id ถัดไป ให้หา comment หรือ <script
  if (end === -1) {
    const cs = ['<!-- ', '<script'];
    cs.forEach(mk => { const p = html.indexOf(mk, start + 10); if (p !== -1 && (end === -1 || p < end)) end = p; });
  }
  if (end !== -1) html = cutIdx(html, start, end, 'uploadSampleModal HTML');
  else console.log('WARN uploadSampleModal: หา end ไม่เจอ');
}

// 4) ปุ่มแท็บตัวอย่าง
{
  const a = html.indexOf('<button type="button" id="aiModeSamples"');
  if (a !== -1) {
    const b = html.indexOf('</button>', a);
    html = cutIdx(html, a, b + '</button>'.length, 'ปุ่มแท็บตัวอย่าง');
  }
}

// 5) JS functions (index-based: จาก "function X(" ถึง "\n        }" ถัดไป)
function cutFn(src, fnName) {
  const key = 'function ' + fnName + '(';
  const a = src.indexOf(key);
  if (a === -1) { console.log('SKIP fn: ' + fnName); return src; }
  const closeKey = '\n        }';
  const b = src.indexOf(closeKey, a);
  if (b === -1) { console.log('SKIP fn (ไม่เจอปิด): ' + fnName); return src; }
  removed.push('fn ' + fnName);
  return src.slice(0, a) + src.slice(b + closeKey.length);
}
['loadAISamples', 'renderAISampleReviewBoard', 'getFilteredAISamples', 'aiReviewSelectByIndex',
 'shiftAIReviewSample', 'saveAIReviewClassification', 'openTemplateModal', 'closeTemplateModal',
 'assignSampleFromModal', 'openUploadSampleModal', 'closeUploadSampleModal', 'uploadSampleFileAction'
].forEach(fn => { html = cutFn(html, fn); });

// 6) JS: ตัวแปร + เศษ references
html = html.replace(/        let aiSampleList = \[\];\r?\n/, '');
html = html.replace(/        let currentSample = null;\r?\n/g, '');
html = html.replace(/        let aiReviewSelectedIndex = 0;\r?\n/, '');
html = html.replace(/aiMode = \(mode === 'samples'\) \? 'samples' : \(mode === 'reference' \? 'reference' : 'prompts'\);/, "aiMode = (mode === 'reference') ? 'reference' : 'prompts';");
html = html.replace(/\n\s*const sBtn = document\.getElementById\('aiModeSamples'\);/, '');
html = html.replace(/\n\s*const sView = document\.getElementById\('aiModeSamplesView'\);/, '');
html = html.replace(/\n\s*if \(sBtn\) sBtn\.className = \(aiMode === 'samples' \? activeCls : idleCls\);/, '');
html = html.replace(/\n\s*if \(sView\) sView\.style\.display = \(aiMode === 'samples'\) \? '' : 'none';/, '');
html = html.replace(/\n\s*if \(aiMode === 'samples'\) return loadAISamples\(force\);/, '');
html = html.replace(/\s*\|\|\s*loadAISamples\(true\)/g, '');
html = html.replace(/\n\s*else \{ if \(!aiSampleList\.length\) loadAISamples\(true\); \}/, '');
html = html.replace(/\n\s*const uploadSampleSel = document\.getElementById\('uploadSampleDocType'\);/, '');
html = html.replace(/\n\s*if \(uploadSampleSel\) uploadSampleSel\.innerHTML = accountingDocTypeOptions\('ยังไม่จัด \(ไปที่แท็บตัวอย่าง\)'\);/, '');
html = html.replace(/let aiMode = 'samples';/, "let aiMode = 'prompts';");

fs.writeFileSync('index.html', html, 'utf8');
console.log('=== index.html ===');
removed.forEach(r => console.log('  - ' + r));

// ============ Code.gs ============
let gs = fs.readFileSync('Code.gs', 'utf8');
const removedGs = [];
function cutGsFn(src, fnName) {
  const key = 'function ' + fnName + '(';
  const a = src.indexOf(key);
  if (a === -1) { console.log('SKIP gs fn: ' + fnName); return src; }
  const closeKey = '\n}';
  const b = src.indexOf(closeKey, a);
  if (b === -1) { console.log('SKIP gs fn (ไม่เจอปิด): ' + fnName); return src; }
  removedGs.push(fnName);
  return src.slice(0, a) + src.slice(b + closeKey.length);
}
['createTemplateCandidate', 'confirmTemplate', 'buildFewShotPrompt', 'getAITemplates',
 'getAISamples', 'ensureTemplateCandidateIfNeeded', 'promptSampleCapReached', 'uploadLocalSample',
 'updateAISampleClassification', 'attachTemplateToPrompt', 'deleteTemplate', 'computeLayoutSignature'
].forEach(fn => { gs = cutGsFn(gs, fn); });

// dispatch cases
['getAITemplates', 'confirmTemplate', 'deleteTemplate', 'getAISamples', 'updateAISampleClassification', 'attachTemplateToPrompt', 'uploadLocalSample'].forEach(name => {
  const re = new RegExp("^\\s*case '" + name + "':.*\\r?\\n", 'm');
  if (re.test(gs)) { gs = gs.replace(re, ''); removedGs.push('dispatch ' + name); }
});

fs.writeFileSync('Code.gs', gs, 'utf8');
console.log('=== Code.gs ===');
removedGs.forEach(r => console.log('  - ' + r));
console.log('DONE');
