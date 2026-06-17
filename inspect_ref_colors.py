# -*- coding: utf-8 -*-
import zipfile
import re
from pathlib import Path
import openpyxl

ref = Path(r"C:\Users\duih\Desktop\이호연\월마감\202604\파트장\항암제 TPN 조제통계(26년 4월)-보고용.xlsx")

with zipfile.ZipFile(ref) as z:
    theme_xml = z.read("xl/theme/theme1.xml").decode("utf-8")
    colors = re.findall(r'<a:srgbClr val="([0-9A-Fa-f]{6})"', theme_xml)
    print("Theme sRGB palette (dk1, lt1, dk2, lt2, accent1-6, hlink, folHlink):")
    for i, c in enumerate(colors):
        print(f"  [{i}] #{c}")

wb = openpyxl.load_workbook(ref)
ws = wb["항암제"]

# theme 2 = accent1 in 0-based theme list? 
# openpyxl theme: 0=lt1, 1=dk1, 2=accent1, 3=accent2, ...
# Actually in OOXML: theme 0 = lt1, 1 = dk1, 2 = accent1, 3 = accent2, 4 = accent3, 5 = accent4, 6 = accent5, 7 = accent6, 8 = hlink, 9 = folHlink

def theme_to_rgb(theme_idx, tint=0.0):
    # simplified: map from extracted palette
    # openpyxl uses: 0=lt1, 1=dk1, 2=accent1, 3=accent2, 4=accent3, 5=accent4, 6=accent5, 7=accent6
    mapping = {0: 1, 1: 0, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9}  # guess
    if theme_idx in (0, 1):
        idx = theme_idx
    else:
        idx = theme_idx  # accent = theme-2+4? 
    # Standard Office theme order in file:
    # [0] dk1, [1] lt1, [2] dk2, [3] lt2, [4] accent1, [5] accent2, ...
    theme_map = {0: 1, 1: 0, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11}
    if theme_idx in theme_map and theme_map[theme_idx] < len(colors):
        hexcol = colors[theme_map[theme_idx]]
        print(f"theme {theme_idx} tint {tint} -> #{hexcol}")
        return hexcol
    return None

for addr in ["B2", "M2", "M3", "A63", "B63"]:
    c = ws[addr]
    fg = c.fill.fgColor
    print(addr, "theme", fg.theme, "tint", fg.tint, "indexed", fg.indexed, "rgb", fg.rgb)