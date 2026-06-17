# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).parent

OLD_DESIGN = """function applyStatsReportDesign(ws, opts) {
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
  var lastRow = (footerRow != null) ? footerRow : tpnRow;

  function ensureCell(r, c) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (!ws[addr]) ws[addr] = { t: 'z', s: {} };
    if (!ws[addr].s) ws[addr].s = {};
    return ws[addr];
  }

  function tableBorder(R, C) {
    var top = thin, bottom = thin, left = thin, right = thin;
    if (C === 0) { left = medium; right = medium; }
    if (C === lastCol) { left = medium; right = medium; }
    if (R === 0) {
      top = medium;
      if (C === 0) left = medium;
      if (C === lastCol) right = medium;
    } else if (R === 1) {
      top = medium;
    } else if (R === totalRow) {
      top = (C === lastCol) ? thin : medium;
    } else if (R === tpnRow) {
      bottom = medium;
    }
    return { top: top, bottom: bottom, left: left, right: right };
  }

  for (var R = 0; R <= lastRow; R++) {
    for (var C = 0; C <= lastCol; C++) {
      var cell = ensureCell(R, C);
      cell.s.border = tableBorder(R, C);
      if (R <= tpnRow) {
        cell.s.font = (C === 0 && R >= 2 && R < totalRow) ? fontDrug : fontData;
        cell.s.alignment = alignCenter;
        if (R === 0) {
          cell.s.font = fontTitle;
        } else if (R === 1) {
          cell.s.fill = headerFill;
        } else if (R >= 2 && R < totalRow) {
          if (C === lastCol) cell.s.fill = headerFill;
        } else if (R === totalRow) {
          if (C < lastCol) cell.s.fill = totalFill;
          else cell.s.fill = headerFill;
        } else if (R === tpnRow) {
          if (C === lastCol) cell.s.fill = headerFill;
        }
      } else {
        cell.s.font = fontData;
        cell.s.alignment = (C === 0) ? { horizontal: 'left', vertical: 'center' } : alignCenter;
      }
    }
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  ws['!cols'] = [{ wch: 13.125 }];
  for (var i = 1; i <= lastCol; i++) ws['!cols'].push({ wch: 8.43 });
  ws['!rows'] = [{ hpt: 36.75 }];
  ws['!rows'][lastDataRow - 1] = { hpt: 17.25 };
  ws['!rows'][tpnRow] = { hpt: 17.25 };
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' }];
}"""

OLD_SETCELL = """      function setCell(addr, val, isFormula) {
        if (isFormula) {
          ws[addr] = { f: val, t: 'n' };
        } else if (val === null || val === undefined || val === '') {
          ws[addr] = { t: 'z' };
        } else {
          ws[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        }
      }"""

NEW_SETCELL = """      function setCell(addr, val, isFormula) {
        var prev = ws[addr];
        var prevS = prev && prev.s;
        var cell;
        if (isFormula) {
          cell = { f: val, t: 'n' };
        } else if (val === null || val === undefined || val === '') {
          cell = { t: 'z' };
        } else {
          cell = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        }
        if (prevS) cell.s = prevS;
        ws[addr] = cell;
      }"""

OLD_CNT = "          setCell(XLSX.utils.encode_col(i + 1) + excelRow, cnt || null, false);"
NEW_CNT = "          setCell(XLSX.utils.encode_col(i + 1) + excelRow, cnt > 0 ? cnt : null, false);"

OLD_TPN_LOOP = """      for (var c = 2; c < activeDepts.length; c++) {
        setCell(XLSX.utils.encode_col(c + 1) + tpnRowNum, null, false);
      }"""

NEW_TPN_LOOP = """      for (var ti = 1; ti < activeDepts.length; ti++) {
        setCell(XLSX.utils.encode_col(ti + 1) + tpnRowNum, null, false);
      }"""

OLD_AOA_CNT = "        row.push(cnt || '');"
NEW_AOA_CNT = "        row.push(cnt > 0 ? cnt : '');"

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    for old, new, label in [
        (OLD_DESIGN, NEW_DESIGN, "design"),
        (OLD_SETCELL, NEW_SETCELL, "setCell"),
        (OLD_CNT, NEW_CNT, "cnt"),
        (OLD_TPN_LOOP, NEW_TPN_LOOP, "tpn"),
        (OLD_AOA_CNT, NEW_AOA_CNT, "aoa cnt"),
    ]:
        if old not in t:
            raise SystemExit(f"{label} missing in {name}")
        t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    print("patched", name)