import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const dir = path.dirname(fileURLToPath(import.meta.url));

function applyStatsReportDesign(ws, opts) {
  var totalRow = opts.totalRow;
  var tpnRow = opts.tpnRow;
  var lastDataRow = opts.lastDataRow;
  var lastCol = 12;
  var thin = { style: 'thin', color: { rgb: '000000' } };
  var medium = { style: 'medium', color: { rgb: '000000' } };
  var headerFill = { patternType: 'solid', fgColor: { rgb: 'FFEEECE1' } };
  var totalFill = { patternType: 'solid', fgColor: { rgb: 'FFD9D9D9' } };
  var fontTitle = { name: '맑은 고딕', sz: 14, bold: true };
  var fontDrug = { name: '맑은 고딕', sz: 10 };
  var fontData = { name: '맑은 고딕', sz: 11 };
  var alignCenter = { horizontal: 'center', vertical: 'center' };
  function ensureCell(r, c) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (!ws[addr]) ws[addr] = { v: '', t: 's', s: {} };
    if (!ws[addr].s) ws[addr].s = {};
    return ws[addr];
  }
  for (var R = 0; R <= tpnRow; R++) {
    for (var C = 0; C <= lastCol; C++) {
      var cell = ensureCell(R, C);
      cell.s.font = (C === 0 && R >= 2 && R < totalRow) ? fontDrug : fontData;
      cell.s.alignment = alignCenter;
      var top = thin, bottom = thin, left = thin, right = thin;
      if (C === 0) { left = medium; right = medium; }
      if (C === lastCol) { left = medium; right = medium; }
      if (R === 0) { cell.s.font = fontTitle; top = medium; if (C === 0) left = medium; if (C === lastCol) right = medium; }
      else if (R === 1) { cell.s.fill = headerFill; top = medium; }
      else if (R >= 2 && R < totalRow) { if (C === lastCol) cell.s.fill = headerFill; }
      else if (R === totalRow) { if (C < lastCol) cell.s.fill = totalFill; else cell.s.fill = headerFill; top = medium; }
      else if (R === tpnRow) { if (C === lastCol) cell.s.fill = headerFill; bottom = medium; }
      cell.s.border = { top: top, bottom: bottom, left: left, right: right };
    }
  }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  ws['!cols'] = [{ wch: 13.125 }];
  for (var i = 1; i <= lastCol; i++) ws['!cols'].push({ wch: 8.43 });
  ws['!rows'] = [{ hpt: 36.75 }];
  ws['!rows'][lastDataRow - 1] = { hpt: 17.25 };
  ws['!rows'][tpnRow] = { hpt: 17.25 };
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' }];
}

const tpl = fs.readFileSync(path.join(dir, 'public', 'stats-report-template.xlsx'));
const wb = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
const ws = wb.Sheets['항암제'];
ws['A1'] = { v: '2026년 4월 항암제 조제통계', t: 's' };
ws['B3'] = { v: 5, t: 'n' };

const firstDataRow = 3, lastDataRow = 62, totalRowNum = 63, tpnRowNum = 64;
applyStatsReportDesign(ws, { lastDataRow, totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });

const out = path.join(dir, 'public', '_template_design.xlsx');
XLSX.writeFile(wb, out, { cellStyles: true });
console.log('wrote', out);