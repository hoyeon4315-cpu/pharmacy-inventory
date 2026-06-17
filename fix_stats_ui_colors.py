# -*- coding: utf-8 -*-
"""Fix stats tab button colors + Excel limited-view (autofilter) issues."""
from pathlib import Path

ROOT = Path(__file__).parent

def patch(path: Path):
    html = path.read_text(encoding="utf-8")

    # 1) Excel button: remove bright cyan, match other stats-print-btn
    html = html.replace(
        '<button class="stats-print-btn" onclick="exportStatsDeptExcel()" style="margin-left:12px;background:#0ea5e9;color:white;border-color:#0ea5e9;">엑셀 다운로드 (보고용 양식)</button>',
        '<button class="stats-print-btn" onclick="exportStatsDeptExcel()" style="margin-left:12px;">엑셀 다운로드 (보고용 양식)</button>',
    )
    html = html.replace(
        '<button class="stats-print-btn" onclick="exportStatsDeptExcel()" style="margin-left:12px; background:#0ea5e9; color:white; border-color:#0ea5e9;">엑셀 다운로드 (진료과별 매트릭스 - 참조 순서)</button>',
        '<button class="stats-print-btn" onclick="exportStatsDeptExcel()" style="margin-left:12px;">엑셀 다운로드 (보고용 양식)</button>',
    )

    # 2) toast-warning style (was missing)
    if ".toast-warning" not in html:
        html = html.replace(
            ".toast-info { background:#3b82f6; }",
            ".toast-info { background:#3b82f6; }\n.toast-warning { background:#78716c; }",
        )

    # 3) Remove autofilter (Excel often opens with hidden rows = feels like '제한된 보기')
    html = html.replace(
        "  ws['!autofilter'] = { ref: 'A2:M' + (tpnRow + 1) };\n}",
        "  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' }];\n}",
        1,
    )

    # 4) Dynamic SUM range (was hardcoded B:K, missing last dept column)
    old_sum_block = """    DEFAULT_STATS_DRUG_ORDER.forEach(function(drug, idx){
      var excelRow = firstDataRow + idx;
      ws['M' + excelRow] = { f: 'SUM(B' + excelRow + ':K' + excelRow + ')', t: 'n' };
    });

    activeDepts.forEach(function(d, i){
      var col = XLSX.utils.encode_col(i + 1);
      ws[col + totalRowNum] = { f: 'SUM(' + col + firstDataRow + ':' + col + lastDataRow + ')', t: 'n' };
    });
    ws['M' + totalRowNum] = { f: 'SUM(B' + totalRowNum + ':K' + totalRowNum + ')', t: 'n' };
    ws['M' + tpnRowNum] = { f: 'SUM(B' + tpnRowNum + ':K' + tpnRowNum + ')', t: 'n' };"""

    new_sum_block = """    var sumFirstCol = XLSX.utils.encode_col(1);
    var sumLastCol = XLSX.utils.encode_col(activeDepts.length);
    DEFAULT_STATS_DRUG_ORDER.forEach(function(drug, idx){
      var excelRow = firstDataRow + idx;
      ws['M' + excelRow] = { f: 'SUM(' + sumFirstCol + excelRow + ':' + sumLastCol + excelRow + ')', t: 'n' };
    });

    activeDepts.forEach(function(d, i){
      var col = XLSX.utils.encode_col(i + 1);
      ws[col + totalRowNum] = { f: 'SUM(' + col + firstDataRow + ':' + col + lastDataRow + ')', t: 'n' };
    });
    ws['M' + totalRowNum] = { f: 'SUM(' + sumFirstCol + totalRowNum + ':' + sumLastCol + totalRowNum + ')', t: 'n' };
    ws['M' + tpnRowNum] = { f: 'SUM(' + sumFirstCol + tpnRowNum + ':' + sumLastCol + tpnRowNum + ')', t: 'n' };"""

    if old_sum_block in html:
        html = html.replace(old_sum_block, new_sum_block, 1)

    # 5) Softer unmapped warning text
    html = html.replace(
        "var um = '매핑되지 않은 약품 ' + Object.keys(unmappedDrugs).length + '개는 엑셀에서 제외됨 (F12 콘솔 확인)';",
        "var um = '보고용 양식 60개 약품 외 ' + Object.keys(unmappedDrugs).length + '개는 엑셀 행에 없음 (화면 통계에는 포함)';",
    )

    path.write_text(html, encoding="utf-8")
    print("patched:", path.name)

for f in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / f
    if p.exists():
        patch(p)