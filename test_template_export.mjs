import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const dir = path.dirname(fileURLToPath(import.meta.url));
const tpl = fs.readFileSync(path.join(dir, 'public', 'stats-report-template.xlsx'));
const wb = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
const ws = wb.Sheets['항암제'];
ws['A1'] = { v: '2026년 4월 항암제 조제통계', t: 's' };
ws['B3'] = { v: 5, t: 'n' };
const out = path.join(dir, 'public', '_test_export.xlsx');
XLSX.writeFile(wb, out, { cellStyles: true });
console.log('wrote', out);