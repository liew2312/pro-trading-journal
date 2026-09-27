(function(){
  // เวลาเปิด-ปิดตามเวลาท้องถิ่นของแต่ละตลาด (Intl จัดการ Daylight Saving ให้เอง)
  const SESS = [
    { key:'Sydney',   tz:'Australia/Sydney', open:7*60, close:16*60 },
    { key:'Tokyo',    tz:'Asia/Tokyo',       open:9*60, close:18*60 },
    { key:'London',   tz:'Europe/London',    open:8*60, close:17*60 },
    { key:'New York', tz:'America/New_York', open:8*60, close:17*60 }
  ];
  const fmtCache = {};
  function localParts(tz, d){
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'numeric',weekday:'short',hourCycle:'h23'}));
    const o = {}; f.formatToParts(d).forEach(p=>{ o[p.type]=p.value; });
    return { min: (+o.hour%24)*60 + (+o.minute), wd: o.weekday };
  }
  function isWeekendClosed(d){
    const ny = localParts('America/New_York', d);
    return ny.wd==='Sat' || (ny.wd==='Fri' && ny.min>=17*60) || (ny.wd==='Sun' && ny.min<17*60);
  }
  // คืน { active:[...], primary } — primary = ตลาดที่เปิดทีหลังสุดในช่วงที่ซ้อนกัน
  window.tjSession = function(d){
    if(!(d instanceof Date) || isNaN(d)) return { active:[], primary:'' };
    if(isWeekendClosed(d)) return { active:[], primary:'Off-session', weekend:true };
    const active = SESS.filter(s=>{ const m = localParts(s.tz, d).min; return m>=s.open && m<s.close; }).map(s=>s.key);
    return { active, primary: active.length ? active[active.length-1] : 'Off-session' };
  };
  window.tjSessionOf = function(dateBase, hhmm){
    let d = new Date(dateBase);
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm||'').trim());
    if(m) d.setHours(+m[1], +m[2], 0, 0);
    return window.tjSession(d);
  };
  window.TJ_SESSIONS = SESS.map(s=>s.key);

  // ── ฟอร์มบันทึกออเดอร์ ──
  const form = document.getElementById('tradeForm'); if(!form) return;
  const sel = form.querySelector('[name="session"]');
  const et  = form.querySelector('[name="entryTime"]');
  const badge = document.getElementById('tj-sess-auto');
  const hint  = document.getElementById('tj-sess-hint');
  let auto = true, setting = false;
  const TH = { 'Sydney':'ซิดนีย์', 'Tokyo':'โตเกียว', 'London':'ลอนดอน', 'New York':'นิวยอร์ก' };

  // ฟอร์มไม่มีช่องวันที่ — ถ้าเวลาที่ได้ตกช่วงตลาดปิดสุดสัปดาห์ (เช่น มาบันทึกย้อนหลังวันเสาร์) ให้อิงวันทำการล่าสุด
  function formSession(){
    const dv = (document.getElementById('f_date')||{}).value;
    let base = new Date();
    if(/^\d{4}-\d{2}-\d{2}$/.test(dv||'')){ const p = dv.split('-').map(Number); base = new Date(p[0], p[1]-1, p[2], base.getHours(), base.getMinutes()); }
    let r = window.tjSessionOf(base, et && et.value), shifted = false;
    for(let i=1; r.weekend && i<=3; i++){ const d = new Date(base); d.setDate(d.getDate()-i); r = window.tjSessionOf(d, et && et.value); shifted = true; }
    r.shifted = shifted && !r.weekend; return r;
  }
  function update(){
    const useNow = !(et && et.value);
    const r = formSession();
    const now = new Date(), p = n=>String(n).padStart(2,'0');
    const when = useNow ? ('ตอนนี้ '+p(now.getHours())+':'+p(now.getMinutes())) : ('เวลาเข้า '+et.value);
    if(hint){
      const chips = SESS.map(s=>`<span class="tj-sess-chip ${r.active.includes(s.key)?'on':''}">${s.key}</span>`).join('');
      const txt = r.weekend ? 'ตลาดปิดช่วงสุดสัปดาห์' : (r.active.length>1 ? 'ช่วงตลาดซ้อน: '+r.active.join(' + ') : (r.active.length ? 'เซสชัน '+TH[r.primary] : 'นอกเวลาตลาดหลัก'));
      hint.innerHTML = chips + `<span>· ${when} · ${txt}${r.shifted?' (อิงวันทำการล่าสุด)':''}</span>`;
    }
    if(auto && sel && r.primary){ setting = true; sel.value = r.primary; setting = false; }
    if(badge) badge.classList.toggle('off', !auto);
    if(badge) badge.innerHTML = auto ? '<i class="fa-solid fa-wand-magic-sparkles"></i> อัตโนมัติ' : '<i class="fa-solid fa-hand"></i> เลือกเอง · กดเพื่อกลับเป็นอัตโนมัติ';
  }
  if(et){ et.addEventListener('input', update); et.addEventListener('change', update); }
  const fd = document.getElementById('f_date'); if(fd) fd.addEventListener('change', update);
  if(sel) sel.addEventListener('change', ()=>{ if(setting) return; auto = false; update(); });
  if(badge) badge.addEventListener('click', ()=>{ auto = true; update(); });
  form.addEventListener('reset', ()=>{ auto = true; setTimeout(update, 0); });
  (function hook(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hook,60); return; }
    window.switchTab = function(id){ const r = orig.apply(this, arguments); if(id==='add-trade') update(); return r; };
  })();
  setInterval(()=>{ const pg=document.querySelector('.page-section.active'); if(pg && pg.id==='add-trade' && !(et && et.value)) update(); }, 60000);
  update();
})();

