(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const fmt$ = (n, signed) => { n = Number(n)||0; return (n<0?'-':(signed&&n>0?'+':''))+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  const fmtR = n => (n>0?'+':'')+(Number(n)||0).toFixed(2)+'R';
  const dkey = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const ls = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  function toast(msg, ms){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), ms||2800); }
  const isTrade = r => (r.type==='Buy'||r.type==='Sell') && String(r.symbol||'').trim()!=='' && isFinite(parseFloat(r.pnl));
  const rows = () => (window._tjRows || []);

  // ══════════ PREFS (ซิงก์ผ่านบัญชี Supabase: user_metadata) ══════════
  const DEFAULT_PLAYBOOK = [
    { value:'SMC', name:'SMC / ICT', rules:['มีการกวาด Liquidity ก่อนเข้า','เกิด BOS / CHOCH ใน TF เล็ก','เข้าที่ FVG / Order Block ฝั่งที่ถูก (Premium/Discount)','ทิศทางตรงกับ HTF bias','RR อย่างน้อย 1:2'] },
    { value:'Demand/Supply', name:'Demand / Supply', rules:['โซนสด ยังไม่ถูกทดสอบ','ราคาออกจากโซนแรง (impulse)','มีแท่งยืนยันที่โซน','RR อย่างน้อย 1:2'] },
    { value:'Breakout', name:'Breakout', rules:['เบรกกรอบชัดเจน ปิดแท่งนอกกรอบ','โมเมนตัมหนุน','รอ Retest ก่อนเข้า','ไม่มีข่าวแรงภายใน 30 นาที'] },
    { value:'Trend Following', name:'Trend Following', rules:['HTF เป็นเทรนด์ชัด (HH/HL หรือ LH/LL)','เข้าตอนย่อ ไม่ไล่ราคา','SL หลัง swing ล่าสุด','RR อย่างน้อย 1:2'] }
  ];
  const DEFAULT_RULES = { maxRiskPct:1, maxDailyLossR:2, maxLossStreak:2, maxTrades:5, revengeMin:15, xauContract:100 };
  let prefs = Object.assign({ rules: Object.assign({}, DEFAULT_RULES), playbook: DEFAULT_PLAYBOOK }, ls.get('tj_prefs', {}));
  prefs.rules = Object.assign({}, DEFAULT_RULES, prefs.rules||{});
  let authClient = null;
  function auth(){
    if(authClient) return authClient;
    try{ const c = window.SUPABASE_CONFIG; authClient = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY); }catch(e){}
    return authClient;
  }
  async function loadPrefs(){
    try{
      const a = auth(); if(!a) return;
      const { data } = await a.auth.getUser();
      const remote = data && data.user && data.user.user_metadata && data.user.user_metadata.tj_prefs;
      if(remote && typeof remote==='object'){
        prefs = Object.assign({}, prefs, remote);
        prefs.rules = Object.assign({}, DEFAULT_RULES, remote.rules||{});
        if(!Array.isArray(prefs.playbook) || !prefs.playbook.length) prefs.playbook = DEFAULT_PLAYBOOK;
        ls.set('tj_prefs', prefs);
        applyPrefs();
      }
    }catch(e){ console.warn('[prefs] load', e); }
  }
  async function savePrefs(){
    ls.set('tj_prefs', prefs);
    applyPrefs();
    try{ const a = auth(); if(a) await a.auth.updateUser({ data: { tj_prefs: prefs } }); }catch(e){ console.warn('[prefs] save', e); }
  }
  function applyPrefs(){ buildSetupSelect(); renderToday(); formChecks(); }

  // ══════════ ข้อ 2: คำนวณ Risk อัตโนมัติ + % พอร์ต ══════════
  function normSym(sym){ return String(sym||'').toUpperCase().replace(/^[A-Z]+:/,'').replace(/[^A-Z0-9]/g,''); }
  function riskUSD(sym, entry, sl, lots){
    sym = normSym(sym); const dist = Math.abs(entry - sl);
    if(!(dist>0) || !(lots>0)) return null;
    const m = /^([A-Z]{6})/.exec(sym); const s6 = m ? m[1] : sym;
    if(/^XAU/.test(s6)) return dist * lots * (Number(prefs.rules.xauContract)||100) * (s6.endsWith('USD')?1:NaN);
    if(/^XAG/.test(s6)) return dist * lots * 5000;
    if(/^(BTC|ETH)/.test(sym)) return dist * lots * 1;
    const FX = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD'];
    if(s6.length===6 && FX.includes(s6.slice(0,3)) && FX.includes(s6.slice(3))){
      if(s6.endsWith('USD')) return dist * lots * 100000;
      if(s6.startsWith('USD')) return dist * lots * 100000 / entry;
    }
    return null;   // คู่ข้าม / ดัชนี — กรอก Risk$ เอง
  }
  function balance(){ const b = parseFloat(window._lastMetrics && window._lastMetrics.balance); return isFinite(b) && b>0 ? b : null; }
  function oneR(){ const b = balance(); return b ? b * (Number(prefs.rules.maxRiskPct)||1) / 100 : null; }
  let riskManual = false;
  function riskCheck(){
    const f = $('tradeForm'); if(!f) return;
    const sym = f.querySelector('[name="symbol"]').value;
    const entry = parseFloat($('f_entry').value), sl = parseFloat($('f_sl').value), lots = parseFloat($('f_lots').value);
    const auto = riskUSD(sym, entry, sl, lots);
    const rInp = $('f_risk');
    if(auto!=null && isFinite(auto) && !riskManual){ rInp.value = auto.toFixed(2); if(typeof autoCalcRR==='function') autoCalcRR(); }
    const risk = parseFloat(rInp.value);
    const info = $('tj-risk-info'); if(!info) return;
    const b = balance(), maxP = Number(prefs.rules.maxRiskPct)||1;
    if(!(risk>0)){ info.className='tj-risk-info'; info.innerHTML = (auto==null && sym && entry && sl) ? 'คู่นี้คำนวณ Risk อัตโนมัติไม่ได้ — กรอก Risk $ เอง (ขาดทุนถ้าโดน SL)' : ''; return; }
    let html = `เสี่ยง <b>${fmt$(risk)}</b>${!riskManual && auto!=null ? ' (คำนวณจาก SL × Lot)' : ''}`;
    let cls = 'tj-risk-info';
    if(b){
      const pct = risk / b * 100;
      html += ` = <b>${pct.toFixed(2)}%</b> ของพอร์ต (${fmt$(b)}) · ลิมิตที่ตั้งไว้ ${maxP}%`;
      if(pct > maxP*2) cls += ' bad'; else if(pct > maxP) cls += ' warn';
      const per = auto!=null && lots>0 ? auto/lots : null;
      if(per && pct > maxP) html += `<br><i class="fa-solid fa-triangle-exclamation"></i> เกินลิมิต — ล็อตที่เหมาะสมไม่เกิน <b>${Math.max(0.01, Math.floor(b*maxP/100/per*100)/100).toFixed(2)}</b> lot`;
      const lr = $('lotRespected'); if(lr && !lr.dataset.touched) lr.checked = pct <= maxP*1.05;
    }
    info.className = cls; info.innerHTML = html;
  }
  (function wireRisk(){
    const f = $('tradeForm'); if(!f) return;
    ['f_entry','f_sl','f_lots'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', riskCheck); });
    const sy = f.querySelector('[name="symbol"]'); if(sy) sy.addEventListener('input', riskCheck);
    const r = $('f_risk'); if(r) r.addEventListener('input', ()=>{ riskManual = r.value !== ''; riskCheck(); });
    const lr = $('lotRespected'); if(lr) lr.addEventListener('change', ()=>{ lr.dataset.touched='1'; });
  })();

  // ══════════ ข้อ 4: สถานะวันนี้ + กฎหยุดเทรด ══════════
  function tradeR(r){
    const rm = parseFloat(r.r_mult); if(isFinite(rm)) return rm;
    const u = oneR(); const p = parseFloat(r.pnl);
    return u && isFinite(p) ? p / u : 0;
  }
  function dayTrades(dateKey){
    return rows().filter(r=>isTrade(r) && dkey(new Date(r.created_at))===dateKey).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  }
  function dayStatus(dateKey){
    const R = prefs.rules, list = dayTrades(dateKey);
    let pnl=0, sumR=0, streak=0;
    list.forEach(r=>{ const p=parseFloat(r.pnl)||0; pnl+=p; sumR+=tradeR(r); streak = p<0 ? streak+1 : (p>0 ? 0 : streak); });
    const reasons = [], warns = [];
    if(sumR <= -R.maxDailyLossR) reasons.push(`ขาดทุนวันนี้ ${fmtR(sumR)} ถึงลิมิต -${R.maxDailyLossR}R`);
    else if(sumR <= -R.maxDailyLossR*0.5) warns.push(`ขาดทุนแล้ว ${fmtR(sumR)} (ลิมิต -${R.maxDailyLossR}R)`);
    if(streak >= R.maxLossStreak) reasons.push(`แพ้ติดกัน ${streak} ไม้ (ลิมิต ${R.maxLossStreak})`);
    else if(streak === R.maxLossStreak-1 && streak>0) warns.push(`แพ้ติดกัน ${streak} ไม้ — อีก 1 ไม้ถึงลิมิต`);
    if(list.length >= R.maxTrades) reasons.push(`เทรดครบ ${list.length} ไม้ (ลิมิต ${R.maxTrades} ไม้/วัน)`);
    else if(list.length === R.maxTrades-1) warns.push(`เหลืออีก 1 ไม้ก่อนถึงลิมิตวันนี้`);
    return { list, pnl, sumR, streak, reasons, warns, level: reasons.length ? 'stop' : (warns.length ? 'warn' : 'ok') };
  }
  window.tjDayStatus = dayStatus;
  function renderToday(){
    const host = $('tj-today'); if(!host) return;
    const R = prefs.rules, st = dayStatus(dkey(new Date()));
    const lossUsed = Math.max(0, -st.sumR), pct = Math.min(100, lossUsed / R.maxDailyLossR * 100);
    const pill = st.level==='stop' ? '<span class="tj-pill stop"><i class="fa-solid fa-hand"></i> หยุดเทรดวันนี้</span>' : (st.level==='warn' ? '<span class="tj-pill warn"><i class="fa-solid fa-triangle-exclamation"></i> ระวัง</span>' : '<span class="tj-pill ok"><i class="fa-solid fa-check"></i> อยู่ในกฎ</span>');
    const barCol = pct>=100 ? 'var(--loss)' : (pct>=50 ? 'var(--ap-warn)' : 'var(--profit)');
    host.innerHTML = `<div class="tj-today-head"><h6>วันนี้</h6>${pill}<button class="tj-linkbtn" onclick="tjOpenRules()"><i class="fa-solid fa-sliders"></i> ตั้งค่ากฎ</button></div>
      <div class="tj-today-grid">
        <div class="tj-today-cell"><div class="l">P&amp;L วันนี้</div><div class="v ${st.pnl>0?'text-gain':(st.pnl<0?'text-loss':'')}">${fmt$(st.pnl,true)}</div><div class="s">${fmtR(st.sumR)}</div></div>
        <div class="tj-today-cell"><div class="l">จำนวนไม้</div><div class="v">${st.list.length}<span class="s"> / ${R.maxTrades}</span></div><div class="s">ลิมิตต่อวัน</div></div>
        <div class="tj-today-cell"><div class="l">แพ้ติดกัน</div><div class="v ${st.streak>=R.maxLossStreak?'text-loss':''}">${st.streak}<span class="s"> / ${R.maxLossStreak}</span></div><div class="s">หยุดเมื่อครบ</div></div>
        <div class="tj-today-cell"><div class="l">ใช้ลิมิตขาดทุน</div><div class="v">${lossUsed.toFixed(1)}R<span class="s"> / ${R.maxDailyLossR}R</span></div><div class="tj-bar"><span style="width:${pct}%;background:${barCol}"></span></div></div>
      </div>
      ${st.reasons.length ? `<div class="tj-today-msg stop"><i class="fa-solid fa-hand"></i> ${st.reasons.map(esc).join(' · ')} — ปิดกราฟ พักก่อน พรุ่งนี้ค่อยเริ่มใหม่</div>` : (st.warns.length ? `<div class="tj-today-msg warn"><i class="fa-solid fa-triangle-exclamation"></i> ${st.warns.map(esc).join(' · ')}</div>` : '')}`;
    const fb = $('tj-stop-form');
    if(fb){ const s2 = dayStatus(($('f_date')||{}).value || dkey(new Date())); fb.innerHTML = s2.reasons.length ? '<i class="fa-solid fa-hand"></i> วันนั้นถึงลิมิตแล้ว: '+s2.reasons.map(esc).join(' · ')+' — ถ้าเป็นไม้ที่เทรดไปแล้วบันทึกได้ แต่อย่าเปิดไม้ใหม่' : ''; }
  }
  function stopOverlay(){
    if(window.tjIsEditing && window.tjIsEditing()!=null) return;
    const st = dayStatus(dkey(new Date()));
    if(st.level!=='stop') return;
    const ackKey = 'tj_stop_ack_'+dkey(new Date());
    if(ls.get(ackKey,false)) return;
    const ov = document.createElement('div'); ov.className='tj-overlay';
    ov.innerHTML = `<div class="box"><div class="tj-ico tj-ico-danger tj-ico-lg"><i class="fa-solid fa-hand"></i></div><h4>ถึงลิมิตของวันนี้แล้ว</h4>
      <ul>${st.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')}</ul>
      <div class="small text-muted mb-3">การเทรดต่อหลังถึงลิมิต คือจุดที่พอร์ตส่วนใหญ่พัง — ปิดกราฟแล้วพักก่อน</div>
      <div class="d-grid gap-2"><button class="btn btn-primary" data-a="home">กลับหน้าหลัก (หยุดเทรด)</button>
      <button class="btn btn-outline-secondary" data-a="log">บันทึกไม้ที่เทรดไปแล้วเท่านั้น</button></div></div>`;
    ov.querySelector('[data-a="home"]').addEventListener('click',()=>{ ov.remove(); switchTab('dashboard'); });
    ov.querySelector('[data-a="log"]').addEventListener('click',()=>{ ls.set(ackKey,true); ov.remove(); });
    document.body.appendChild(ov);
  }

  // ── Modal helper ──
  function modal(id, title, bodyHtml, footHtml, size){
    let el = $(id);
    if(!el){
      el = document.createElement('div'); el.className='modal fade print-hide'; el.id=id; el.tabIndex=-1;
      el.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${size||''}"><div class="modal-content"><div class="modal-header"><h5 class="modal-title fw-bold"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"></div><div class="modal-footer"></div></div></div>`;
      document.body.appendChild(el);
    }
    el.querySelector('.modal-title').innerHTML = title;
    el.querySelector('.modal-body').innerHTML = bodyHtml;
    el.querySelector('.modal-footer').innerHTML = footHtml||'';
    el.querySelector('.modal-footer').style.display = footHtml ? '' : 'none';
    const m = bootstrap.Modal.getOrCreateInstance(el); m.show();
    return el;
  }
  window.tjHideSettings = function(){ const m = bootstrap.Modal.getInstance($('settingsModal')); if(m) m.hide(); };

  // ── Rules modal ──
  window.tjOpenRules = function(){
    const R = prefs.rules;
    const f = (k, label, step, suf, help) => `<div class="mb-3"><label class="form-label">${label}</label><div class="input-group"><input type="number" class="form-control" data-k="${k}" step="${step}" min="0" value="${R[k]}"><span class="input-group-text">${suf}</span></div>${help?`<div class="small text-muted mt-1">${help}</div>`:''}</div>`;
    const el = modal('tjRulesModal','<i class="fa-solid fa-shield-halved me-2" style="color:var(--loss)"></i> กฎคุมความเสี่ยง',
      f('maxRiskPct','ความเสี่ยงสูงสุดต่อไม้','0.1','% ของพอร์ต','มืออาชีพส่วนใหญ่ใช้ 0.5–1%') +
      f('maxDailyLossR','ขาดทุนสูงสุดต่อวัน','0.5','R','ถึงแล้วหยุดเทรดทั้งวัน (แนะนำ 2–3R)') +
      f('maxLossStreak','แพ้ติดกันสูงสุด','1','ไม้','ครบแล้วหยุด (แนะนำ 2)') +
      f('maxTrades','จำนวนไม้สูงสุดต่อวัน','1','ไม้','กัน Overtrade') +
      f('revengeMin','นับเป็น Revenge ถ้าเข้าไม้ใหม่ภายใน','1','นาที หลังแพ้','') +
      f('xauContract','ขนาดสัญญาทอง (XAUUSD) ต่อ 1 lot','1','ออนซ์','โบรกส่วนใหญ่ = 100 (ราคาขยับ $1 = $100/lot)') +
      '<div class="small text-muted">กฎซิงก์กับบัญชีของคุณ ใช้ได้ทุกเครื่อง · 1R ของไม้ที่ไม่มี Risk$ = พอร์ต × % ความเสี่ยงต่อไม้</div>',
      '<button class="btn btn-primary w-100" id="tj-rules-save">บันทึกกฎ</button>');
    el.querySelector('#tj-rules-save').onclick = async ()=>{
      el.querySelectorAll('[data-k]').forEach(i=>{ const v=parseFloat(i.value); if(isFinite(v) && v>=0) prefs.rules[i.dataset.k]=v; });
      await savePrefs(); bootstrap.Modal.getInstance(el).hide(); toast('บันทึกกฎแล้ว');
    };
  };

  // ══════════ ข้อ 5: ตรวจ Revenge / Overtrade อัตโนมัติในฟอร์ม ══════════
  function minutesOf(r){ const d = new Date(r.created_at); return d.getHours()*60+d.getMinutes(); }
  function exitMin(r){ const m=/^(\d{1,2}):(\d{2})/.exec(String(r.exit_time||'')); return m ? (+m[1])*60+(+m[2]) : minutesOf(r); }
  function formChecks(){
    const f = $('tradeForm'); if(!f) return;
    const date = ($('f_date')||{}).value || dkey(new Date());
    const et = ($('f_etime')||{}).value; const em = /^(\d{1,2}):(\d{2})/.exec(et||'');
    const entryMin = em ? (+em[1])*60+(+em[2]) : (new Date().getHours()*60+new Date().getMinutes());
    const lots = parseFloat(($('f_lots')||{}).value);
    const editId = window.tjIsEditing ? window.tjIsEditing() : null;
    const before = dayTrades(date).filter(r=>minutesOf(r) <= entryMin && (editId==null || String(r.id)!==String(editId)));
    const R = prefs.rules, msgs = [];
    let revenge = false, over = false;
    const last = before[before.length-1];
    if(last && (parseFloat(last.pnl)||0) < 0){
      const gap = entryMin - exitMin(last);
      if(gap >= 0 && gap <= R.revengeMin){ revenge = true; msgs.push(`เข้าไม้ใหม่ ${gap} นาทีหลังแพ้ (${esc(last.symbol)} ${fmt$(last.pnl,true)})`); }
      if(isFinite(lots) && parseFloat(last.lots) > 0 && lots > parseFloat(last.lots)){ revenge = true; msgs.push(`ล็อตใหญ่ขึ้นหลังแพ้ (${last.lots} → ${lots})`); }
    }
    if(before.length >= R.maxTrades){ over = true; msgs.push(`เป็นไม้ที่ ${before.length+1} ของวัน (ลิมิต ${R.maxTrades})`); }
    const rv = $('revenge'), ov = $('overtrade');
    if(rv && !rv.dataset.touched) rv.checked = revenge;
    if(ov && !ov.dataset.touched) ov.checked = over;
    const w = $('tj-behave-warn');
    if(w) w.innerHTML = msgs.length ? '<i class="fa-solid fa-wand-magic-sparkles"></i> ระบบตรวจพบ: '+msgs.join(' · ')+' — ติ๊ก '+[revenge?'Revenge':'',over?'Overtrade':''].filter(Boolean).join(' / ')+' ให้แล้ว' : '';
    renderToday();
  }
  (function wireForm(){
    const f = $('tradeForm'); if(!f) return;
    const today = ()=>{ const d=$('f_date'); if(d && !d.value) d.value = dkey(new Date()); };
    today();
    ['f_date','f_etime','f_lots'].forEach(id=>{ const el=$(id); if(el){ el.addEventListener('input', formChecks); el.addEventListener('change', formChecks); } });
    ['revenge','overtrade'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change', ()=>{ el.dataset.touched='1'; }); });
    f.addEventListener('reset', ()=>{ setTimeout(()=>{ today(); riskManual=false; ['revenge','overtrade','lotRespected'].forEach(id=>{ const el=$(id); if(el) delete el.dataset.touched; }); const i=$('tj-risk-info'); if(i) i.innerHTML=''; $('tj-pb-check').innerHTML=''; $('f_grade').value=''; formChecks(); }, 0); });
    // เปลี่ยนวันที่ → เซสชัน/ข่าวคิดตามวันนั้น
    const d = $('f_date'); if(d) d.addEventListener('change', ()=>{ const e=$('f_etime'); if(e) e.dispatchEvent(new Event('change')); });
  })();

  // ══════════ ข้อ 6: Playbook + เกรด ══════════
  function buildSetupSelect(){
    const sel = $('f_setup'); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled '+(cur?'':'selected')+'>เลือก Setup...</option>' +
      prefs.playbook.map(p=>`<option value="${esc(p.value||p.name)}">${esc(p.name)}</option>`).join('');
    if(cur && [...sel.options].some(o=>o.value===cur)) sel.value = cur;
    try{ prefs.playbook.forEach(p=>window._allSetups && window._allSetups.add(p.value||p.name)); }catch(e){}
    renderChecklist();
  }
  function gradeOf(done, total){ if(!total) return ''; const p = done/total; return p>=1 ? 'A+' : (p>=0.75 ? 'A' : (p>=0.5 ? 'B' : 'C')); }
  const gcls = g => g==='A+'?'gAp':(g==='A'?'gA':(g==='B'?'gB':'gC'));
  function renderChecklist(){
    const host = $('tj-pb-check'), sel = $('f_setup'); if(!host || !sel) return;
    const pb = prefs.playbook.find(p=>(p.value||p.name)===sel.value);
    if(!pb || !pb.rules || !pb.rules.length){ host.innerHTML=''; if($('f_grade')) $('f_grade').value=''; return; }
    host.innerHTML = `<div class="hd"><i class="fa-solid fa-list-check"></i> เช็กลิสต์ ${esc(pb.name)} <span class="tj-grade" id="tj-grade-badge"></span></div>` +
      pb.rules.map((r,i)=>`<label><input type="checkbox" class="form-check-input tj-pb-cb" data-i="${i}"> <span>${esc(r)}</span></label>`).join('') +
      '<div class="small text-muted mt-1" style="font-size:.7rem">ติ๊กเฉพาะข้อที่ “เป็นจริง” ตอนเข้าเทรด · ครบทุกข้อ = A+ · ≥75% = A · ≥50% = B · ต่ำกว่า = C</div>';
    const upd = ()=>{ const cbs=[...host.querySelectorAll('.tj-pb-cb')]; const g = gradeOf(cbs.filter(c=>c.checked).length, cbs.length); $('f_grade').value = g; const b=$('tj-grade-badge'); b.className='tj-grade '+gcls(g); b.textContent='เกรด '+g; };
    host.querySelectorAll('.tj-pb-cb').forEach(c=>c.addEventListener('change', upd)); upd();
  }
  (function(){ const s=$('f_setup'); if(s) s.addEventListener('change', renderChecklist); })();

  window.tjOpenPlaybook = function(){
    const draw = list => list.map((p,i)=>`<div class="tj-pb-item" data-i="${i}">
        <div class="d-flex gap-2 mb-2"><input class="form-control fw-bold" data-f="name" value="${esc(p.name)}" placeholder="ชื่อ Setup">
        <button class="btn btn-outline-danger btn-sm" data-del="${i}" title="ลบ"><i class="fa-solid fa-trash"></i></button></div>
        <textarea class="form-control" data-f="rules" rows="4" placeholder="เงื่อนไขเข้าเทรด บรรทัดละ 1 ข้อ">${esc((p.rules||[]).join('\n'))}</textarea></div>`).join('');
    let list = JSON.parse(JSON.stringify(prefs.playbook));
    const el = modal('tjPlaybookModal','<i class="fa-solid fa-book me-2"></i> Playbook ของคุณ',
      '<div class="small text-muted mb-3">กำหนด Setup ที่คุณเทรด และเงื่อนไขที่ต้องครบก่อนเข้า — ฟอร์มจะให้เกรด A+/A/B/C อัตโนมัติ แล้วหน้า Performance จะบอกว่าเกรดไหนทำเงินจริง</div><div id="tj-pb-list"></div><button class="btn btn-outline-secondary w-100" id="tj-pb-add"><i class="fa-solid fa-plus me-1"></i> เพิ่ม Setup</button>',
      '<button class="btn btn-primary w-100" id="tj-pb-save">บันทึก Playbook</button>', 'modal-lg');
    const box = el.querySelector('#tj-pb-list');
    const collect = ()=>{ [...box.querySelectorAll('.tj-pb-item')].forEach(it=>{ const i=+it.dataset.i; list[i].name = it.querySelector('[data-f="name"]').value.trim(); list[i].rules = it.querySelector('[data-f="rules"]').value.split('\n').map(x=>x.trim()).filter(Boolean); }); };
    const render = ()=>{ box.innerHTML = draw(list); box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ collect(); list.splice(+b.dataset.del,1); render(); }); };
    render();
    el.querySelector('#tj-pb-add').onclick = ()=>{ collect(); list.push({ value:'', name:'', rules:[] }); render(); };
    el.querySelector('#tj-pb-save').onclick = async ()=>{
      collect();
      list = list.filter(p=>p.name).map(p=>({ value: p.value || p.name, name: p.name, rules: p.rules }));
      if(!list.length){ toast('ต้องมีอย่างน้อย 1 Setup'); return; }
      prefs.playbook = list; await savePrefs(); bootstrap.Modal.getInstance(el).hide(); toast('บันทึก Playbook แล้ว');
    };
  };

  // ══════════ ข้อ 8: MAE / MFE เป็นราคา → R ══════════
  function excursion(r){
    const e = parseFloat(r.entry_price), sl = parseFloat(r.sl_price), mae = parseFloat(r.mae), mfe = parseFloat(r.mfe);
    const risk = Math.abs(e - sl);
    if(!(risk>0) || !(e>0)) return null;
    const looksPrice = v => isFinite(v) && v>0 && Math.abs(v - e)/e < 0.2;
    const out = {};
    if(looksPrice(mae)) out.maeR = Math.abs(e - mae) / risk;
    if(looksPrice(mfe)) out.mfeR = Math.abs(mfe - e) / risk;
    if(out.maeR==null && out.mfeR==null) return null;
    return out;
  }
  function maeMfePreview(){
    const info = $('tj-maemfe-info'); if(!info) return;
    const r = { entry_price: $('f_entry').value, sl_price: $('f_sl').value, mae: $('f_mae').value, mfe: $('f_mfe').value };
    const x = excursion(r);
    if(!x){ info.innerHTML = 'กรอกเป็น<b>ราคา</b> ระบบคำนวณเป็น R ให้ — ใช้วิเคราะห์ว่า SL แคบ/กว้างไปไหม และปิดกำไรเร็วไปไหม (ดูที่หน้า Performance)'; return; }
    info.innerHTML = [x.maeR!=null ? `ราคาสวนไป <b>${x.maeR.toFixed(2)}R</b>` : '', x.mfeR!=null ? `วิ่งไปได้ <b>${x.mfeR.toFixed(2)}R</b>` : ''].filter(Boolean).join(' · ');
  }
  ['f_mae','f_mfe','f_entry','f_sl'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', maeMfePreview); });

  // ══════════ Performance: เกรด / พฤติกรรม / ประสิทธิภาพ ══════════
  function rowRow(t){ return t.row || {}; }
  function statRows(list){
    let n=0,w=0,p=0,rs=0,rn=0; list.forEach(t=>{ n++; p+=t.pnl; if(t.pnl>0) w++; const rm=parseFloat(rowRow(t).r_mult); if(isFinite(rm)){ rs+=rm; rn++; } });
    return { n, w, p, wr: n? w/n*100:0, avgR: rn? rs/rn : null };
  }
  const lsRow = (name, sub, x) => `<div class="tj-ls-row"><div class="fw-semibold">${name}<div class="h" style="text-align:left">${sub||''}</div></div>
    <div><div class="h">ไม้</div><div class="n">${x.n}</div></div>
    <div><div class="h">Win</div><div class="n">${x.n? x.wr.toFixed(0)+'%':'—'}</div></div>
    <div><div class="h">${x.avgR!=null?'เฉลี่ย R':'P&amp;L'}</div><div class="n money ${(x.avgR!=null?x.avgR:x.p)>0?'text-gain':((x.avgR!=null?x.avgR:x.p)<0?'text-loss':'')}">${x.avgR!=null ? fmtR(x.avgR) : fmt$(x.p,true)}</div></div></div>`;
  function renderExtraPerf(){
    if(!window.tjApplyFilters) return;
    const trades = window.tjApplyFilters(rows(), true);
    // เกรด
    const gh = $('tj-grade-perf');
    if(gh){
      const groups = { 'A+':[], 'A':[], 'B':[], 'C':[] }; let none = 0;
      trades.forEach(t=>{ const g = String(rowRow(t).grade||'').trim(); if(groups[g]) groups[g].push(t); else none++; });
      const graded = Object.values(groups).reduce((a,b)=>a+b.length,0);
      if(!graded){ gh.innerHTML = '<div class="tj-empty"><i class="fa-solid fa-medal"></i><div>ยังไม่มีไม้ที่มีเกรด — เลือก Setup และติ๊กเช็กลิสต์ในฟอร์ม</div></div>'; }
      else {
        const st = {}; Object.keys(groups).forEach(g=>st[g]=statRows(groups[g]));
        let tip = '';
        const hi = statRows(groups['A+'].concat(groups['A'])), lo = statRows(groups['B'].concat(groups['C']));
        if(hi.n>=5 && lo.n>=5){
          const hv = hi.avgR!=null?hi.avgR:hi.p/hi.n, lv = lo.avgR!=null?lo.avgR:lo.p/lo.n;
          tip = hv > lv ? `<div class="tj-tip ${lv<0?'bad':''}">ไม้เกรด A+/A ได้เฉลี่ย ${hi.avgR!=null?fmtR(hi.avgR):fmt$(hv,true)} ต่อไม้ เทียบกับ B/C ${lo.avgR!=null?fmtR(lo.avgR):fmt$(lv,true)}${lv<0?' — <b>ตัดไม้เกรด B/C ออกจะดีขึ้นทันที</b>':''}</div>`
                        : `<div class="tj-tip">ไม้เกรดต่ำยังทำผลได้ไม่แย่กว่าเกรดสูง — ลองทบทวนว่าเช็กลิสต์วัดสิ่งที่สำคัญจริงไหม</div>`;
        }
        gh.innerHTML = Object.keys(groups).map(g=> lsRow(`<span class="tj-grade ${gcls(g)}" style="margin:0">${g}</span>`, g==='A+'?'ครบทุกเงื่อนไข':(g==='C'?'ไม่ถึงครึ่ง':''), st[g])).join('') + (none? `<div class="small text-muted mt-2" style="font-size:.7rem">ไม่มีเกรด ${none} ไม้ (บันทึกก่อนมี Playbook)</div>`:'') + tip;
      }
    }
    // พฤติกรรม
    const bh = $('tj-behave-perf');
    if(bh){
      const R = prefs.rules, byDay = {};
      trades.forEach(t=>{ const k=dkey(t.d); (byDay[k]=byDay[k]||[]).push(t); });
      const rev=[], over=[], after=[], normal=[];
      Object.values(byDay).forEach(list=>{
        list.sort((a,b)=>a.d-b.d); let streak=0, sumR=0;
        list.forEach((t,i)=>{
          const prev = list[i-1], r = rowRow(t);
          const isRev = prev && prev.pnl<0 && (minutesOf(r) - exitMin(rowRow(prev))) <= R.revengeMin && (minutesOf(r) - exitMin(rowRow(prev))) >= 0;
          const isOver = i >= R.maxTrades;
          const isAfter = streak >= R.maxLossStreak || sumR <= -R.maxDailyLossR;
          if(isRev) rev.push(t); if(isOver) over.push(t); if(isAfter) after.push(t);
          if(!isRev && !isOver && !isAfter) normal.push(t);
          streak = t.pnl<0 ? streak+1 : (t.pnl>0?0:streak); sumR += tradeR(r);
        });
      });
      const sr = statRows(rev), so = statRows(over), sa = statRows(after), sn = statRows(normal);
      const bad = [sr,so,sa].filter(x=>x.n).reduce((a,x)=>a+x.p,0);
      bh.innerHTML = lsRow('<i class="fa-solid fa-fire me-1"></i>Revenge (เอาคืน)', `เข้าภายใน ${R.revengeMin} นาทีหลังแพ้`, sr) + lsRow('<i class="fa-solid fa-repeat me-1"></i>เกินจำนวนไม้/วัน', `ไม้ที่ ${R.maxTrades+1} ขึ้นไป`, so) + lsRow('<i class="fa-solid fa-ban me-1"></i>เทรดหลังถึงลิมิต', 'แพ้ติด/ขาดทุนเกินกฎ', sa) + lsRow('<i class="fa-regular fa-circle-check me-1"></i>ไม้ปกติ', 'อยู่ในกฎทั้งหมด', sn) +
        ((sr.n+so.n+sa.n) ? `<div class="tj-tip ${bad<0?'bad':''}">ไม้ที่ผิดกฎรวม ${fmt$(bad,true)}${bad<0?' — ถ้าไม่เทรดไม้เหล่านี้ ผลรวมจะดีขึ้นเท่านี้':' — รอบนี้ได้กำไร แต่เป็นความเสี่ยงนอกแผน ถ้าปล่อยเป็นนิสัย วันที่พลาดจะเสียหนัก'}</div>` : '<div class="tj-tip good"><i class="fa-regular fa-circle-check me-1"></i>ยังไม่พบพฤติกรรมผิดกฎในช่วงนี้</div>');
    }
    // ประสิทธิภาพ SL/TP
    const eh = $('tj-eff-perf');
    if(eh){
      const W=[], Lz=[];
      trades.forEach(t=>{ const x = excursion(rowRow(t)); if(!x) return; (t.pnl>0?W:(t.pnl<0?Lz:[])).push({t,x}); });
      if(W.length + Lz.length < 3){ eh.innerHTML = '<div class="tj-empty"><i class="fa-solid fa-ruler-combined"></i><div>ต้องมีไม้ที่กรอก MAE/MFE (เป็นราคา) อย่างน้อย 3 ไม้</div></div>'; }
      else {
        const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
        const wMae = avg(W.filter(o=>o.x.maeR!=null).map(o=>o.x.maeR));
        const tightOk = W.filter(o=>o.x.maeR!=null); const tightPct = tightOk.length ? tightOk.filter(o=>o.x.maeR < 0.5).length/tightOk.length*100 : null;
        const lGave = Lz.filter(o=>o.x.mfeR!=null); const gavePct = lGave.length ? lGave.filter(o=>o.x.mfeR >= 1).length/lGave.length*100 : null;
        const caps = W.filter(o=>o.x.mfeR>0 && isFinite(parseFloat(rowRow(o.t).r_mult))).map(o=>Math.min(1.5, parseFloat(rowRow(o.t).r_mult)/o.x.mfeR));
        const cap = avg(caps);
        const cell = (l,v,s) => `<div class="tj-today-cell"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
        let tips = '';
        if(tightPct!=null && tightPct>=70 && tightOk.length>=5) tips += `<div class="tj-tip">ไม้ชนะ ${tightPct.toFixed(0)}% ราคาสวนไม่ถึง 0.5R — <b>SL อาจกว้างเกินจำเป็น</b> ลอง SL แคบลงแล้วเพิ่มล็อตในความเสี่ยงเท่าเดิม (ทดสอบย้อนหลังก่อน)</div>`;
        if(gavePct!=null && gavePct>=30 && lGave.length>=5) tips += `<div class="tj-tip bad">ไม้แพ้ ${gavePct.toFixed(0)}% เคยวิ่งบวก ≥1R ก่อนกลับมาโดน SL — <b>ควรมีกฎเลื่อน SL มาจุดเข้า (BE) หรือปิดบางส่วนที่ 1R</b></div>`;
        if(cap!=null && cap<0.5 && caps.length>=5) tips += `<div class="tj-tip">ไม้ชนะเก็บได้เฉลี่ยแค่ ${(cap*100).toFixed(0)}% ของระยะที่ราคาวิ่ง — <b>อาจปิดกำไรเร็วเกินไป</b> ลองใช้ TP ตามโครงสร้าง หรือ trailing stop</div>`;
        eh.innerHTML = `<div class="tj-eff-grid">${cell('ไม้ชนะ: ราคาสวนเฉลี่ย', wMae!=null?wMae.toFixed(2)+'R':'—', 'MAE ของไม้ที่ชนะ')}${cell('ไม้ชนะที่สวน < 0.5R', tightPct!=null?tightPct.toFixed(0)+'%':'—', tightOk.length+' ไม้')}${cell('ไม้แพ้ที่เคยบวก ≥1R', gavePct!=null?gavePct.toFixed(0)+'%':'—', lGave.length+' ไม้')}${cell('เก็บกำไรได้', cap!=null?(cap*100).toFixed(0)+'%':'—', 'ของระยะที่ราคาวิ่ง (MFE)')}</div>` + (tips || '<div class="tj-tip good">ยังไม่พบจุดที่ต้องปรับชัดเจนจาก MAE/MFE</div>');
      }
    }
    // การ์ด MAE/MFE เดิม → แสดงเป็น R
    const allX = trades.map(t=>excursion(rowRow(t))).filter(Boolean);
    const am = allX.filter(x=>x.maeR!=null), af = allX.filter(x=>x.mfeR!=null);
    const sm = $('stat-avg-mae'), sf = $('stat-avg-mfe');
    if(sm) sm.textContent = am.length ? (am.reduce((s,x)=>s+x.maeR,0)/am.length).toFixed(2)+'R' : '—';
    if(sf) sf.textContent = af.length ? (af.reduce((s,x)=>s+x.mfeR,0)/af.length).toFixed(2)+'R' : '—';
  }

  // ══════════ ข้อ 7: ทบทวนประจำสัปดาห์ ══════════
  function weekStart(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; }
  function weekKey(d){
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay()||7));
    const y0 = new Date(Date.UTC(t.getUTCFullYear(),0,1));
    return t.getUTCFullYear()+'-W'+pad(Math.ceil(((t-y0)/864e5+1)/7));
  }
  const TH_M = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  function weekLabel(ws){ const we = new Date(ws); we.setDate(we.getDate()+6); return `${ws.getDate()} ${TH_M[ws.getMonth()]} – ${we.getDate()} ${TH_M[we.getMonth()]}`; }
  function reviews(){
    return rows().filter(r=>r.type==='Review').map(r=>{ let o={}; try{ o=JSON.parse(r.notes||'{}'); }catch(e){} return Object.assign({ id:r.id, week:r.session }, o); })
      .sort((a,b)=>String(b.week).localeCompare(String(a.week)));
  }
  function weekStats(ws){
    const we = new Date(ws); we.setDate(we.getDate()+7);
    const list = rows().filter(r=>isTrade(r)).filter(r=>{ const d=new Date(r.created_at); return d>=ws && d<we; }).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    let net=0, sumR=0, w=0; const g={'A+':0,'A':0,'B':0,'C':0};
    list.forEach(r=>{ const p=parseFloat(r.pnl)||0; net+=p; sumR+=tradeR(r); if(p>0) w++; if(g[r.grade]!=null) g[r.grade]++; });
    const best = list.slice().sort((a,b)=>b.pnl-a.pnl)[0], worst = list.slice().sort((a,b)=>a.pnl-b.pnl)[0];
    const cnt = f => list.filter(f).length;
    const days = {}; list.forEach(r=>{ const k=dkey(new Date(r.created_at)); days[k]=1; });
    const stopDays = Object.keys(days).filter(k=>{ const s=dayStatus(k); return s.reasons.length && s.list.length > 0; }).length;
    return { list, net, sumR, w, wr: list.length? w/list.length*100:0, best, worst, g,
      revenge: cnt(r=>r.revenge==='Yes'), over: cnt(r=>r.overtrade==='Yes'), noPlan: cnt(r=>r.followed_plan==='No'),
      news: cnt(r=>/(^|,)\s*NEWS\s*(,|$)/.test(String(r.confluences||''))), stopDays };
  }
  function renderReviewWidgets(){
    const now = new Date(), dow = now.getDay();
    const pr = $('tj-review-prompt'), gl = $('tj-week-goal');
    const revs = reviews();
    if(pr){
      let target = null;
      if(dow===6 || dow===0) target = weekStart(now);
      else if(dow===1){ target = weekStart(now); target.setDate(target.getDate()-7); }
      const wk = target ? weekKey(target) : null;
      const has = wk && revs.some(r=>r.week===wk);
      const traded = target && weekStats(target).list.length > 0;
      pr.innerHTML = (target && !has && traded) ? `<div class="tj-prompt"><span class="tj-ico"><i class="fa-solid fa-clipboard-list"></i></span><div><b>ถึงเวลาทบทวนสัปดาห์ (${weekLabel(target)})</b><small>5 นาที: ดูผล · กฎที่ทำผิด · บทเรียน 1 ข้อ · เป้าหมาย 1 ข้อ</small></div><button onclick="tjOpenReview('${wk}')">เริ่มทบทวน</button></div>` : '';
    }
    if(gl){
      const curWk = weekKey(now); const prev = weekStart(now); prev.setDate(prev.getDate()-7);
      const src = revs.find(r=>r.week===weekKey(prev) && r.goal) || revs.find(r=>r.week===curWk && r.goal);
      gl.innerHTML = src ? `<div class="tj-goal"><span class="tj-ico"><i class="fa-solid fa-bullseye"></i></span><div><div class="small text-muted" style="font-size:.7rem">เป้าหมายสัปดาห์นี้ (จากการทบทวน ${esc(src.week)})</div><b>${esc(src.goal)}</b></div><button class="tj-linkbtn" onclick="tjOpenReview()">ทบทวน</button></div>` : '';
    }
  }
  window.tjOpenReview = function(wkWanted){
    const now = new Date(); const weeks = [];
    for(let i=0;i<10;i++){ const ws = weekStart(now); ws.setDate(ws.getDate()-7*i); weeks.push(ws); }
    let ws = weeks.find(w=>weekKey(w)===wkWanted) || ((now.getDay()===1) ? weeks[1] : weeks[0]);
    const draw = ()=>{
      const wk = weekKey(ws), st = weekStats(ws), revs = reviews(), ex = revs.find(r=>r.week===wk) || {};
      const cell = (l,v,cls) => `<div class="tj-today-cell"><div class="l">${l}</div><div class="v ${cls||''}">${v}</div></div>`;
      const tline = r => r ? `${esc(r.symbol)} ${r.type} ${fmt$(r.pnl,true)} · ${new Date(r.created_at).getDate()}/${new Date(r.created_at).getMonth()+1}` : '—';
      const past = revs.filter(r=>r.week!==wk).slice(0,6).map(r=>`<div class="it"><b>${esc(r.week)}</b>${r.score?` · วินัย ${esc(r.score)}/10`:''}<br><span class="text-muted">บทเรียน:</span> ${esc(r.lesson||'-')}<br><span class="text-muted">เป้าหมาย:</span> ${esc(r.goal||'-')}</div>`).join('');
      return `<div class="d-flex gap-2 align-items-center mb-3"><select class="form-select" id="tj-rev-week">${weeks.map(w=>`<option value="${weekKey(w)}" ${weekKey(w)===wk?'selected':''}>${weekKey(w)} · ${weekLabel(w)}${reviews().some(r=>r.week===weekKey(w))?' ✓':''}</option>`).join('')}</select></div>
        <div class="tj-rev-stats">${cell('P&L', fmt$(st.net,true), st.net>0?'text-gain':(st.net<0?'text-loss':''))}${cell('รวม R', fmtR(st.sumR), st.sumR>0?'text-gain':(st.sumR<0?'text-loss':''))}${cell('ไม้ / Win', st.list.length+' / '+st.wr.toFixed(0)+'%')}
        ${cell('Revenge / Overtrade', st.revenge+' / '+st.over, (st.revenge+st.over)?'text-loss':'')}${cell('ไม่ทำตามแผน', st.noPlan, st.noPlan?'text-loss':'')}${cell('วันที่ชนลิมิต', st.stopDays, st.stopDays?'text-loss':'')}</div>
        <div class="small mb-3" style="line-height:1.7"><b>ไม้ดีที่สุด:</b> ${tline(st.best)}<br><b>ไม้แย่ที่สุด:</b> ${tline(st.worst)}<br><b>เกรด:</b> A+ ${st.g['A+']} · A ${st.g.A} · B ${st.g.B} · C ${st.g.C} · <b>ช่วงข่าว:</b> ${st.news} ไม้</div>
        <div class="mb-2"><label class="form-label">1) สัปดาห์นี้ทำอะไรได้ดี</label><textarea class="form-control" rows="2" data-f="good">${esc(ex.good||'')}</textarea></div>
        <div class="mb-2"><label class="form-label">2) ผิดพลาดอะไร / กฎข้อไหนที่ทำผิดบ่อยสุด</label><textarea class="form-control" rows="2" data-f="bad">${esc(ex.bad||'')}</textarea></div>
        <div class="mb-2"><label class="form-label">3) บทเรียน 1 ข้อ</label><input class="form-control" data-f="lesson" value="${esc(ex.lesson||'')}"></div>
        <div class="mb-2"><label class="form-label">4) เป้าหมาย 1 ข้อสำหรับสัปดาห์หน้า <span class="text-muted small">(จะขึ้นที่หน้าภาพรวมทั้งสัปดาห์)</span></label><input class="form-control" data-f="goal" value="${esc(ex.goal||'')}" placeholder="เช่น ไม่เข้าไม้เกรด C / หยุดหลังแพ้ 2 ไม้"></div>
        <div class="mb-2"><label class="form-label">5) ให้คะแนนวินัยตัวเอง</label><select class="form-select" data-f="score">${['','10','9','8','7','6','5','4','3','2','1'].map(v=>`<option ${String(ex.score||'')===v?'selected':''} value="${v}">${v?v+' / 10':'เลือก...'}</option>`).join('')}</select></div>
        ${past?`<div class="tj-rev-past"><b>การทบทวนก่อนหน้า</b>${past}</div>`:''}`;
    };
    const el = modal('tjReviewModal','<i class="fa-solid fa-clipboard-list me-2"></i> ทบทวนสัปดาห์', draw(), '<button class="btn btn-primary w-100" id="tj-rev-save">บันทึกการทบทวน</button>', 'modal-lg');
    const body = el.querySelector('.modal-body');
    const wire = ()=>{ const s = body.querySelector('#tj-rev-week'); s.onchange = ()=>{ ws = weeks.find(w=>weekKey(w)===s.value); body.innerHTML = draw(); wire(); }; };
    wire();
    el.querySelector('#tj-rev-save').onclick = async ()=>{
      const wk = weekKey(ws), ex = reviews().find(r=>r.week===wk);
      const obj = { v:1 }; body.querySelectorAll('[data-f]').forEach(i=>obj[i.dataset.f]=i.value.trim());
      const st = weekStats(ws); obj.stats = { n: st.list.length, net: +st.net.toFixed(2), r: +st.sumR.toFixed(2), wr: +st.wr.toFixed(1) };
      const btn = el.querySelector('#tj-rev-save'); btn.disabled = true;
      try{
        if(ex && ex.id!=null) await window.api.updateRow(ex.id, { notes: JSON.stringify(obj) });
        else { const end = new Date(ws); end.setDate(end.getDate()+6); end.setHours(23,0,0,0);
          await window.api.insertRows([{ symbol:'REVIEW', type:'Review', lots:null, pnl:null, session: wk, notes: JSON.stringify(obj), created_at: end.toISOString(),
            price_in_zone:'-', confirmation:'-', violated_rule:'-', followed_plan:'-', overtrade:'-', revenge:'-', lot_respected:'-' }]); }
        bootstrap.Modal.getInstance(el).hide(); toast('บันทึกการทบทวนแล้ว'); if(typeof loadAllData==='function') loadAllData();
      }catch(e){ alert('บันทึกไม่สำเร็จ: '+(e.message||e)); }
      finally{ btn.disabled = false; }
    };
  };

  // ══════════ ข้อ 11: นำเข้าออเดอร์จาก MT5 ══════════
  function num(v){ if(v==null) return NaN; const s = String(v).replace(/\s/g,'').replace(/,/g,''); return parseFloat(s); }
  function parseMtTime(s, offsetH){
    const m = /(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s||''));
    if(!m) return null;
    return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0)) - offsetH*3600000);
  }
  function expandRow(cells){ const out=[]; cells.forEach(c=>{ const n = parseInt(c.getAttribute && c.getAttribute('colspan')) || 1; out.push((c.textContent||'').trim()); for(let i=1;i<n;i++) out.push(''); }); return out; }
  function tableFromHtml(text){
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return [...doc.querySelectorAll('tr')].map(tr=>expandRow([...tr.children]));
  }
  function tableFromCsv(text){
    text = text.replace(/^﻿/,'');
    const first = text.split(/\r?\n/)[0]||''; const delim = (first.match(/\t/g)||[]).length > (first.match(/;/g)||[]).length ? '\t' : ((first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length ? ';' : ',');
    const out=[]; let row=[], f='', q=false;
    for(let i=0;i<text.length;i++){ const c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; }
      else if(c==='"') q=true; else if(c===delim){ row.push(f.trim()); f=''; } else if(c==='\n'){ row.push(f.trim()); out.push(row); row=[]; f=''; } else if(c!=='\r') f+=c; }
    if(f!==''||row.length){ row.push(f.trim()); out.push(row); }
    return out;
  }
  function parseMT5(text, offsetH){
    const table = /<t[rd][\s>]/i.test(text) ? tableFromHtml(text) : tableFromCsv(text);
    const norm = s => String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    let hi = -1, idx = null;
    for(let i=0;i<table.length;i++){
      const h = table[i].map(norm);
      if(h.includes('symbol') && h.includes('type') && h.includes('volume') && h.includes('profit') && (h.includes('position') || h.includes('ticket') || h.includes('order'))){
        const find = (name, from) => h.indexOf(name, from||0);
        const t1 = find('time'), t2 = find('time', t1+1), p1 = find('price'), p2 = find('price', p1+1);
        idx = { t1, t2, pos: h.indexOf('position')>=0 ? h.indexOf('position') : (h.indexOf('ticket')>=0 ? h.indexOf('ticket') : h.indexOf('order')),
          sym: find('symbol'), type: find('type'), vol: find('volume'), p1, p2,
          sl: h.findIndex(x=>x==='s / l'||x==='s/l'||x==='sl'), tp: h.findIndex(x=>x==='t / p'||x==='t/p'||x==='tp'),
          com: find('commission'), swap: find('swap'), profit: find('profit') };
        hi = i; break;
      }
    }
    if(hi<0){ const alt = parseByPattern(table, offsetH); if(alt.length) return alt; }
    if(hi<0) throw new Error('ไม่พบตาราง Positions — ใช้ไฟล์ Report จาก MT5 (History → คลิกขวา → Report → HTML) หรือ CSV ที่มีหัวคอลัมน์ Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Profit');
    const out = [];
    for(let i=hi+1;i<table.length;i++){
      const r = table[i];
      const type = norm(r[idx.type]);
      if(!(type==='buy' || type==='sell')){ if(r.filter(Boolean).length <= 2 && out.length) break; continue; }
      const open = parseMtTime(r[idx.t1], offsetH), close = parseMtTime(r[idx.t2], offsetH);
      if(!open) continue;
      const entry = num(r[idx.p1]), exit = num(r[idx.p2]), lots = num(r[idx.vol]);
      const sl = num(r[idx.sl]), tp = num(r[idx.tp]);
      const pnl = (num(r[idx.profit])||0) + (idx.com>=0 ? (num(r[idx.com])||0) : 0) + (idx.swap>=0 ? (num(r[idx.swap])||0) : 0);
      out.push({ pos: r[idx.pos]||'', symbol: normSym(r[idx.sym]).replace(/^([A-Z]{6}).*$/, (m0,a)=> /^(XAU|XAG|EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)/.test(a) ? a : m0),
        type: type==='buy'?'Buy':'Sell', lots, entry, exit, sl: sl>0?sl:null, tp: tp>0?tp:null, open, close, pnl: +pnl.toFixed(2) });
    }
    return out;
  }
  // สำรอง: อ่านจากรูปแบบข้อมูล (ใช้ได้ทุกภาษาของ MT5 เช่นเมนูภาษาไทย)
  // แถว Position = [เวลาเปิด, เลขที่, Symbol, Type, Volume, ราคาเปิด, S/L, T/P, เวลาปิด, ราคาปิด, Commission, Swap, Profit]
  function parseByPattern(table, offsetH){
    const isDT = v => /^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}[ T]\d{2}:\d{2}/.test(String(v||'').trim());
    const typeOf = v => { v = String(v||'').trim().toLowerCase(); if(/^(buy|ซื้อ|compra|kauf|achat)(?![a-z])/.test(v)) return 'Buy'; if(/^(sell|ขาย|venta|verkauf|vente)(?![a-z])/.test(v)) return 'Sell'; return ''; };
    const out = []; let started = false;
    for(const r of table){
      const cells = r.map(x=>String(x||'').trim());
      const dts = []; cells.forEach((c,i)=>{ if(isDT(c)) dts.push(i); });
      const nonEmpty = cells.filter(Boolean).length;
      if(started && nonEmpty <= 2) break;              // หัว section ถัดไป (Orders / Deals)
      if(dts.length < 2) continue;
      const i1 = dts[0], i2 = dts[1];
      const type = typeOf(cells[i1+3]);
      if(!type || i2 - i1 < 8) continue;
      const nums = cells.slice(i2+1).map(num).filter(v=>isFinite(v));
      if(nums.length < 2) continue;
      const open = parseMtTime(cells[i1], offsetH), close = parseMtTime(cells[i2], offsetH);
      const entry = num(cells[i1+5]), exit = num(cells[i2+1]), lots = num(cells[i1+4]);
      const sl = num(cells[i1+6]), tp = num(cells[i1+7]);
      const tail = cells.slice(i2+2).map(num).filter(v=>isFinite(v));   // commission, swap, profit
      const pnl = tail.reduce((a,b)=>a+b,0);
      if(!open || !isFinite(entry) || !isFinite(lots)) continue;
      started = true;
      out.push({ pos: cells[i1+1]||'', symbol: normSym(cells[i1+2]).replace(/^([A-Z]{6}).*$/, (m0,a)=> /^(XAU|XAG|EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)/.test(a) ? a : m0),
        type, lots, entry, exit, sl: sl>0?sl:null, tp: tp>0?tp:null, open, close, pnl: +pnl.toFixed(2) });
    }
    return out;
  }
  function toRow(t){
    const hm = d => d ? pad(d.getHours())+':'+pad(d.getMinutes()) : '';
    let risk = t.sl ? riskUSD(t.symbol, t.entry, t.sl, t.lots) : null;
    const rMult = risk>0 ? +(t.pnl/risk).toFixed(2) : null;
    let outcome = 'Manual';
    if(t.tp && Math.abs(t.exit - t.tp) <= Math.abs(t.tp - t.entry)*0.03) outcome = 'TP';
    else if(t.sl && Math.abs(t.exit - t.sl) <= Math.max(Math.abs(t.sl - t.entry)*0.03, 1e-9)) outcome = Math.abs(t.sl - t.entry) < Math.abs(t.entry)*1e-5 ? 'BE' : 'SL';
    const sess = window.tjSessionOf ? window.tjSessionOf(t.open, hm(t.open)).primary : '';
    return { symbol: t.symbol, type: t.type, lots: t.lots, pnl: t.pnl, entry_price: t.entry, sl_price: t.sl, tp_price: t.tp,
      outcome, r_mult: rMult, entry_time: hm(t.open), exit_time: hm(t.close), created_at: t.open.toISOString(), session: sess || '',
      notes: 'นำเข้าจาก MT5 #'+t.pos, setup:'', grade:'', emotion:'', mae:null, mfe:null, market_context:'', confidence:'', confluences:'',
      price_in_zone:'-', confirmation:'-', violated_rule:'-', followed_plan:'-', overtrade:'-', revenge:'-', lot_respected:'-', chart_before:'', chart_after:'' };
  }
  function isDup(t){
    return rows().some(r=>{
      if(!isTrade(r)) return false;
      if(t.pos && String(r.notes||'').includes('#'+t.pos)) return true;
      return normSym(r.symbol)===t.symbol && r.type===t.type && Math.abs((parseFloat(r.entry_price)||0)-t.entry) < 1e-6 && Math.abs((parseFloat(r.lots)||0)-t.lots) < 1e-6 && Math.abs(new Date(r.created_at)-t.open) < 3*60000;
    });
  }
  window.tjOpenImport = function(){
    const offs = []; for(let o=-5;o<=5;o++) offs.push(o);
    const el = modal('tjImportModal','<i class="fa-solid fa-file-arrow-up me-2"></i> นำเข้าออเดอร์จาก MT5',
      `<ol class="small mb-3" style="line-height:1.7"><li>ใน MT5 เปิดแท็บ <b>History</b> (ประวัติ) → เลือกช่วงเวลา</li><li>คลิกขวา → <b>Report</b> → <b>HTML</b> (หรือ Open XML แล้วบันทึกเป็น CSV)</li><li>เลือกไฟล์ด้านล่าง ตรวจรายการ แล้วกดนำเข้า</li></ol>
      <div class="row g-2 mb-3"><div class="col-sm-7"><input type="file" class="form-control" id="tj-imp-file" accept=".html,.htm,.csv,.txt"></div>
      <div class="col-sm-5"><select class="form-select" id="tj-imp-off">${offs.map(o=>`<option value="${o}" ${o===ls.get('tj_mt5_off',3)?'selected':''}>เวลาเซิร์ฟเวอร์ GMT${o>=0?'+':''}${o}</option>`).join('')}</select></div></div>
      <div class="small text-muted mb-2">เวลาเซิร์ฟเวอร์ดูได้ที่ Market Watch ของ MT5 เทียบกับเวลาไทย (GMT+7) — เช่น เวลา MT5 ช้ากว่าไทย 4 ชม. = GMT+3</div>
      <div id="tj-imp-prev"></div>
      <div class="small mt-2"><a href="javascript:void(0)" onclick="bootstrap.Modal.getInstance(document.getElementById('tjImportModal')).hide();tjOpenImported()"><i class="fa-solid fa-trash-can"></i> จัดการ / ลบออเดอร์ที่นำเข้าไปแล้ว</a></div>`,
      '<button class="btn btn-primary w-100" id="tj-imp-go" disabled>นำเข้า</button>', 'modal-xl');
    let parsed = [];
    const fileI = el.querySelector('#tj-imp-file'), offI = el.querySelector('#tj-imp-off'), prev = el.querySelector('#tj-imp-prev'), go = el.querySelector('#tj-imp-go');
    let text = '';
    const run = ()=>{
      if(!text){ prev.innerHTML=''; go.disabled=true; return; }
      try{
        const off = +offI.value; ls.set('tj_mt5_off', off);
        parsed = parseMT5(text, off).map(t=>Object.assign(t, { dup: isDup(t) }));
        const fresh = parsed.filter(t=>!t.dup);
        const fmtD = d => d ? d.getDate()+'/'+(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes()) : '';
        prev.innerHTML = `<div class="small mb-2"><b>${parsed.length}</b> ออเดอร์ · ใหม่ <b>${fresh.length}</b> · ซ้ำกับที่มีอยู่ ${parsed.length-fresh.length} (ข้าม) · P&amp;L รวม (ใหม่) ${fmt$(fresh.reduce((s,t)=>s+t.pnl,0),true)}</div>
          <div style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:10px"><table class="tj-imp-table"><thead><tr><th>เปิด (เวลาไทย)</th><th>Symbol</th><th>Type</th><th>Lot</th><th>Entry</th><th>SL</th><th>TP</th><th>Close</th><th>P&amp;L</th><th></th></tr></thead><tbody>
          ${parsed.map(t=>`<tr class="${t.dup?'dup':''}"><td>${fmtD(t.open)}</td><td>${esc(t.symbol)}</td><td>${t.type}</td><td>${t.lots}</td><td>${t.entry}</td><td>${t.sl||'-'}</td><td>${t.tp||'-'}</td><td>${t.exit}</td><td class="${t.pnl>0?'text-gain':(t.pnl<0?'text-loss':'')}">${fmt$(t.pnl,true)}</td><td>${t.dup?'ซ้ำ':'ใหม่'}</td></tr>`).join('')}</tbody></table></div>
          <div class="small text-muted mt-2">หลังนำเข้า ไปเติม Setup/เกรด/บันทึกในแต่ละไม้ได้ภายหลัง · ไม้ที่ไม่มี SL จะไม่มีค่า R</div>`;
        go.disabled = !fresh.length; go.textContent = fresh.length ? `นำเข้า ${fresh.length} ออเดอร์` : 'ไม่มีออเดอร์ใหม่';
      }catch(e){ prev.innerHTML = `<div class="tj-tip bad">${esc(e.message||e)}</div>`; go.disabled = true; }
    };
    fileI.onchange = async ()=>{ const f = fileI.files && fileI.files[0]; if(!f) return;
      const buf = await f.arrayBuffer(); const b = new Uint8Array(buf);
      text = (b[0]===0xFF && b[1]===0xFE) ? new TextDecoder('utf-16le').decode(buf) : new TextDecoder('utf-8').decode(buf);
      run(); };
    offI.onchange = run;
    go.onclick = async ()=>{
      const fresh = parsed.filter(t=>!t.dup); if(!fresh.length) return;
      go.disabled = true; go.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังนำเข้า...';
      try{ const n = await window.api.insertRows(fresh.map(toRow)); bootstrap.Modal.getInstance(el).hide(); toast('นำเข้า '+n+' ออเดอร์แล้ว'); if(typeof loadAllData==='function') loadAllData(); }
      catch(e){ alert('นำเข้าไม่สำเร็จ: '+(e.message||e)); go.disabled=false; go.textContent='ลองอีกครั้ง'; }
    };
  };
  window.tjParseMT5 = parseMT5;   // สำหรับทดสอบ

  // ── จัดการ / ลบออเดอร์ที่นำเข้าจาก MT5 ──
  window.tjOpenImported = function(){
    const list = rows().filter(r=>/^นำเข้าจาก MT5/.test(String(r.notes||''))).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const fmtD = d => d.getDate()+'/'+(d.getMonth()+1)+'/'+String(d.getFullYear()).slice(2)+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    const body = !list.length ? '<div class="tj-empty"><i class="fa-solid fa-inbox"></i><div>ไม่มีออเดอร์ที่นำเข้าจาก MT5</div></div>' :
      `<div class="d-flex align-items-center gap-2 mb-2 flex-wrap"><label class="d-flex align-items-center gap-2 fw-semibold small m-0"><input type="checkbox" class="form-check-input m-0" id="tj-im-all"> เลือกทั้งหมด (${list.length})</label>
        <span class="small text-muted ms-auto" id="tj-im-sum">เลือก 0 รายการ</span></div>
      <div style="max-height:420px;overflow:auto;border:1px solid var(--border);border-radius:10px"><table class="tj-imp-table"><thead><tr><th></th><th>เปิด</th><th>Symbol</th><th>Type</th><th>Lot</th><th>Entry</th><th>P&amp;L</th><th>อ้างอิง</th></tr></thead><tbody>
      ${list.map(r=>`<tr><td><input type="checkbox" class="form-check-input tj-im-cb" value="${esc(r.id)}" data-p="${parseFloat(r.pnl)||0}"></td><td>${fmtD(new Date(r.created_at))}</td><td>${esc(r.symbol)}</td><td>${esc(r.type)}</td><td>${esc(r.lots)}</td><td>${esc(r.entry_price)}</td><td class="${r.pnl>0?'text-gain':(r.pnl<0?'text-loss':'')}">${fmt$(r.pnl,true)}</td><td class="text-muted">${esc(String(r.notes).replace('นำเข้าจาก MT5 ',''))}</td></tr>`).join('')}
      </tbody></table></div><div class="small text-muted mt-2">ลบแล้วกู้คืนไม่ได้ · ถ้าต้องการนำเข้าใหม่ ลบแล้วนำเข้าไฟล์เดิมได้เลย</div>`;
    const el = modal('tjImportedModal','<i class="fa-solid fa-trash-can me-2" style="color:var(--loss)"></i> ออเดอร์ที่นำเข้าจาก MT5', body,
      list.length ? '<button class="btn btn-outline-danger w-100" id="tj-im-del" disabled>ลบรายการที่เลือก</button>' : '', 'modal-lg');
    if(!list.length) return;
    const cbs = [...el.querySelectorAll('.tj-im-cb')], all = el.querySelector('#tj-im-all'), del = el.querySelector('#tj-im-del'), sum = el.querySelector('#tj-im-sum');
    const upd = ()=>{ const sel = cbs.filter(c=>c.checked); const p = sel.reduce((a,c)=>a+(+c.dataset.p),0);
      sum.textContent = `เลือก ${sel.length} รายการ · P&L ${fmt$(p,true)}`; del.disabled = !sel.length; del.textContent = sel.length ? `ลบ ${sel.length} รายการที่เลือก` : 'ลบรายการที่เลือก';
      all.checked = sel.length===cbs.length; all.indeterminate = sel.length>0 && sel.length<cbs.length; };
    cbs.forEach(c=>c.addEventListener('change', upd));
    all.addEventListener('change', ()=>{ cbs.forEach(c=>c.checked = all.checked); upd(); });
    del.onclick = async ()=>{
      const ids = cbs.filter(c=>c.checked).map(c=>{ const r = list.find(x=>String(x.id)===c.value); return r ? r.id : c.value; });
      if(!ids.length || !confirm(`ลบออเดอร์ที่นำเข้า ${ids.length} รายการถาวร?\nลบแล้วกู้คืนไม่ได้`)) return;
      del.disabled = true; del.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังลบ...';
      try{ const n = await window.api.deleteMany(ids); bootstrap.Modal.getInstance(el).hide(); toast('ลบ '+n+' รายการแล้ว'); if(typeof loadAllData==='function') loadAllData(); }
      catch(e){ alert('ลบไม่สำเร็จ: '+(e.message||e)); upd(); }
    };
  };

  // ══════════ hooks ══════════
  function refreshAll(){ try{ renderToday(); }catch(e){ console.error(e); } try{ renderReviewWidgets(); }catch(e){ console.error(e); } try{ renderExtraPerf(); }catch(e){ console.error(e); } try{ formChecks(); }catch(e){} }
  document.addEventListener('tj:rows', refreshAll);
  (function hookTab(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hookTab,60); return; }
    window.switchTab = function(id){ const r = orig.apply(this, arguments);
      if(id==='add-trade'){ formChecks(); riskCheck(); stopOverlay(); }
      if(id==='analytics') setTimeout(renderExtraPerf, 40);
      if(id==='dashboard'){ renderToday(); renderReviewWidgets(); }
      return r; };
  })();
  (function hookDash(){
    const orig = window.updateDashboardUI;
    if(typeof orig!=='function'){ setTimeout(hookDash,60); return; }
    window.updateDashboardUI = function(d){ const r = orig.apply(this, arguments); try{ renderToday(); riskCheck(); renderExtraPerf(); }catch(e){} return r; };
  })();
  buildSetupSelect();
  renderToday();
  setInterval(()=>{ const pg=document.querySelector('.page-section.active'); if(pg && pg.id==='dashboard') renderToday(); }, 60000);
  setTimeout(loadPrefs, 800);
})();

