# -*- coding: utf-8 -*-
"""Sync stats Excel export from 항암제_재고관리.html into public/index.html for Cloudflare deploy."""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "항암제_재고관리.html"
DST = ROOT / "public" / "index.html"

src = SRC.read_text(encoding="utf-8")
dst = DST.read_text(encoding="utf-8")

def extract_between(text, start_marker, end_marker):
    s = text.index(start_marker)
    e = text.index(end_marker, s)
    return text[s:e]

# --- 1) constants ---
const_block = extract_between(src, "const DEFAULT_STATS_DEPT_ORDER", "// 항암제 코드 → 성분명")
const_block = const_block.rstrip() + "\nconst REPORT_DEPT_FALLBACK = {\n  'OS':'OR','CV':'기타','TS':'기타','NS':'기타','IME':'기타','IMI':'기타',\n  'RH':'기타','OT':'기타','PD':'기타','HOSPICE':'기타','Hospice':'기타'\n};\n"

anchor = "// 처방의 → 진료과 코드 매핑"
if "DEFAULT_STATS_DEPT_ORDER" not in dst:
    dst = dst.replace(anchor, const_block + "\n" + anchor, 1)

# --- 2) helper functions (after getIngredient) ---
helpers = extract_between(src, "// ── 통계 진료과 순서 헬퍼", "function getStatsData()")
helpers = helpers.replace("function getStatsData()", "").rstrip()

extra = """
function getReportDeptCode(doctor, deptFallback) {
  var code = getDeptCode(doctor, deptFallback);
  if (DEFAULT_STATS_DEPT_ORDER.indexOf(code) >= 0) return code;
  return REPORT_DEPT_FALLBACK[code] || '기타';
}
"""

if "function getPreferredDeptOrder" not in dst:
    dst = dst.replace(
        "function getIngredient(code) {\n  return CODE_TO_INGREDIENT[code] || '';\n}",
        "function getIngredient(code) {\n  return CODE_TO_INGREDIENT[code] || '';\n}\n" + helpers + extra,
        1,
    )

# --- 3) export function (public variant uses getReportDeptCode) ---
i0 = src.index("function exportStatsDeptExcel()")
i1 = src.index("// ============================================================\n// 공통", i0)
export_fn = src[i0:i1]
export_fn = export_fn.replace(
    "var dept = getDeptCode(r.doctor);",
    "var dept = getReportDeptCode(r.doctor, r.dept);",
)
export_fn = export_fn.replace("var msg = '보낼 통계", "var msg = '내볼 통계")

if "function exportStatsDeptExcel" not in dst:
    dst = dst.replace(
        "// ============================================================\n// 공통\n// ============================================================\n// 약품 드롭다운 데이터",
        export_fn + "\n// ============================================================\n// 공통\n// ============================================================\n// 약품 드롭다운 데이터",
        1,
    )

# --- 4) HTML UI ---
old_toggle = """    <div style="display:flex;gap:8px;margin-bottom:12px;" id="statsViewToggle">
      <button class="stats-toggle-btn active" onclick="toggleStatsView('dept')">진료과별 통계</button>
      <button class="stats-toggle-btn" onclick="toggleStatsView('ampm')">조제통계 (오전/오후)</button>
    </div>"""

new_toggle = """    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;" id="statsViewToggle">
      <button class="stats-toggle-btn active" onclick="toggleStatsView('dept')">진료과별 통계</button>
      <button class="stats-toggle-btn" onclick="toggleStatsView('ampm')">조제통계 (오전/오후)</button>
      <button class="stats-print-btn" onclick="exportStatsDeptExcel()" style="margin-left:12px;background:#0ea5e9;color:white;border-color:#0ea5e9;">엑셀 다운로드 (보고용 양식)</button>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:8px;">※ 보고용 양식(GS→GIC→IMH…)으로 다운로드. 진료과 순서는 아래 편집 설정이 반영됩니다.</div>"""

if "exportStatsDeptExcel()" not in dst:
    dst = dst.replace(old_toggle, new_toggle, 1)

old_dept_summary = """        <h4 style="font-size:13px;font-weight:700;margin-bottom:6px;color:#334155;">진료과별 요약</h4>
        <div id="statsDoctorTable"></div>
      </div>"""

new_dept_summary = """        <h4 style="font-size:13px;font-weight:700;margin-bottom:6px;color:#334155;">진료과별 요약</h4>
        <div id="statsDoctorTable"></div>
        <div id="deptReorderPanel" style="display:none;margin-top:6px;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;">
          <div style="font-weight:600;margin-bottom:3px;color:#334155;">진료과 순서 편집 (보고용 엑셀 컬럼 순서)</div>
          <div id="deptReorderList" style="line-height:1.4;"></div>
          <div style="margin-top:4px;display:flex;gap:6px;">
            <button onclick="saveDeptOrderEdit()" class="stats-print-btn" style="font-size:11px;">이 순서 저장</button>
            <button onclick="cancelDeptOrderEdit()" class="stats-print-btn" style="font-size:11px;">취소</button>
          </div>
        </div>
        <div style="margin-top:4px;">
          <button onclick="startDeptOrderEdit()" class="stats-print-btn" style="font-size:11px;">진료과 순서 편집</button>
        </div>
      </div>"""

if "deptReorderPanel" not in dst:
    dst = dst.replace(old_dept_summary, new_dept_summary, 1)

# --- 5) state.statsDeptOrder ---
if "statsDeptOrder" not in dst:
    dst = dst.replace(
        "  customDepts: [] // [{code, name}] — 사용자 추가 진료과\n};",
        "  customDepts: [], // [{code, name}] — 사용자 추가 진료과\n  statsDeptOrder: [] // 보고용 엑셀/통계 진료과 순서\n};",
        1,
    )
    dst = dst.replace(
        "  state.customDepts = [];\n  // 2) 뷰 / 정렬",
        "  state.customDepts = [];\n  state.statsDeptOrder = [];\n  // 2) 뷰 / 정렬",
        1,
    )

# backup payload merge
if "statsDeptOrder: []" not in dst.split("forecastUsage")[1][:500] if "forecastUsage" in dst else True:
    dst = dst.replace(
        "forecastUsage: { from:'', to:'', items:[] }\n  };",
        "forecastUsage: { from:'', to:'', items:[] }, statsDeptOrder: []\n  };",
        1,
    )

# --- 6) matrix drug names: statsDrugDisplayName ---
dst = dst.replace(
    "    var norm = cleanDrugName(cn); if (!norm) norm = cn;",
    "    var norm = statsDrugDisplayName(cn); if (!norm) norm = cn;",
    1,
)

DST.write_text(dst, encoding="utf-8")
print("public/index.html synced OK")