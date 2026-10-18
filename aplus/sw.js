// Service Worker — A+ Check (แยกจาก LiewTrade, scope เฉพาะโฟลเดอร์ /aplus/)
// เปลี่ยนเลขเวอร์ชันทุกครั้งที่แก้ไฟล์ในโฟลเดอร์นี้
const CACHE = 'aplus-check-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
  './guide.html', './guide/ov.jpg', './guide/s1.jpg', './guide/s2.jpg', './guide/s3.jpg', './guide/s4.jpg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('aplus-check-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
// network-first แล้วเก็บสำเนาไว้ → ได้เวอร์ชันใหม่เมื่อมีเน็ต และเปิดได้เมื่อออฟไลน์
// (cache นี้อาจถูก LiewTrade ล้างตอนอัปเดต จึงเติมกลับทุกครั้งที่โหลดสำเร็จ)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin && url.pathname.startsWith(new URL('./', self.registration.scope).pathname);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!own && !font) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
