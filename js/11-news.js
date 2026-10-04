(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  const pad = n => String(n).padStart(2,'0');
  const ALL_CCY = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD','CNY'];
  const FLAG = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦', CHF:'🇨🇭', NZD:'🇳🇿', CNY:'🇨🇳' };
  const TH_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const TH_MON = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const NEWS_WORKER = 'https://liewtrade-news.lewclassic.workers.dev/api/calendar';
  const WORKER = 'https://liewtrade.lewclassic.workers.dev/api/calendar';
  const URLS = [NEWS_WORKER, WORKER];
  const CACHE_KEY = 'tj_news_cache_v1', TTL = 15*60*1000;
  const NEAR_MIN = 30;

  const st = {
    events: [], loaded: false, error: '', updated: null,
    impact: store.get('tj_news_imp','High'), range: 'upcoming',
    ccy: store.get('tj_news_ccy', null),
    alertOn: store.get('tj_news_alert_on', false), alertMin: store.get('tj_news_alert_min', 15),
    notified: store.get('tj_news_notified', []),
    gold: store.get('tj_news_gold', false)
  };

  // ── โหมดทองคำ: ข่าว USD ที่มีผลกับทองมากที่สุด ──
  // t1 = แรงมาก · t2 = สำคัญ
  const GOLD_T1 = /(FOMC(?! Minutes)|Fed(eral)? (Funds )?(Interest )?Rate|Interest Rate Decision|Fed Press Conference|Fed Chair|Powell|Non[- ]?Farm|Nonfarm|\bNFP\b|Core PCE|PCE Price|\bCPI\b|Consumer Price Index|Inflation Rate)/i;
  const GOLD_T2 = /(Unemployment Rate|Average Hourly Earnings|\bPPI\b|Producer Price|Retail Sales|\bISM\b|JOLT|Job Openings|Jobless Claims|Unemployment Claims|\bADP\b|GDP|FOMC Minutes|Fed .*Testimony|Personal Spending|Personal Income|Michigan|UoM|Consumer Sentiment)/i;
  function goldTier(e){
    if(e.ccy!=='USD') return 0;
    if(GOLD_T1.test(e.title)) return 1;
    if(GOLD_T2.test(e.title)) return 2;
    return 0;
  }

  // ── สกุลเงินที่เกี่ยวกับ Symbol ──
  function ccyOfSymbol(sym){
    sym = String(sym||'').toUpperCase().replace(/^[A-Z]+:/,'');
    const out = new Set();
    ALL_CCY.forEach(c=>{ if(sym.includes(c)) out.add(c); });
    if(/XAU|XAG|GOLD|SILVER|OIL|WTI|BTC|ETH|US30|US500|SPX|NAS|NDX|DJ|US100/.test(sym)) out.add('USD');
    if(/GER|DE40|DAX|EU50|FRA/.test(sym)) out.add('EUR');
    if(/UK100|FTSE/.test(sym)) out.add('GBP');
    if(/JP225|NIK/.test(sym)) out.add('JPY');
    if(/AUS200/.test(sym)) out.add('AUD');
    return Array.from(out);
  }
  function defaultCcy(){
    const set = new Set(['USD']);
    (window._tjRows||[]).forEach(r=>{ if(r.type==='Buy'||r.type==='Sell') ccyOfSymbol(r.symbol).forEach(c=>set.add(c)); });
    return ALL_CCY.filter(c=>set.has(c));
  }
  function selCcy(){ return st.ccy && st.ccy.length ? st.ccy : defaultCcy(); }

  // ── โหลดข่าว ──
  function normalize(arr){
    return (arr||[]).map(e=>{
      const t = new Date(e.date);
      return { id: (e.country||'')+'|'+(e.title||'')+'|'+(e.date||''), title: e.title||'', ccy: String(e.country||'').toUpperCase(), t, impact: e.impact||'', forecast: e.forecast||'', previous: e.previous||'', actual: e.actual||'' };
    }).filter(e=>!isNaN(e.t)).sort((a,b)=>a.t-b.t);
  }
  async function load(force){
    const c = store.get(CACHE_KEY, null);
    if(!force && c && Date.now()-c.ts < TTL && c.events){ st.source = c.source || 'forexfactory'; st.events = normalize(c.events); st.loaded = true; st.error=''; st.updated = new Date(c.ts); renderAll(); return; }
    let lastErr = '';
    for(const u of URLS){
      try{
        const ctl = new AbortController(); const to = setTimeout(()=>ctl.abort(), 12000);
        const r = await fetch(u, { signal: ctl.signal, cache:'no-store' }); clearTimeout(to);
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j.events;
        if(!Array.isArray(arr)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
        st.source = (j && j.source) || 'forexfactory';
        store.set(CACHE_KEY, { ts: Date.now(), events: arr, source: st.source });
        st.events = normalize(arr); st.loaded = true; st.error=''; st.updated = new Date(); renderAll(); return;
      }catch(e){ lastErr = e.name==='AbortError' ? 'หมดเวลาเชื่อมต่อ' : (e.message||String(e)); }
    }
    if(c && c.events){ st.events = normalize(c.events); st.loaded = true; st.updated = new Date(c.ts); st.error = 'ใช้ข้อมูลที่เก็บไว้ (อัปเดตไม่สำเร็จ: '+lastErr+')'; }
    else { st.loaded = false; st.error = lastErr || 'โหลดไม่สำเร็จ'; }
    renderAll();
  }

  // ── helper ──
  function filtered(opts){
    opts = opts||{};
    const now = Date.now();
    if(st.gold){
      return st.events.filter(e=>{
        if(e.ccy!=='USD') return false;
        if(!(goldTier(e)>0 || e.impact==='High')) return false;
        if(opts.upcoming && e.t.getTime() < now - 60*1000) return false;
        return true;
      });
    }
    const ccy = selCcy();
    return st.events.filter(e=>{
      if(!ccy.includes(e.ccy)) return false;
      const imp = opts.impact || st.impact;
      if(imp==='High' && e.impact!=='High') return false;
      if(imp==='Medium' && !(e.impact==='High' || e.impact==='Medium')) return false;
      if(opts.upcoming && e.t.getTime() < now - 60*1000) return false;
      return true;
    });
  }
  function nextHigh(){ const now = Date.now(); return filtered({impact:'High'}).find(e=>e.t.getTime() >= now - 60*1000) || null; }
  function cdText(ms){
    if(ms <= 0) return 'กำลังประกาศ';
    const m = Math.floor(ms/60000), h = Math.floor(m/60), d = Math.floor(h/24);
    if(d>=1) return d+' วัน '+(h%24)+' ชม.';
    if(h>=1) return h+' ชม. '+(m%60)+' นาที';
    const s = Math.floor(ms/1000)%60;
    return m+':'+pad(s)+' นาที';
  }
  const fmtTime = d => pad(d.getHours())+':'+pad(d.getMinutes());
  const fmtDay = d => TH_DAYS[d.getDay()]+' '+d.getDate()+' '+TH_MON[d.getMonth()];
  function tradedNear(e){
    const rows = window._tjRows||[]; const t = e.t.getTime();
    return rows.some(r=>{
      if(r.type!=='Buy' && r.type!=='Sell') return false;
      if(!ccyOfSymbol(r.symbol).includes(e.ccy)) return false;
      let d = new Date(r.created_at);
      const m = /^(\d{1,2}):(\d{2})/.exec(String(r.entry_time||'')); if(m) d.setHours(+m[1],+m[2],0,0);
      return Math.abs(d.getTime()-t) <= NEAR_MIN*60000;
    });
  }

  // ── render ──
  function renderControls(){
    const ccy = st.gold ? ['USD'] : selCcy();
    const host = $('tj-news-ccy');
    if(host){
      host.innerHTML = ALL_CCY.map(c=>`<button type="button" data-c="${c}" class="${ccy.includes(c)?'active':''}">${FLAG[c]||''} ${c}</button>`).join('');
      host.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
        const cur = new Set(selCcy()); cur.has(b.dataset.c) ? cur.delete(b.dataset.c) : cur.add(b.dataset.c);
        st.ccy = ALL_CCY.filter(c=>cur.has(c)); if(!st.ccy.length) st.ccy = ['USD'];
        store.set('tj_news_ccy', st.ccy); renderAll();
      }));
    }
    document.querySelectorAll('#tj-news-impact button').forEach(b=>b.classList.toggle('active', b.dataset.imp===st.impact));
    const gb = $('tj-news-gold'); if(gb){ gb.classList.toggle('on', !!st.gold); gb.setAttribute('aria-pressed', st.gold?'true':'false'); }
    document.body.classList.toggle('tj-gold', !!st.gold);
    const gn = $('tj-gold-note');
    if(gn) gn.innerHTML = st.gold ? '<b>โหมดทองคำ:</b> แสดงเฉพาะข่าว <b>USD</b> ที่มีผลกับทอง + ข่าวแรงอื่นของสหรัฐฯ (เช่น ประชุมผู้นำ) · <span class="tj-gtag t1"><i class="fa-solid fa-fire"></i> ทองวิ่งแรง</span> FOMC, NFP, CPI, Core PCE, ประธาน Fed · <span class="tj-gtag t2">★ สำคัญต่อทอง</span> PPI, Retail Sales, ISM, JOLTS, Jobless Claims, GDP ฯลฯ · การแจ้งเตือนใช้ชุดข่าวนี้ด้วย' : '';
    document.querySelectorAll('#tj-news-range button').forEach(b=>b.classList.toggle('active', b.dataset.r===st.range));
    const on=$('tj-news-alert-on'); if(on) on.checked = !!st.alertOn;
    const mi=$('tj-news-alert-min'); if(mi) mi.value = String(st.alertMin);
    alertStatus();
  }
  let tvLoaded = false;
  function renderFallback(){
    const list = $('tj-news-list'); if(!list) return;
    list.innerHTML = `<div class="p-3 small" style="color:var(--muted)"><i class="fa-solid fa-triangle-exclamation text-warning me-1"></i> โหลดข้อมูลข่าวไม่ได้ (${esc(st.error)}) — แสดงปฏิทินข่าวจาก TradingView แทน · ระบบแจ้งเตือนและการวิเคราะห์ต้องใช้ข้อมูลข่าว (ดูวิธีตั้งค่า Worker ด้านล่าง)</div><div class="tj-news-tvwrap" id="tj-news-tv"></div>
      <div class="p-3 small" style="color:var(--muted);font-size:.72rem;border-top:1px solid var(--border)">วิธีเปิดใช้: สร้าง Cloudflare Worker ชื่อ <b>liewtrade-news</b> แล้ววางโค้ดจากไฟล์ <b>news-worker.js</b> กด Deploy</div>`;
    const box = $('tj-news-tv'); if(!box) return;
    const dark = document.documentElement.getAttribute('data-theme')==='dark';
    const wrap = document.createElement('div'); wrap.className='tradingview-widget-container'; wrap.style.height='100%';
    const inner = document.createElement('div'); inner.className='tradingview-widget-container__widget'; inner.style.height='100%';
    const sc = document.createElement('script'); sc.src='https://s3.tradingview.com/external-embedding/embed-widget-events.js'; sc.async=true;
    sc.text = JSON.stringify({ colorTheme: dark?'dark':'light', isTransparent:true, width:'100%', height:'100%', locale:'th_TH', importanceFilter:'0,1', countryFilter:'us,eu,gb,jp,au,ca,ch,nz,cn' });
    wrap.appendChild(inner); wrap.appendChild(sc); box.appendChild(wrap);
  }
  function renderList(){
    const list = $('tj-news-list'); if(!list) return;
    if(!st.loaded){ if(st.error) renderFallback(); return; }
    const evs = filtered({ upcoming: st.range==='upcoming' });
    if(!evs.length){ list.innerHTML = '<div class="tj-empty"><i class="fa-regular fa-newspaper"></i><div>ไม่มีข่าวตามตัวกรองนี้</div></div>'; return; }
    const now = Date.now(); let html = '', lastDay = '';
    evs.forEach(e=>{
      const dk = e.t.toDateString();
      if(dk!==lastDay){ lastDay = dk; html += `<div class="tj-news-day">${fmtDay(e.t)}${dk===new Date().toDateString()?' · วันนี้':''}</div>`; }
      const diff = e.t.getTime() - now;
      const cls = ['tj-news-row', diff < -60000 ? 'past' : '', (diff >= -60000 && diff <= 60*60000 && e.impact==='High') ? 'soon' : '', (diff < 0 && tradedNear(e)) ? 'traded' : ''].join(' ');
      const imp = (e.impact||'').toLowerCase();
      const fp = [e.actual?'A: '+esc(e.actual):'', e.forecast?'F: '+esc(e.forecast):'', e.previous?'P: '+esc(e.previous):''].filter(Boolean).join(' · ');
      const allDay = e.t.getHours()===0 && e.t.getMinutes()===0 && e.impact==='Holiday';
      const gt = goldTier(e);
      const gtag = gt===1 ? '<span class="tj-gtag t1"><i class="fa-solid fa-fire"></i> ทองวิ่งแรง</span>' : (gt===2 ? '<span class="tj-gtag t2">★ สำคัญต่อทอง</span>' : '');
      html += `<div class="${cls}${st.gold && gt===1 ? ' g1':''}"><div class="t">${allDay?'ทั้งวัน':fmtTime(e.t)}</div><div class="c"><span class="tj-imp ${imp}" title="${esc(e.impact)}"></span>${esc(e.ccy)}</div>
        <div class="ti">${esc(e.title)}${gtag}${diff>0 && diff<=24*3600000 ? `<small>อีก ${cdText(diff)}</small>`:''}</div><div class="fp">${fp}</div></div>`;
    });
    const upd = st.updated ? `อัปเดต ${fmtTime(st.updated)}` : '';
    list.innerHTML = html + `<div class="p-2 px-3 small" style="font-size:.68rem;color:var(--muted);border-top:1px solid var(--border)">ที่มา: ${st.source==='tradingview'?'TradingView Economic Calendar':'ForexFactory'} · ${upd}${st.error? ' · '+esc(st.error):''} · A = ค่าจริง, F = คาดการณ์, P = ก่อนหน้า</div>`;
  }
  function renderNext(){
    const e = st.loaded ? nextHigh() : null;
    const host = $('tj-news-next'), strip = $('tj-news-strip');
    const dots = [$('tj-news-dot-side'), $('tj-news-dot-bottom')];
    if(!e){ if(host) host.innerHTML=''; if(strip) strip.innerHTML=''; dots.forEach(d=>d&&d.classList.remove('on')); return; }
    const diff = e.t.getTime() - Date.now();
    const gt = goldTier(e);
    if(host) host.innerHTML = `<div><div class="lbl">${st.gold?'ข่าวสำคัญต่อทองถัดไป':'ข่าวแรงถัดไป'}${gt===1?' · <i class="fa-solid fa-fire"></i> ทองวิ่งแรง':''}</div><div class="ttl">${FLAG[e.ccy]||''} ${esc(e.ccy)} — ${esc(e.title)}</div>
      <div class="meta">${fmtDay(e.t)} · ${fmtTime(e.t)} น.${e.forecast?' · คาด '+esc(e.forecast):''}${e.previous?' · ก่อนหน้า '+esc(e.previous):''}</div></div>
      <div class="cd"><div class="lbl">อีก</div><b data-cd="${e.t.getTime()}">${cdText(diff)}</b></div>`;
    if(strip) strip.innerHTML = diff <= 24*3600000 ? `<i class="fa-regular fa-newspaper" style="color:var(--loss)"></i><span>ข่าวแรง <b>${esc(e.ccy)} ${esc(e.title)}</b> · ${fmtTime(e.t)} น.</span><span class="cd" data-cd="${e.t.getTime()}">${cdText(diff)}</span>` : '';
    dots.forEach(d=>d && d.classList.toggle('on', diff <= 60*60000));
  }
  function tick(){
    document.querySelectorAll('[data-cd]').forEach(el=>{ el.textContent = cdText(+el.dataset.cd - Date.now()); });
  }
  function renderAll(){ renderControls(); renderList(); renderNext(); formWarn(); }

  // ── แจ้งเตือน ──
  function alertStatus(){
    const el = $('tj-news-alert-status'); if(!el) return;
    if(!st.alertOn){ el.textContent=''; return; }
    if(!('Notification' in window)) el.textContent = 'อุปกรณ์นี้ไม่รองรับการแจ้งเตือน — จะแสดงแถบเตือนในแอปแทน';
    else if(Notification.permission==='granted') el.textContent = '✓ เปิดการแจ้งเตือนแล้ว';
    else if(Notification.permission==='denied') el.textContent = 'เบราว์เซอร์บล็อกการแจ้งเตือน — จะแสดงแถบเตือนในแอปแทน (เปิดได้ในตั้งค่าเว็บไซต์)';
    else el.textContent = 'รอการอนุญาตแจ้งเตือน';
  }
  async function notify(e){
    const mins = Math.max(0, Math.round((e.t.getTime()-Date.now())/60000));
    const title = (goldTier(e)===1 ? '🔥 ' : '') + `${st.gold?'ข่าวทอง':'ข่าวแรง'}อีก ${mins} นาที: ${e.ccy}`;
    const body = `${e.title} · ${fmtTime(e.t)} น.${e.forecast?' · คาด '+e.forecast:''}${e.previous?' · ก่อนหน้า '+e.previous:''}`;
    banner(title, body);
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(_){}
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const opts = { body, tag: e.id, icon: 'icon-192.png', badge: 'icon-192.png', requireInteraction: true };
    try{
      if(navigator.serviceWorker){ const reg = await navigator.serviceWorker.getRegistration(); if(reg && reg.showNotification){ await reg.showNotification(title, opts); return; } }
    }catch(_){}
    try{ new Notification(title, opts); }catch(_){}
  }
  function banner(title, body){
    const old = document.querySelector('.tj-news-banner'); if(old) old.remove();
    const b = document.createElement('div'); b.className='tj-news-banner';
    b.innerHTML = `<i class="fa-solid fa-bell" style="color:var(--loss);margin-top:3px"></i><div><b>${esc(title)}</b><div style="color:var(--muted);font-size:.8rem">${esc(body)}</div></div><button type="button" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>`;
    b.querySelector('button').addEventListener('click', ev=>{ ev.stopPropagation(); b.remove(); });
    b.addEventListener('click', ()=>{ b.remove(); switchTab('news'); });
    document.body.appendChild(b);
    setTimeout(()=>{ if(b.isConnected) b.remove(); }, 60000);
  }
  function checkAlerts(){
    if(!st.alertOn || !st.loaded) return;
    const now = Date.now(), win = st.alertMin*60000;
    filtered({impact:'High'}).forEach(e=>{
      const diff = e.t.getTime() - now;
      if(diff > 0 && diff <= win && !st.notified.includes(e.id)){
        st.notified.push(e.id); st.notified = st.notified.slice(-200); store.set('tj_news_notified', st.notified);
        notify(e);
      }
    });
  }

  // ── ฟอร์มบันทึกออเดอร์: เตือนข่าวใกล้เวลาเข้า + ติ๊ก NEWS อัตโนมัติ ──
  let newsTouched = false;
  function formWarn(){
    const box = $('tj-news-warn'); if(!box) return;
    const form = $('tradeForm'); if(!form || !st.loaded){ box.innerHTML=''; return; }
    const sym = (form.querySelector('[name="symbol"]')||{}).value || '';
    const et = (form.querySelector('[name="entryTime"]')||{}).value || '';
    const ccy = sym ? ccyOfSymbol(sym) : selCcy();
    let d = new Date(); const dv = ($('f_date')||{}).value;
    if(/^\d{4}-\d{2}-\d{2}$/.test(dv||'')){ const p = dv.split('-').map(Number); d = new Date(p[0], p[1]-1, p[2], d.getHours(), d.getMinutes()); }
    const m = /^(\d{1,2}):(\d{2})/.exec(et); if(m) d.setHours(+m[1],+m[2],0,0);
    const near = st.events.filter(e=> e.impact==='High' && ccy.includes(e.ccy) && Math.abs(e.t.getTime()-d.getTime()) <= NEAR_MIN*60000);
    box.innerHTML = near.length ? '<i class="fa-solid fa-newspaper"></i> ข่าวแรงใกล้เวลาเข้า: ' + near.map(e=>{ const dm = Math.round((e.t.getTime()-d.getTime())/60000); return `<b>${esc(e.ccy)} ${esc(e.title)}</b> ${fmtTime(e.t)} (${dm>=0?'อีก '+dm:'ผ่านมา '+(-dm)} นาที)`; }).join(', ') : '';
    const cb = $('conf5');
    if(cb && !newsTouched) cb.checked = near.length > 0;
  }
  (function wireForm(){
    const form = $('tradeForm'); if(!form) return;
    ['symbol','entryTime','tradeDate'].forEach(n=>{ const el=form.querySelector('[name="'+n+'"]'); if(el){ el.addEventListener('input', formWarn); el.addEventListener('change', formWarn); } });
    const cb = $('conf5'); if(cb) cb.addEventListener('change', ()=>{ newsTouched = true; });
    form.addEventListener('reset', ()=>{ newsTouched = false; setTimeout(formWarn, 0); });
  })();

  // ── wire ──
  document.querySelectorAll('#tj-news-impact button').forEach(b=>b.addEventListener('click',()=>{ st.impact=b.dataset.imp; store.set('tj_news_imp', st.impact); renderAll(); }));
  $('tj-news-gold') && $('tj-news-gold').addEventListener('click', ()=>{ st.gold = !st.gold; store.set('tj_news_gold', st.gold); renderAll(); checkAlerts(); });
  document.querySelectorAll('#tj-news-range button').forEach(b=>b.addEventListener('click',()=>{ st.range=b.dataset.r; renderAll(); }));
  $('tj-news-refresh') && $('tj-news-refresh').addEventListener('click', ()=>{ const l=$('tj-news-list'); if(l) l.innerHTML='<div class="tj-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>กำลังโหลดข่าว...</div></div>'; load(true); });
  $('tj-news-alert-on') && $('tj-news-alert-on').addEventListener('change', async ev=>{
    st.alertOn = ev.target.checked; store.set('tj_news_alert_on', st.alertOn);
    if(st.alertOn && 'Notification' in window && Notification.permission==='default'){ try{ await Notification.requestPermission(); }catch(_){} }
    alertStatus(); checkAlerts();
  });
  $('tj-news-alert-min') && $('tj-news-alert-min').addEventListener('change', ev=>{ st.alertMin = +ev.target.value||15; store.set('tj_news_alert_min', st.alertMin); checkAlerts(); });
  document.addEventListener('tj:rows', ()=>{ if(!st.ccy) renderAll(); else renderList(); });
  (function hook(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hook,60); return; }
    window.switchTab = function(id){ const r = orig.apply(this, arguments); if(id==='news'){ renderAll(); if(!st.updated || Date.now()-st.updated.getTime() > TTL) load(false); } if(id==='add-trade') formWarn(); return r; };
  })();
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ if(!st.updated || Date.now()-st.updated.getTime() > TTL) load(false); checkAlerts(); renderNext(); } });
  setInterval(tick, 1000);
  setInterval(()=>{ checkAlerts(); renderNext(); }, 20000);
  setInterval(()=>{ load(false); }, TTL);
  window.tjNews = { reload: ()=>load(true), state: st, ccyOfSymbol };
  load(false);
})();

