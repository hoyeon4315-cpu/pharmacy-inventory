# -*- coding: utf-8 -*-
import zipfile
import re
from pathlib import Path

ref = Path(r"C:\Users\duih\Desktop\이호연\월마감\202604\파트장\항암제 TPN 조제통계(26년 4월)-보고용.xlsx")
with zipfile.ZipFile(ref) as z:
    styles = z.read("xl/styles.xml").decode("utf-8")
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")

for cell in ["B2", "M2", "M3", "A63", "B63", "M63"]:
    m = re.search(r'r="%s"[^>]*s="(\d+)"' % cell, sheet)
    print(cell, "xfId", m.group(1) if m else "?")

fills = re.findall(r"<fill>(.*?)</fill>", styles, re.S)
print("\n--- fills with color ---")
for i, f in enumerate(fills):
    if "theme" in f or "rgb" in f or "indexed" in f:
        print(i, f.replace("\n", " ")[:350])

# cellXfs
cell_xfs = re.findall(r'<xf ([^/>]*)/>', styles)
print("\n--- xfs using fill 2 or 3 (sample) ---")
for i, xf in enumerate(cell_xfs[:20]):
    if "fillId" in xf:
        print(i, xf)