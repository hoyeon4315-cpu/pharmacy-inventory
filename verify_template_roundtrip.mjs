import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const dir = path.dirname(fileURLToPath(import.meta.url));
const tpl = fs.readFileSync(path.join(dir, 'public', 'stats-report-template.xlsx'));
const wb = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
const ws = wb.Sheets['항암제'];

// check read
for (const addr of ['B3', 'C3', 'M10', 'A2']) {
  const c = ws[addr];
  const b = c?.s?.border;
  console.log('READ', addr, b ? `${b.left?.style}/${b.top?.style}/${b.right?.style}/${b.bottom?.style}` : 'NO BORDER', 'has s', !!c?.s);
}

const out = path.join(dir, 'public', '_roundtrip.xlsx');
XLSX.writeFile(wb, out, { cellStyles: true });
console.log('wrote', out);