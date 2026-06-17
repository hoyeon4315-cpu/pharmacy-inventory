import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const dir = path.dirname(fileURLToPath(import.meta.url));

function applyStatsReportGridBorders(ws, opts) {
  var hdrRow = 1;
  var totalRow = opts.totalRow;
  var tpnRow = opts.tpnRow;
  var lastCol = 12;
  var thin = { style: 'thin', color: { rgb: '000000' } };
  var medium = { style: 'medium', color: { rgb: '000000' } };
  function ec(r, c) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (!ws[addr]) ws[addr] = { t: 'z', s: {} };
    if (!ws[addr].s) ws[addr].s = {};
    return ws[addr];
  }
  for (var R = hdrRow; R <= tpnRow; R++) {
    for (var C = 0; C <= lastCol; C++) {
      var cell = ec(R, C);
      var top = thin, bottom = thin, left = thin, right = thin;
      if (C === 0) { left = medium; right = medium; }
      if (C === lastCol) { left = medium; right = medium; }
      if (R === hdrRow) top = medium;
      if (R === totalRow) top = medium;
      if (R === tpnRow) bottom = medium;
      cell.s.border = { top: top, bottom: bottom, left: left, right: right };
    }
  }
}

function applyStatsReportFillsOnly(ws, opts) {
  var totalRow = opts.totalRow;
  var tpnRow = opts.tpnRow;
  var lastCol = 12;
  var headerFill = { patternType: 'solid', fgColor: { rgb: 'FFEEECE1' } };
  var totalFill = { patternType: 'solid', fgColor: { rgb: 'FFD9D9D9' } };
  function ec(r, c) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (!ws[addr]) ws[addr] = { t: 'z', s: {} };
    if (!ws[addr].s) ws[addr].s = {};
    return ws[addr];
  }
  for (var c = 1; c <= lastCol; c++) ec(1, c).s.fill = headerFill;
  for (var r = 2; r < totalRow; r++) ec(r, lastCol).s.fill = headerFill;
  for (var c = 0; c < lastCol; c++) ec(totalRow, c).s.fill = totalFill;
  ec(totalRow, lastCol).s.fill = headerFill;
  ec(tpnRow, lastCol).s.fill = headerFill;
}

const tpl = fs.readFileSync(path.join(dir, 'public', 'stats-report-template.xlsx'));
const wb = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
const ws = wb.Sheets['항암제'];

function setCell(addr, val) {
  var cell = ws[addr];
  if (!cell) { cell = { s: {} }; ws[addr] = cell; }
  else if (!cell.s) { cell.s = {}; }
  if (val === null) { delete cell.v; cell.t = 'z'; }
  else { cell.v = val; cell.t = typeof val === 'number' ? 'n' : 's'; }
}

setCell('A1', '2026년 4월 항암제 조제통계');
setCell('B3', 5);
setCell('C10', 3);

const firstDataRow = 3;
const lastDataRow = firstDataRow + 59;
const totalRowNum = lastDataRow + 1;
const tpnRowNum = totalRowNum + 1;

applyStatsReportGridBorders(ws, { totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });
applyStatsReportFillsOnly(ws, { totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });

const out = path.join(dir, 'public', '_verify_grid_export.xlsx');
XLSX.writeFile(wb, out, { cellStyles: true });

// quick read-back check
const wb2 = XLSX.read(fs.readFileSync(out), { type: 'buffer', cellStyles: true });
const ws2 = wb2.Sheets['항암제'];
for (const addr of ['B3', 'C3', 'D10', 'M10', 'A2', 'M2']) {
  const c = ws2[addr];
  const b = c?.s?.border;
  console.log(addr, b ? `${b.left?.style}/${b.top?.style}/${b.right?.style}/${b.bottom?.style}` : 'NO BORDER');
}
console.log('wrote', out);