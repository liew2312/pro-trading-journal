// อัปเดตเวอร์ชันของ Cache เป็น v17 เพื่อบังคับล้าง cache เก่าทุกเครื่อง (deploy 2026-07-18 · ตัดให้เหลือแก่น: สถิติเชิงลึก + R-distribution + Edge leaderboard + ตัวกรอง)
const CACHE_NAME = 'tradejournal-cache-v40';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

// ติดตั้ง Service Worker และ Cache ทรัพยากร
self.addEventListener('install', event => {
  // บังคับให้ SW ใหม่ activate ทันที ไม่ต้องรอ tab เก่าปิด
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// เปิดใช้งาน Service Worker และลบ Cache เก่าทั้งหมด
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // ลบ Cache เก่าทุกเวอร์ชัน
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // เข้าควบคุม tab ทั้งหมดทันที
      self.clients.claim()
    ])
  );
});

// Network-first สำหรับ HTML — ให้โหลดเวอร์ชันใหม่เสมอ ถ้า offline ค่อยใช้ cache
self.addEventListener('fetch', event => {
  const req = event.request;
  // เฉพาะ HTML / navigation requests → network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // อัปเดต cache ด้วยเวอร์ชันใหม่
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // ทรัพยากรอื่น: cache-first เฉพาะไฟล์ static ของแอปเอง (โดเมนเดียวกัน, GET)
  // ข้อมูลจาก Supabase / ข่าว / CDN / TradingView ปล่อยผ่านเครือข่ายตามปกติ (ไม่ cache เพื่อไม่ให้ข้อมูลค้าง)
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') !== -1) return;
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, c)); }
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
