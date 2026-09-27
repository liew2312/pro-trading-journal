// Service Worker — LiewTrade Journal
// เวอร์ชัน cache เปลี่ยนทุก release (tools/release.py แก้ให้อัตโนมัติ) → cache เก่าถูกลบทิ้ง
const CACHE_NAME = 'tradejournal-cache-2026-09-27-v53';
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // หน้า HTML: network-first (ได้เวอร์ชันใหม่เสมอ) · ออฟไลน์ค่อยใช้ cache
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // ไฟล์ของแอปเอง (css/js/รูป): cache-first — ไฟล์ css/js มี ?v=เวอร์ชัน ต่อท้ายจึงไม่ค้างของเก่า
  // Supabase / ข่าว / CDN / TradingView ปล่อยผ่านเครือข่ายตามปกติ
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});

// กดที่การแจ้งเตือนข่าว → เปิด/โฟกัสแอป
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
