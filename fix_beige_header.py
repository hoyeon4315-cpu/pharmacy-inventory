# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).parent

# 1) rebuild xlsx template
import build_stats_template_from_original as b
b.build()

OLD_FILL = "  var headerFill = { patternType: 'solid', fgColor: { rgb: 'FF1F497D' } };"
NEW_FILL = "  var headerFill = { patternType: 'solid', fgColor: { rgb: 'FFEEECE1' } };  // 2행 진료과 — 밝은 베이지(lt2)"

OLD_WRITE = """      setCell('M' + tpnRowNum, 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', true);
    }

    function writeFromWorkbook(wb) {
      var ws = wb.Sheets['항암제'] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('템플릿 시트를 찾을 수 없습니다.');
      fillWorksheet(ws);
      XLSX.writeFile(wb, formatStatsReportFilename(label), { cellStyles: true });"""

NEW_WRITE = """      setCell('M' + tpnRowNum, 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', true);
      applyStatsReportDesign(ws, {
        lastDataRow: lastDataRow - 1,
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });
    }

    function writeFromWorkbook(wb) {
      var ws = wb.Sheets['항암제'] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('템플릿 시트를 찾을 수 없습니다.');
      fillWorksheet(ws);
      XLSX.writeFile(wb, formatStatsReportFilename(label), { cellStyles: true });"""

OLD_SETCELL = """      function setCell(addr, val, isFormula) {
        var cell = ws[addr];
        if (!cell) { cell = {}; ws[addr] = cell; }"""

NEW_SETCELL = """      function setCell(addr, val, isFormula) {
        var cell = ws[addr];
        if (!cell) { cell = { s: {} }; ws[addr] = cell; }
        else if (!cell.s) { cell.s = {}; }"""

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    if OLD_FILL not in t:
        raise SystemExit(f"headerFill not found in {name}")
    t = t.replace(OLD_FILL, NEW_FILL, 1)
    t = t.replace(OLD_SETCELL, NEW_SETCELL, 1)
    t = t.replace(OLD_WRITE, NEW_WRITE, 1)
    p.write_text(t, encoding="utf-8")
    print("patched", name)