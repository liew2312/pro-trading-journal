// ══════════ อารมณ์ตอนเปิด / ปิดออเดอร์ ══════════
// เก็บในช่อง confluences เป็น EMOIN:<code> และ EMOOUT:<code> (ไม่ต้องแก้ฐานข้อมูล · แบบเดียวกับ HITTP/HITSL)
// ฟอร์ม: อารมณ์ตอนเข้า อยู่ขั้น 3 (Setup) · อารมณ์ตอนปิด อยู่ขั้น 4 (ผลลัพธ์) ซ่อนเมื่อ "ยังเปิดอยู่" / "ตกรถ"
// สถิติ: การ์ด "อารมณ์กับผลเทรด" ในแท็บพฤติกรรม + แท็กในตารางวิเคราะห์
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt$ = (n, signed) => { n = Number(n)||0; return (n<0?'-':(signed&&n>0?'+':''))+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  const fmtR = n => (n>0?'+':'')+(Number(n)||0).toFixed(2)+'R';

  // [code, ป้าย, คำอธิบายสั้น, โทน: ok | warn | bad]
  const IN = [
    ['CALM','สงบ ตามแผน','ครบเงื่อนไข ไม่รีบ','ok'],
    ['HESIT','ลังเล','ไม่แน่ใจ กดช้า/กดๆ หยุดๆ','warn'],
    ['FOMO','กลัวตกรถ','ราคาวิ่งแล้ว รีบตาม','bad'],
    ['FEAR','กังวล','กลัวโดน SL ตั้งแต่ก่อนเข้า','warn'],
    ['GREED','โลภ','อยากได้เยอะ เพิ่มล็อต/ไม่รอ','bad'],
    ['REVENGE','อยากเอาคืน','เพิ่งแพ้มา อยากได้คืน','bad'],
    ['BORED','เบื่อ / อยากเทรด','ไม่มีเซ็ตอัพแต่อยากเข้า','bad']
  ];
  const OUT = [
    ['PLAN','ปิดตามแผน','ชน TP/SL หรือปิดตามเงื่อนไขที่วางไว้','ok'],
    ['FEAR','กลัว ปิดก่อน','กลัวกำไรหาย / กลัวโดน SL','warn'],
    ['PANIC','ตกใจ ปิดทันที','แท่งสวนแรง กดปิดโดยไม่คิด','bad'],
    ['HOPE','หวัง ถือต่อ','ไม่ยอมตัดขาดทุน / เลื่อน SL','bad'],
    ['GREED','โลภ ถือเลย TP','เลื่อน TP / ไม่ยอมปิดตามแผน','bad'],
    ['TIRED','เหนื่อย / เบื่อ','ปิดทิ้งเพราะไม่อยากเฝ้าแล้ว','warn']
  ];
  const label = (list, code) => { const x = list.find(e=>e[0]===code); return x ? x[1] : code; };
  function emoOf(r){
    const out = {}; String(r.confluences||'').split(',').forEach(s=>{ const m = /^\s*EMO(IN|OUT):(\w+)\s*$/.exec(s); if(m) out[m[1]==='IN'?'in':'out'] = m[2]; });
    return out;
  }
  function tokenLabel(tok){
    const m = /^EMO(IN|OUT):(\w+)$/.exec(String(tok||'').trim()); if(!m) return null;
    return m[1]==='IN' ? ['อารมณ์ตอนเข้า', label(IN, m[2])] : ['อารมณ์ตอนปิด', label(OUT, m[2])];
  }
  window.tjEmotions = { IN, OUT, emoOf, tokenLabel };

  // ── ฟอร์ม ──
  const form = $('tradeForm');
  function chips(name, list){
    return list.map(([c,t,h,tone])=>`<input type="radio" class="btn-check conf-check tj-emo-in" name="${name}" id="${name}_${c}" value="${name==='emo_in'?'EMOIN':'EMOOUT'}:${c}" autocomplete="off"><label class="tj-emo ${tone}" for="${name}_${c}" title="${esc(h)}">${esc(t)}</label>`).join('');
  }
  function block(id, step, icon, title, hint, name, list){
    const el = document.createElement('div');
    el.className = 'tj-emo-box mb-4'; el.id = id; el.dataset.step = step;
    el.innerHTML = `<label class="form-label"><i class="${icon} me-1"></i> ${title}</label>
      <div class="tj-emo-chips" role="radiogroup" aria-label="${esc(title)}">${chips(name, list)}</div>
      <div class="tj-q-hint" id="${id}-hint">${hint}</div>`;
    return el;
  }
  if(form){
    const inBox = block('tj-emo-entry', 3, 'fa-regular fa-face-meh', 'อารมณ์ตอนเปิดออเดอร์', 'เลือกตามจริง ไม่มีถูกผิด — ระบบจะบอกทีหลังว่าอารมณ์ไหนทำเงิน / เสียเงิน', 'emo_in', IN);
    const outBox = block('tj-emo-exit', 4, 'fa-regular fa-face-grimace', 'อารมณ์ตอนปิดออเดอร์', 'ปิดเพราะอะไร? ถ้าชน TP/SL เองโดยไม่ได้แตะ เลือก “ปิดตามแผน”', 'emo_out', OUT);
    const conf = form.querySelector('.confluence-box');
    if(conf) conf.after(inBox); else form.insertBefore(inBox, $('submitBtn'));
    const q = $('tj-q-row'), oc0 = $('tj-outcome-row');
    if(q) q.after(outBox); else if(oc0) oc0.after(outBox); else form.insertBefore(outBox, $('submitBtn'));
    // ฟอร์มทีละขั้นแสดงขั้นแรกไปแล้วก่อนโมดูลนี้โหลด → ซ่อนกล่องที่ไม่ใช่ขั้นปัจจุบัน
    const cur = /^(\d+)\//.exec((($('tj-wiz-head')||{}).textContent||'').trim());
    if(cur) [inBox, outBox].forEach(b=>b.classList.toggle('tj-wiz-hide', b.dataset.step !== cur[1]));

    // กดซ้ำที่ตัวเลือกเดิม = ยกเลิก
    let was = null;
    form.querySelectorAll('.tj-emo').forEach(lb=>{
      lb.addEventListener('pointerdown', ()=>{ const i=$(lb.htmlFor); was = i && i.checked ? i : null; });
      lb.addEventListener('click', e=>{ const i=$(lb.htmlFor); if(i && was===i){ e.preventDefault(); i.checked=false; was=null; i.dispatchEvent(new Event('change',{bubbles:true})); } });
    });
    // ยังเปิดอยู่ / ตกรถ → ยังไม่มีการปิด ไม่ต้องถาม
    const oc = form.querySelector('[name="outcome"]');
    function sync(){
      const v = oc ? oc.value : '';
      const hide = v === 'OPEN' || v === 'MISSED';
      outBox.style.display = hide ? 'none' : '';
      if(hide) outBox.querySelectorAll('input').forEach(i=>{ i.checked = false; });
      const h = $('tj-emo-entry-hint');
      if(h) h.textContent = v === 'MISSED' ? 'ตอนนั้นรู้สึกอย่างไรถึงไม่ได้เข้า (เช่น ลังเล / กังวล)' : 'เลือกตามจริง ไม่มีถูกผิด — ระบบจะบอกทีหลังว่าอารมณ์ไหนทำเงิน / เสียเงิน';
    }
    if(oc){
      oc.addEventListener('change', sync);
      const box = $('pj-oc-chips'); if(box) new MutationObserver(sync).observe(box, { subtree:true, attributes:true, attributeFilter:['aria-checked'] });
    }
    form.addEventListener('reset', ()=>setTimeout(sync, 0));
    sync();
  }

  // ── สถิติ: อารมณ์กับผลเทรด ──
  const planRR = r => { const e=parseFloat(r.entry_price), sl=parseFloat(r.sl_price), tp=parseFloat(r.tp_price); const v = Math.abs(tp-e)/Math.abs(e-sl); return isFinite(v) && v>0 ? v : null; };
  const rOf = t => { const x = parseFloat(t.row.r_mult); return isFinite(x) ? x : null; };
  function stat(list){
    let n=0,w=0,p=0,rs=0,rn=0; list.forEach(t=>{ n++; p+=t.pnl; if(t.pnl>0) w++; const r=rOf(t); if(r!=null){ rs+=r; rn++; } });
    return { n, w, p, wr: n ? w/n*100 : 0, avgR: rn ? rs/rn : null };
  }
  const val = s => s.avgR!=null ? s.avgR : (s.n ? s.p/s.n : 0);
  const showV = s => s.avgR!=null ? fmtR(s.avgR) : fmt$(s.p, true);
  function rows(list, groups){
    return list.filter(([c])=>groups[c] && groups[c].length).map(([c,t,,tone])=>{ const s = stat(groups[c]);
      return `<div class="tj-ls-row"><div class="fw-semibold"><span class="tj-emo-dot ${tone}"></span>${esc(t)}${s.n<5?' <span class="tj-few" title="ไม้น้อยกว่า 5">น้อย</span>':''}</div>
        <div><div class="h">ไม้</div><div class="n">${s.n}</div></div>
        <div><div class="h">Win</div><div class="n">${s.wr.toFixed(0)}%</div></div>
        <div><div class="h">${s.avgR!=null?'เฉลี่ย R':'P&amp;L'}</div><div class="n money ${val(s)>0?'text-gain':(val(s)<0?'text-loss':'')}">${showV(s)}</div></div></div>`; }).join('');
  }
  function render(){
    const host = $('tj-emo-perf'); if(!host || !window.tjApplyFilters) return;
    const trades = window.tjApplyFilters(window._tjRows||[], true);
    const gIn = {}, gOut = {}; let tagged = 0;
    trades.forEach(t=>{ const e = emoOf(t.row); if(e.in){ (gIn[e.in]=gIn[e.in]||[]).push(t); } if(e.out){ (gOut[e.out]=gOut[e.out]||[]).push(t); } if(e.in||e.out) tagged++; });
    if(!tagged){ host.innerHTML = '<div class="tj-empty"><i class="fa-regular fa-face-smile"></i><div>ยังไม่มีไม้ที่บันทึกอารมณ์ — เลือก “อารมณ์ตอนเปิด/ปิดออเดอร์” ในฟอร์มบันทึกเทรด</div></div>'; return; }

    const tips = [];
    // 1) เข้าแบบสงบ vs เข้าแบบมีอารมณ์
    const calm = stat(gIn.CALM||[]), emo = stat(IN.filter(e=>e[0]!=='CALM').flatMap(e=>gIn[e[0]]||[]));
    if(calm.n>=3 && emo.n>=3){
      const d = val(calm) - val(emo);
      tips.push(`<div class="tj-tip ${d>0?'good':''}">เข้าแบบ<b>สงบ ตามแผน</b> ได้เฉลี่ย ${showV(calm)} ต่อไม้ เทียบกับเข้าตอนมีอารมณ์ (ลังเล / กลัวตกรถ / โลภ ฯลฯ) ${showV(emo)}${d>0 && val(emo)<0 ? ' — <b>ไม้ที่เข้าตอนมีอารมณ์คือส่วนที่ทำให้เสียเงิน</b>' : ''}</div>`);
    }
    // 2) ปิดเพราะกลัว/ตกใจ แต่ราคาไปถึง TP ทีหลัง = กำไรที่ทิ้งไว้
    const scared = trades.filter(t=>{ const e = emoOf(t.row); return (e.out==='FEAR' || e.out==='PANIC') && t.row.outcome!=='TP'; });
    const reached = scared.filter(t=>/(^|,)\s*HITTP:Y\s*(,|$)/.test(String(t.row.confluences||'')));
    if(scared.length){
      let left = 0, ln = 0; reached.forEach(t=>{ const p = planRR(t.row), r = rOf(t); if(p!=null && r!=null && p>r){ left += p - r; ln++; } });
      tips.push(`<div class="tj-tip ${reached.length?'bad':''}">ปิดเพราะ<b>กลัว / ตกใจ</b> ${scared.length} ไม้${reached.length ? ` — ในนั้น <b>${reached.length} ไม้ราคาวิ่งไปถึง TP ทีหลัง</b>${ln ? ` ทิ้งกำไรไปรวมประมาณ <b>${left.toFixed(1)}R</b>` : ''}` : ''}${scared.length && !reached.length ? ' · ตอบคำถาม “ราคาวิ่งไปถึง TP ไหม?” ในฟอร์มด้วย จะรู้ว่าปิดก่อนแล้วเสียโอกาสแค่ไหน' : ''}</div>`);
    }
    // 3) หวัง ถือต่อ
    const hope = stat(gOut.HOPE||[]);
    if(hope.n>=2) tips.push(`<div class="tj-tip ${val(hope)<0?'bad':''}">ไม้ที่<b>หวัง ถือต่อ / เลื่อน SL</b> ${hope.n} ไม้ ได้เฉลี่ย ${showV(hope)}${val(hope)<0 ? ' — ตัดตาม SL เดิมจะเสียน้อยกว่านี้' : ''}</div>`);

    host.innerHTML = `<div class="row g-4">
        <div class="col-lg-6"><div class="tj-emo-sub">ตอนเปิดออเดอร์</div>${rows(IN, gIn) || '<div class="small text-muted">ยังไม่มีข้อมูล</div>'}</div>
        <div class="col-lg-6"><div class="tj-emo-sub">ตอนปิดออเดอร์</div>${rows(OUT, gOut) || '<div class="small text-muted">ยังไม่มีข้อมูล</div>'}</div>
      </div>${tips.join('')}
      <div class="small text-muted mt-2" style="font-size:.7rem">บันทึกอารมณ์แล้ว ${tagged} จาก ${trades.length} ไม้ในช่วงที่กรอง · อย่างน้อย ~20 ไม้ต่ออารมณ์ ตัวเลขถึงเริ่มเชื่อถือได้</div>`;
  }
  document.addEventListener('tj:rows', ()=>setTimeout(render, 30));
  (function hookTab(){
    const orig = window.switchTab; if(typeof orig!=='function'){ setTimeout(hookTab, 60); return; }
    window.switchTab = function(id){ const r = orig.apply(this, arguments); if(id==='analytics') setTimeout(render, 60); return r; };
  })();
  (function hookDash(){
    const orig = window.updateDashboardUI; if(typeof orig!=='function'){ setTimeout(hookDash, 60); return; }
    window.updateDashboardUI = function(){ const r = orig.apply(this, arguments); try{ render(); }catch(e){} return r; };
  })();
})();
