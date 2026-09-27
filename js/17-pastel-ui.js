(function(){ // เงาใต้หัวที่ล็อกไว้เมื่อเลื่อน
  const tick=()=>{ const h=document.getElementById('tj-dash-head'), y=window.scrollY>40;
    if(h) h.classList.toggle('stuck',y); const hh=document.getElementById('tj-hist-head'); if(hh) hh.classList.toggle('stuck',y); };
  window.addEventListener('scroll',tick,{passive:true}); tick();
})();


// ══ v41: การ์ดหลักเปลี่ยนสีตามกำไร/ขาดทุน + สถานะว่าง + เลิกโหลด ══
(function(){
  const dash = () => document.getElementById('dashboard');
  function apply(data){
    try{
      const d = dash(); if(d) d.classList.remove('pj-loading');
      const pnl = Number(data && data.totalPnl) || 0;
      const n = Number(data && data.trades) || 0;
      const hero = document.getElementById('pj-hero');
      if(hero){ hero.classList.remove('pos','neg','zero'); hero.classList.add(pnl>0?'pos':(pnl<0?'neg':'zero')); }
      const dir = document.getElementById('pj-hero-dir');
      if(dir) dir.textContent = pnl>0 ? '▲ กำไร' : (pnl<0 ? '▼ ขาดทุน' : '— เท่าทุน');
      const wr = document.getElementById('pj-hero-wr');
      if(wr) wr.textContent = (data && data.winRate!=null && n) ? data.winRate+'%' : '—';
      const empty = document.getElementById('pj-empty');
      if(empty) empty.hidden = n>0;
      if(d) d.classList.toggle('pj-is-empty', n===0);
      const ins = document.getElementById('ai-insights-container');
      if(ins && n>0 && !ins.children.length) ins.innerHTML = '<div class="pj-insight-none">ยังไม่มีข้อสังเกตในช่วงนี้ บันทึกเพิ่มอีกสักหน่อยแล้วระบบจะเริ่มเห็นรูปแบบการเทรดของคุณ</div>';
    }catch(e){ console.error('pj hero', e); }
  }
  function install(){
    const orig = window.updateDashboardUI;
    if(typeof orig!=='function'){ setTimeout(install,60); return; }
    window.updateDashboardUI = function(data){ orig.apply(this, arguments); apply(data); };
  }
  install();
  // กันค้าง: ถ้าผ่านไป 15 วินาทียังไม่มีข้อมูล ให้เลิกแสดงโครงร่าง
  setTimeout(()=>{ const d=dash(); if(d) d.classList.remove('pj-loading'); }, 15000);
})();


