# -*- coding: utf-8 -*-
"""원본 xlsx(20년 월) 서식 기준으로 export/design 동기화."""
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
ORIG = Path(r"C:\Users\duih\Desktop\월별 보고자료 (to 파트장님)\항암제 TPN 조제통계(20년  월)-보고용.xlsx")

OLD_DESIGN = """function applyStatsReportDesign(ws, opts) {
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

NEW_DESIGN = """function applyStatsReportDesign(ws, opts) {
  var totalRow = opts.totalRow;
  var tpnRow = opts.tpnRow;
  var lastDataRow = opts.lastDataRow;
  var footerRow = opts.footerRow;
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
        top = (C === lastCol) ? thin : medium;
      } else if (R === tpnRow) {
        if (C === lastCol) cell.s.fill = headerFill;
        bottom = medium;
      }
      cell.s.border = { top: top, bottom: bottom, left: left, right: right };
    }
  }

  if (footerRow != null) {
    var fa = ensureCell(footerRow, 0);
    var fb = ensureCell(footerRow, 1);
    fa.s.font = fontData;
    fb.s.font = fontData;
    fa.s.alignment = { horizontal: 'left', vertical: 'center' };
    fb.s.alignment = alignCenter;
  }

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  ws['!cols'] = [{ wch: 13.125 }];
  for (var i = 1; i <= lastCol; i++) ws['!cols'].push({ wch: 8.43 });
  ws['!rows'] = [{ hpt: 36.75 }];
  ws['!rows'][lastDataRow - 1] = { hpt: 17.25 };
  ws['!rows'][tpnRow] = { hpt: 17.25 };
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' }];
}"""

OLD_EXPORT_CHUNK1 = """    var tpnRowNum = totalRowNum + 1;
    var sumFirstCol = XLSX.utils.encode_col(1);
    var sumLastCol = XLSX.utils.encode_col(activeDepts.length);"""

NEW_EXPORT_CHUNK1 = """    var tpnRowNum = totalRowNum + 1;
    var footerRowNum = tpnRowNum + 2;
    var sumFirstCol = XLSX.utils.encode_col(1);
    var sumLastCol = XLSX.utils.encode_col(activeDepts.length);
    var outRxKeys = {};
    fOut.forEach(function(r) { outRxKeys[getStatsRxKey(r)] = 1; });
    var outRxCount = Object.keys(outRxKeys).length;"""

OLD_TPN = """      setCell('A' + tpnRowNum, '특수TPN', false);
      setCell('B' + tpnRowNum, '0건', false);
      for (var c = 2; c < activeDepts.length; c++) {
        setCell(XLSX.utils.encode_col(c + 1) + tpnRowNum, null, false);
      }
      setCell('M' + tpnRowNum, 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', true);
      applyStatsReportDesign(ws, {
        lastDataRow: lastDataRow,
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });
    }"""

NEW_TPN = """      setCell('A' + tpnRowNum, '특수TPN', false);
      setCell('B' + tpnRowNum, 0, false);
      for (var c = 2; c < activeDepts.length; c++) {
        setCell(XLSX.utils.encode_col(c + 1) + tpnRowNum, null, false);
      }
      setCell('M' + tpnRowNum, 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', true);
      setCell('A' + footerRowNum, '외래주사실 :', false);
      setCell('B' + footerRowNum, outRxCount > 0 ? (outRxCount + '건 ') : '', false);
      applyStatsReportDesign(ws, {
        lastDataRow: lastDataRow,
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1,
        footerRow: footerRowNum - 1
      });
    }"""

OLD_AOA_END = """    aoa.push(['TOTAL'].concat(new Array(activeDepts.length).fill(null)).concat([null]));
    aoa.push(['특수TPN', '0건'].concat(new Array(activeDepts.length - 1).fill('')).concat([null]));"""

NEW_AOA_END = """    aoa.push(['TOTAL'].concat(new Array(activeDepts.length).fill(null)).concat([null]));
    aoa.push(['특수TPN', 0].concat(new Array(activeDepts.length - 1).fill('')).concat([null]));
    aoa.push(new Array(activeDepts.length + 2).fill(''));
    aoa.push(['외래주사실 :', ''].concat(new Array(activeDepts.length).fill('')));"""

if ORIG.exists():
    shutil.copy2(ORIG, ROOT / "public" / "stats-report-original.xlsx")
    print("copied original -> public/stats-report-original.xlsx")

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    for old, new, label in [
        (OLD_DESIGN, NEW_DESIGN, "design"),
        (OLD_EXPORT_CHUNK1, NEW_EXPORT_CHUNK1, "vars"),
        (OLD_TPN, NEW_TPN, "tpn/footer"),
        (OLD_AOA_END, NEW_AOA_END, "aoa"),
    ]:
        if old not in t:
            raise SystemExit(f"{label} block missing in {name}")
        t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    print("patched", name)