#!/usr/bin/env python3
"""ตั้งเลขเวอร์ชันใหม่ทั้งแอปในคำสั่งเดียว

ใช้:  python tools/release.py            → วันที่วันนี้ + เลขถัดไป (เช่น 2026-09-28-v49)
      python tools/release.py 2026-10-01-v50  → กำหนดเอง

แก้ 3 จุดให้ตรงกัน:
  - index.html   : ?v=... ท้ายไฟล์ css/js ทุกไฟล์ (บังคับให้มือถือโหลดไฟล์ใหม่)
  - js/06-pwa.js : window.APP_BUILD (เลขที่โชว์ในหน้าตั้งค่า)
  - sw.js        : CACHE_NAME (ล้าง cache เก่า)
"""
import re, sys, datetime, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
pwa = root / 'js' / '06-pwa.js'
cur = re.search(r"APP_BUILD = '([^']+)'", pwa.read_text(encoding='utf-8')).group(1)
if len(sys.argv) > 1:
    new = sys.argv[1]
else:
    n = int(re.search(r'v(\d+)$', cur).group(1)) + 1
    new = f"{datetime.date.today().isoformat()}-v{n}"
def sub(path, pattern, repl):
    p = root / path; s = p.read_text(encoding='utf-8'); s2, k = re.subn(pattern, repl, s)
    if not k: sys.exit(f'ไม่พบจุดที่ต้องแก้ใน {path}')
    p.write_text(s2, encoding='utf-8'); return k
k = sub('index.html', r'(\.(?:css|js))\?v=[\w.-]+', r'\1?v=' + new)
sub('js/06-pwa.js', r"APP_BUILD = '[^']+'", f"APP_BUILD = '{new}'")
sub('sw.js', r"CACHE_NAME = '[^']+'", f"CACHE_NAME = 'tradejournal-cache-{new}'")
print(f'{cur}  →  {new}   (อัปเดต {k} ลิงก์ใน index.html)')
