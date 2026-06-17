# -*- coding: utf-8 -*-
"""Switch exportStatsDeptExcel to template-based export (preserve original colors)."""
from pathlib import Path
import re

ROOT = Path(__file__).parent

OLD_FN_START = "function exportStatsDeptExcel() {"
OLD_FN_END = "\n\n// ============================================================\n// 공통"

NEW_FN = r'''function exportStatsDeptExcel() {
  try {
    if (typeof XLSX === 'undefined' || !XLSX.utils || typeof XLSX.writeFile !== 'function') {
      if (typeof toast === 'function') toast('XLSX 라이브러리(XLSX)가 로드되지 않았습니다. 페이지를 새로고침(F5) 후 다시 시도하세요.', 'error');
      else console.error('XLSX not available');
      return;
    }

    var sd = getStatsData();
    var mix = sd.mix || [], out = sd.out || [];
    if (mix.length === 0 && out.length === 0) {
      var msg = '내볼 통계 데이터가 없습니다.\n\n' +
                '• "진료과별 통계" 토글 버튼이 선택(활성)되어 있는지 확인하세요.\n' +
                '• 3.xlsx(입원MIX) 또는 4.xlsx(외래집계)를 업로드했는지 확인.\n' +
                '• 기간 선택(오늘 / 이번달 / 커스텀) 후 매트릭스가 실제로 표시되는 상태에서 다시 시도.';
      if (typeof toast === 'function') toast(msg.replace(/\n/g, ' '), 'error');
      else alert(msg);
      console.warn('exportStatsDeptExcel: no mix/out data for current period');
      return;
    }

    var fMix = mix.filter(function(r){ return !isVehicle(r.code); });
    var fOut = out.filter(function(r){ return !isVehicle(r.code); });
    var drugDept = {};
    var unmappedDrugs = {};
    fMix.concat(fOut).forEach(function(r){
      var cname = normalizeStatsDrugName(r.name);
      if (!cname) {
        var fallback = cleanDrugName(r.name) || String(r.name || '').trim();
        if (fallback) unmappedDrugs[fallback] = 1;
        return;
      }
      var dept = getReportDeptCode(r.doctor, r.dept);
      if (!drugDept[cname]) drugDept[cname] = {};
      if (!drugDept[cname][dept]) drugDept[cname][dept] = new Set();
      drugDept[cname][dept].add(getStatsRxKey(r));
    });

    var activeDepts = getPreferredDeptOrder();
    var label = (sd && sd.label) ? sd.label : today();
    var title = formatStatsReportTitle(label);
    var firstDataRow = 3;
    var lastDataRow = firstDataRow + DEFAULT_STATS_DRUG_ORDER.length - 1;
    var totalRowNum = lastDataRow + 1;
    var tpnRowNum = totalRowNum + 1;
    var sumFirstCol = XLSX.utils.encode_col(1);
    var sumLastCol = XLSX.utils.encode_col(activeDepts.length);

    function fillWorksheet(ws) {
      function setCell(addr, val, isFormula) {
        var cell = ws[addr];
        if (!cell) { cell = {}; ws[addr] = cell; }
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
      }

      setCell('A1', title, false);
      activeDepts.forEach(function(d, i) {
        setCell(XLSX.utils.encode_col(i + 1) + '2', d, false);
      });
      setCell('M2', '합계', false);

      DEFAULT_STATS_DRUG_ORDER.forEach(function(drug, idx) {
        var excelRow = firstDataRow + idx;
        setCell('A' + excelRow, drug, false);
        activeDepts.forEach(function(d, i) {
          var cnt = (drugDept[drug] && drugDept[drug][d]) ? drugDept[drug][d].size : 0;
          setCell(XLSX.utils.encode_col(i + 1) + excelRow, cnt || null, false);
        });
        setCell('M' + excelRow, 'SUM(' + sumFirstCol + excelRow + ':' + sumLastCol + excelRow + ')', true);
      });

      setCell('A' + totalRowNum, 'TOTAL', false);
      activeDepts.forEach(function(d, i) {
        var col = XLSX.utils.encode_col(i + 1);
        setCell(col + totalRowNum, 'SUM(' + col + firstDataRow + ':' + col + lastDataRow + ')', true);
      });
      setCell('M' + totalRowNum, 'SUM(' + sumFirstCol + totalRowNum + ':' + sumLastCol + totalRowNum + ')', true);

      setCell('A' + tpnRowNum, '특수TPN', false);
      setCell('B' + tpnRowNum, '0건', false);
      for (var c = 2; c < activeDepts.length; c++) {
        setCell(XLSX.utils.encode_col(c + 1) + tpnRowNum, null, false);
      }
      setCell('M' + tpnRowNum, 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', true);
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
        applyStatsReportDesign(ws2, { lastDataRow: lastDataRow, totalRow: totalRowNum - 1, tpnRow: tpnRowNum - 1 });
        XLSX.utils.book_append_sheet(wb2, ws2, '항암제');
        writeFromWorkbook(wb2);
      });
  } catch (e) {
    console.error('exportStatsDeptExcel error:', e);
    if (typeof toast === 'function') {
      toast('다운로드 중 오류: ' + (e && e.message ? e.message : e), 'error');
    } else {
      alert('엑셀 다운로드 중 오류가 발생했습니다.\n\n' + (e && e.message ? e.message : e) + '\n\nF12 콘솔 확인 후 알려주세요.');
    }
  }
}'''

for name in ["public/index.html", "항암제_재고관리.html"]:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    s = text.index(OLD_FN_START)
    e = text.index(OLD_FN_END, s)
    text = text[:s] + NEW_FN + text[e:]
    path.write_text(text, encoding="utf-8")
    print("patched", name)

# Fix fallback colors to match reference theme (dk2 navy, not cyan)
for name in ["public/index.html", "항암제_재고관리.html"]:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "  var headerFill = { patternType: 'solid', fgColor: { rgb: '1F497D' } };",
        "  var headerFill = { patternType: 'solid', fgColor: { theme: 2, tint: 0 } };",
        1,
    )
    text = text.replace(
        "  var totalFill = { patternType: 'solid', fgColor: { rgb: 'D8D8D8' } };",
        "  var totalFill = { patternType: 'solid', fgColor: { theme: 0, tint: -0.1499984740745262 } };",
        1,
    )
    path.write_text(text, encoding="utf-8")