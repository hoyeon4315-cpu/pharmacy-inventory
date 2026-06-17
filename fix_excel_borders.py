# -*- coding: utf-8 -*-
"""Fix Excel export: fills only on template path, uniform borders on fallback."""
from pathlib import Path
import build_stats_template_from_original as b

b.build()

ROOT = Path(__file__).parent

OLD_APPLY_CALL = """      applyStatsReportDesign(ws, {
        lastDataRow: lastDataRow - 1,
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });"""

NEW_APPLY_CALL = """      applyStatsReportFillsOnly(ws, {
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });"""

NEW_FILLS_FN = """
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
"""

OLD_DESIGN_START = "function applyStatsReportDesign(ws, opts) {"
OLD_DESIGN_END = "  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' }];\n}"

NEW_DESIGN = """function applyStatsReportFillsOnly(ws, opts) {
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
      if (R === 0) {
        cell.s.font = fontTitle;
        top = medium;
        if (C === 0) left = medium;
        if (C === lastCol) right = medium;
      } else if (R === 1) {
        cell.s.fill = headerFill;
        top = medium;
      } else if (R >= 2 && R < totalRow) {
        if (C === lastCol) cell.s.fill = headerFill;
      } else if (R === totalRow) {
        if (C < lastCol) cell.s.fill = totalFill;
        else cell.s.fill = headerFill;
        top = medium;
      } else if (R === tpnRow) {
        if (C === lastCol) cell.s.fill = headerFill;
        bottom = medium;
      }
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
}"""

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    if OLD_APPLY_CALL not in t:
        raise SystemExit(f"apply call missing in {name}")
    t = t.replace(OLD_APPLY_CALL, NEW_APPLY_CALL, 1)

    s = t.index(OLD_DESIGN_START)
    e = t.index(OLD_DESIGN_END, s) + len(OLD_DESIGN_END)
    t = t[:s] + NEW_DESIGN + t[e:]

    p.write_text(t, encoding="utf-8")
    print("patched", name)