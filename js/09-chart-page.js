(function(){
  const SLOTS = ['fileHtf','fileBefore','fileAfter'];
  const SLOT_LABEL = { fileHtf:'HTF', fileBefore:'จุดเข้า', fileAfter:'หลังปิด' };
  const SLOT_KEY = { fileHtf:'htf', fileBefore:'before', fileAfter:'after' };
  window._tjShots = { fileHtf:null, fileBefore:null, fileAfter:null };
  const urls = {};
  const $ = id => document.getElementById(id);
  const store = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg, ms){
    const old = document.querySelector('.tj-toast'); if(old) old.remove();
    const t = document.createElement('div'); t.className='tj-toast'; t.textContent=msg;
    const full = document.body.classList.contains('tj-chart-full') && $('tj-chart-box');
    (full || document.body).appendChild(t);
    setTimeout(()=>t.remove(), ms||2600);
  }

  // ── ภาพที่แนบ (pending) ────────────────────────────────
  function slotFile(slot){ const inp=$(slot); if(inp && inp.files && inp.files[0]) return inp.files[0]; return window._tjShots[slot]; }
  function urlFor(slot, file){ if(!file) return ''; if(urls[slot] && urls[slot].file===file) return urls[slot].url; if(urls[slot]) URL.revokeObjectURL(urls[slot].url); urls[slot]={file, url:URL.createObjectURL(file)}; return urls[slot].url; }
  function shotCard(slot, file, big){
    const u = urlFor(slot, file);
    return `<div class="tj-shot"><img src="${u}" alt="ภาพ ${SLOT_LABEL[slot]}"><div class="cap"><span>${SLOT_LABEL[slot]}${big?'':' · '+Math.round(file.size/1024)+' KB'}</span><button type="button" title="ลบภาพ" onclick="tjClearShot('${slot}')"><i class="fa-solid fa-xmark"></i></button></div></div>`;
  }
  const LINK_NAME = { fileHtf:'chartHtfUrl', fileBefore:'chartBeforeUrl', fileAfter:'chartAfterUrl' };
  function linkInput(slot){ return document.querySelector('#tradeForm [name="'+LINK_NAME[slot]+'"]'); }
  function linkCard(slot, url){
    const src = imgSrc(url); if(!src) return '';
    return `<div class="tj-shot"><img src="${esc(src)}" alt="ภาพ ${SLOT_LABEL[slot]}" onerror="this.style.display='none'"><div class="cap"><span>${SLOT_LABEL[slot]} · ลิงก์ TradingView</span><button type="button" title="ลบลิงก์" onclick="tjClearShot('${slot}')"><i class="fa-solid fa-xmark"></i></button></div></div>`;
  }
  function slotCard(s, big){ const f=slotFile(s); if(f) return shotCard(s,f,big); const li=linkInput(s); return (li && li.value) ? linkCard(s, li.value.trim()) : ''; }
  function renderShots(){
    const list = $('tj-chart-shots');
    if(list) list.innerHTML = SLOTS.map(s=>slotCard(s,false)).join('');
    SLOTS.forEach(s=>{ const p=$('prev-'+s); if(p) p.innerHTML = slotCard(s,true); });
    paintTf();
  }
  // ป้าย TF บนหัวช่องภาพ (เช่น HTF · H4 / จุดเข้า · M15) ตามที่เลือกในฟอร์ม
  function paintTf(){
    const pick = n => { const c=document.querySelector('#tradeForm .tj-tf-in[name="'+n+'"]:checked'); return c ? String(c.value).split(':').pop() : ''; };
    const h=$('tj-htf-tf'), l=$('tj-ltf-tf'), hv=pick('tf_htf'), lv=pick('tf_ltf');
    if(h) h.textContent = hv ? '· '+hv : ''; if(l) l.textContent = lv ? '· '+lv : '';
  }
  document.addEventListener('change', e=>{ if(e.target && e.target.classList && e.target.classList.contains('tj-tf-in')) paintTf(); });
  window.tjClearShot = function(slot){ window._tjShots[slot]=null; const inp=$(slot); if(inp) inp.value=''; if(!slotFile(slot)){ const li=linkInput(slot); if(li) li.value=''; } renderShots(); };
  SLOTS.forEach(s=>{ const li=linkInput(s); if(li) li.addEventListener('input', renderShots); });
  function setShot(slot, file){ window._tjShots[slot]=file; const inp=$(slot); if(inp) inp.value=''; renderShots(); }

  // getFileBase64: ถ้าไม่ได้เลือกไฟล์เอง ให้ใช้ภาพที่จับจากกราฟ / วางไว้
  (function hookBase64(){
    const orig = window.getFileBase64;
    if(typeof orig!=='function'){ setTimeout(hookBase64,60); return; }
    window.getFileBase64 = function(id){
      const inp=$(id);
      if((!inp || !inp.files || !inp.files.length) && window._tjShots[id]){
        const f = window._tjShots[id];
        return new Promise(res=>{ const r=new FileReader(); r.onload=e=>res({name:f.name, mimeType:f.type||'image/png', data:String(e.target.result).split(',')[1]}); r.onerror=()=>res(null); r.readAsDataURL(f); });
      }
      return orig(id);
    };
  })();

  SLOTS.forEach(s=>{ const inp=$(s); if(inp) inp.addEventListener('change',()=>{ if(inp.files && inp.files.length) window._tjShots[s]=null; renderShots(); }); });
  const form = $('tradeForm');
  if(form) form.addEventListener('reset',()=>{ window._tjShots={fileHtf:null,fileBefore:null,fileAfter:null}; lastSlot=null; setTimeout(renderShots,0); });

  // วางรูปลงช่องที่แตะ/โฟกัสล่าสุด (ถ้าไม่ได้เลือก: จุดเข้า → หลังปิด)
  let lastSlot = null;
  ['pointerdown','focusin'].forEach(ev=>document.addEventListener(ev, e=>{
    const box = e.target && e.target.closest && e.target.closest('#tradeForm .upload-box[data-slot]');
    if(box) lastSlot = box.dataset.slot;
  }, true));

  // วางรูปจากคลิปบอร์ด (Ctrl+V) ในหน้าบันทึกเทรด
  document.addEventListener('paste', e=>{
    const page = document.querySelector('.page-section.active');
    if(!page || page.id!=='add-trade') return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for(const it of items){
      if(it.kind==='file' && /^image\//.test(it.type)){
        const f = it.getAsFile(); if(!f) continue;
        const slot = lastSlot || (!slotFile('fileBefore') ? 'fileBefore' : 'fileAfter');
        const file = new File([f], 'paste-'+SLOT_KEY[slot]+'-'+Date.now()+'.png', {type:f.type||'image/png'});
        setShot(slot, file); e.preventDefault();
        toast('วางภาพลงช่อง '+SLOT_LABEL[slot]+' แล้ว');
        return;
      }
    }
  });

  // ── TradingView widget ─────────────────────────────────
  let tvLoading = null, tvKey = '';
  function loadTV(){
    if(window.TradingView) return Promise.resolve();
    if(tvLoading) return tvLoading;
    tvLoading = new Promise((res, rej)=>{ const sc=document.createElement('script'); sc.src='https://s3.tradingview.com/tv.js'; sc.async=true; sc.onload=res; sc.onerror=()=>{ tvLoading=null; rej(new Error('load tv.js')); }; document.head.appendChild(sc); });
    return tvLoading;
  }
  function curSym(){ return String(($('tj-chart-symbol')||{}).value||'XAUUSD').trim().toUpperCase().replace(/\s+/g,'') || 'XAUUSD'; }
  function curTf(){ const b=document.querySelector('#tj-chart-tf button.active'); return b? b.dataset.tf : '15'; }
  function isDark(){ return document.documentElement.getAttribute('data-theme')==='dark'; }
  async function renderTV(force){
    const box = $('tj-tv'); if(!box) return;
    const sym = curSym(), tf = curTf(), theme = isDark()?'dark':'light';
    const key = sym+'|'+tf+'|'+theme;
    if(!force && key===tvKey && box.childElementCount) return;
    tvKey = key; store.set('tj_chart_sym', sym); store.set('tj_chart_tf', tf);
    markChips();
    box.innerHTML = '<div class="tj-chart-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>กำลังโหลดกราฟ...</div></div>';
    try{ await loadTV(); }
    catch(e){ box.innerHTML = '<div class="tj-chart-empty"><i class="fa-solid fa-plug-circle-xmark fs-3"></i><div>โหลดกราฟ TradingView ไม่ได้ · ตรวจสอบอินเทอร์เน็ต แล้วกด “เปิดกราฟ” อีกครั้ง</div></div>'; return; }
    box.innerHTML = '';
    let tz = 'Asia/Bangkok'; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; }catch(e){}
    new window.TradingView.widget({
      container_id:'tj-tv', autosize:true, symbol:sym, interval:tf, timezone:tz, theme:theme, style:'1',
      locale:'th_TH', allow_symbol_change:true, save_image:true, withdateranges:true, hide_side_toolbar:false,
      enable_publishing:false, details:false
    });
  }
  function markChips(){ const s=curSym(); document.querySelectorAll('#tj-chart-chips button').forEach(b=>b.classList.toggle('active', b.dataset.s===s)); }
  function buildChips(){
    const set = new Set(['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD']);
    try{ (window._allSymbols||new Set()).forEach(x=>{ if(x && x!=='FUNDING') set.add(String(x).toUpperCase()); }); }catch(e){}
    const arr = Array.from(set).slice(0,12);
    const host=$('tj-chart-chips'); if(host) host.innerHTML = arr.map(s=>`<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('');
    const dl=$('tj-chart-symlist'); if(dl) dl.innerHTML = arr.map(s=>`<option value="${esc(s)}">`).join('');
    if(host) host.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ $('tj-chart-symbol').value=b.dataset.s; renderTV(); }));
    markChips();
  }

  // ── จับภาพกราฟ (Screen Capture API) ─────────────────────
  const canCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  function pickFile(slot){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(f){ setShot(slot, f); toast('แนบภาพ '+SLOT_LABEL[slot]+' แล้ว'); } };
    inp.click();
  }
  async function capture(slot, btn){
    if(!canCapture){ toast('อุปกรณ์นี้จับภาพหน้าจอจากแอปไม่ได้ — เลือกภาพจากเครื่องแทน หรือใช้ปุ่มกล้องของ TradingView', 4200); pickFile(slot); return; }
    const box = $('tj-chart-box');
    const fsBar = $('tj-fs-bar');
    let stream;
    try{
      if(btn) btn.disabled = true;
      stream = await navigator.mediaDevices.getDisplayMedia({ video:{ displaySurface:'browser', frameRate:5 }, audio:false, preferCurrentTab:true, selfBrowserSurface:'include', surfaceSwitching:'exclude' });
    }catch(e){ if(btn) btn.disabled=false; if(e && e.name!=='NotAllowedError') toast('จับภาพไม่สำเร็จ: '+(e.message||e)); return; }
    try{
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video'); video.muted=true; video.playsInline=true; video.srcObject=stream;
      if(fsBar) fsBar.classList.add('hide');
      await video.play();
      await new Promise(r=>setTimeout(r, 450));   // รอให้หน้าต่างเลือกแท็บปิด + ได้เฟรมล่าสุด
      const vw = video.videoWidth, vh = video.videoHeight;
      const settings = track.getSettings ? track.getSettings() : {};
      const sameTab = settings.displaySurface ? settings.displaySurface==='browser' : true;
      const aspectOk = Math.abs(vw/vh - window.innerWidth/window.innerHeight) < 0.06;
      let sx=0, sy=0, sw=vw, sh=vh;
      if(sameTab && aspectOk && box){
        const r = box.getBoundingClientRect(), k = vw / window.innerWidth;
        sx = Math.max(0, Math.round(r.left*k)); sy = Math.max(0, Math.round(r.top*k));
        sw = Math.min(vw-sx, Math.round(r.width*k)); sh = Math.min(vh-sy, Math.round(r.height*k));
        if(sw<50 || sh<50){ sx=0; sy=0; sw=vw; sh=vh; }
      }
      const cv = document.createElement('canvas'); cv.width=sw; cv.height=sh;
      cv.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      stream.getTracks().forEach(t=>t.stop());
      const blob = await new Promise(r=>cv.toBlob(r,'image/png'));
      if(!blob) throw new Error('สร้างภาพไม่ได้');
      const d=new Date(), p=n=>String(n).padStart(2,'0');
      const name = 'chart-'+SLOT_KEY[slot]+'-'+curSym().replace(/[^A-Z0-9]/g,'')+'-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.png';
      setShot(slot, new File([blob], name, {type:'image/png'}));
      toast('จับภาพกราฟลงช่อง '+SLOT_LABEL[slot]+' แล้ว ✓');
    }catch(e){
      try{ stream.getTracks().forEach(t=>t.stop()); }catch(_){}
      toast('จับภาพไม่สำเร็จ: '+(e.message||e));
    }finally{ if(btn) btn.disabled=false; if(fsBar) fsBar.classList.remove('hide'); }
  }

  function goJournal(){
    const f = document.querySelector('#tradeForm [name="symbol"]');
    if(f){ const s = curSym(); f.value = s.includes(':') ? s.split(':').pop() : s; }
    switchTab('add-trade'); window.scrollTo({top:0,behavior:'smooth'});
    const n = SLOTS.filter(s=>slotFile(s)).length;
    toast(n? 'แนบภาพกราฟ '+n+' ภาพไว้ในฟอร์มแล้ว' : 'ใส่ Symbol ให้แล้ว');
  }

  // ── แสดงภาพในหน้าต่างรายละเอียดเทรด ─────────────────────
  function imgSrc(url){
    if(!url) return '';
    const m = /tradingview\.com\/x\/([A-Za-z0-9]+)/.exec(url);
    if(m) return 'https://s3.tradingview.com/snapshots/'+m[1].charAt(0).toLowerCase()+'/'+m[1]+'.png';
    if(/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || /\/storage\/v1\/object\//.test(url)) return url;
    return '';
  }
  (function hookModal(){
    const orig = window.showTradeModal;
    if(typeof orig!=='function'){ setTimeout(hookModal,60); return; }
    window.showTradeModal = function(trade){
      orig(trade);
      const host = $('tj-modal-shots'); if(!host) return;
      host.innerHTML = '';
      if(!trade || trade.type==='Deposit' || trade.type==='Withdraw') return;
      const tfs = (()=>{ const c=String(trade.confluences||''); return { h:(/HTF:(\w+)/.exec(c)||[])[1], l:(/LTF:(\w+)/.exec(c)||[])[1] }; })();
      [['HTF'+(tfs.h?' · '+tfs.h:' (ภาพรวม)'), trade.chartHtf], ['จุดเข้า'+(tfs.l?' · '+tfs.l:' (LTF)'), trade.chartBefore], ['หลังปิด', trade.chartAfter]].forEach(([lbl,u])=>{
        const src = imgSrc(u); if(!src) return;
        const fig = document.createElement('figure');
        fig.innerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(lbl)}" loading="lazy"></a><figcaption>${esc(lbl)}</figcaption>`;
        fig.querySelector('img').addEventListener('error',()=>fig.remove());
        host.appendChild(fig);
      });
    };
  })();

  // ── ลบรายการเทรด / ฝาก-ถอน ทีละรายการ ─────────────────
  (function hookDel(){
    const orig = window.showTradeModal;
    if(typeof orig!=='function'){ setTimeout(hookDel,60); return; }
    window.showTradeModal = function(trade){
      window._tjModalTrade = trade || null;
      const r = orig.apply(this, arguments);
      const btn = $('tj-del-btn');
      if(btn){
        const isFund = trade && (trade.type==='Deposit' || trade.type==='Withdraw');
        btn.disabled = !(trade && trade.id!=null);
        btn.querySelector('span').textContent = isFund ? 'ลบรายการ'+(trade.type==='Deposit'?'ฝาก':'ถอน')+'นี้' : 'ลบออเดอร์นี้';
      }
      return r;
    };
  })();
  $('tj-del-btn') && $('tj-del-btn').addEventListener('click', async ()=>{
    const t = window._tjModalTrade; if(!t || t.id==null) return;
    const isFund = t.type==='Deposit' || t.type==='Withdraw';
    const pnl = parseFloat(t.pnl)||0;
    const label = isFund ? ((t.type==='Deposit'?'ฝากเงิน ':'ถอนเงิน ')+'$'+Math.abs(pnl).toFixed(2))
                         : ((t.symbol||'-')+' '+(t.type||'')+' '+(pnl>=0?'+':'-')+'$'+Math.abs(pnl).toFixed(2));
    if(!confirm('ลบรายการนี้ถาวร?\n\n'+label+'\n'+(t.date||'')+'\n\nลบแล้วกู้คืนไม่ได้')) return;
    const btn = $('tj-del-btn'); const html = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังลบ...';
    try{
      await window.api.deleteTrade(t.id);
      const m = bootstrap.Modal.getInstance($('tradeModal')); if(m) m.hide();
      if(typeof loadAllData==='function') loadAllData();
      toast('ลบรายการแล้ว');
    }catch(e){ alert('ลบไม่สำเร็จ: '+(e.message||e)); }
    finally{ btn.disabled=false; btn.innerHTML = html; }
  });

  // ── ภาพ HTF: ฐานข้อมูลยังไม่มีคอลัมน์ chart_htf ─────────────
  const HTF_SQL = 'alter table public.journal_entries add column if not exists chart_htf text;';
  function paintHtfWarn(){
    const w = $('tj-htf-warn'); if(!w) return;
    if(window._tjHtfCol !== false){ w.hidden = true; return; }
    w.hidden = false;
    w.innerHTML = '<b>ยังเก็บภาพ HTF ไม่ได้</b> ต้องเพิ่มช่องเก็บในฐานข้อมูลก่อน (ทำครั้งเดียว): Supabase → SQL Editor → วางคำสั่งนี้แล้วกด Run'
      + '<code>'+esc(HTF_SQL)+'</code><button type="button" class="tj-linkbtn" id="tj-htf-copy"><i class="fa-regular fa-copy"></i> คัดลอกคำสั่ง</button>';
    const b=$('tj-htf-copy'); if(b) b.onclick = async ()=>{ try{ await navigator.clipboard.writeText(HTF_SQL); toast('คัดลอกแล้ว'); }catch(e){ window.prompt('คัดลอกคำสั่งนี้', HTF_SQL); } };
  }
  document.addEventListener('tj:htfcol', e=>{ paintHtfWarn(); if(e.detail && e.detail.lost) setTimeout(()=>toast('บันทึกแล้ว แต่ภาพ HTF ยังไม่ถูกเก็บ — ดูวิธีเพิ่มช่องเก็บที่ช่องภาพ HTF', 6000), 2700); });
  paintHtfWarn();

  // ── wire ───────────────────────────────────────────────
  const symInp = $('tj-chart-symbol');
  if(symInp){ symInp.value = store.get('tj_chart_sym','XAUUSD'); symInp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); renderTV(); } }); }
  const savedTf = store.get('tj_chart_tf','15');
  document.querySelectorAll('#tj-chart-tf button').forEach(b=>{
    b.classList.toggle('active', b.dataset.tf===savedTf);
    b.addEventListener('click',()=>{ document.querySelectorAll('#tj-chart-tf button').forEach(x=>x.classList.toggle('active',x===b)); renderTV(); });
  });
  $('tj-chart-go') && $('tj-chart-go').addEventListener('click',()=>renderTV(true));
  document.querySelectorAll('.tj-cap-btn[data-slot]').forEach(b=>b.addEventListener('click',()=>capture(b.dataset.slot, b)));
  $('tj-chart-journal') && $('tj-chart-journal').addEventListener('click', goJournal);

  // ── ขยายกราฟเต็มจอ ─────────────────────────────────────
  let hideTimer = null;
  function isFull(){ return document.body.classList.contains('tj-chart-full'); }
  async function enterFull(){
    if(isFull()) return;
    if(!$('tj-tv') || !$('tj-tv').childElementCount) renderTV();
    document.body.classList.add('tj-chart-full');
    const box = $('tj-chart-box');
    try{
      const req = box.requestFullscreen || box.webkitRequestFullscreen;
      if(req) await req.call(box, { navigationUI:'hide' });
    }catch(e){ /* iPhone ไม่รองรับ fullscreen ของ element — ใช้โหมดเต็มหน้าต่างแทน */ }
    const rot = $('tj-fs-rotate');
    if(rot) rot.style.display = (screen.orientation && screen.orientation.lock && document.fullscreenElement) ? '' : 'none';
    try{ history.pushState({tjChartFull:1}, ''); }catch(e){}
  }
  function exitFull(fromPop){
    if(!isFull()) return;
    document.body.classList.remove('tj-chart-full');
    clearTimeout(hideTimer); const bar=$('tj-fs-bar'); if(bar) bar.classList.remove('hide');
    document.body.classList.remove('tj-fs-clean');
    ['tj-fs-sheet','tj-fs-pill'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('show'); });
    try{ if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    if(fe){ try{ (document.exitFullscreen || document.webkitExitFullscreen).call(document); }catch(e){} }
    if(!fromPop){ try{ if(history.state && history.state.tjChartFull) history.back(); }catch(e){} }
  }
  $('tj-chart-fs') && $('tj-chart-fs').addEventListener('click', enterFull);
  $('tj-chart-fs2') && $('tj-chart-fs2').addEventListener('click', enterFull);
  $('tj-fs-close') && $('tj-fs-close').addEventListener('click', ()=>exitFull(false));
  function cleanFor(ms, after){
    clearTimeout(hideTimer); document.body.classList.add('tj-fs-clean');
    const old=document.querySelector('.tj-toast'); if(old) old.remove();
    hideTimer = setTimeout(()=>{ document.body.classList.remove('tj-fs-clean'); if(after) after(); }, ms);
  }
  $('tj-fs-hide') && $('tj-fs-hide').addEventListener('click', ()=>cleanFor(6000));

  // จับภาพในโหมดเต็มจอ (มือถือ): แคปหน้าจอ / ลิงก์ TradingView / เลือกรูป
  let fsSlot = 'fileBefore';
  const sheet = $('tj-fs-sheet'), pill = $('tj-fs-pill');
  function openSheet(){ if(pill) pill.classList.remove('show'); if(sheet) sheet.classList.add('show'); }
  function closeSheet(){ if(sheet) sheet.classList.remove('show'); }
  $('tj-fs-snap') && $('tj-fs-snap').addEventListener('click', ()=>{ if(sheet && sheet.classList.contains('show')) closeSheet(); else openSheet(); });
  $('tj-fs-sheet-x') && $('tj-fs-sheet-x').addEventListener('click', closeSheet);
  document.querySelectorAll('#tj-fs-slot button').forEach(b=>b.addEventListener('click',()=>{
    fsSlot=b.dataset.slot; document.querySelectorAll('#tj-fs-slot button').forEach(x=>x.classList.toggle('active',x===b)); }));
  async function useTvLink(slot){
    let txt = '';
    try{ if(navigator.clipboard && navigator.clipboard.readText) txt = await navigator.clipboard.readText(); }catch(e){}
    if(!/tradingview\.com\/x\//.test(txt||'')) txt = window.prompt('วางลิงก์ภาพจาก TradingView (เช่น https://www.tradingview.com/x/AbCd1234/)', txt||'') || '';
    txt = txt.trim();
    if(!txt) return;
    const m = /https?:\/\/[^\s]+/.exec(txt); if(m) txt = m[0];
    if(!/^https?:\/\//.test(txt)){ toast('ลิงก์ไม่ถูกต้อง'); return; }
    const li = linkInput(slot); if(li) li.value = txt;
    window._tjShots[slot]=null; const inp=$(slot); if(inp) inp.value='';
    renderShots(); toast('ใส่ลิงก์ภาพ '+SLOT_LABEL[slot]+' แล้ว ✓');
  }
  window.tjUseTvLink = useTvLink; window.tjChartState = ()=>({ sym: curSym(), tf: curTf() });
  function showPill(slot){
    if(!pill) return;
    pill.dataset.slot = slot; pill.querySelector('span').textContent = 'แนบภาพที่แคป → '+SLOT_LABEL[slot];
    pill.classList.add('show');
  }
  pill && pill.addEventListener('click', ()=>{ pill.classList.remove('show'); pickFile(pill.dataset.slot || 'fileBefore'); });
  sheet && sheet.querySelectorAll('.tj-fs-opt').forEach(b=>b.addEventListener('click',()=>{
    const act=b.dataset.act, slot=fsSlot; closeSheet();
    if(act==='shot') cleanFor(5000, ()=>showPill(slot));
    else if(act==='link') useTvLink(slot);
    else pickFile(slot);
  }));
  if(canCapture){ const sn=$('tj-fs-snap'); if(sn) sn.style.display='none'; }
  let landscape = false;
  $('tj-fs-rotate') && $('tj-fs-rotate').addEventListener('click', async ()=>{
    try{ landscape = !landscape; await screen.orientation.lock(landscape ? 'landscape' : 'portrait'); }
    catch(e){ landscape = false; toast('อุปกรณ์นี้หมุนจออัตโนมัติไม่ได้ — หมุนเครื่องเองได้เลย'); }
  });
  document.querySelectorAll('.tj-fs-btn.cap').forEach(b=>{
    if(!canCapture){ b.style.display='none'; return; }
    b.addEventListener('click',()=>capture(b.dataset.slot, b));
  });
  const onFsChange = ()=>{ if(!(document.fullscreenElement || document.webkitFullscreenElement) && isFull()) exitFull(false); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  window.addEventListener('popstate', ()=>{ if(isFull()) exitFull(true); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && isFull()) exitFull(false); });
  if(!canCapture){ document.querySelectorAll('.tj-cap-btn[data-slot] b').forEach(b=>{ b.textContent = b.textContent.replace('จับภาพ','แนบภาพ'); }); }

  function hook(name, after){
    const orig = window[name];
    if(typeof orig!=='function'){ setTimeout(()=>hook(name,after),60); return; }
    window[name] = function(){ const r = orig.apply(this, arguments); try{ after.apply(this, arguments); }catch(e){ console.error(e); } return r; };
  }
  hook('switchTab', id => { if(id!=='chart' && document.body.classList.contains('tj-chart-full')) document.body.classList.remove('tj-chart-full'); if(id==='chart'){ buildChips(); renderTV(); renderShots(); } if(id==='add-trade') renderShots(); });
  hook('toggleDarkMode', () => { const pg=document.querySelector('.page-section.active'); if(pg && pg.id==='chart') renderTV(); else tvKey=''; });
})();

