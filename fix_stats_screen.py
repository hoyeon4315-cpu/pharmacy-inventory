# -*- coding: utf-8 -*-
"""Fix stats tab UI in public/index.html: remove sync duplicates, align with report format."""
from pathlib import Path
import re

DST = Path(__file__).parent / "public" / "index.html"
html = DST.read_text(encoding="utf-8")

# 1) Remove duplicate _statsPeriod / setStatsPeriod / toggleStatsView / printStatsSection block
dup_block = """var _statsPeriod = 'daily';
function setStatsPeriod(mode) {
  _statsPeriod = mode;
  document.querySelectorAll('.stats-period-btn').forEach(function(b){ b.classList.remove('active'); });
  event.target.classList.add('active');
  var monthEl = document.getElementById('statsMonth');
  var fromEl = document.getElementById('statsDateFrom');
  var toEl = document.getElementById('statsDateTo');
  var sepEl = document.getElementById('statsDateSep');
  monthEl.style.display = 'none'; fromEl.style.display = 'none'; toEl.style.display = 'none'; sepEl.style.display = 'none';
  if (mode === 'monthly') {
    monthEl.style.display = '';
    if (!monthEl.value) { var d = new Date(); monthEl.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
  } else if (mode === 'custom') {
    fromEl.style.display = ''; toEl.style.display = ''; sepEl.style.display = '';
    if (!fromEl.value) { var keys = Object.keys(state.dailyData).sort(); fromEl.value = keys[0] || getWorkDate(); }
    if (!toEl.value) toEl.value = getWorkDate();
  }
  renderStats();
}
function toggleStatsView(view) {
  document.querySelectorAll('.stats-toggle-btn').forEach(function(b){ b.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('statsViewDept').style.display = view === 'dept' ? '' : 'none';
  document.getElementById('statsViewAmpm').style.display = view === 'ampm' ? '' : 'none';
}
function printStatsSection(section) {
  var el = section === 'dept' ? document.getElementById('statsViewDept') : document.getElementById('statsAmpmContent');
  var label = document.getElementById('statsDateLabel').textContent;
  var win = window.open('', '_blank');
  win.document.write('<html><head><title>통계 출력</title><style>body{font-family:sans-serif;font-size:12px;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #999;padding:4px 6px;font-size:11px;line-height:1.3;}th{background:#f1f5f9;font-weight:700;}.total-row{font-weight:700;background:#e2e8f0 !important;}td.num{text-align:right;font-variant-numeric:tabular-nums;}h4{margin:12px 0 6px;font-size:13px;}</style></head><body>');
  win.document.write('<h3>' + (section === 'dept' ? '진료과별 통계' : '오전/오후 통계') + ' - ' + label + '</h3>');
  win.document.write(el.innerHTML);
  win.document.write('</body></html>');
  win.document.close();
  win.print();
}
function cleanDrugName(name) {"""

if html.count(dup_block) != 1:
    raise SystemExit(f"duplicate stats block count={html.count(dup_block)}, expected 1")
html = html.replace(dup_block, "function cleanDrugName(name) {", 1)

# 2) Remove simple cleanDrugName inserted before normalizeStatsDrugName
simple_clean = """function cleanDrugName(name) {
  if (!name) return '';
  // Remove dosage info: numbers with units like mg, ml, g, mcg, iu, etc.
  var cleaned = name.replace(/\\s*\\d+[\\d,.]*\\s*(mg|ml|g|mcg|ug|iu|unit|mci|mbq|kit|vial|tab|cap|amp|bag|btl|syr|pen)[\\s/]*/gi, ' ');
  // Remove parenthesized content
  cleaned = cleaned.replace(/\\s*\\([^)]*\\)/g, '');
  // Remove trailing special chars and whitespace
  cleaned = cleaned.replace(/[\\s,./\\-]+$/g, '').trim();
  // Capitalize first letter
  if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned || name;
}

function normalizeStatsDrugName"""

sophisticated_anchor = "function normalizeStatsDrugName"
if simple_clean not in html:
    raise SystemExit("simple cleanDrugName block not found")
html = html.replace(simple_clean, sophisticated_anchor, 1)

# 3) renderStats: preferred dept order
html = html.replace(
    "  var depts = sumS.depts || {};\n  var deptKeys = Object.keys(depts).sort(function(a,b){ return depts[b].rx - depts[a].rx; });",
    "  var depts = sumS.depts || {};\n  var preferredOrder = getPreferredDeptOrder();\n  var deptKeys = getOrderedDepts(depts, preferredOrder);",
    1,
)

