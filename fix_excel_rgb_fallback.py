from pathlib import Path
ROOT = Path(__file__).parent
for name in ["public/index.html", "항암제_재고관리.html"]:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    t = t.replace("fgColor: { theme: 2, tint: 0 }", "fgColor: { rgb: 'FF1F497D' }")
    t = t.replace("fgColor: { theme: 0, tint: -0.1499984740745262 }", "fgColor: { rgb: 'FFD9D9D9' }")
    p.write_text(t, encoding="utf-8")
    print("ok", name)