// ── Apply theme ทันทีก่อน render เพื่อไม่ให้กระพริบ ──
(function() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function _syncDarkModeUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const icon  = document.getElementById('darkModeIcon');
  const track = document.getElementById('darkModeTrack');
  const thumb = document.getElementById('darkModeThumb');
  if (icon)  icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  if (track) track.style.background = isDark ? '#1E1E24' : '#E4E1D8';
  if (thumb) thumb.style.transform  = isDark ? 'translateX(24px)' : 'translateX(0)';
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  _syncDarkModeUI();
  if (window.equityChart) {
    const gridColor = newTheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = newTheme === 'dark' ? '#70707A' : '#9C9CA4';
    window.equityChart.options.scales.x.grid.color = gridColor;
    window.equityChart.options.scales.y.grid.color = gridColor;
    window.equityChart.options.scales.x.ticks.color = tickColor;
    window.equityChart.options.scales.y.ticks.color = tickColor;
    window.equityChart.update();
  }
}

// sync UI ทุกครั้งที่ modal เปิด
document.addEventListener('DOMContentLoaded', function() {
  _syncDarkModeUI();
  const settingsEl = document.getElementById('settingsModal');
  if (settingsEl) {
    settingsEl.addEventListener('show.bs.modal', _syncDarkModeUI);
  }
});

