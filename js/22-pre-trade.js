// ══════════ เช็กก่อนเข้า (Pre-trade) ══════════
// เลือก Setup จาก Playbook → ติ๊กเงื่อนไข → ระบบเช็กลิมิตวันนี้ + ข่าวแรง + RR + ขนาดล็อต
// ผ่านแล้วกด "บันทึกออเดอร์" → เปิดฟอร์มบันทึกเทรด กรอกราคา/ล็อต/Setup/เช็กลิสต์ให้ สถานะ "ยังเปิดอยู่"
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const dkey = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const ls = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  const num = v => { const n = parseFloat(String(v==null?'':v).replace(/,/g,'')); return isFinite(n) ? n : NaN; };
  const fmt$ = n => '$'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const KEY = 'tj_pretrade';
  const NEWS_MIN = 30;

  const FLAGS = [
    ['chase','ราคาวิ่งไปแล้ว ไม่ได้ลงมาถึงโซน','ไม่ไล่ราคา รอเซ็ตอัพใหม่'],
    ['news','มีข่าวแรงภายใน 30 นาที','ใช้เมื่อระบบยังโหลดข่าวไม่ได้ ให้เช็กเอง']
  ];

  function lastSymbol(){
    const r = (window._tjRows||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).find(x=>x.symbol);
    return r ? String(r.symbol).toUpperCase() : 'XAUUSD';
  }
  function defaults(){
    const pb = window.tjPB ? window.tjPB.prefs().playbook : [];
    const bos = pb.find(p=>(p.value||p.name)==='BOS Sweep');
    return { setup: (bos||pb[0]||{}).value || (bos||pb[0]||{}).name || '', symbol: lastSymbol(), side:'Buy', entry:'', sl:'', tp:'', checks:[], flags:{}, emo:'' };
  }
  let S = Object.assign(defaults(), ls.get(KEY, {}));
  const save = () => ls.set(KEY, S);

  function setupObj(){ const pb = window.tjPB.prefs().playbook; return pb.find(p=>(p.value||p.name)===S.setup) || pb[0]; }

  function newsNear(){
    const n = window.tjNews; if(!n || !n.state || !n.state.loaded) return null;
    let ccy = []; try{ ccy = n.ccyOfSymbol(S.symbol||'') || []; }catch(e){}
    const now = Date.now();
    return (n.state.events||[]).filter(e=> e.impact==='High' && ccy.includes(e.ccy) && e.t && Math.abs(e.t.getTime()-now) <= NEWS_MIN*60000);
  }

  function calc(){
    const P = window.tjPB, R = P.prefs().rules;
    const e = num(S.entry), sl = num(S.sl), tp = num(S.tp), buy = S.side==='Buy';
    const out = { ok:false, msg:'' };
    if(!(e>0) || !(sl>0)){ out.msg = 'ใส่ราคาเข้าและ SL'; return out; }
    const slPts = buy ? e - sl : sl - e;
    if(!(slPts>0)){ out.msg = buy ? 'SL ต้องอยู่ต่ำกว่าราคาเข้า (Buy)' : 'SL ต้องอยู่สูงกว่าราคาเข้า (Sell)'; return out; }
    out.slPts = slPts;
    if(tp>0){
      const tpPts = buy ? tp - e : e - tp;
      if(!(tpPts>0)){ out.msg = buy ? 'TP ต้องอยู่สูงกว่าราคาเข้า (Buy)' : 'TP ต้องอยู่ต่ำกว่าราคาเข้า (Sell)'; return out; }
      out.rr = tpPts / slPts;
    }
    const perLot = P.riskUSD(S.symbol, e, sl, 1);
    const bal = P.balance();
    out.riskTarget = bal ? bal * (Number(R.maxRiskPct)||1) / 100 : null;
    if(perLot>0 && isFinite(perLot)){
      out.perLot = perLot;
      if(out.riskTarget) out.lot = Math.max(0.01, Math.floor(out.riskTarget / perLot * 100) / 100);
    }
    out.ok = true; return out;
  }

  function emoInfo(){ return S.emo && window.tjEmotions ? window.tjEmotions.IN.find(e=>e[0]===S.emo) : null; }
  function verdict(){
    const P = window.tjPB, R = P.prefs().rules, pb = setupObj();
    const rules = (pb && pb.rules) || [];
    const done = rules.filter((_,i)=>S.checks.includes(i)).length;
    const grade = P.gradeOf(done, rules.length);
    const stops = [], waits = [];
    const st = window.tjDayStatus ? window.tjDayStatus(dkey(new Date())) : null;
    if(st && st.reasons.length) stops.push('ถึงลิมิตวันนี้: '+st.reasons.join(' · '));
    const near = newsNear();
    if(near && near.length) stops.push('ข่าวแรงใกล้เวลานี้: '+near.map(e=>e.ccy+' '+e.title).join(', '));
    FLAGS.forEach(f=>{ if(S.flags[f[0]] && !(f[0]==='news' && near)) stops.push(f[1]); });
    const emo = emoInfo();
    if(emo && emo[3]==='bad') stops.push('อารมณ์ตอนนี้: '+emo[1]+' — '+emo[2]);
    const c = calc(), minRR = Number(R.minRR)||0;
    if(done < rules.length) waits.push('เงื่อนไขยังไม่ครบ '+done+'/'+rules.length);
    if(!c.ok) waits.push(c.msg);
    else if(c.rr==null) waits.push('ใส่ราคา TP เพื่อเช็ก RR');
    else if(minRR && c.rr < minRR) stops.push('RR 1:'+c.rr.toFixed(1)+' ต่ำกว่าขั้นต่ำ 1:'+minRR);
    const level = stops.length ? 'stop' : (waits.length ? 'wait' : 'go');
    return { level, stops, waits, grade, done, total: rules.length, calc: c, st, near };
  }

  // ── UI ──
  let el;
  function shell(){
    if(el) return el;
    el = document.createElement('div'); el.className='modal fade print-hide'; el.id='tjPreTradeModal'; el.tabIndex=-1;
    el.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title fw-bold"><i class="fa-solid fa-list-check me-2"></i> เช็กก่อนเข้า</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="ปิด"></button></div>
      <div class="modal-body" id="tj-pt-body"></div>
      <div class="modal-footer tj-pt-foot" id="tj-pt-foot"></div></div></div>`;
    document.body.appendChild(el);
    return el;
  }

  function drawBody(){
    const P = window.tjPB, pbList = P.prefs().playbook, pb = setupObj();
    if(pb && S.setup !== (pb.value||pb.name)) S.setup = pb.value||pb.name;
    const rules = (pb && pb.rules) || [];
    const near = newsNear();
    $('tj-pt-body').innerHTML = `
      <div class="row g-2 mb-3">
        <div class="col-12 col-sm-6"><label class="form-label" for="tj-pt-setup">Setup</label>
          <select class="form-select" id="tj-pt-setup">${pbList.map(p=>`<option value="${esc(p.value||p.name)}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="col-6 col-sm-3"><label class="form-label" for="tj-pt-sym">Symbol</label>
          <input class="form-control text-uppercase" id="tj-pt-sym" value="${esc(S.symbol)}" autocomplete="off"></div>
        <div class="col-6 col-sm-3"><label class="form-label">ทิศทาง</label>
          <div class="tj-pt-side" role="radiogroup" aria-label="ทิศทาง">
            <button type="button" data-side="Buy" role="radio" aria-checked="${S.side==='Buy'}">Buy</button>
            <button type="button" data-side="Sell" role="radio" aria-checked="${S.side==='Sell'}">Sell</button></div></div>
      </div>
      <div class="tj-pt-auto" id="tj-pt-auto"></div>
      ${window.tjSetupExamples ? window.tjSetupExamples.html(pb, S.side) : ''}
      <div class="tj-pb-check tj-pt-check">
        <div class="hd"><i class="fa-solid fa-list-check"></i> เงื่อนไข ${esc(pb?pb.name:'')} <span class="tj-grade" id="tj-pt-grade"></span></div>
        ${rules.length ? rules.map((r,i)=>`<label><input type="checkbox" class="form-check-input" data-rule="${i}" ${S.checks.includes(i)?'checked':''}> <span><span class="tj-rule-no">${i+1}</span>${esc(r)}</span></label>`).join('') : '<div class="small text-muted">Setup นี้ยังไม่มีเงื่อนไข — เพิ่มได้ใน Playbook</div>'}
        <div class="small text-muted mt-1" style="font-size:.7rem">ติ๊กเฉพาะข้อที่เป็นจริงตอนนี้ · ${S.side==='Sell'?'ฝั่ง Sell ให้อ่านกลับด้าน (High ↔ Low)':'ฝั่ง Sell ให้อ่านกลับด้าน'}</div>
      </div>
      <div class="tj-pt-sec">ราคา · RR · ขนาดล็อต</div>
      <div class="row g-2 mb-2">
        <div class="col-4"><label class="form-label" for="tj-pt-entry">Entry</label><input type="number" step="any" inputmode="decimal" class="form-control text-center fw-bold" id="tj-pt-entry" value="${esc(S.entry)}"></div>
        <div class="col-4"><label class="form-label text-danger" for="tj-pt-sl">SL</label><input type="number" step="any" inputmode="decimal" class="form-control text-center fw-bold" id="tj-pt-sl" value="${esc(S.sl)}"></div>
        <div class="col-4"><label class="form-label text-success" for="tj-pt-tp">TP</label><input type="number" step="any" inputmode="decimal" class="form-control text-center fw-bold" id="tj-pt-tp" value="${esc(S.tp)}"></div>
      </div>
      <div class="tj-pt-calc" id="tj-pt-calc"></div>
      ${window.tjEmotions ? `<div class="tj-pt-sec">อารมณ์ตอนนี้</div>
      <div class="tj-emo-chips tj-pt-emo mb-1" role="radiogroup" aria-label="อารมณ์ตอนนี้">${window.tjEmotions.IN.map(([c,t,h,tone])=>`<button type="button" class="tj-emo ${tone}" data-emo="${c}" role="radio" aria-checked="${S.emo===c}" title="${esc(h)}">${esc(t)}</button>`).join('')}</div>
      <div class="tj-q-hint mb-3" id="tj-pt-emo-hint"></div>` : ''}
      <div class="tj-pt-sec">ข้อห้าม — ติ๊กข้อไหนก็ไม่เข้า</div>
      <div class="tj-pb-check tj-pt-flags">
        ${FLAGS.filter(f=>!(f[0]==='news' && near)).map(f=>`<label><input type="checkbox" class="form-check-input" data-flag="${f[0]}" ${S.flags[f[0]]?'checked':''}> <span><b>${esc(f[1])}</b><br><small class="text-muted">${esc(f[2])}</small></span></label>`).join('')}
      </div>`;
    $('tj-pt-setup').value = S.setup;
    if(window.tjSetupExamples) window.tjSetupExamples.wire($('tj-pt-body'), pb, S.side);
    wire();
    update();
  }

  function update(){
    const P = window.tjPB, R = P.prefs().rules, v = verdict(), c = v.calc;
    // grade
    const g = $('tj-pt-grade'); if(g){ g.className = 'tj-grade '+(v.grade?P.gcls(v.grade):''); g.textContent = v.grade ? 'เกรด '+v.grade : ''; }
    // auto checks
    const st = v.st, near = v.near, items = [];
    if(st) items.push(st.reasons.length ? `<div class="tj-pt-row stop"><i class="fa-solid fa-hand"></i> ${esc(st.reasons.join(' · '))}</div>`
                     : `<div class="tj-pt-row ok"><i class="fa-solid fa-check"></i> อยู่ในกฎวันนี้ · เทรดไปแล้ว ${st.list.length}/${R.maxTrades} ไม้ · แพ้ติด ${st.streak}/${R.maxLossStreak}</div>`);
    if(near==null) items.push(`<div class="tj-pt-row warn"><i class="fa-regular fa-newspaper"></i> ยังไม่ได้โหลดข่าว — เช็กเองในหัวข้อข้อห้าม</div>`);
    else items.push(near.length ? `<div class="tj-pt-row stop"><i class="fa-regular fa-newspaper"></i> ข่าวแรงภายใน ${NEWS_MIN} นาที: ${near.map(e=>'<b>'+esc(e.ccy)+'</b> '+esc(e.title)).join(', ')}</div>`
                                : `<div class="tj-pt-row ok"><i class="fa-regular fa-newspaper"></i> ไม่มีข่าวแรงของ ${esc(S.symbol||'-')} ใน ${NEWS_MIN} นาที</div>`);
    $('tj-pt-auto').innerHTML = items.join('');
    const eh = $('tj-pt-emo-hint'), emo = emoInfo();
    if(eh) eh.textContent = !emo ? 'เลือกตามจริง — ระบบบันทึกลงไม้นี้ให้ด้วย' : emo[3]==='bad' ? 'อารมณ์นี้มักทำให้เสียเงิน — พักก่อน รอเซ็ตอัพถัดไป' : emo[3]==='warn' ? 'ถ้าลังเล / กังวล ลองเช็กว่าเงื่อนไขครบจริงไหม หรือลดล็อตลง' : 'ดี — เข้าตามแผนได้';
    // calc
    const minRR = Number(R.minRR)||0;
    const cell = (l, val, cls) => `<div class="${cls||''}"><small>${l}</small><b>${val}</b></div>`;
    $('tj-pt-calc').innerHTML = c.ok ? (
      cell('RR', c.rr!=null ? '1:'+c.rr.toFixed(2) : '—', c.rr!=null ? (minRR && c.rr<minRR ? 'bad' : 'good') : '') +
      cell('SL (จุด)', c.slPts.toFixed(c.slPts<1?4:1)) +
      cell(c.lot!=null ? 'ล็อตที่ควรใช้' : 'เสีย/1 lot', c.lot!=null ? c.lot.toFixed(2) : (c.perLot ? fmt$(c.perLot) : '—'))
    ) + `<p>${c.lot!=null ? `เสี่ยง ${Number(R.maxRiskPct)||1}% ของพอร์ต ≈ ${fmt$(c.riskTarget)} · ${fmt$(c.perLot)} ต่อ 1 lot` : (c.perLot ? 'ยังไม่รู้ยอดพอร์ต — ใส่ยอดฝากในเมนูฝาก/ถอน เพื่อคำนวณล็อต' : 'Symbol นี้คำนวณมูลค่าต่อ lot อัตโนมัติไม่ได้')} · RR ขั้นต่ำ 1:${minRR}</p>`
      : `<p class="m-0">${esc(c.msg)}</p>`;
    // footer
    const head = v.level==='go' ? ['go','fa-circle-check','เข้าได้ตามแผน', `เกรด ${v.grade}${c.rr!=null?' · RR 1:'+c.rr.toFixed(1):''}${c.lot!=null?' · '+c.lot.toFixed(2)+' lot':''}`]
               : v.level==='stop' ? ['stop','fa-hand','ห้ามเข้า', v.stops[0]]
               : ['wait','fa-hourglass-half','ยังไม่ครบ', v.waits[0]];
    $('tj-pt-foot').innerHTML = `<div class="tj-pt-verdict ${head[0]}" aria-live="polite"><i class="fa-solid ${head[1]}"></i><div><b>${head[2]}</b><small>${esc(head[3]||'')}</small></div></div>
      <div class="tj-pt-btns">
        <button type="button" class="btn btn-outline-secondary" id="tj-pt-reset">เริ่มใหม่</button>
        <button type="button" class="btn ${v.level==='go'?'btn-primary':'btn-outline-secondary'}" id="tj-pt-log">${v.level==='go'?'<i class="fa-solid fa-pen-to-square me-1"></i> บันทึกออเดอร์':'บันทึกทั้งที่ไม่ครบ'}</button>
      </div>`;
    $('tj-pt-reset').onclick = ()=>{ const keep = { setup:S.setup, symbol:S.symbol, side:S.side }; S = Object.assign(defaults(), keep); save(); drawBody(); };
    $('tj-pt-log').onclick = ()=>toForm(v);
    save();
  }

  function wire(){
    const body = $('tj-pt-body');
    $('tj-pt-setup').onchange = e=>{ S.setup = e.target.value; S.checks = []; save(); drawBody(); };
    $('tj-pt-sym').oninput = e=>{ S.symbol = e.target.value.toUpperCase().trim(); update(); };
    body.querySelectorAll('[data-side]').forEach(b=>b.onclick = ()=>{ S.side = b.dataset.side; save(); drawBody(); });
    [['tj-pt-entry','entry'],['tj-pt-sl','sl'],['tj-pt-tp','tp']].forEach(([id,k])=>{ $(id).oninput = e=>{ S[k] = e.target.value; update(); }; });
    body.querySelectorAll('[data-rule]').forEach(cb=>cb.onchange = ()=>{
      const i = +cb.dataset.rule; S.checks = S.checks.filter(x=>x!==i); if(cb.checked) S.checks.push(i); update();
    });
    body.querySelectorAll('[data-flag]').forEach(cb=>cb.onchange = ()=>{ S.flags[cb.dataset.flag] = cb.checked; update(); });
    body.querySelectorAll('[data-emo]').forEach(b=>b.onclick = ()=>{ S.emo = S.emo===b.dataset.emo ? '' : b.dataset.emo;
      body.querySelectorAll('[data-emo]').forEach(x=>x.setAttribute('aria-checked', String(x.dataset.emo===S.emo))); update(); });
  }

  // ── ส่งต่อไปฟอร์มบันทึกเทรด ──
  function setVal(el, v){ if(!el) return; el.value = v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
  function toForm(v){
    const form = $('tradeForm'); if(!form) return;
    const m = bootstrap.Modal.getInstance(el); if(m) m.hide();
    const editing = window.tjIsEditing && window.tjIsEditing()!=null;
    if(typeof switchTab==='function') switchTab('add-trade');
    if(!editing) form.reset();
    setTimeout(()=>{
      const F = n => form.querySelector('[name="'+n+'"]'), now = new Date();
      setVal($('f_date'), dkey(now));
      setVal($('f_etime'), pad(now.getHours())+':'+pad(now.getMinutes()));
      setVal(F('symbol'), S.symbol);
      setVal(F('type'), S.side);
      setVal($('f_entry'), S.entry); setVal($('f_sl'), S.sl); setVal($('f_tp'), S.tp);
      if(v.calc.lot!=null) setVal($('f_lots'), v.calc.lot.toFixed(2));
      setVal($('f_setup'), S.setup);
      setTimeout(()=>{
        document.querySelectorAll('#tj-pb-check .tj-pb-cb').forEach(cb=>{ const want = S.checks.includes(+cb.dataset.i); if(cb.checked!==want){ cb.checked = want; cb.dispatchEvent(new Event('change',{bubbles:true})); } });
        setVal(F('outcome'), 'OPEN');
        if(S.emo){ const r = document.getElementById('emo_in_'+S.emo); if(r){ r.checked = true; r.dispatchEvent(new Event('change',{bubbles:true})); } }
        toast('กรอกข้อมูลจากเช็กลิสต์ให้แล้ว — ตรวจแล้วกดบันทึก');
      }, 60);
    }, 80);
  }
  function toast(msg){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 3200); }

  window.tjOpenPreTrade = function(){
    if(!window.tjPB){ toast('ยังโหลด Playbook ไม่เสร็จ ลองใหม่อีกครั้ง'); return; }
    shell(); drawBody();
    bootstrap.Modal.getOrCreateInstance(el).show();
  };
  // เปิดตรงจากลิงก์ ...#pretrade (ใช้ทำทางลัดบนหน้าจอโฮม)
  if(location.hash === '#pretrade') setTimeout(()=>window.tjOpenPreTrade(), 600);
})();
