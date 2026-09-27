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
    const open = oc && oc.value === 'OPEN';
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
      dash.innerHTML = list.length ? `<div class="tj-open-card">
        <div class="tj-open-head"><div><b><i class="fa-regular fa-hourglass-half me-1"></i> ออเดอร์ที่เปิดอยู่</b> <span class="tj-open-count">${list.length}</span></div>
        <small>ปิดแล้วกด "ปิดออเดอร์" เพื่อใส่ผลและภาพหลังเทรด</small></div>
        <div class="tj-open-list">${list.slice(0,5).map(card).join('')}</div>
        ${list.length>5?`<button type="button" class="tj-linkbtn" id="tj-open-more">ดูทั้งหมด ${list.length} ออเดอร์ ›</button>`:''}
      </div>` : '';
      wire(dash);
      const more = $('tj-open-more'); if(more) more.onclick = ()=>{ switchTab('history'); switchHistoryTab('open'); };
    }
    const b = $('tab-badge-open'); if(b) b.textContent = list.length;
    const tb = $('open-table-body');
    if(tb){ tb.innerHTML = list.length ? list.map(card).join('') : '<div class="text-center py-5 text-muted fw-bold"><i class="fa-regular fa-hourglass-half mb-3 fs-1 d-block opacity-25"></i> ไม่มีออเดอร์ที่เปิดอยู่</div>'; wire(tb); }
  }
  document.addEventListener('tj:open', render);
  setInterval(render, 60000);   // อัปเดต "เปิดมา x นาที"

  // ── แท็บ "เปิดอยู่" ในหน้าประวัติ ──
  (function hookTabs(){
    const orig = window.switchHistoryTab;
    if(typeof orig!=='function'){ setTimeout(hookTabs,60); return; }
    window.switchHistoryTab = function(tab){
      const r = orig.apply(this, arguments);
      const isOpen = tab === 'open';
      const p = $('history-panel-open'); if(p) p.style.display = isOpen ? '' : 'none';
      const b = $('tab-btn-open'); if(b) b.classList.toggle('active', isOpen);
      const hh = $('tj-hist-head'); if(hh) hh.classList.toggle('tj-hist-openmode', isOpen);
      if(isOpen) render();
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

  render();
})();
