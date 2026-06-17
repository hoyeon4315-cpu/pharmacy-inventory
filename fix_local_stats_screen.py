# -*- coding: utf-8 -*-
from pathlib import Path

HTML = Path(__file__).parent / "항암제_재고관리.html"
html = HTML.read_text(encoding="utf-8")

if "REPORT_DEPT_FALLBACK" not in html:
    html = html.replace(
        "  '5-fu':'5-FU','5-Fu':'5-FU','Herceptin sc':'Herceptin SC','Mabthera sc':'Mabthera SC'\n};\n\n// 항암제 코드",
        "  '5-fu':'5-FU','5-Fu':'5-FU','Herceptin sc':'Herceptin SC','Mabthera sc':'Mabthera SC'\n};\n"
        "const REPORT_DEPT_FALLBACK = {\n"
        "  'OS':'OR','CV':'기타','TS':'기타','NS':'기타','IME':'기타','IMI':'기타',\n"
        "  'RH':'기타','OT':'기타','PD':'기타','HOSPICE':'기타','Hospice':'기타'\n};\n\n// 항암제 코드",
        1,
    )

if "function getReportDeptCode" not in html:
    html = html.replace(
        "  return result;\n}\n\nvar _statsPeriod = 'daily';",
        "  return result;\n}\nfunction getReportDeptCode(doctor, deptFallback) {\n"
        "  var code = getDeptCode(doctor, deptFallback);\n"
        "  if (DEFAULT_STATS_DEPT_ORDER.indexOf(code) >= 0) return code;\n"
        "  return REPORT_DEPT_FALLBACK[code] || '기타';\n}\n\nvar _statsPeriod = 'daily';",
        1,
    )

replacements = [
    ("    var d = getDeptCode(r.doctor);\n    used[d] = true;",
     "    var d = getReportDeptCode(r.doctor, r.dept);\n    used[d] = true;"),
    ("    var dept = getDeptCode(r.doctor);\n    if(!depts[dept])depts[dept]={pts:{},rx:{}};",
     "    var dept = getReportDeptCode(r.doctor, r.dept);\n    if(!depts[dept])depts[dept]={pts:{},rx:{}};"),
    ("    var dept = getDeptCode(r.doctor);\n    if(!drugDept[cname])drugDept[cname]={code:r.code};",
     "    var dept = getReportDeptCode(r.doctor, r.dept);\n    if(!drugDept[cname])drugDept[cname]={code:r.code};"),
    ("      var dept = getDeptCode(r.doctor);\n      if (!drugDept[cname]) drugDept[cname] = {};",
     "      var dept = getReportDeptCode(r.doctor, r.dept);\n      if (!drugDept[cname]) drugDept[cname] = {};"),
]
for old, new in replacements:
    if old in html:
        html = html.replace(old, new, 1)

assert "function getReportDeptCode" in html
assert "getReportDeptCode(r.doctor, r.dept)" in html
HTML.write_text(html, encoding="utf-8")
print("항암제_재고관리.html stats screen synced OK")