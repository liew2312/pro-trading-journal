window.APP_BUILD = '2026-10-04-v60';
console.log('[APP] LiewTrade Journal build', window.APP_BUILD);
// แสดงเลขเวอร์ชันในหน้าตั้งค่า
(function(){ var el = document.getElementById('appVersionLabel'); if (el) el.textContent = 'เวอร์ชัน ' + window.APP_BUILD; })();
// ─── อัปเดตแอป: ยกเลิก Service Worker + ลบ cache ทั้งหมด + โหลดใหม่แบบข้ามแคช ───
window.forceAppUpdate = async function() {
  var icon = document.getElementById('updateIcon');
  if (icon) icon.classList.add('fa-spin');
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(r){ return r.unregister(); }));
    }
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }
  } catch (e) { console.warn('[UPDATE] error:', e); }
  // เติม query กันแคชของ browser/CDN แล้ว reload
  var u = new URL(window.location.href);
  u.searchParams.set('_v', Date.now());
  window.location.replace(u.toString());
};
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js')
      .then(function(reg) {
        console.log('[PWA] Service Worker registered:', reg.scope);
        // ตรวจหาเวอร์ชันใหม่ทุกครั้งที่เปิดแอพ
        reg.update();
        // ถ้ามี SW ใหม่ติดตั้งแล้วและรอ activate → reload หน้า
        reg.addEventListener('updatefound', function() {
          const newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', function() {
              if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version active, reloading…');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch(function(err) { console.warn('[PWA] Service Worker registration failed:', err); });

    // ถ้า SW เปลี่ยน controller → reload (ครอบคลุมกรณี skipWaiting)
    let _refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (_refreshing) return;
      _refreshing = true;
      window.location.reload();
    });
  });
}

// ─── PWA Install Banner (Add to Home Screen) ───────────
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _pwaPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

window._installPWA = function() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    }
    _pwaPrompt = null;
  });
};

window.addEventListener('appinstalled', function() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
});

