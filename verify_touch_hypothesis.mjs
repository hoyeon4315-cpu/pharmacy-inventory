import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const dir = path.dirname(fileURLToPath(import.meta.url));

function applyDesign(ws, totalRow, tpnRow) {
  const thin = { style: 'thin', color: { rgb: '000000' } };
  const medium = { style: 'medium', color: { rgb: '000000' } };
  const lastCol = 12;
  for (let R = 1; R <= tpnRow; R++) {
    for (let C = 0; C <= lastCol; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      let cell = ws[addr];
      if (!cell) cell = ws[addr] = { t: 'z', s: {} };
      if (!cell.s) cell.s = {};
      let top = thin, bottom = thin, left = thin, right = thin;
      if (C === 0) { left = medium; right = medium; }
      if (C === lastCol) { left = medium; right = medium; }
      if (R === 1) top = medium;
      if (R === totalRow) top = medium;
      if (R === tpnRow) bottom = medium;
      cell.s.border = { top, bottom, left, right };
    }
  }
}

function touchAll(ws, totalRow, tpnRow) {
  for (let R = 1; R <= tpnRow; R++) {
    for (let C = 0; C <= 12; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      ws[addr] = { ...cell, v: cell.v, t: cell.t, f: cell.f, s: cell.s };
    }
  }
}

const tpl = fs.readFileSync(path.join(dir, 'public', 'stats-report-template.xlsx'));
const wb = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
const ws = wb.Sheets['항암제'];
const totalRow = 62, tpnRow = 63;

applyDesign(ws, totalRow, tpnRow);
console.log('in-memory C3 border', ws.C3?.s?.border?.left?.style);

// test A: design only
const wbA = structuredClone ? null : null;
let wbA2 = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
let wsA = wbA2.Sheets['항암제'];
applyDesign(wsA, totalRow, tpnRow);
XLSX.writeFile(wbA2, path.join(dir, 'public', '_touchA.xlsx'), { cellStyles: true });

// test B: design + touch all cells
let wbB = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
let wsB = wbB.Sheets['항암제'];
applyDesign(wsB, totalRow, tpnRow);
touchAll(wsB, totalRow, tpnRow);
XLSX.writeFile(wbB, path.join(dir, 'public', '_touchB.xlsx'), { cellStyles: true });

// test C: design + only set v on each cell
let wbC = XLSX.read(tpl, { type: 'buffer', cellStyles: true });
let wsC = wbC.Sheets['항암제'];
applyDesign(wsC, totalRow, tpnRow);
for (let R = 1; R <= tpnRow; R++) {
  for (let C = 0; C <= 12; C++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: C });
    const cell = wsC[addr];
    if (!cell) continue;
    wsC[addr] = { v: cell.v, t: cell.t || 'z', f: cell.f, s: cell.s };
  }
}
XLSX.writeFile(wbC, path.join(dir, 'public', '_touchC.xlsx'), { cellStyles: true });

console.log('done A/B/C');