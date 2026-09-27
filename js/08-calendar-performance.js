(function(){
  const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const TH_MON_S  = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const DOW_S = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  const state = { rows: [], calY: new Date().getFullYear(), calM: new Date().getMonth(), calMode: 'month', cumMode: 'trade', hmMetric: 'pnl' };
  const charts = {};

  // ── helpers ──
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const dkey = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  function fmt$(n, signed){ n = Number(n)||0; const a = Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); return (n<0?'-':(signed&&n>0?'+':''))+'$'+a; }
  function fmtShort(n){ n = Number(n)||0; const a=Math.abs(n); const s = a>=10000 ? (a/1000).toFixed(1)+'k' : a>=1000 ? (a/1000).toFixed(2)+'k' : a.toFixed(a>=10?0:2); return (n<0?'-':'+')+'$'+s; }
  const tone = n => n>0?'pos':(n<0?'neg':'');
  function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function rgbOf(hex){ hex = hex.replace('#',''); if(hex.length===3) hex = hex.split('').map(c=>c+c).join(''); const n = parseInt(hex,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function rgba(varName, a){ const v = cssVar(varName); if(v.startsWith('#')){ const [r,g,b]=rgbOf(v); return `rgba(${r},${g},${b},${a})`; } return v; }

  function isTrade(r){ const t = String(r.type||'').trim(); return (t==='Buy'||t==='Sell') && String(r.symbol||'').trim()!=='' && isFinite(parseFloat(r.pnl)); }
  function tradeHour(r, d){ const m = /^(\d{1,2}):(\d{2})/.exec(String(r.entry_time||'').trim()); if(m){ const h=+m[1]; if(h>=0&&h<24) return h; } return d.getHours(); }

  // ตัวกรองร่วม: symbol / setup / side (+ ช่วงเวลา/เดือน-ปี ถ้า withDate)
  function applyFilters(rows, withDate){
    const gf = window._globalFilter || {};
    const fm = (document.getElementById('filter-month')||{}).value || 'all';
    const fy = (document.getElementById('filter-year')||{}).value || 'all';
    let cutoff = null;
    if(withDate && gf.preset && gf.preset!=='all'){
      const now = new Date();
      if(gf.preset==='ytd') cutoff = new Date(now.getFullYear(),0,1);
      else { const days = {'7d':7,'30d':30,'90d':90,'1y':365}[gf.preset]; if(days){ cutoff = new Date(now); cutoff.setDate(cutoff.getDate()-days); } }
    }
    const out = [];
    for(const r of rows){
      if(!isTrade(r)) continue;
      const d = new Date(r.created_at);
      const sym = String(r.symbol||'').toUpperCase().trim(), type = String(r.type).trim();
      if(gf.symbols && gf.symbols.length && !gf.symbols.includes(sym)) continue;
      if(gf.setups && gf.setups.length && !gf.setups.includes(String(r.setup||'').trim())) continue;
      if(gf.side==='long' && type!=='Buy') continue;
      if(gf.side==='short' && type!=='Sell') continue;
      if(withDate){
        if(cutoff && d < cutoff) continue;
        if(fm!=='all' && (d.getMonth()+1)!=fm) continue;
        if(fy!=='all' && d.getFullYear()!=fy) continue;
      }
      out.push({ d, pnl: parseFloat(r.pnl), type, sym, hour: tradeHour(r,d), r: parseFloat(r.r_mult), sess: String(r.session||'').trim(), et: String(r.entry_time||'').trim(), news: /(^|,)\s*NEWS\s*(,|$)/.test(String(r.confluences||'')), row: r });
    }
    out.sort((a,b)=>a.d-b.d);
    return out;
  }
  function summarize(trades){
    let n=0,w=0,l=0,gp=0,gl=0,net=0;
    for(const t of trades){ n++; net+=t.pnl; if(t.pnl>0){w++;gp+=t.pnl;} else if(t.pnl<0){l++;gl+=Math.abs(t.pnl);} }
    return { n, w, l, net, gp, gl, wr: n? w/n*100 : 0, pf: gl>0? gp/gl : (gp>0?Infinity:0), avgW: w? gp/w:0, avgL: l? gl/l:0 };
  }
  function byDay(trades){ const m={}; for(const t of trades){ const k=dkey(t.d); (m[k]=m[k]||{pnl:0,n:0,w:0}); m[k].pnl+=t.pnl; m[k].n++; if(t.pnl>0) m[k].w++; } return m; }
  function kpi(label, value, sub, cls){ return `<div class="tj-kpi ${cls||''}"><div class="tj-kpi-label">${label}</div><div class="tj-kpi-value">${value}</div>${sub?`<div class="tj-kpi-sub">${sub}</div>`:''}</div>`; }

  // ══════════ CALENDAR ══════════
  function renderCalendar2(){
    const body = document.getElementById('tj-cal-body'); if(!body) return;
    const trades = applyFilters(state.rows, false);
    const days = byDay(trades);
    const title = document.getElementById('tj-cal-title');
    const kpis = document.getElementById('tj-cal-kpis');
    const weeksM = document.getElementById('tj-cal-weeks');
    const today = new Date();

    if(state.calMode==='year'){
      const y = state.calY;
      title.textContent = 'ปี ' + y;
      const months = Array.from({length:12},()=>({pnl:0,n:0,w:0}));
      const yt = trades.filter(t=>t.d.getFullYear()===y);
      yt.forEach(t=>{ const m=months[t.d.getMonth()]; m.pnl+=t.pnl; m.n++; if(t.pnl>0) m.w++; });
      body.innerHTML = '<div class="tj-year-grid">' + months.map((m,i)=>{
        const cls = m.pnl>0?'g':(m.pnl<0?'l':'');
        return `<div class="tj-year-cell ${cls}" data-m="${i}"><div class="m">${TH_MONTHS[i]}</div><div class="v">${m.n? fmt$(m.pnl,true):'—'}</div><div class="c">${m.n? m.n+' ไม้ · '+Math.round(m.w/m.n*100)+'% win':'ไม่มีเทรด'}</div></div>`;
      }).join('') + '</div>';
      body.querySelectorAll('.tj-year-cell').forEach(el=>el.addEventListener('click',()=>{ state.calM=+el.dataset.m; setCalMode('month'); }));
      weeksM.innerHTML = '';
      const s = summarize(yt); const pm = months.filter(m=>m.n&&m.pnl>0).length, lm = months.filter(m=>m.n&&m.pnl<0).length;
      let best=-1; months.forEach((m,i)=>{ if(m.n && (best<0 || m.pnl>months[best].pnl)) best=i; });
      kpis.innerHTML = kpi('Net P&L ทั้งปี', fmt$(s.net,true), s.n+' ไม้', tone(s.net))
        + kpi('Win rate', s.wr.toFixed(1)+'%', s.w+'W / '+s.l+'L')
        + kpi('เดือนกำไร / ขาดทุน', `<span class="text-gain">${pm}</span> / <span class="text-loss">${lm}</span>`, 'เดือน')
        + kpi('เดือนที่ดีที่สุด', best>=0? TH_MON_S[best] : '—', best>=0? fmt$(months[best].pnl,true):'', best>=0 && months[best].pnl>0?'pos':'');
      return;
    }

    const y = state.calY, m = state.calM;
    title.textContent = TH_MONTHS[m] + ' ' + y;
    const first = new Date(y,m,1), dim = new Date(y,m+1,0).getDate();
    const lead = first.getDay();
    let html = '<div class="tj-cal2">' + DOW_S.map(d=>`<div class="tj-cal2-h">${d}</div>`).join('') + '<div class="tj-cal2-h wk"><span class="dsk">ราย</span>สัปดาห์</div>';
    let cells = [];
    for(let i=0;i<lead;i++) cells.push(null);
    for(let d=1; d<=dim; d++) cells.push(d);
    while(cells.length%7) cells.push(null);
    const weekTotals = [];
    for(let w=0; w<cells.length/7; w++){
      let wp=0, wn=0, wd=0, ww=0;
      for(let c=0;c<7;c++){
        const d = cells[w*7+c];
        if(d===null){ html += '<div class="tj-cal2-d out"></div>'; continue; }
        const k = y+'-'+pad(m+1)+'-'+pad(d); const s = days[k];
        const isToday = d===today.getDate() && m===today.getMonth() && y===today.getFullYear();
        let cls = 'tj-cal2-d' + (isToday?' today':'');
        let inner = `<div class="tj-cal2-top"><span class="tj-cal2-num">${d}</span>${s?`<span class="tj-cal2-cnt"><i class="fa-regular fa-file-lines"></i>${s.n}</span>`:''}</div>`;
        let style = '';
        if(s){
          wp+=s.pnl; wn+=s.n; wd++; ww+=s.w;
          cls += ' has ' + (s.pnl>0?'g':(s.pnl<0?'l':''));
          const a = s.pnl>0 ? 'gain' : 'loss';
          if(s.pnl!==0) style = `background:var(--${a}-bg);border-color:transparent;`;
          inner += `<div class="tj-cal2-pnl">${fmtShort(s.pnl)}</div><div class="tj-cal2-meta">Win ${Math.round(s.w/s.n*100)}%</div>`;
        }
        html += `<div class="${cls}" ${s?`data-k="${k}" title="${k}: ${fmt$(s.pnl,true)} · ${s.n} ไม้"`:''} style="${style}">${inner}</div>`;
      }
      weekTotals.push({wp,wn,wd,ww});
      html += `<div class="tj-cal2-w ${wp>0?'g':(wp<0?'l':'')}"><div class="lbl">สัปดาห์ ${w+1}</div><div class="val ${wp>0?'text-gain':(wp<0?'text-loss':'')}">${wn? fmtShort(wp):'$0'}</div><div class="sub">${wn?`<span class="dsk">${wd} วัน · </span>${wn} ไม้`:`${wd} วัน`}</div>${wn?`<div class="sub wr">Win ${Math.round(ww/wn*100)}%</div>`:''}</div>`;
    }
    html += '</div>';
    body.innerHTML = html;
    weeksM.innerHTML = weekTotals.map((w,i)=> w.wn ? `<div class="pj-wk ${w.wp>0?'g':(w.wp<0?'l':'')}"><span>สัปดาห์ ${i+1}<small>${w.wn} ไม้ · ${w.wd} วัน</small></span><b>${fmtShort(w.wp)}</b></div>` : '').join('');
    body.querySelectorAll('.tj-cal2-d.has').forEach(el=>el.addEventListener('click',()=>openDay(el.dataset.k)));

    const mt = trades.filter(t=>t.d.getFullYear()===y && t.d.getMonth()===m);
    const s = summarize(mt);
    title.innerHTML = TH_MONTHS[m] + ' ' + y + ` <span class="tj-cal-net ${s.net>0?'g':(s.net<0?'l':'')}">${fmt$(s.net,true)}</span>`;
    const dk = Object.keys(days).filter(k=>k.startsWith(y+'-'+pad(m+1)+'-'));
    const gd = dk.filter(k=>days[k].pnl>0).length, ld = dk.filter(k=>days[k].pnl<0).length;
    let bestK=null; dk.forEach(k=>{ if(!bestK || days[k].pnl>days[bestK].pnl) bestK=k; });
    kpis.innerHTML = kpi('Net P&L เดือนนี้', fmt$(s.net,true), s.n+' ไม้', tone(s.net))
      + kpi('Win rate', s.wr.toFixed(1)+'%', s.w+'W / '+s.l+'L')
      + kpi('วันกำไร / ขาดทุน', `<span class="text-gain">${gd}</span> / <span class="text-loss">${ld}</span>`, dk.length+' วันที่เทรด')
      + kpi('วันที่ดีที่สุด', bestK? (+bestK.slice(8))+' '+TH_MON_S[m] : '—', bestK? fmt$(days[bestK].pnl,true):'', bestK && days[bestK].pnl>0?'pos':'');
  }
  function openDay(k){
    if(!k) return;
    const t = document.getElementById('history-filter-type'), d = document.getElementById('history-filter-day');
    if(t && d){ t.value='day'; d.value=k; if(typeof toggleHistoryFilterInput==='function') toggleHistoryFilterInput(); }
    switchTab('history');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setCalMode(mode){
    state.calMode = mode;
    document.querySelectorAll('#tj-cal-mode button').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    renderCalendar2();
  }
  function wireCalendar(){
    const q = id => document.getElementById(id);
    q('tj-cal-prev') && q('tj-cal-prev').addEventListener('click',()=>{ if(state.calMode==='year') state.calY--; else { state.calM--; if(state.calM<0){state.calM=11;state.calY--;} } renderCalendar2(); });
    q('tj-cal-next') && q('tj-cal-next').addEventListener('click',()=>{ if(state.calMode==='year') state.calY++; else { state.calM++; if(state.calM>11){state.calM=0;state.calY++;} } renderCalendar2(); });
    q('tj-cal-today') && q('tj-cal-today').addEventListener('click',()=>{ const n=new Date(); state.calY=n.getFullYear(); state.calM=n.getMonth(); renderCalendar2(); });
    document.querySelectorAll('#tj-cal-mode button').forEach(b=>b.addEventListener('click',()=>setCalMode(b.dataset.mode)));
  }

  // ══════════ PERFORMANCE ══════════
  function chartBase(){
    const axis = cssVar('--muted') || '#71717A', grid = cssVar('--border') || '#E7E7EA';
    return { axis, grid, font: { family: "'Prompt', sans-serif", size: 11 } };
  }
  function mkChart(key, canvasId, cfg){
    const cv = document.getElementById(canvasId); if(!cv || typeof Chart==='undefined') return;
    if(charts[key]) charts[key].destroy();
    charts[key] = new Chart(cv.getContext('2d'), cfg);
  }
  function barColors(vals){ const g = cssVar('--profit'), l = cssVar('--loss'), n = cssVar('--border'); return vals.map(v=> v>0?g:(v<0?l:n)); }
  function moneyTick(v){ const a=Math.abs(v); return (v<0?'-':'')+'$'+(a>=1000?(a/1000).toFixed(1)+'k':a.toFixed(0)); }
  function barOpts(tipLabel){
    const b = chartBase();
    return { responsive:true, maintainAspectRatio:false, animation:{duration:300},
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: tipLabel } } },
      scales:{ x:{ grid:{display:false}, ticks:{color:b.axis,font:b.font,maxRotation:0,autoSkip:true} },
               y:{ grid:{color:b.grid}, border:{display:false}, ticks:{color:b.axis,font:b.font,callback:moneyTick} } } };
  }

  function renderPerformance(){
    const host = document.getElementById('tj-perf-kpis'); if(!host) return;
    const trades = applyFilters(state.rows, true);
    const s = summarize(trades);
    const days = byDay(trades); const dks = Object.keys(days).sort();

    // Max drawdown (on cumulative trade P&L)
    let cum=0, peak=0, mdd=0; trades.forEach(t=>{ cum+=t.pnl; if(cum>peak) peak=cum; mdd=Math.max(mdd, peak-cum); });
    const greenDays = dks.filter(k=>days[k].pnl>0).length;
    const few = s.n && s.n < 30 ? ` <span class="tj-few" title="สถิติจากไม้น้อยกว่า 30 ไม้ยังเชื่อถือได้น้อย">ข้อมูลน้อย ${s.n}/30</span>` : '';
    const expc = s.n ? s.net/s.n : 0;
    const lm = window._lastMetrics || {};
    const disc = (lm.disciplineScore!=null && lm.disciplineScore!=='') ? lm.disciplineScore : null;
    const hero = document.getElementById('pj-perf-hero');
    if(hero){
      hero.className = 'pj-perf-hero ' + (s.net>0?'pos':(s.net<0?'neg':'zero'));
      hero.innerHTML = `<div class="lbl">กำไร/ขาดทุนสุทธิ</div><div class="big money">${fmt$(s.net,true)}</div>
        <div class="sub"><span>${s.net>0?'▲ กำไร':(s.net<0?'▼ ขาดทุน':'— เท่าทุน')}</span> · Win rate <b>${s.n? s.wr.toFixed(1)+'%':'—'}</b> (${s.w}W / ${s.l}L) · <b>${s.n}</b> ไม้ · ${dks.length} วัน${few}</div>`;
    }
    host.innerHTML = kpi('Profit factor'+few, isFinite(s.pf)? s.pf.toFixed(2) : '∞', 'กำไรรวม ÷ ขาดทุนรวม', s.pf>=1?'pos':(s.n?'neg':''))
      + kpi('ค่าคาดหวัง/ไม้', s.n? fmt$(expc,true) : '—', 'Expectancy เฉลี่ยต่อไม้', tone(expc))
      + kpi('ชนะเฉลี่ย / แพ้เฉลี่ย', (s.avgL? (s.avgW/s.avgL).toFixed(2):'—')+'x', fmt$(s.avgW)+' / -'+fmt$(s.avgL))
      + kpi('Drawdown สูงสุด', mdd? '-'+fmt$(mdd):'$0.00', 'จากจุดสูงสุดของกำไรสะสม', mdd?'neg':'')
      + kpi('วันที่กำไร', dks.length? Math.round(greenDays/dks.length*100)+'%':'—', greenDays+' / '+dks.length+' วันกำไร')
      + `<div class="tj-kpi" id="pj-kpi-disc"><div class="tj-kpi-label">คะแนนวินัย</div><div class="tj-kpi-value">${disc!=null? esc(String(disc)) : '—'}</div><div class="tj-kpi-sub">จาก 100</div></div>`
      + kpi('กำไรรวม', fmt$(s.gp), '', s.gp?'pos':'')
      + kpi('ขาดทุนรวม', s.gl? '-'+fmt$(s.gl):'$0.00', '', s.gl?'neg':'');

    const b = chartBase();
    // Cumulative
    let labels=[], data=[];
    if(state.cumMode==='day'){ let c=0; dks.forEach(k=>{ c+=days[k].pnl; labels.push(k.slice(8)+'/'+k.slice(5,7)); data.push(+c.toFixed(2)); }); }
    else { let c=0; trades.forEach((t,i)=>{ c+=t.pnl; labels.push('#'+(i+1)+' · '+pad(t.d.getDate())+'/'+pad(t.d.getMonth()+1)); data.push(+c.toFixed(2)); }); }
    const last = data.length? data[data.length-1] : 0;
    const lineVar = last>=0 ? '--profit' : '--loss';
    mkChart('cum','tjCumChart',{ type:'line',
      data:{ labels, datasets:[{ data, borderColor:cssVar(lineVar), borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:.25, fill:{target:'origin', above:rgba('--profit',.12), below:rgba('--loss',.12)} }] },
      options:{ responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>' '+fmt$(c.parsed.y,true) } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:b.axis,font:b.font,maxTicksLimit:7,maxRotation:0} },
                 y:{ grid:{color:b.grid}, border:{display:false}, ticks:{color:b.axis,font:b.font,callback:moneyTick} } } } });

    // Daily bars
    const dv = dks.map(k=>+days[k].pnl.toFixed(2));
    mkChart('daily','tjDailyChart',{ type:'bar', data:{ labels: dks.map(k=>k.slice(8)+'/'+k.slice(5,7)), datasets:[{ data:dv, backgroundColor:barColors(dv), borderRadius:3, maxBarThickness:22 }] },
      options: barOpts(c=>' '+fmt$(c.parsed.y,true)+' · '+days[dks[c.dataIndex]].n+' ไม้') });

    // Day of week (Mon..Sun)
    const order=[1,2,3,4,5,6,0], dow = Array.from({length:7},()=>({p:0,n:0}));
    trades.forEach(t=>{ const x=dow[t.d.getDay()]; x.p+=t.pnl; x.n++; });
    const dowV = order.map(i=>+dow[i].p.toFixed(2));
    mkChart('dow','tjDowChart',{ type:'bar', data:{ labels: order.map(i=>DOW_S[i]), datasets:[{ data:dowV, backgroundColor:barColors(dowV), borderRadius:4, maxBarThickness:36 }] },
      options: barOpts(c=>' '+fmt$(c.parsed.y,true)+' · '+dow[order[c.dataIndex]].n+' ไม้') });

    // Hour
    const hr = Array.from({length:24},()=>({p:0,n:0}));
    trades.forEach(t=>{ hr[t.hour].p+=t.pnl; hr[t.hour].n++; });
    const hv = hr.map(x=>+x.p.toFixed(2));
    mkChart('hour','tjHourChart',{ type:'bar', data:{ labels: hr.map((_,i)=>pad(i)), datasets:[{ data:hv, backgroundColor:barColors(hv), borderRadius:3, maxBarThickness:18 }] },
      options: barOpts(c=>' '+pad(c.dataIndex)+':00 · '+fmt$(c.parsed.y,true)+' · '+hr[c.dataIndex].n+' ไม้') });

    renderHeatmap(trades);
    renderLongShort(trades);
    renderSessions(trades);
    renderNewsPerf(trades);
  }

  function renderNewsPerf(trades){
    const host = document.getElementById('tj-news-perf'); if(!host) return;
    if(!trades.length){ host.innerHTML = '<div class="tj-empty"><i class="fa-regular fa-newspaper"></i><div>ยังไม่มีข้อมูล</div></div>'; return; }
    const N = summarize(trades.filter(t=>t.news)), R = summarize(trades.filter(t=>!t.news));
    const row = (name, sub, x) => `<div class="tj-ls-row"><div class="fw-semibold">${name}<div class="h" style="text-align:left">${sub}</div></div>
      <div><div class="h">ไม้</div><div class="n">${x.n}</div></div>
      <div><div class="h">Win</div><div class="n">${x.n? x.wr.toFixed(0)+'%':'—'}</div></div>
      <div><div class="h">P&amp;L</div><div class="n money ${x.net>0?'text-gain':(x.net<0?'text-loss':'')}">${fmt$(x.net,true)}</div></div></div>`;
    let tip = '';
    if(N.n>=3 && R.n>=3){
      const d = N.wr - R.wr;
      tip = `<div class="small mt-2 fw-semibold ${d<0?'text-loss':'text-gain'}">${d<0?'<i class="fa-solid fa-triangle-exclamation me-1"></i>ช่วงข่าวแรง win rate ต่ำกว่าปกติ '+Math.abs(d).toFixed(0)+'% — พิจารณาหลีกเลี่ยงการเข้าออเดอร์ช่วงข่าว':'<i class="fa-regular fa-circle-check me-1"></i>ช่วงข่าวแรง win rate สูงกว่าปกติ '+d.toFixed(0)+'%'}</div>`;
    }
    host.innerHTML = row('<i class="fa-regular fa-newspaper me-1"></i>ช่วงข่าวแรง','±30 นาทีจากข่าว',N) + row('ช่วงปกติ','ไม่มีข่าวแรงใกล้เวลาเข้า',R) + tip;
  }

  function renderSessions(trades){
    const host = document.getElementById('tj-sess-perf'); if(!host) return;
    if(!trades.length){ host.innerHTML = '<div class="tj-empty"><i class="fa-solid fa-earth-asia"></i><div>ยังไม่มีข้อมูล</div></div>'; return; }
    const g = {}; let auto = 0;
    trades.forEach(t=>{
      let k = t.sess;
      if(!k && window.tjSessionOf){ k = window.tjSessionOf(t.d, t.et).primary || 'Off-session'; auto++; }
      k = k || 'ไม่ระบุ';
      (g[k] = g[k] || {n:0,w:0,p:0}); g[k].n++; g[k].p+=t.pnl; if(t.pnl>0) g[k].w++;
    });
    const order = ['Sydney','Tokyo','Asian','London','New York','Off-session'];
    const keys = Object.keys(g).sort((a,b)=>{ const ia=order.indexOf(a), ib=order.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
    const maxAbs = Math.max(1, ...keys.map(k=>Math.abs(g[k].p)));
    const TH = {'Sydney':'ซิดนีย์','Tokyo':'โตเกียว','Asian':'เอเชีย (เดิม)','London':'ลอนดอน','New York':'นิวยอร์ก','Off-session':'นอกเวลาตลาดหลัก'};
    host.innerHTML = keys.map(k=>{
      const x = g[k], wr = Math.round(x.w/x.n*100), wpct = Math.round(Math.abs(x.p)/maxAbs*100);
      const col = x.p>=0 ? 'var(--profit)' : 'var(--loss)';
      return `<div class="tj-ls-row" style="grid-template-columns:minmax(110px,1.2fr) 2fr repeat(3,auto);">
        <div class="fw-semibold">${esc(k)}<div class="h" style="text-align:left">${esc(TH[k]||'')}</div></div>
        <div><div style="height:8px;border-radius:99px;background:var(--panel);overflow:hidden;"><div style="height:100%;width:${wpct}%;background:${col};"></div></div></div>
        <div><div class="h">ไม้</div><div class="n">${x.n}</div></div>
        <div><div class="h">Win</div><div class="n">${wr}%</div></div>
        <div><div class="h">P&amp;L</div><div class="n money ${x.p>0?'text-gain':(x.p<0?'text-loss':'')}">${fmt$(x.p,true)}</div></div></div>`;
    }).join('') + (auto? `<div class="small text-muted mt-2" style="font-size:.7rem;">คำนวณเซสชันอัตโนมัติ ${auto} ไม้</div>`:'');
  }

  function renderHeatmap(trades){
    const host = document.getElementById('tj-heatmap'); if(!host) return;
    if(!trades.length){ host.innerHTML = '<div class="tj-empty"><i class="fa-solid fa-table-cells"></i><div>ยังไม่มีข้อมูลในช่วงนี้</div></div>'; return; }
    const order=[1,2,3,4,5,6,0];
    const step = window.innerWidth < 600 ? 3 : 1; state._hmStep = step;
    const g = {}; trades.forEach(t=>{ const k=t.d.getDay()+'-'+(Math.floor(t.hour/step)*step); (g[k]=g[k]||{p:0,n:0,w:0}); g[k].p+=t.pnl; g[k].n++; if(t.pnl>0) g[k].w++; });
    const metric = state.hmMetric;
    let maxAbs = 0, maxN = 0; Object.values(g).forEach(c=>{ maxAbs=Math.max(maxAbs,Math.abs(c.p)); maxN=Math.max(maxN,c.n); });
    const hours = [...Array(24/step).keys()].map(i=>i*step);
    let html = `<div class="tj-hm${step>1?' pj-hm3':''}" style="grid-template-columns:34px repeat(${hours.length},minmax(${step>1?30:22}px,1fr));"><div></div>` + hours.map(h=>`<div class="tj-hm-top">${step>1||h%3===0?pad(h):''}</div>`).join('');
    order.forEach(di=>{
      html += `<div class="tj-hm-lab">${DOW_S[di]}</div>`;
      hours.forEach(h=>{
        const c = g[di+'-'+h];
        if(!c){ html += '<div class="tj-hm-c"></div>'; return; }
        let bg, label, tip;
        const wr = c.w/c.n*100;
        if(metric==='wr'){ const a = .2+.8*Math.min(1,Math.abs(wr-50)/50); bg = wr>=50? rgba('--profit',a): rgba('--loss',a); label = Math.round(wr); }
        else if(metric==='n'){ bg = rgba('--brand', .15+.85*(c.n/maxN)); label = c.n; }
        else { const a = .15+.85*(maxAbs? Math.abs(c.p)/maxAbs : 0); bg = c.p>=0? rgba('--profit',a): rgba('--loss',a); label = Math.round(c.p); }
        tip = `${DOW_S[di]} ${pad(h)}:00–${pad(h+step-1)}:59 · ${fmt$(c.p,true)} · ${c.n} ไม้ · win ${Math.round(wr)}%`;
        html += `<div class="tj-hm-c" style="background:${bg}" title="${esc(tip)}">${label}</div>`;
      });
    });
    html += '</div>';
    const legend = metric==='n'
      ? `<div class="tj-legend">น้อย <i style="background:${rgba('--brand',.2)}"></i><i style="background:${rgba('--brand',.55)}"></i><i style="background:${rgba('--brand',1)}"></i> มาก</div>`
      : `<div class="tj-legend">${metric==='wr'?'Win &lt; 50%':'ขาดทุน'} <i style="background:${rgba('--loss',1)}"></i><i style="background:${rgba('--loss',.35)}"></i><i style="background:var(--cal-cell-empty)"></i><i style="background:${rgba('--profit',.35)}"></i><i style="background:${rgba('--profit',1)}"></i> ${metric==='wr'?'Win &gt; 50%':'กำไร'}</div>`;
    host.innerHTML = html + legend;
  }

  function renderLongShort(trades){
    const host = document.getElementById('tj-ls'); if(!host) return;
    const L = summarize(trades.filter(t=>t.type==='Buy')), S = summarize(trades.filter(t=>t.type==='Sell'));
    const tot = L.n + S.n;
    if(!tot){ host.innerHTML = '<div class="tj-empty"><i class="fa-solid fa-arrows-up-down"></i><div>ยังไม่มีข้อมูล</div></div>'; return; }
    const lp = Math.round(L.n/tot*100);
    const row = (name, color, x) => `<div class="tj-ls-row"><div class="fw-semibold"><span class="tj-dot" style="background:${color}"></span>${name}</div>
      <div><div class="h">ไม้</div><div class="n">${x.n}</div></div>
      <div><div class="h">Win</div><div class="n">${x.n? x.wr.toFixed(0)+'%':'—'}</div></div>
      <div><div class="h">P&amp;L</div><div class="n money ${x.net>0?'text-gain':(x.net<0?'text-loss':'')}">${fmt$(x.net,true)}</div></div></div>`;
    host.innerHTML = `<div class="d-flex justify-content-between small fw-semibold"><span>ซื้อ (Long) ${lp}%</span><span>ขาย (Short) ${100-lp}%</span></div>
      <div class="tj-ls-bar"><span style="width:${lp}%;background:var(--ink)"></span><span style="width:${100-lp}%;background:var(--pj-short,var(--brand))"></span></div>
      ${row('ซื้อ (Long)','var(--ink)',L)}${row('ขาย (Short)','var(--pj-short,var(--brand))',S)}`;
  }

  let _hmW = window.innerWidth < 600;
  window.addEventListener('resize', ()=>{ const w = window.innerWidth < 600; if(w!==_hmW){ _hmW = w; try{ renderHeatmap(applyFilters(state.rows,true)); }catch(e){} } });
  function wirePerf(){
    document.querySelectorAll('#tj-perf-cum-mode button').forEach(b=>b.addEventListener('click',()=>{
      state.cumMode=b.dataset.m; document.querySelectorAll('#tj-perf-cum-mode button').forEach(x=>x.classList.toggle('active',x===b)); renderPerformance(); }));
    document.querySelectorAll('#tj-hm-metric button').forEach(b=>b.addEventListener('click',()=>{
      state.hmMetric=b.dataset.m; document.querySelectorAll('#tj-hm-metric button').forEach(x=>x.classList.toggle('active',x===b)); renderHeatmap(applyFilters(state.rows,true)); }));
  }

  // ══════════ data + hooks ══════════
  let _loadSeq = 0;
  async function refreshRows(){
    if(!window.api || !window.api.getAllRows) return;
    const seq = ++_loadSeq;
    try{
      const rows = await window.api.getAllRows();
      if(seq!==_loadSeq) return;
      state.rows = rows || [];
      window._tjRows = state.rows;
      try{ document.dispatchEvent(new CustomEvent('tj:rows')); }catch(e){}
      renderAll();
    }catch(e){ console.error('[v2] load rows', e); }
  }
  function renderAll(){
    try{ renderCalendar2(); }catch(e){ console.error('[v2] calendar', e); }
    try{ renderPerformance(); }catch(e){ console.error('[v2] performance', e); }
  }
  window.tjRenderV2 = renderAll;
  window.tjApplyFilters = applyFilters;
  window.tjSummarize = summarize;

  function hook(name, after){
    const orig = window[name];
    if(typeof orig!=='function'){ setTimeout(()=>hook(name,after),60); return; }
    window[name] = function(){ const r = orig.apply(this, arguments); try{ after.apply(this, arguments); }catch(e){ console.error(e); } return r; };
  }
  hook('loadAllData', refreshRows);
  hook('switchTab', id => { if(id==='calendar'||id==='analytics') setTimeout(renderAll, 30); });
  hook('toggleDarkMode', () => setTimeout(()=>{ renderAll(); if(window._lastMetrics && typeof window.updateDashboardUI==='function') window.updateDashboardUI(window._lastMetrics); }, 30));

  wireCalendar();
  wirePerf();
})();

