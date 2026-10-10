// ══════════ หน้าสถิติ: ตัวชี้วัดทั้งหมด (ภาพรวม) · วิเคราะห์ตามแท็ก (Setup) · จุดออกของคุณ (พฤติกรรม) ══════════
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v, sign) => { if(!isFinite(v)) return '—'; const a = Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); return (v<0?'-':(sign&&v>0?'+':''))+'$'+a; };
  const rr = v => isFinite(v) ? (v>0?'+':'')+v.toFixed(2)+'R' : '—';
  const pct = v => isFinite(v) ? v.toFixed(1)+'%' : '—';
  const tone = v => v>0 ? 'text-gain' : (v<0 ? 'text-loss' : '');
  const root = $('analytics'); if(!root) return;

  // การ์ด 3 ใบ (ต้องเป็นลูกโดยตรงของ #analytics เพื่อให้ระบบแท็บซ่อน/แสดงได้)
  function mk(id, tab, title, icon, sub){
    if($(id)) return $(id);
    const el = document.createElement('div');
    el.className = 'card card-stat p-4 mb-4 tj-ins-card'; el.id = id; el.dataset.pjTab = tab;
    el.innerHTML = `<div class="section-header"><div class="icon-wrap"><i class="${icon}"></i></div><div><h6 class="title mb-0">${title}</h6>${sub?`<div class="tj-ins-sub">${sub}</div>`:''}</div></div><div class="tj-ins-body"></div>`;
    return el;
  }
  const after = (ref, el) => ref && ref.parentNode === root ? ref.insertAdjacentElement('afterend', el) : root.appendChild(el);
  const cMetrics = mk('tj-ins-metrics','overview','ตัวชี้วัดทั้งหมด','fa-solid fa-table-list','ตัวเลขสำคัญรวมไว้ในตารางเดียว · ใช้ตัวกรองด้านบน');
  after($('tj-perf-kpis'), cMetrics);
  const firstOf = t => root.querySelector(`:scope > [data-pj-tab="${t}"]`);
  const cExit = mk('tj-ins-exit','behave','จุดออกของคุณ','fa-solid fa-door-open','จากคำถาม "ราคาวิ่งไปถึง TP ไหม / ย้อนมาชน SL ไหม" ในฟอร์ม');
  root.insertBefore(cExit, firstOf('behave') || null);
  const cTags = mk('tj-ins-tags','setup','วิเคราะห์ตามแท็ก','fa-solid fa-tags','Setup · เซสชัน · TF · ปัจจัยสนับสนุน — แตะหัวตารางเพื่อเรียง');
  root.insertBefore(cTags, firstOf('setup') || null);

  // ── ข้อมูล ──
  const holdMin = r => { const p = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s||'')); return m ? +m[1]*60 + +m[2] : null; }; const a = p(r.entry_time), b = p(r.exit_time); if(a==null || b==null) return null; let d = b - a; if(d < 0) d += 1440; return d; };
  const fmtHold = m => m==null ? '—' : (m < 60 ? Math.round(m)+' นาที' : (m/60).toFixed(1)+' ชม.');
  const planRR = r => { const e=parseFloat(r.entry_price), sl=parseFloat(r.sl_price), tp=parseFloat(r.tp_price); const v = Math.abs(tp-e)/Math.abs(e-sl); return isFinite(v) && v>0 ? v : null; };
  const tags = r => String(r.confluences||'').split(',').map(s=>s.trim()).filter(Boolean);

  function stats(list){
    let n=0,w=0,l=0,gp=0,gl=0,net=0,rs=0,rn=0;
    list.forEach(t=>{ n++; net+=t.pnl; if(t.pnl>0){w++;gp+=t.pnl;} else if(t.pnl<0){l++;gl+=-t.pnl;} const x=parseFloat(t.row.r_mult); if(isFinite(x)){ rs+=x; rn++; } });
    return { n,w,l,gp,gl,net, wr:n?w/n*100:NaN, pf: gl>0?gp/gl:(gp>0?Infinity:NaN), avgR: rn? rs/rn : NaN };
  }

  // ── 1) ตัวชี้วัดทั้งหมด ──
  function renderMetrics(trades){
    const body = cMetrics.querySelector('.tj-ins-body');
    if(!trades.length){ body.innerHTML = '<div class="tj-ins-empty">ยังไม่มีเทรดในช่วงที่เลือก</div>'; return; }
    const s = stats(trades);
    let cum=0, peak=0, mdd=0, ws=0, ls=0, mw=0, ml=0;
    trades.forEach(t=>{ cum+=t.pnl; if(cum>peak) peak=cum; mdd=Math.max(mdd,peak-cum);
      if(t.pnl>0){ ws++; ls=0; mw=Math.max(mw,ws); } else if(t.pnl<0){ ls++; ws=0; ml=Math.max(ml,ls); } });
    const days = new Set(trades.map(t=>t.d.toDateString())).size;
    const months = new Set(trades.map(t=>t.d.getFullYear()+'-'+t.d.getMonth())).size;
    const best = trades.reduce((a,t)=>t.pnl>a.pnl?t:a, trades[0]), worst = trades.reduce((a,t)=>t.pnl<a.pnl?t:a, trades[0]);
    const funds = (window._tjRows||[]).filter(r=>r.type==='Deposit'||r.type==='Withdraw');
    const dep = funds.filter(r=>r.type==='Deposit').reduce((a,r)=>a+Math.abs(parseFloat(r.pnl)||0),0);
    const longs = trades.filter(t=>t.type==='Buy'), shorts = trades.filter(t=>t.type==='Sell');
    const ls_ = stats(longs), ss = stats(shorts);
    const hw = trades.filter(t=>t.pnl>0).map(t=>holdMin(t.row)).filter(x=>x!=null), hl = trades.filter(t=>t.pnl<0).map(t=>holdMin(t.row)).filter(x=>x!=null);
    const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
    const maxLot = Math.max(0, ...trades.map(t=>parseFloat(t.row.lots)||0));
    const row = (k, v, cls, hint) => `<div class="tj-mt-row"><span>${k}${hint?`<small>${hint}</small>`:''}</span><b class="${cls||''}">${v}</b></div>`;
    const grp = (title, rows) => `<div class="tj-mt-grp"><div class="tj-mt-h">${title}</div>${rows.join('')}</div>`;
    const hwA = avg(hw), hlA = avg(hl);
    body.innerHTML = `<div class="tj-mt">
      ${grp('ผลกำไร', [
        row('กำไรสุทธิ', money(s.net,true), tone(s.net)),
        row('กำไรรวม / ขาดทุนรวม', `<span class="text-gain">${money(s.gp)}</span> / <span class="text-loss">${money(-s.gl)}</span>`),
        row('Profit factor', isFinite(s.pf)?s.pf.toFixed(2):'∞', s.pf>=1?'text-gain':'text-loss', 'กำไรรวม ÷ ขาดทุนรวม'),
        row('เฉลี่ยต่อไม้', money(s.net/s.n,true), tone(s.net)),
        row('เฉลี่ยต่อเดือน', money(s.net/Math.max(1,months),true), tone(s.net)),
        row('ชนะเฉลี่ย / แพ้เฉลี่ย', `${money(s.w?s.gp/s.w:0)} / ${money(s.l?-s.gl/s.l:0)}`),
        row('ผลตอบแทนจากเงินฝาก', dep>0 ? pct(s.net/dep*100) : '—', tone(s.net), dep>0?'กำไรสุทธิ ÷ ฝากรวม '+money(dep):'ยังไม่มีรายการฝาก')
      ])}
      ${grp('ความเสี่ยง', [
        row('Drawdown สูงสุด', money(-mdd), mdd?'text-loss':''),
        row('Recovery factor', mdd>0 ? (s.net/mdd).toFixed(2) : '—', '', 'กำไรสุทธิ ÷ DD สูงสุด · มากกว่า 2 ถือว่าดี'),
        row('R เฉลี่ยต่อไม้', rr(s.avgR), tone(s.avgR)),
        row('ไม้กำไรใหญ่สุด', money(best.pnl,true), 'text-gain'),
        row('ไม้ขาดทุนใหญ่สุด', money(worst.pnl,true), 'text-loss'),
        row('Lot ใหญ่สุด', maxLot ? maxLot : '—')
      ])}
      ${grp('การเทรด', [
        row('จำนวนไม้', `${s.n} <small class="text-muted fw-normal">(${s.w}W / ${s.l}L)</small>`),
        row('Win rate', pct(s.wr)),
        row('ชนะติดกัน / แพ้ติดกันสูงสุด', `<span class="text-gain">${mw}</span> / <span class="text-loss">${ml}</span>`),
        row('วันที่เทรด', `${days} วัน · ${(s.n/Math.max(1,days)).toFixed(1)} ไม้/วัน`),
        row('Long', `${ls_.n} ไม้ · Win ${pct(ls_.wr)} · ${money(ls_.net,true)}`, tone(ls_.net)),
        row('Short', `${ss.n} ไม้ · Win ${pct(ss.wr)} · ${money(ss.net,true)}`, tone(ss.net))
      ])}
      ${grp('เวลาถือ', [
        row('ไม้ชนะ ถือเฉลี่ย', fmtHold(hwA)),
        row('ไม้แพ้ ถือเฉลี่ย', fmtHold(hlA), hwA!=null && hlA!=null && hlA > hwA*1.5 ? 'text-loss' : ''),
        (hwA!=null && hlA!=null && hlA > hwA*1.5) ? `<div class="tj-tip bad" style="margin-top:8px">ไม้แพ้ถือนานกว่าไม้ชนะ ${(hlA/hwA).toFixed(1)} เท่า — สัญญาณว่าปล่อยขาดทุนวิ่ง / ตัดกำไรเร็ว</div>` : '',
        (hw.length+hl.length) < s.n ? `<div class="tj-ins-sub" style="margin-top:6px">คำนวณจากไม้ที่ใส่ทั้งเวลาเข้าและเวลาปิด (${hw.length+hl.length}/${s.n} ไม้)</div>` : ''
      ])}
    </div>`;
  }

  // ── 2) วิเคราะห์ตามแท็ก ──
  let sortKey = 'n', sortDir = -1;
  function tagGroups(t){
    const r = t.row, out = [];
    if(r.setup) out.push(['Setup', r.setup]);
    if(r.session) out.push(['เซสชัน', r.session]);
    if(r.market_context) out.push(['สภาวะตลาด', r.market_context]);
    const names = { FVG:'FVG / Imbalance', OB:'Order Block', LIQ:'Liquidity Sweep', BOS:'BOS / CHOCH', NEWS:'เทรดช่วงข่าวแรง' };
    tags(r).forEach(c=>{
      let m;
      if((m=/^HTF:(\w+)$/.exec(c))) out.push(['TF วิเคราะห์', m[1]]);
      else if((m=/^LTF:(\w+)$/.exec(c))) out.push(['TF เข้า', m[1]]);
      else if(/^HIT(TP|SL):/.test(c)) return;
      else if(/^EMO(IN|OUT):/.test(c)){ const e = window.tjEmotions && window.tjEmotions.tokenLabel(c); if(e) out.push(e); }
      else out.push(['ปัจจัย', names[c] || c]);
    });
    return out;
  }
  function renderTags(trades){
    const body = cTags.querySelector('.tj-ins-body');
    const map = {};
    trades.forEach(t=>tagGroups(t).forEach(([g,v])=>{ const k=g+'|'+v; (map[k]=map[k]||{g,v,list:[]}).list.push(t); }));
    const rows = Object.values(map).map(x=>Object.assign({g:x.g, v:x.v}, stats(x.list)));
    if(!rows.length){ body.innerHTML = '<div class="tj-ins-empty">ยังไม่มีแท็ก — เลือก Setup / TF / ติ๊กปัจจัยสนับสนุนในฟอร์มบันทึกเทรด</div>'; return; }
    const val = (x,k) => { const v = x[k]; return isFinite(v) ? v : (k==='pf' && v===Infinity ? 1e9 : -1e9); };
    rows.sort((a,b)=> sortKey==='v' ? sortDir*String(a.g+a.v).localeCompare(String(b.g+b.v)) : sortDir*(val(a,sortKey)-val(b,sortKey)));
    const th = (k, label) => `<th data-k="${k}" class="${sortKey===k?'on':''}">${label}${sortKey===k?(sortDir<0?' ▾':' ▴'):''}</th>`;
    body.innerHTML = `<div class="tj-tag-wrap"><table class="tj-tag-tbl"><thead><tr>${th('v','แท็ก')}${th('n','ไม้')}${th('wr','Win')}${th('pf','PF')}${th('avgR','R เฉลี่ย')}${th('net','P&L')}</tr></thead><tbody>
      ${rows.map(x=>`<tr><td><span class="tj-tag-g">${esc(x.g)}</span>${esc(x.v)}${x.n<5?' <span class="tj-few" title="ไม้น้อยกว่า 5">น้อย</span>':''}</td><td>${x.n}</td><td>${pct(x.wr)}</td>
        <td class="${x.pf>=1?'text-gain':'text-loss'}">${x.pf===Infinity?'∞':(isFinite(x.pf)?x.pf.toFixed(2):'—')}</td><td class="${tone(x.avgR)}">${rr(x.avgR)}</td><td class="${tone(x.net)}">${money(x.net,true)}</td></tr>`).join('')}
    </tbody></table></div>`;
    body.querySelectorAll('th[data-k]').forEach(h=>h.onclick=()=>{ const k=h.dataset.k; if(sortKey===k) sortDir*=-1; else { sortKey=k; sortDir = k==='v'?1:-1; } renderTags(trades); });
  }

  // ── 3) จุดออกของคุณ ──
  function renderExit(trades){
    const body = cExit.querySelector('.tj-ins-body');
    const answered = trades.filter(t=>/HIT(TP|SL):/.test(String(t.row.confluences||'')));
    const has = (t, k) => tags(t.row).includes(k);
    const R = t => parseFloat(t.row.r_mult);
    const early = trades.filter(t=>t.row.outcome!=='TP' && t.row.outcome!=='SL' && t.pnl>=0 && has(t,'HITTP:Y'));
    const slThenTp = trades.filter(t=>t.row.outcome==='SL' && has(t,'HITTP:Y'));
    const savedBySl = trades.filter(t=>t.row.outcome!=='SL' && has(t,'HITSL:Y'));
    const sumMissed = early.reduce((a,t)=>{ const p=planRR(t.row), r=R(t); return a + (p!=null && isFinite(r) ? p - r : 0); },0);
    const sumSaved = savedBySl.reduce((a,t)=>{ const r=R(t); return a + (isFinite(r) ? r + 1 : 0); },0);
    if(!answered.length){ body.innerHTML = '<div class="tj-ins-empty">ยังไม่มีข้อมูล — ตอบคำถาม "ราคาวิ่งไปถึง TP ไหม / ย้อนกลับมาชน SL ไหม" ตอนบันทึกเทรด แล้วส่วนนี้จะบอกว่าคุณปิดเร็วไป หรือวาง SL แคบไปหรือเปล่า</div>'; return; }
    const item = (icon, cls, title, n, val, note) => `<div class="tj-exit-it ${cls}"><div class="ic"><i class="${icon}"></i></div><div class="tx"><b>${title}</b><small>${note}</small></div><div class="v"><b>${n}</b> ไม้${val?`<small>${val}</small>`:''}</div></div>`;
    body.innerHTML = `
      ${item('fa-solid fa-person-walking-arrow-right','warn','ปิดเองก่อน แล้วราคาไปถึง TP', early.length, early.length?'พลาด '+rr(sumMissed).replace('+',''):'', 'ถ้าถือถึง TP ตามแผน จะได้เพิ่มจากที่ได้จริง')}
      ${item('fa-solid fa-scissors','bad','โดน SL แล้วราคาไปถึง TP', slThenTp.length, '', 'บ่อยเกินไปแปลว่า SL อาจแคบหรืออยู่ในจุดที่ถูกกวาดง่าย')}
      ${item('fa-solid fa-shield-halved','good','ปิดก่อน แล้วราคากลับมาชน SL', savedBySl.length, savedBySl.length?'ช่วยไว้ '+rr(sumSaved):'', 'การปิดก่อนของคุณถูกต้อง — ประหยัดเทียบกับโดน SL เต็ม (−1R)')}
      <div class="tj-ins-sub" style="margin-top:8px">จาก ${answered.length} ไม้ที่ตอบคำถาม (ทั้งหมด ${trades.length} ไม้ในช่วงที่เลือก)</div>
      ${early.length>=3 && sumMissed>sumSaved ? `<div class="tj-tip bad">ปิดก่อน TP แล้วเสียโอกาสมากกว่าที่ช่วยไว้ (${rr(sumMissed)} vs ${rr(sumSaved)}) — ลองถือตามแผนให้ถึง TP มากขึ้น</div>` : ''}`;
  }

  function renderAll(){
    if(!window.tjApplyFilters) return;
    const trades = window.tjApplyFilters(window._tjRows||[], true);
    try{ renderMetrics(trades); }catch(e){ console.error('[insights] metrics', e); }
    try{ renderTags(trades); }catch(e){ console.error('[insights] tags', e); }
    try{ renderExit(trades); }catch(e){ console.error('[insights] exit', e); }
  }
  // วาดใหม่ทุกครั้งที่ KPI หน้าสถิติถูกวาด (เปลี่ยนตัวกรอง / โหลดข้อมูลใหม่)
  let t = null; const later = ()=>{ clearTimeout(t); t = setTimeout(renderAll, 60); };
  const k = $('tj-perf-kpis'); if(k) new MutationObserver(later).observe(k, { childList:true });
  document.addEventListener('tj:rows', later);
  later();
})();