// ══ v42: แท็บหน้าสถิติ · แถบผลการปิดออเดอร์ · ปุ่มเลือกทิศทาง/ผลลัพธ์ ══
(function(){
  // ── แท็บหน้าสถิติ ──
  const an = document.getElementById('analytics');
  if(an){
    const MAP = [['overview',['#stat-tp','#tjCumChart','#tjDailyChart','#adv-streak','#rDistChart']],
                 ['time',['#tj-heatmap','#tj-sess-perf','#tjDowChart']],
                 ['behave',['#tj-news-perf','#tj-eff-perf','#tag-best','#tj-behave-perf']],
                 ['setup',['#tj-grade-perf','#setup-stats-container']]];
    [...an.children].forEach(el=>{
      if(el.dataset.pjTab || el.classList.contains('tj-page-head') || el.id==='tj-filterbar' || el.id==='pj-perf-tabs' || el.classList.contains('pj-dup-hidden')) return;
      for(const [t,sels] of MAP){ if(sels.some(q=>el.querySelector(q))){ el.dataset.pjTab = t; return; } }
    });
    const tabs = document.getElementById('pj-perf-tabs');
    let cur = 'overview'; try{ cur = localStorage.getItem('tj_perf_tab') || 'overview'; }catch(e){}
    if(!['overview','time','behave','setup'].includes(cur)) cur = 'overview';
    function setTab(t){
      an.dataset.tab = t;
      tabs.querySelectorAll('button').forEach(b=>{ const on = b.dataset.t===t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); });
      try{ localStorage.setItem('tj_perf_tab', t); }catch(e){}
      requestAnimationFrame(()=>{ try{ if(window.Chart && Chart.instances) Object.values(Chart.instances).forEach(c=>{ if(c && c.canvas && c.canvas.offsetParent) c.resize(); }); }catch(e){} });
    }
    tabs.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ setTab(b.dataset.t); const top = tabs.getBoundingClientRect().top; if(top < 60) window.scrollTo({top: window.scrollY + top - 70, behavior:'smooth'}); }));
    setTab(cur);
  }

  // ── แถบสัดส่วนผลการปิด + คะแนนวินัย (หลังได้ข้อมูลจาก updateDashboardUI) ──
  function ocBar(){
    const bar = document.getElementById('pj-oc-bar'); if(!bar) return;
    const ids = {tp:'stat-tp', mwin:'stat-mwin', be:'stat-be', closs:'stat-mloss', sl:'stat-sl'};
    const v = {}; let tot = 0;
    Object.keys(ids).forEach(k=>{ const el = document.getElementById(ids[k]); const n = el ? parseFloat(el.textContent) : 0; v[k] = isFinite(n) && n>0 ? n : 0; tot += v[k]; });
    Object.keys(ids).forEach(k=>{ const s = bar.querySelector('.'+k); if(s) s.style.width = tot ? (v[k]/tot*100)+'%' : '0'; });
  }
  function after(data){
    try{
      ocBar();
      const dk = document.querySelector('#pj-kpi-disc .tj-kpi-value');
      if(dk && data && data.disciplineScore!=null && data.disciplineScore!=='') dk.textContent = data.disciplineScore;
    }catch(e){ console.error('pj v42', e); }
  }
  (function install(){
    const orig = window.updateDashboardUI;
    if(typeof orig!=='function'){ setTimeout(install,60); return; }
    window.updateDashboardUI = function(data){ orig.apply(this, arguments); after(data); };
  })();

  // ── ปุ่มเลือกทิศทาง / ผลลัพธ์ (ผูกกับ select เดิม → ค่าที่บันทึกเหมือนเดิมทุกอย่าง) ──
  const form = document.getElementById('tradeForm');
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const descIdx = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  function bind(sel, box){
    if(!sel || !box) return;
    const btns = [...box.querySelectorAll('button[data-v]')];
    const sync = ()=>{ const v = desc.get.call(sel); btns.forEach(b=>b.setAttribute('aria-checked', b.dataset.v===v ? 'true':'false')); if(v) box.classList.remove('pj-invalid'); };
    // ค่าที่ถูกตั้งจากโค้ด (เช่น ตอนกดแก้ไขออเดอร์) → ปุ่มอัปเดตตาม
    Object.defineProperty(sel, 'value', { configurable:true, get(){ return desc.get.call(this); }, set(v){ desc.set.call(this, v); sync(); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable:true, get(){ return descIdx.get.call(this); }, set(v){ descIdx.set.call(this, v); sync(); } });
    btns.forEach(b=>b.addEventListener('click', ()=>{
      desc.set.call(sel, b.dataset.v); sync();
      sel.dispatchEvent(new Event('input', {bubbles:true})); sel.dispatchEvent(new Event('change', {bubbles:true}));
    }));
    sel.addEventListener('change', sync);
    sel.addEventListener('invalid', ()=>{ box.classList.add('pj-invalid'); try{ box.scrollIntoView({block:'center', behavior:'smooth'}); }catch(e){} });
    if(form) form.addEventListener('reset', ()=>setTimeout(sync, 0));
    sync();
  }
  if(form){
    bind(form.querySelector('select[name="type"]'), document.getElementById('pj-side-seg'));
    bind(form.querySelector('select[name="outcome"]'), document.getElementById('pj-oc-chips'));
  }
})();


// ══ v43: ตัวเลือกเดือน/ปีตัวเดิม (id เดิม) ย้ายไปอยู่ในหน้าที่ใช้มัน ══
(function(){
  const pill = document.getElementById('tj-period');
  const park = pill ? pill.parentNode : null;   // ที่เดิมในแถบหัว (ซ่อนไว้)
  if(!pill || !park) return;
  function place(id){
    const slot = document.querySelector('.pj-period-slot[data-for="'+id+'"]');
    const target = slot || park;
    if(pill.parentNode !== target) target.appendChild(pill);
  }
  (function hook(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hook,60); return; }
    window.switchTab = function(id){ const r = orig.apply(this, arguments); try{ place(id); }catch(e){} return r; };
    const act = document.querySelector('.page-section.active'); place(act ? act.id : 'dashboard');
  })();
})();

