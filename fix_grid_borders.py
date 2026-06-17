# -*- coding: utf-8 -*-
from pathlib import Path
import build_stats_template_from_original as b
b.build()

ROOT = Path(__file__).parent

GRID_FN = """
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
"""

OLD_FILLS = """function applyStatsReportFillsOnly(ws, opts) {
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
}"""

NEW_STYLE_BLOCK = GRID_FN + "\n" + OLD_FILLS + """
function applyStatsReportStyle(ws, opts) {
  applyStatsReportGridBorders(ws, opts);
  applyStatsReportFillsOnly(ws, opts);
}
"""

OLD_CALL = """      applyStatsReportFillsOnly(ws, {
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });"""

NEW_CALL = """      applyStatsReportStyle(ws, {
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });"""

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    if OLD_FILLS not in t:
        raise SystemExit(f"fills fn missing in {name}")
    t = t.replace(OLD_FILLS, NEW_STYLE_BLOCK, 1)
    t = t.replace(OLD_CALL, NEW_CALL, 1)
    # fallback path: use full style instead of design only
    t = t.replace(
        "applyStatsReportDesign(ws2, { lastDataRow: lastDataRow, totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });",
        "applyStatsReportStyle(ws2, { totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });",
        1,
    )
    p.write_text(t, encoding="utf-8")
    print("patched", name)