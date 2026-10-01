// ══════════ ออเดอร์ที่ยังเปิดอยู่ (outcome = OPEN) · ปิดออเดอร์ทีหลัง · เพิ่มภาพหลังเทรดทีหลัง ══════════
// เก็บในตารางเดิม: outcome = 'OPEN', pnl = null → ไม่ถูกนับในสถิติ/ปฏิทิน/ประวัติ (กรองใน api.fetchAllRows)
(function(){
  const $ = id => document.getElementById(id);
  const form = $('tradeForm'); if(!form) return;
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const F = n => form.querySelector('[name="'+n+'"]');
  const openRows = () => (window._tjOpenRows||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  function toast(m){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),3200); }

  // ── ฟอร์ม: เลือก "ยังเปิดอยู่" → ไม่ต้องใส่ P/L ──
  const oc = F('outcome'), pnl = $('f_pnl');
  function syncForm(){
    const open = oc && (oc.value === 'OPEN' || oc.value === 'MISSED');   // ยังไม่มี/ไม่มี P/L
    form.classList.toggle('tj-is-open', open);
    if(pnl){ pnl.required = !open; if(open) pnl.value = ''; }
    const x = F('exitTime'); if(open && x) x.value = '';
  }
  if(oc){
    oc.addEventListener('change', syncForm);
    const ob = document.querySelector('#pj-oc-chips [data-v="OPEN"]');
    if(ob) new MutationObserver(syncForm).observe(ob, { attributes:true, attributeFilter:['aria-checked'] });
  }
  form.addEventListener('reset', ()=>setTimeout(syncForm, 0));
  syncForm();

  // ── รายการออเดอร์ที่เปิดอยู่ ──
  function ago(d){
    const m = Math.max(0, Math.round((Date.now()-d.getTime())/60000));
    if(m < 60) return m+' นาที'; const h = Math.floor(m/60); if(h < 24) return h+' ชม. '+(m%60)+' นาที';
    return Math.floor(h/24)+' วัน '+(h%24)+' ชม.';
  }
  function card(r){
    const d = new Date(r.created_at), buy = r.type === 'Buy';
    const thumb = window.tjThumb && window.tjThumb(r.chart_before);
    const px = v => (v==null || v==='') ? '—' : esc(v);
    const tf = (()=>{ const c=String(r.confluences||''); const h=(/HTF:(\w+)/.exec(c)||[])[1], l=(/LTF:(\w+)/.exec(c)||[])[1]; return (h||l) ? ' · '+(h||'?')+(l?' → '+l:'') : ''; })();
    return `<div class="tj-open-row">
      ${thumb ? `<img class="tj-hist-thumb" src="${esc(thumb)}" alt="" loading="lazy" onerror="this.remove()">` : `<div class="tj-hist-ico ${buy?'win':'loss'}"><i class="fa-solid ${buy?'fa-arrow-trend-up':'fa-arrow-trend-down'}"></i></div>`}
      <div class="tj-hist-main">
        <div class="tj-hist-sym">${esc(r.symbol||'-')} <span class="tj-hist-tag ${buy?'buy':'sell'}">${buy?'BUY':'SELL'}</span>${r.lots?` <span class="tj-open-lot">${esc(r.lots)} lot</span>`:''}</div>
        <div class="tj-hist-sub">เข้า ${px(r.entry_price)} · SL ${px(r.sl_price)} · TP ${px(r.tp_price)}</div>
        <div class="tj-hist-sub">${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())} · เปิดมา ${ago(d)}${esc(tf)}</div>
      </div>
      <div class="tj-open-act">
        <button type="button" class="tj-open-close" data-close="${esc(r.id)}"><i class="fa-solid fa-flag-checkered"></i> ปิดออเดอร์</button>
        <button type="button" class="tj-open-edit" data-edit="${esc(r.id)}" title="แก้ไข" aria-label="แก้ไข"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>`;
  }
  function wire(host){
    host.querySelectorAll('[data-close]').forEach(b=>b.onclick = ()=>closeTrade(b.dataset.close));
    host.querySelectorAll('[data-edit]').forEach(b=>b.onclick = ()=>window.tjEditTrade && window.tjEditTrade(b.dataset.edit));
  }
  function render(){
    const list = openRows();
    const dash = $('tj-open-card');
    if(dash){
      // หน้าภาพรวม: แถบย่อบรรทัดเดียว — แตะเพื่อดูรายละเอียดในหน้าประวัติ › เปิดอยู่
      const syms = [...new Set(list.map(r=>String(r.symbol||'').toUpperCase()))].slice(0,3).join(', ');
      dash.innerHTML = list.length ? `<button type="button" class="tj-open-pill" id="tj-open-pill">
        <span class="ic"><i class="fa-regular fa-hourglass-half"></i></span>
        <span class="tx"><b>ออเดอร์ที่เปิดอยู่ ${list.length}</b><small>${esc(syms)} · แตะเพื่อดู / ปิดออเดอร์</small></span>
        <i class="fa-solid fa-chevron-right ar"></i></button>` : '';
      const pill = $('tj-open-pill'); if(pill) pill.onclick = ()=>{ switchTab('history'); switchHistoryTab('open'); window.scrollTo(0,0); };
    }
    const b = $('tab-badge-open'); if(b) b.textContent = list.length;
    const tb = $('open-table-body');
    if(tb){ tb.innerHTML = list.length ? list.map(card).join('') : '<div class="text-center py-5 text-muted fw-bold"><i class="fa-regular fa-hourglass-half mb-3 fs-1 d-block opacity-25"></i> ไม่มีออเดอร์ที่เปิดอยู่</div>'; wire(tb); }
  }
  document.addEventListener('tj:open', render);
  setInterval(render, 60000);   // อัปเดต "เปิดมา x นาที"

  // ── แท็บ "เปิดอยู่" ในหน้าประวัติ ──
  // ── ไม้ตกรถ (outcome = MISSED): ถ้าได้เข้าตามแผนจะได้กี่ R ──
  function missedR(r){
    const c = String(r.confluences||''), e = parseFloat(r.entry_price), sl = parseFloat(r.sl_price), tp = parseFloat(r.tp_price);
    if(/HITSL:Y/.test(c)) return -1;                               // ชน SL ก่อน
    if(/HITTP:Y/.test(c)){ const rr = Math.abs(tp-e)/Math.abs(e-sl); return isFinite(rr) && rr>0 ? rr : null; }
    return null;                                                    // ไม่รู้ผล
  }
  function missedCard(r){
    const d = new Date(r.created_at), buy = r.type === 'Buy', R = missedR(r);
    const px = v => (v==null || v==='') ? '—' : esc(v);
    const tf = (()=>{ const c=String(r.confluences||''); const h=(/HTF:(\w+)/.exec(c)||[])[1], l=(/LTF:(\w+)/.exec(c)||[])[1]; return (h||l) ? ' · '+(h||'?')+(l?' → '+l:'') : ''; })();
    const res = R==null ? '<span class="tj-miss-r">ไม่รู้ผล</span>' : `<span class="tj-miss-r ${R>0?'g':'l'}">${R>0?'+':''}${R.toFixed(1)}R</span>`;
    return `<div class="tj-open-row tj-miss-row" data-edit="${esc(r.id)}">
      <div class="tj-hist-ico" style="background:var(--panel);color:var(--muted)"><i class="fa-solid fa-person-running"></i></div>
      <div class="tj-hist-main">
        <div class="tj-hist-sym">${esc(r.symbol||'-')} <span class="tj-hist-tag ${buy?'buy':'sell'}">${buy?'BUY':'SELL'}</span>${r.setup?` <span class="tj-open-lot">${esc(r.setup)}</span>`:''}</div>
        <div class="tj-hist-sub">แผน ${px(r.entry_price)} · SL ${px(r.sl_price)} · TP ${px(r.tp_price)}</div>
        <div class="tj-hist-sub">${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}${esc(tf)}${r.notes?' · '+esc(String(r.notes).slice(0,60)):''}</div>
      </div>
      <div class="text-end" style="flex-shrink:0"><div class="small text-muted" style="font-size:.66rem">ถ้าได้เข้า</div>${res}</div>
    </div>`;
  }
  function renderMissed(){
    const list = (window._tjMissedRows||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const b = $('tab-badge-missed'); if(b) b.textContent = list.length;
    const tb = $('missed-table-body'), sum = $('missed-summary');
    if(tb){
      tb.innerHTML = list.length ? list.map(missedCard).join('') : '<div class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-person-running mb-3 fs-1 d-block opacity-25"></i> ยังไม่มีไม้ตกรถ<div class="small fw-normal mt-2">เห็น Setup แต่ไม่ได้เข้า → บันทึกเทรดแล้วเลือกผลลัพธ์ "ตกรถ"</div></div>';
      tb.querySelectorAll('[data-edit]').forEach(el=>el.onclick = ()=>window.tjEditTrade && window.tjEditTrade(el.dataset.edit));
    }
    if(sum){
      const known = list.map(missedR).filter(x=>x!=null), tot = known.reduce((a,x)=>a+x,0), w = known.filter(x=>x>0).length;
      sum.style.display = list.length ? 'flex' : 'none';
      sum.innerHTML = `<div class="it"><small>ไม้ตกรถ</small><b>${list.length} ไม้</b></div>
        <div class="it"><small>ถ้าเข้าจะชนะ</small><b>${known.length ? Math.round(w/known.length*100)+'%' : '—'}</b></div>
        <div class="it end"><small>R ที่พลาดไป (รู้ผล ${known.length} ไม้)</small><b class="${tot>0?'text-success':(tot<0?'text-danger':'')}">${known.length ? (tot>0?'+':'')+tot.toFixed(1)+'R' : '—'}</b></div>`;
    }
  }
  document.addEventListener('tj:open', renderMissed);

  // ── แท็บ "เปิดอยู่" / "ตกรถ" ในหน้าประวัติ ──
  (function hookTabs(){
    const orig = window.switchHistoryTab;
    if(typeof orig!=='function'){ setTimeout(hookTabs,60); return; }
    window.switchHistoryTab = function(tab){
      const r = orig.apply(this, arguments);
      const isOpen = tab === 'open', isMissed = tab === 'missed';
      const p = $('history-panel-open'); if(p) p.style.display = isOpen ? '' : 'none';
      const pm = $('history-panel-missed'); if(pm) pm.style.display = isMissed ? '' : 'none';
      const b = $('tab-btn-open'); if(b) b.classList.toggle('active', isOpen);
      const bm = $('tab-btn-missed'); if(bm) bm.classList.toggle('active', isMissed);
      const hh = $('tj-hist-head'); if(hh) hh.classList.toggle('tj-hist-openmode', isOpen || isMissed);
      if(isOpen) render();
      if(isMissed) renderMissed();
      return r;
    };
  })();

  // ── ปิดออเดอร์: เปิดฟอร์มแก้ไข ล้างผลลัพธ์ แล้วเลื่อนไปช่องผลลัพธ์ ──
  function closeTrade(id){
    if(!window.tjEditTrade) return;
    window.tjEditTrade(id);
    setTimeout(()=>{
      if(oc){ oc.value = ''; oc.dispatchEvent(new Event('change', {bubbles:true})); }
      syncForm();
      const n = new Date(), x = F('exitTime'); if(x && !x.value) x.value = pad(n.getHours())+':'+pad(n.getMinutes());
      const ban = $('tj-edit-banner'); if(ban){ const bb = ban.querySelector('b'); if(bb) bb.innerHTML = '<i class="fa-solid fa-flag-checkered me-1"></i> ปิดออเดอร์'; }
      const row = $('tj-outcome-row');
      if(row){ row.scrollIntoView({block:'center', behavior:'smooth'}); row.classList.add('tj-flash'); setTimeout(()=>row.classList.remove('tj-flash'), 2400); }
    }, 180);
  }
  window.tjCloseTrade = closeTrade;

  // ── หน้าต่างรายละเอียด: ปุ่ม "เพิ่มภาพหลังเทรด" ถ้ายังไม่มี ──
  (function hookModal(){
    const orig = window.showTradeModal;
    if(typeof orig!=='function'){ setTimeout(hookModal,60); return; }
    window.showTradeModal = function(trade){
      const r = orig.apply(this, arguments);
      const eb = $('tj-edit-btn'); if(!eb) return r;
      let ab = $('tj-after-btn');
      if(!ab){
        ab = document.createElement('button'); ab.type='button'; ab.id='tj-after-btn';
        ab.className='btn btn-outline-secondary w-100 fw-bold py-2 mb-2';
        ab.innerHTML='<i class="fa-regular fa-image me-2"></i> เพิ่มภาพหลังเทรด';
        eb.insertAdjacentElement('afterend', ab);
        ab.addEventListener('click', ()=>{
          const id = ab.dataset.id; const m = bootstrap.Modal.getInstance($('tradeModal')); if(m) m.hide();
          window.tjEditTrade(id);
          setTimeout(()=>{ const box = document.querySelectorAll('#tradeForm .upload-box')[1]; if(box){ box.scrollIntoView({block:'center', behavior:'smooth'}); box.classList.add('tj-flash'); setTimeout(()=>box.classList.remove('tj-flash'), 2400); } }, 200);
        });
      }
      const isTrade = trade && trade.id!=null && trade.type!=='Deposit' && trade.type!=='Withdraw';
      ab.style.display = (isTrade && !trade.chartAfter) ? '' : 'none';
      ab.dataset.id = trade && trade.id;
      return r;
    };
  })();

  render(); renderMissed();
})();
