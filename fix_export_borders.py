# -*- coding: utf-8 -*-
"""SheetJS는 openpyxl 템플릿 read 후 테두리 저장 불가 → aoa 신규 생성 + applyStatsReportDesign."""
from pathlib import Path

ROOT = Path(__file__).parent

OLD = """      applyStatsReportStyle(ws, {
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });
    }

    function writeFromWorkbook(wb) {
      var ws = wb.Sheets['항암제'] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('템플릿 시트를 찾을 수 없습니다.');
      fillWorksheet(ws);
      XLSX.writeFile(wb, formatStatsReportFilename(label), { cellStyles: true });
      if (Object.keys(unmappedDrugs).length > 0) {
        console.warn('exportStatsDeptExcel: unmapped drugs (not in 60-row template):', Object.keys(unmappedDrugs).sort());
        var um = '보고용 양식 60개 약품 외 ' + Object.keys(unmappedDrugs).length + '개는 엑셀 행에 없음 (화면 통계에는 포함)';
        if (typeof toast === 'function') toast(um, 'warning');
      }
      if (typeof toast === 'function') toast('보고용 양식 엑셀 다운로드 완료', 'success');
      else alert('다운로드 완료: ' + formatStatsReportFilename(label));
    }

    fetch('stats-report-template.xlsx')
      .then(function(res) {
        if (!res.ok) throw new Error('템플릿 파일 로드 실패');
        return res.arrayBuffer();
      })
      .then(function(buf) {
        var wb = XLSX.read(buf, { type: 'array', cellStyles: true });
        writeFromWorkbook(wb);
      })
      .catch(function(err) {
        console.warn('template export failed, fallback to built-in styles:', err);
        var aoa = [];
        aoa.push([title]);
        aoa.push([''].concat(activeDepts).concat(['합계']));
        DEFAULT_STATS_DRUG_ORDER.forEach(function(drug) {
          var row = [drug];
          activeDepts.forEach(function(d) {
            var cnt = (drugDept[drug] && drugDept[drug][d]) ? drugDept[drug][d].size : 0;
            row.push(cnt || '');
          });
          row.push(null);
          aoa.push(row);
        });
        aoa.push(['TOTAL'].concat(new Array(activeDepts.length).fill(null)).concat([null]));
        aoa.push(['특수TPN', '0건'].concat(new Array(activeDepts.length - 1).fill('')).concat([null]));
        var wb2 = XLSX.utils.book_new();
        var ws2 = XLSX.utils.aoa_to_sheet(aoa);
        DEFAULT_STATS_DRUG_ORDER.forEach(function(drug, idx) {
          var excelRow = firstDataRow + idx;
          ws2['M' + excelRow] = { f: 'SUM(' + sumFirstCol + excelRow + ':' + sumLastCol + excelRow + ')', t: 'n' };
        });
        activeDepts.forEach(function(d, i) {
          var col = XLSX.utils.encode_col(i + 1);
          ws2[col + totalRowNum] = { f: 'SUM(' + col + firstDataRow + ':' + col + lastDataRow + ')', t: 'n' };
        });
        ws2['M' + totalRowNum] = { f: 'SUM(' + sumFirstCol + totalRowNum + ':' + sumLastCol + totalRowNum + ')', t: 'n' };
        ws2['M' + tpnRowNum] = { f: 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', t: 'n' };
        applyStatsReportStyle(ws2, { totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });
        XLSX.utils.book_append_sheet(wb2, ws2, '항암제');
        writeFromWorkbook(wb2);
      });"""

NEW = """      applyStatsReportDesign(ws, {
        lastDataRow: lastDataRow,
        totalRow: totalRowNum - 1,
        tpnRow: tpnRowNum - 1
      });
    }

    var aoa = [];
    aoa.push([title]);
    aoa.push([''].concat(activeDepts).concat(['합계']));
    DEFAULT_STATS_DRUG_ORDER.forEach(function(drug) {
      var row = [drug];
      activeDepts.forEach(function(d) {
        var cnt = (drugDept[drug] && drugDept[drug][d]) ? drugDept[drug][d].size : 0;
        row.push(cnt || '');
      });
      row.push(null);
      aoa.push(row);
    });
    aoa.push(['TOTAL'].concat(new Array(activeDepts.length).fill(null)).concat([null]));
    aoa.push(['특수TPN', '0건'].concat(new Array(activeDepts.length - 1).fill('')).concat([null]));
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    fillWorksheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, '항암제');
    XLSX.writeFile(wb, formatStatsReportFilename(label), { cellStyles: true });
    if (Object.keys(unmappedDrugs).length > 0) {
      console.warn('exportStatsDeptExcel: unmapped drugs (not in 60-row template):', Object.keys(unmappedDrugs).sort());
      var um = '보고용 양식 60개 약품 외 ' + Object.keys(unmappedDrugs).length + '개는 엑셀 행에 없음 (화면 통계에는 포함)';
      if (typeof toast === 'function') toast(um, 'warning');
    }
    if (typeof toast === 'function') toast('보고용 양식 엑셀 다운로드 완료', 'success');
    else alert('다운로드 완료: ' + formatStatsReportFilename(label));"""

OLD_SETCELL = """      function setCell(addr, val, isFormula) {
        var cell = ws[addr];
        if (!cell) { cell = { s: {} }; ws[addr] = cell; }
        else if (!cell.s) { cell.s = {}; }
        if (isFormula) {
          cell.f = val;
          cell.t = 'n';
          delete cell.v;
        } else if (val === null || val === undefined || val === '') {
          delete cell.v;
          delete cell.f;
          cell.t = 'z';
        } else {
          cell.v = val;
          cell.t = typeof val === 'number' ? 'n' : 's';
          delete cell.f;
        }
      }"""

NEW_SETCELL = """      function setCell(addr, val, isFormula) {
        if (isFormula) {
          ws[addr] = { f: val, t: 'n' };
        } else if (val === null || val === undefined || val === '') {
          ws[addr] = { t: 'z' };
        } else {
          ws[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        }
      }"""

for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    if OLD not in t:
        raise SystemExit(f"export block missing in {name}")
    t = t.replace(OLD_SETCELL, NEW_SETCELL, 1)
    t = t.replace(OLD, NEW, 1)
    p.write_text(t, encoding="utf-8")
    print("patched", name)