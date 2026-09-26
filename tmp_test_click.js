// ทดสอบ togglePromptField (v3.17.5)
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// mocks
global.aiPromptList = [
  { doc_type: 'ใบกำกับภาษี', field_config: { doc_type: true, doc_no: true } }
];
let drawn = 0;
global.renderFieldMatrixTable = () => { drawn++; };
let saved = null, shouldFail = false;
global.scriptCall = (fn, payload) => {
  saved = payload;
  return shouldFail ? Promise.reject(new Error('network')) : Promise.resolve({ success: true });
};
let toastMsgs = [];
global.showToast = (m, t) => toastMsgs.push(m + (t ? ' [' + t + ']' : ''));

// ดึง togglePromptField
const m = html.match(/        function togglePromptField\(docType, fieldKey\) \{[\s\S]*?\n        \}/);
if (!m) { console.log('MISS togglePromptField'); process.exit(1); }
eval(m[0]);

(async () => {
  // 1) สลับ doc_no: true → false
  togglePromptField('ใบกำกับภาษี', 'doc_no');
  await new Promise(r => setTimeout(r, 10));
  const cfg = global.aiPromptList[0].field_config;
  console.log((cfg.doc_no === false && drawn >= 1) ? 'PASS สลับ true→false + วาดใหม่' : 'FAIL ' + JSON.stringify(cfg));
  console.log((saved && saved.docType === 'ใบกำกับภาษี' && saved.fields === cfg) ? 'PASS ส่ง updateAIPromptFields ถูกต้อง' : 'FAIL payload ' + JSON.stringify(saved));

  // 2) สลับกลับ false → true
  togglePromptField('ใบกำกับภาษี', 'doc_no');
  await new Promise(r => setTimeout(r, 10));
  console.log((cfg.doc_no === true) ? 'PASS สลับกลับ false→true' : 'FAIL');

  // 3) rollback เมื่อบันทึกล้มเหลว
  shouldFail = true;
  togglePromptField('ใบกำกับภาษี', 'date');
  await new Promise(r => setTimeout(r, 10));
  console.log((cfg.date === undefined) ? 'PASS rollback เมื่อบันทึกล้มเหลว (date กลับ undefined)' : 'FAIL date=' + cfg.date);
  console.log(toastMsgs.some(t => t.includes('error')) ? 'PASS แจ้ง error' : 'FAIL ไม่แจ้ง');
  console.log('ALL DONE');
})();
