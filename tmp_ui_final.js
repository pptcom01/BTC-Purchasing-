// v3.16.0 รอบสุดท้ายฝั่ง UI — เก็บกวาดเศษ "ตัวอย่าง" ใน index.html
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
const before = s.length;
const n = (label) => console.log('CUT: ' + label);

// 1) ปุ่มแท็บ "ตัวอย่าง" (id ขึ้นต้น aiMode ที่ไม่ใช่ Prompts/Reference) ใน setAIMode header
{
  const re = /\n[^\n]*<button[^>]*id="aiMode[^"]*"[^>]*>[^<]*<i[\s\S]*?<\/button>/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (/aiModePrompts"|aiModeReference"/.test(m[0])) continue;
    if (!/ตัวอย่าง/.test(m[0])) continue;
    s = s.replace(m[0], '');
    n('แท็บตัวอย่าง button');
  }
}
// fallback: หา button ที่มี aiModeSamples id แบบไม่เว้นบรรทัด
{
  const re = /<button[^>]*id="aiModeSamples"[^>]*>[\s\S]*?<\/button>/g;
  let m;
  while ((m = re.exec(s)) !== null) { s = s.replace(m[0], ''); n('แท็บตัวอย่าง button (fallback)'); }
}

// 2) บล็อก drop-zone ลากตัวอย่าง/วางรูป ใน renderPromptCards + ondragover/ondragleave/ondrop attrs
s = s.replace(/\s*\+\s*'\n?\s*<div class="border-t border-dashed border-slate-200 m-3 mt-2 p-2 rounded-lg bg-slate-50 text-center text-\[10px\] text-slate-400">' \+\r?\n\s*'<i class="fa-solid fa-droplet mr-1"><\/i>ลากตัวอย่างบิล \/ วางรูปที่นี่เพื่อให้ AI เรียนรู้' \+\r?\n\s*'<\/div>'/g, '');
s = s.replace(/\s*'ondragover="event\.preventDefault\(\); this\.classList\.add\(\\'ring-2\\',\\'ring-amber-300\\',\\'border-amber-300\\'\)" ' \+\r?\n\s*'ondragleave="this\.classList\.remove\(\\'ring-2\\',\\'ring-amber-300\\',\\'border-amber-300\\'\)" ' \+\r?\n\s*'ondrop="handlePromptDrop\(event,\\'' \+/g, '');
n('drop-zone ใน renderPromptCards');

// 3) comment นำหน้า modal + ป้ายในการ์ดว่าง
s = s.replace(/<!-- AI Sample View Modal \(ดูตัวอย่างบิล\) -->\r?\n/g, '');
s = s.replace(/ลากตัวอย่างบิลลงในชุด → AI จะเขียนชุดคำสั่งอ่านให้เอง/g, 'กดรีเฟรชเพื่อโหลดหมวดมาตรฐาน');
n('comments + ป้ายการ์ดว่าง');

// 4) handlePromptDrop + uploadDroppedFile (backend route ถูกลบแล้ว)
{
  const re = /\n        \/\/ --- drag & drop[^\n]*\n[\s\S]*?function uploadDroppedFile\(f, docType\) \{[\s\S]*?\n        \}\r?\n/;
  const m = s.match(re);
  if (m) { s = s.replace(m[0], '\n'); n('handlePromptDrop + uploadDroppedFile'); }
  else console.log('MISS: drag&drop block');
}

// 5) เศษข้อความ "ตัวอย่าง" ใน toast/confirm ของ prompt actions
s = s.replace(/สร้างชุด Prompt แล้ว — ลากตัวอย่างบิลเข้าไปแล้วให้ AI เขียนชุดคำสั่ง/g, 'สร้างชุด Prompt แล้ว — กด "✨ AI เขียนชุด prompt" ได้เลย');
s = s.replace(/ลบชุด prompt นี้\? \(ตัวอย่างที่จัดไว้จะกลับเป็น "ยังไม่จัดหมวด"\)/g, 'ลบชุด prompt นี้?');
n('ข้อความ toast/confirm');

fs.writeFileSync('index.html', s);
console.log('removed ' + (before - s.length) + ' chars');
