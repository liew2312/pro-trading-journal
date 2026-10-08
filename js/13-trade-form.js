(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const fmt$ = (n, signed) => { n = Number(n)||0; return (n<0?'-':(signed&&n>0?'+':''))+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  const ls = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  function toast(msg){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 2800); }
  const form = $('tradeForm'); if(!form) return;
  const F = n => form.querySelector('[name="'+n+'"]');

  // ══════════ โหมดบันทึกด่วน / แบบเต็ม ══════════
  const fullOnly = [];
  const mark = el => { if(el && !fullOnly.includes(el)){ el.classList.add('tj-full-only'); fullOnly.push(el); } };
  mark($('f_setup') && $('f_setup').closest('.row'));
  mark($('tj-pb-check'));
  mark(F('marketContext') && F('marketContext').closest('.row'));
  form.querySelectorAll('.confluence-box, .god-rule-box, .discipline-box, .upload-box').forEach(mark);
  mark($('f_mae') && $('f_mae').closest('.row'));
  mark(F('notes') && F('notes').closest('div'));
  form.querySelectorAll('hr').forEach(h=>{ const n = h.nextElementSibling; if(n && n.classList.contains('upload-box')) mark(h); });

  let mode = ls.get('tj_form_mode', window.innerWidth < 768 ? 'wizard' : 'full');
  let editing = null;   // { id, wasQuick }
  // ══════════ โหมดทีละขั้น (Wizard) ══════════
  const STEPS = [
    { t:'เทรดอะไร', s:'คู่เงิน · ทิศทาง · วันเวลาเข้า' },
    { t:'แผน & ความเสี่ยง', s:'ราคาเข้า · SL · TP · ล็อต' },
    { t:'Setup', s:'เลือก Setup และติ๊กเงื่อนไขที่เป็นจริง', skip:true },
    { t:'ผลลัพธ์', s:'ปิดแบบไหน ได้/เสียเท่าไร' },
    { t:'วินัย', s:'ทำตามแผนไหม · ระบบตรวจพฤติกรรมให้', skip:true },
    { t:'ภาพ & บทเรียน', s:'ภาพก่อน/หลัง และบันทึกสั้นๆ', skip:true },
    { t:'ตรวจสอบก่อนบันทึก', s:'ดูสรุป แล้วกดบันทึก' }
  ];
  const stepOf = (el, n) => { if(el){ el.dataset.step = n; } };
  const rowOf = sel => { const e = form.querySelector(sel); return e ? e.closest('.row') : null; };
  stepOf(rowOf('#f_date'),1); stepOf($('tj-stop-form'),1); stepOf(rowOf('[name="symbol"]'),1);
  stepOf(rowOf('#f_entry'),2); stepOf($('rr-preview-box'),2); stepOf(rowOf('#f_lots'),2); stepOf($('tj-risk-info'),2);
  stepOf(rowOf('#f_setup'),3); stepOf($('tj-pb-check'),3); stepOf(rowOf('[name="marketContext"]'),3); stepOf(form.querySelector('.confluence-box'),3);
  stepOf($('tj-outcome-row'),4); stepOf($('rmult-preview'),4); stepOf(rowOf('#f_mae'),4);
  stepOf(form.querySelector('.god-rule-box'),5); stepOf($('tj-behave-warn'),5); stepOf(form.querySelector('.discipline-box'),5);
  form.querySelectorAll('.upload-box').forEach(e=>stepOf(e,6)); stepOf(F('notes') && F('notes').closest('div'),6);
  form.querySelectorAll(':scope > hr').forEach(h=>{ h.dataset.step = 'x'; });

  const head = document.createElement('div'); head.id='tj-wiz-head'; head.className='tj-wiz-head';
  const summary = document.createElement('div'); summary.id='tj-wiz-summary'; summary.className='tj-wiz-summary';
  const nav = document.createElement('div'); nav.id='tj-wiz-nav'; nav.className='tj-wiz-nav';
  nav.innerHTML = '<button type="button" class="btn btn-outline-secondary" id="tj-wiz-back"><i class="fa-solid fa-chevron-left me-1"></i> ย้อนกลับ</button><button type="button" class="btn btn-primary" id="tj-wiz-next">ถัดไป <i class="fa-solid fa-chevron-right ms-1"></i></button><button type="button" class="tj-linkbtn w-100 text-center" id="tj-wiz-skip" style="margin:0">ข้ามขั้นนี้</button>';
  form.insertBefore(head, form.firstElementChild.nextElementSibling);
  const submitBtn = $('submitBtn');
  form.insertBefore(summary, submitBtn);
  form.insertBefore(nav, submitBtn);
  let step = 1;

  function stepEls(n){ return [...form.querySelectorAll(':scope > [data-step="'+n+'"]')]; }
  function validStep(n){
    for(const el of stepEls(n)){
      for(const inp of el.querySelectorAll('input,select,textarea')){
        if(inp.offsetParent !== null && !inp.checkValidity()){ inp.reportValidity(); return false; }
      }
    }
    return true;
  }
  function showStep(n){
    step = Math.max(1, Math.min(STEPS.length, n));
    const st = STEPS[step-1];
    [...form.children].forEach(el=>{
      if(el===head || el===nav || el===summary || el.tagName==='INPUT' && el.type==='hidden') return;
      if(el===submitBtn){ el.style.display = step===STEPS.length ? '' : 'none'; return; }
      el.classList.toggle('tj-wiz-hide', String(el.dataset.step)!==String(step));
    });
    head.innerHTML = `<div class="d-flex align-items-center gap-2 mb-2"><span class="tj-wiz-num">${step}/${STEPS.length}</span><div class="tj-wiz-bar"><span style="width:${step/STEPS.length*100}%"></span></div></div><div class="tj-wiz-title">${st.t}</div><div class="tj-wiz-sub">${st.s}</div>`;
    $('tj-wiz-back').style.visibility = step>1 ? 'visible' : 'hidden';
    $('tj-wiz-next').style.display = step<STEPS.length ? '' : 'none';
    $('tj-wiz-skip').style.display = st.skip ? '' : 'none';
    summary.style.display = step===STEPS.length ? '' : 'none';
    if(step===STEPS.length) renderSummary();
    if(step===2 || step===4){ ['f_entry','f_lots'].forEach(i=>{ const e=$(i); if(e) e.dispatchEvent(new Event('input')); }); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function nextStep(){ if(!validStep(step)) return; showStep(step+1); }
  $('tj-wiz-next').onclick = nextStep;
  $('tj-wiz-back').onclick = ()=>showStep(step-1);
  $('tj-wiz-skip').onclick = ()=>showStep(step+1);

  function renderSummary(){
    const v = n => (F(n)||{}).value || '';
    const risk = parseFloat(v('riskAmount')), pnl = parseFloat(v('pnl'));
    const rr = (()=>{ const e=parseFloat(v('entryPrice')), sl=parseFloat(v('slPrice')), tp=parseFloat(v('tpPrice')); return (e&&sl&&tp&&e!==sl) ? '1 : '+(Math.abs(tp-e)/Math.abs(e-sl)).toFixed(2) : '—'; })();
    const r = risk>0 && isFinite(pnl) ? (pnl/risk) : null;
    const g = $('f_grade').value;
    const flags = [$('revenge').checked?'Revenge':'', $('overtrade').checked?'Overtrade':'', !$('lotRespected').checked?'OverLot':'', !$('followedPlan').checked?'ไม่ทำตามแผน':''].filter(Boolean);
    const ocTxt = { TP:'ชน TP', SL:'ชน SL', BE:'Break Even', Manual:'ปิดเอง', OPEN:'<i class="fa-regular fa-clock"></i> ยังเปิดอยู่ (ใส่ผลทีหลัง)', MISSED:'<i class="fa-solid fa-person-running"></i> ตกรถ (ไม่ได้เข้า)' }[v('outcome')] || '—';
    const riskInfo = ($('tj-risk-info')||{}).textContent || '';
    const pct = /=\s*([\d.]+%)/.exec(riskInfo);
    const row = (k, val, go) => `<div class="tj-sum-row"><span>${k}</span><b>${val}</b><button type="button" class="tj-linkbtn" data-go="${go}">แก้</button></div>`;
    summary.innerHTML = `<div class="tj-sum-card">
      <div class="tj-sum-top"><div><div class="sym">${esc(v('symbol').toUpperCase()||'—')} <span class="tj-hist-tag" style="background:var(--brand-tint);color:var(--brand)">${esc(v('type'))}</span></div><div class="small text-muted">${esc(v('tradeDate'))} ${esc(v('entryTime'))}${v('session')?' · '+esc(v('session')):''}</div></div>
      <div class="text-end"><div class="pnl ${pnl>0?'text-gain':(pnl<0?'text-loss':'')}">${isFinite(pnl)?fmt$(pnl,true):'—'}</div><div class="small fw-bold ${r>0?'text-gain':(r<0?'text-loss':'')}">${r!=null?(r>0?'+':'')+r.toFixed(2)+'R':''}</div></div></div>
      ${row('Timeframe', (()=>{ const h=form.querySelector('.tj-tf-in[name="tf_htf"]:checked'), l=form.querySelector('.tj-tf-in[name="tf_ltf"]:checked'); return (h||l) ? esc((h?h.value.split(':')[1]:'—')+' → '+(l?l.value.split(':')[1]:'—')) : '—'; })(), 1)}
      ${row('Entry / SL / TP', `${esc(v('entryPrice')||'—')} / ${esc(v('slPrice')||'—')} / ${esc(v('tpPrice')||'—')}`, 2)}
      ${row('Lot · Risk', `${esc(v('lots')||'—')} lot · ${isFinite(risk)?fmt$(risk):'—'}${pct?' ('+pct[1]+')':''} · R:R ${rr}`, 2)}
      ${row('Setup', `${esc(($('f_setup').selectedOptions[0]||{}).textContent && $('f_setup').value ? $('f_setup').selectedOptions[0].textContent : '—')}${g?` <span class="tj-grade ${g==='A+'?'gAp':('g'+g)}" style="margin-left:6px">${g}</span>`:''}`, 3)}
      ${row('ผลลัพธ์', ocTxt, 4)}
      ${row('วินัย', flags.length ? `<span class="text-loss">${flags.join(' · ')}</span>` : '<span class="text-gain">ตามกฎ ✓</span>', 5)}
      ${row('ภาพ / บันทึก', [(v('chartHtfUrl')||(($('fileHtf')||{}).files||[]).length||(window._tjShots&&window._tjShots.fileHtf))?'ภาพ HTF ✓':'', (v('chartBeforeUrl')||($('fileBefore').files||[]).length||(window._tjShots&&window._tjShots.fileBefore))?'ภาพจุดเข้า ✓':'', (v('chartAfterUrl')||($('fileAfter').files||[]).length||(window._tjShots&&window._tjShots.fileAfter))?'ภาพหลัง ✓':'', v('notes')?'มีบันทึก ✓':''].filter(Boolean).join(' · ') || '—', 6)}
    </div>`;
    summary.querySelectorAll('[data-go]').forEach(b=>b.onclick = ()=>showStep(+b.dataset.go));
  }
  function wizApply(){
    const on = mode==='wizard';
    form.classList.toggle('tj-wizard', on);
    head.style.display = on ? '' : 'none'; nav.style.display = on ? '' : 'none';
    if(on){ showStep(1); }
    else { [...form.children].forEach(el=>el.classList.remove('tj-wiz-hide')); summary.style.display='none'; submitBtn.style.display=''; }
  }
  // Enter ระหว่างขั้น → ไปขั้นถัดไป แทนการส่งฟอร์ม
  form.addEventListener('keydown', e=>{ if(mode==='wizard' && e.key==='Enter' && e.target.tagName!=='TEXTAREA' && step<STEPS.length){ e.preventDefault(); nextStep(); } });
  // สัญลักษณ์ใช้บ่อย → ปุ่มลัดในขั้นที่ 1
  (function symChips(){
    const inp = F('symbol'); if(!inp) return;
    const box = document.createElement('div'); box.className='tj-sym-chips'; inp.parentNode.appendChild(box);
    const draw = ()=>{ const cnt = {}; (window._tjRows||[]).forEach(r=>{ if(r.type==='Buy'||r.type==='Sell'){ const s=String(r.symbol||'').toUpperCase(); cnt[s]=(cnt[s]||0)+1; } });
      const top = Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,5); if(!top.length) top.push('XAUUSD');
      box.innerHTML = top.map(s=>`<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('');
      box.querySelectorAll('button').forEach(b=>b.onclick = ()=>{ inp.value = b.dataset.s; inp.dispatchEvent(new Event('input')); }); };
    draw(); document.addEventListener('tj:rows', draw);
  })();

  function applyMode(){
    const quick = mode==='quick';
    form.classList.toggle('tj-quick', quick);
    document.querySelectorAll('#tj-form-mode button').forEach(b=>b.classList.toggle('active', b.dataset.m===mode));
    const note = $('tj-quick-note'); if(note) note.style.display = quick ? '' : 'none';
    $('f_emotion').value = quick ? 'QUICK' : '';
    const btn = $('submitBtn');
    if(btn && !btn.disabled) btn.innerHTML = editing ? '<i class="fa-solid fa-floppy-disk me-2"></i> บันทึกการแก้ไข' : (quick ? '<i class="fa-solid fa-bolt me-2"></i> บันทึกด่วน' : '<i class="fa-solid fa-save me-2"></i> บันทึกข้อมูลการเทรด');
    wizApply();
  }
  document.querySelectorAll('#tj-form-mode button').forEach(b=>b.addEventListener('click', ()=>{ mode = b.dataset.m; if(!editing) ls.set('tj_form_mode', mode); applyMode(); }));
  form.addEventListener('reset', ()=>setTimeout(applyMode, 0));
  applyMode();

  // ══════════ แก้ไขออเดอร์ ══════════
  function rowById(id){ return (window._tjRows||[]).concat(window._tjOpenRows||[], window._tjMissedRows||[]).find(r=>String(r.id)===String(id)); }
  function setVal(name, v){ const el = F(name); if(el) el.value = (v==null ? '' : v); }
  function setChk(id, on){ const el = $(id); if(el){ el.checked = !!on; el.dispatchEvent(new Event('change')); } }
  function startEdit(id){
    const r = rowById(id); if(!r){ alert('ไม่พบข้อมูลออเดอร์ (ลองรีเฟรชหน้า)'); return; }
    form.reset();
    setTimeout(()=>{
      editing = { id: r.id, wasQuick: r.emotion==='QUICK' };
      mode = 'full';
      const d = new Date(r.created_at);
      setVal('tradeDate', d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));
      setVal('entryTime', r.entry_time || (pad(d.getHours())+':'+pad(d.getMinutes())));
      setVal('exitTime', r.exit_time || '');
      setVal('symbol', r.symbol); setVal('type', r.type);
      setVal('entryPrice', r.entry_price); setVal('slPrice', r.sl_price); setVal('tpPrice', r.tp_price);
      setVal('lots', r.lots); setVal('pnl', r.pnl);
      const rm = parseFloat(r.r_mult), p = parseFloat(r.pnl);
      if(isFinite(rm) && rm!==0 && isFinite(p)){ setVal('riskAmount', Math.abs(p/rm).toFixed(2)); $('f_risk').dispatchEvent(new Event('input')); }
      if(r.setup){ const sel = $('f_setup'); if(![...sel.options].some(o=>o.value===r.setup)){ const o=document.createElement('option'); o.value=r.setup; o.textContent=r.setup; sel.appendChild(o); } sel.value = r.setup; sel.dispatchEvent(new Event('change')); }
      if(r.grade){ $('f_grade').value = r.grade; const b = $('tj-grade-badge'); if(b){ b.textContent = 'เกรดเดิม '+r.grade+' · ติ๊กใหม่เพื่อเปลี่ยน'; b.className = 'tj-grade gB'; } }
      if(r.session){ const s = F('session'); if(![...s.options].some(o=>o.value===r.session)){ const o=document.createElement('option'); o.value=r.session; o.textContent=r.session; s.appendChild(o); } s.value = r.session; s.dispatchEvent(new Event('change')); }
      setVal('marketContext', r.market_context); setVal('confidence', r.confidence);
      setVal('outcome', r.outcome);
      setVal('mae', r.mae); setVal('mfe', r.mfe);
      setVal('chartBeforeUrl', r.chart_before); setVal('chartAfterUrl', r.chart_after); setVal('chartHtfUrl', r.chart_htf);
      setVal('notes', r.notes);
      const conf = String(r.confluences||'').split(',').map(x=>x.trim());
      form.querySelectorAll('.conf-check').forEach(c=>{ c.checked = conf.includes(c.value); c.dispatchEvent(new Event('change')); });
      const yes = v => v==='Yes';
      $('priceInZone').checked = yes(r.price_in_zone); $('confirmation').checked = yes(r.confirmation);
      setChk('followedPlan', r.followed_plan==='-' ? true : yes(r.followed_plan));
      setChk('lotRespected', r.lot_respected==='-' ? true : yes(r.lot_respected));
      setChk('overtrade', yes(r.overtrade)); setChk('revenge', yes(r.revenge));
      ['f_entry','f_sl','f_lots','f_mae'].forEach(i=>{ const el=$(i); if(el) el.dispatchEvent(new Event('input')); });
      if(typeof autoCalcRR==='function') autoCalcRR();
      const ban = $('tj-edit-banner');
      ban.innerHTML = `<div><b><i class="fa-solid fa-pen me-1"></i> กำลังแก้ไขออเดอร์</b> ${esc(r.symbol)} ${esc(r.type)} ${r.outcome==='OPEN' ? '(เปิดอยู่)' : r.outcome==='MISSED' ? '(ตกรถ)' : fmt$(r.pnl,true)} · ${d.getDate()}/${d.getMonth()+1}${editing.wasQuick?' · <span class="text-warning">บันทึกด่วน — เติมให้ครบแล้วกดบันทึก</span>':''}</div><button type="button" class="btn btn-sm btn-outline-secondary" id="tj-edit-cancel">ยกเลิก</button>`;
      $('tj-edit-cancel').onclick = cancelEdit;
      applyMode();
      switchTab('add-trade'); window.scrollTo({top:0, behavior:'smooth'});
    }, 30);
  }
  function cancelEdit(){
    editing = null; $('tj-edit-banner').innerHTML = '';
    mode = ls.get('tj_form_mode', mode);
    form.reset(); applyMode();
  }
  window.tjEditTrade = startEdit;
  window.tjIsEditing = () => editing ? editing.id : null;

  // ปุ่มแก้ไขในหน้าต่างรายละเอียด
  (function hookModal(){
    const orig = window.showTradeModal;
    if(typeof orig!=='function'){ setTimeout(hookModal,60); return; }
    window.showTradeModal = function(trade){
      const r = orig.apply(this, arguments);
      const b = $('tj-edit-btn');
      if(b){ const isFund = trade && (trade.type==='Deposit' || trade.type==='Withdraw'); b.style.display = (trade && trade.id!=null && !isFund) ? '' : 'none'; b.dataset.id = trade && trade.id; }
      return r;
    };
  })();
  $('tj-edit-btn') && $('tj-edit-btn').addEventListener('click', ()=>{
    const id = $('tj-edit-btn').dataset.id;
    const m = bootstrap.Modal.getInstance($('tradeModal')); if(m) m.hide();
    startEdit(id);
  });

  // ส่งฟอร์ม: ถ้าอยู่ในโหมดแก้ไข → update แทน insert
  (function hookSubmit(){
    const orig = window.handleFormSubmit;
    if(typeof orig!=='function'){ setTimeout(hookSubmit,60); return; }
    window.handleFormSubmit = async function(event){
      if(!editing) return orig.apply(this, arguments);
      event.preventDefault();
      const btn = $('submitBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังบันทึกการแก้ไข...';
      const data = Object.fromEntries(new FormData(form).entries());
      data.followedPlan = $('followedPlan').checked ? 'on' : '';
      data.lotRespected = $('lotRespected').checked ? 'on' : '';
      data.overtrade = $('overtrade').checked ? 'on' : '';
      data.revenge = $('revenge').checked ? 'on' : '';
      data.priceInZone = $('priceInZone').checked ? 'on' : '';
      data.confirmation = $('confirmation').checked ? 'on' : '';
      const checks = []; form.querySelectorAll('.conf-check:checked').forEach(c=>checks.push(c.value)); data.confluences = checks.join(', ');
      data.emotion = mode==='quick' ? 'QUICK' : '';
      try{
        data.fileBeforeObj = await getFileBase64('fileBefore');
        data.fileAfterObj = await getFileBase64('fileAfter');
        data.fileHtfObj = await getFileBase64('fileHtf');
        await window.api.updateTradeData(editing.id, data);
        editing = null; $('tj-edit-banner').innerHTML = '';
        btn.disabled = false; mode = ls.get('tj_form_mode', 'full');
        form.reset(); applyMode();
        toast('บันทึกการแก้ไขแล้ว');
        loadAllData(); switchTab('history'); window.scrollTo(0,0);
      }catch(err){ alert('แก้ไขไม่สำเร็จ: '+(err.message||err)); btn.disabled = false; applyMode(); }
    };
  })();

  // ══════════ ไม้ที่ยังไม่ครบ (บันทึกด่วน / นำเข้า MT5 ที่ยังไม่มี Setup) ══════════
  function pending(){
    return (window._tjRows||[]).filter(r=>(r.type==='Buy'||r.type==='Sell') && (r.emotion==='QUICK' || (/^นำเข้าจาก MT5/.test(String(r.notes||'')) && !r.setup)))
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }
  function renderPending(){
    const host = $('tj-pending'); if(!host) return;
    const list = pending();
    host.innerHTML = list.length ? `<div class="tj-goal" style="border-style:solid;border-color:rgba(217,119,6,.45);cursor:pointer" onclick="tjOpenPending()"><span class="tj-ico tj-ico-warning"><i class="fa-solid fa-pen-to-square"></i></span><div><b>มี ${list.length} ไม้ที่ยังกรอกไม่ครบ</b><div class="small text-muted" style="font-size:.72rem">เติม Setup / เกรด / บันทึก เพื่อให้สถิติ Playbook และวินัยแม่นขึ้น</div></div><button class="tj-linkbtn">เติมเลย ›</button></div>` : '';
  }
  window.tjOpenPending = function(){
    const list = pending();
    let el = $('tjPendingModal');
    if(!el){ el = document.createElement('div'); el.className='modal fade print-hide'; el.id='tjPendingModal'; el.tabIndex=-1;
      el.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title fw-bold"><i class="fa-solid fa-pen-to-square me-2"></i>ไม้ที่ยังกรอกไม่ครบ</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"></div></div></div>';
      document.body.appendChild(el); }
    const fmtD = d => d.getDate()+'/'+(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    el.querySelector('.modal-body').innerHTML = !list.length ? '<div class="tj-empty"><i class="fa-solid fa-check"></i><div>ครบทุกไม้แล้ว</div></div>' :
      `<div class="small text-muted mb-2">เรียงจากล่าสุด · กด “เติม” เพื่อเปิดฟอร์มแก้ไข</div>` + list.map(r=>`<div class="d-flex align-items-center gap-2 py-2" style="border-bottom:1px solid var(--border)">
        <div style="min-width:90px" class="small text-muted">${fmtD(new Date(r.created_at))}</div>
        <div class="fw-semibold" style="flex:1">${esc(r.symbol)} ${esc(r.type)} <span class="${r.pnl>0?'text-gain':(r.pnl<0?'text-loss':'')}">${fmt$(r.pnl,true)}</span>
          <span class="tj-hist-tag" style="background:rgba(217,119,6,.14);color:var(--ap-warn);">${r.emotion==='QUICK'?'บันทึกด่วน':'นำเข้า MT5'}</span></div>
        <button class="btn btn-sm btn-primary" data-id="${esc(r.id)}">เติม</button></div>`).join('');
    el.querySelectorAll('[data-id]').forEach(b=>b.onclick = ()=>{ bootstrap.Modal.getInstance(el).hide(); startEdit(b.dataset.id); });
    bootstrap.Modal.getOrCreateInstance(el).show();
  };
  document.addEventListener('tj:rows', renderPending);
  renderPending();

  // ออกจากหน้าฟอร์มระหว่างแก้ไข → ยกเลิกโหมดแก้ไข
  (function hookTab(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hookTab,60); return; }
    window.switchTab = function(id){ if(editing && id!=='add-trade' && id!=='chart'){ cancelEdit(); } return orig.apply(this, arguments); };
  })();
})();