# 4) renderStats: matrix uses statsDrugDisplayName + getOrderedDepts
old_matrix = """  // ── 약품 × 진료과 매트릭스 (집계 합산) ──
  var deptOrder = ['IMR','IMH','IMN','IME','IMI','IMJ','GIC','GS','OG','UR','OS','CV','TS','NS','NR','RH','OT','PD','HOSPICE','기타'];
  // 서버 캐시의 옛 키를 현재 cleanDrugName으로 재정규화 (중복 병합)
  var rawDrugDept = sumS.drugDept || {};
  var drugDept = {};
  Object.keys(rawDrugDept).forEach(function(cn){
    var norm = cleanDrugName(cn);"""

new_matrix = """  // ── 약품 × 진료과 매트릭스 (집계 합산, 보고용 순서/약품명 통일) ──
  var rawDrugDept = sumS.drugDept || {};
  var drugDept = {};
  Object.keys(rawDrugDept).forEach(function(cn){
    var norm = statsDrugDisplayName(cn);"""

if old_matrix not in html:
    raise SystemExit("matrix block not found")
html = html.replace(old_matrix, new_matrix, 1)

html = html.replace(
    "    var activeDepts = deptOrder.filter(function(d){ return usedDepts[d]; });\n    Object.keys(usedDepts).forEach(function(d){ if (activeDepts.indexOf(d) < 0) activeDepts.push(d); });",
    "    var activeDepts = getOrderedDepts(usedDepts, preferredOrder);",
    1,
)

# 5) buildDailyStatsFull: report dept codes + display drug names
html = html.replace(
    "    var dc = getDeptCode(r.doctor, r.dept);\n    if (!depts[dc]) depts[dc] = { pts:{}, rx:{} };",
    "    var dc = getReportDeptCode(r.doctor, r.dept);\n    if (!depts[dc]) depts[dc] = { pts:{}, rx:{} };",
    1,
)
html = html.replace(
    "  // 약품×진료과 매트릭스 (cleanDrugName)\n  var drugDept = {};\n  fMix.concat(fOut).forEach(function(r){\n    var cn = cleanDrugName(r.name);\n    if (!cn) return;\n    var dc = getDeptCode(r.doctor, r.dept);",
    "  // 약품×진료과 매트릭스 (statsDrugDisplayName + report dept)\n  var drugDept = {};\n  fMix.concat(fOut).forEach(function(r){\n    var cn = statsDrugDisplayName(r.name);\n    if (!cn) return;\n    var dc = getReportDeptCode(r.doctor, r.dept);",
    1,
)
html = html.replace(
    "  fMix.forEach(function(r){\n    var cn = cleanDrugName(r.name);\n    if (!drugDetail[cn]) drugDetail[cn] = { inQty:0, outQty:0, inPts:{}, outPts:{} };",
    "  fMix.forEach(function(r){\n    var cn = statsDrugDisplayName(r.name);\n    if (!drugDetail[cn]) drugDetail[cn] = { inQty:0, outQty:0, inPts:{}, outPts:{} };",
    1,
)
html = html.replace(
    "  fOut.forEach(function(r){\n    var cn = cleanDrugName(r.name);\n    if (!drugDetail[cn]) drugDetail[cn] = { inQty:0, outQty:0, inPts:{}, outPts:{} };",
    "  fOut.forEach(function(r){\n    var cn = statsDrugDisplayName(r.name);\n    if (!drugDetail[cn]) drugDetail[cn] = { inQty:0, outQty:0, inPts:{}, outPts:{} };",
    1,
)
html = html.replace(
    "    if (getDeptCode(r.doctor, r.dept) === '기타') {",
    "    if (getReportDeptCode(r.doctor, r.dept) === '기타') {",
    1,
)

# 6) dept order editor uses report dept codes
html = html.replace(
    "    var d = getDeptCode(r.doctor);\n    used[d] = true;",
    "    var d = getReportDeptCode(r.doctor, r.dept);\n    used[d] = true;",
    1,
)

# sanity checks
assert html.count("var _statsPeriod = 'daily';") == 1, "still duplicate _statsPeriod"
assert html.count("function cleanDrugName(name)") == 1, "still duplicate cleanDrugName"
assert "deptOrder = ['IMR'" not in html, "hardcoded deptOrder still present"

DST.write_text(html, encoding="utf-8")
print("public/index.html stats screen fixed OK")