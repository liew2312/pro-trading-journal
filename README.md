# LiewTrade Journal

เว็บแอปบันทึกเทรด (PWA) — https://liew2312.github.io/pro-trading-journal/

## โครงสร้างไฟล์

```
index.html          หน้าเว็บ (HTML ล้วน + สคริปต์ธีมเล็กๆ กันจอกระพริบ)
manifest.json       ข้อมูลแอปสำหรับติดตั้งบนมือถือ
sw.js               Service Worker (cache / ออฟไลน์ / แจ้งเตือนข่าว)
icon-192.png, icon-512.png, app-icon.svg   ไอคอนแอป

css/                สไตล์ (โหลดตามลำดับเลข — ไฟล์หลังทับไฟล์ก่อน)
  01-base.css         พื้นฐาน: ตัวแปรสี ฟอร์ม การ์ด ตาราง
  02-analytics.css    แถบกรอง + สถิติเชิงลึก
  03-layout.css       แถบข้าง เมนูล่าง ปฏิทิน หน้าสถิติ กราฟ ข่าว
  04-discipline.css   วันนี้ · กฎ · Playbook · ทบทวน · นำเข้า MT5 · ฟอร์มทีละขั้น
  05-theme.css        ธีมสี (เขียว/แดง/น้ำเงิน/ขาวดำ) + คำทักทาย + การ์ดวินัย
  06-components.css   โปรไฟล์ · TradingView ของฉัน · ปฏิทินตาราง · ประวัติ
  07-pastel.css       ธีมพาสเทล (ค่าเริ่มต้น) + การ์ดหลัก + หน้าสถิติแบ่งแท็บ
  08-extras.css       Timeframe · ปฏิทินมือถือ · Equity curve

js/                 สคริปต์ (โหลดตามลำดับเลข — ห้ามสลับ เพราะไฟล์หลังต่อยอดไฟล์ก่อน)
  01-config.js        ค่า Supabase
  02-api.js           ดึง/บันทึกข้อมูล + คำนวณสถิติ
  03-app.js           หน้าภาพรวม ประวัติ ฟอร์ม (แกนหลัก)
  04-auth.js          ล็อกอิน Google
  05-theme.js         โหมดมืด
  06-pwa.js           เลขเวอร์ชัน · ปุ่มอัปเดตแอป · ติดตั้งแอป
  07-filters.js       ตัวกรองรวม (ช่วงเวลา/Symbol/Setup/Long-Short)
  08-calendar-performance.js   ปฏิทิน P&L + หน้าสถิติ
  09-chart-page.js    หน้ากราฟ TradingView + จับภาพ
  10-session.js       เซสชันอัตโนมัติ
  11-news.js          ข่าวเศรษฐกิจ + แจ้งเตือน + โหมดทองคำ
  12-discipline.js    กฎความเสี่ยง · Playbook · ทบทวนสัปดาห์ · นำเข้า MT5
  13-trade-form.js    บันทึกด่วน · แก้ไข · ฟอร์มทีละขั้น
  14-dashboard.js     คำทักทาย · การ์ดวินัย · เมนูมือถือ · สีธีม
  15-profile.js       รูปโปรไฟล์ + ชื่อที่แสดง
  16-my-tradingview.js  เปิดกราฟในบัญชี TradingView ของตัวเอง
  17-pastel-ui.js     การ์ดหลัก · แท็บหน้าสถิติ · ตัวเลือกเดือน/ปี
  18-timeframe.js     TF วิเคราะห์ / TF เข้าออเดอร์

workers/            โค้ด Cloudflare Worker (ไม่ได้ถูกโหลดโดยแอป — ไว้ก๊อปไปวางใน Cloudflare)
tools/release.py    ตั้งเลขเวอร์ชันใหม่ทั้งแอปในคำสั่งเดียว
```

## วิธีปล่อยเวอร์ชันใหม่

1. แก้ไฟล์ที่ต้องการ
2. `python tools/release.py` — เปลี่ยนเลขเวอร์ชัน (index.html `?v=`, `APP_BUILD`, cache ของ sw.js) ให้ตรงกัน
   ถ้าไม่เปลี่ยนเลข มือถือที่เคยเปิดแอปอาจยังใช้ไฟล์ css/js เก่าจาก cache
3. Commit แล้ว Push ขึ้น GitHub (ใช้ GitHub Desktop) — GitHub Pages อัปเดตเองภายใน 1–2 นาที

> อย่าอัปโหลดไฟล์ผ่านหน้าเว็บ GitHub อีก — ให้ repo นี้เป็นต้นฉบับที่เดียว
