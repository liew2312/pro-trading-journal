(function(){
  // ── global filter + view state ──
  window._globalFilter = { preset:'all', symbols:[], setups:[], side:'all' };
  window._viewMode = 'money';           // 'money' | 'r'
  window._charts = {};
  window._allSymbols = new Set();
  window._allSetups  = new Set(['SMC','Demand/Supply','Breakout','Trend Following']);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  // ── helpers ──
  function money(n){ n = Number(n)||0; const s = n<0?'-':(n>0?'+':''); return s+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function moneyPlain(n){ n = Number(n)||0; return '$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function glyph(n){ return n>0?'▲':(n<0?'▼':'–'); }
  function toneClass(n){ return n>0?'text-gain':(n<0?'text-loss':''); }
  function fmtHold(mins){ if(mins==null) return '-'; if(mins<60) return mins+' นาที'; const h=Math.floor(mins/60), m=mins%60; return h+' ชม'+(m?(' '+m+'น'):''); }
  function fmtDayKey(k){ if(!k) return '-'; const p=k.split('-'); return p.length===3 ? (p[2]+'/'+p[1]) : k; }

  function countUp(el, to, fmt){
    if(!el) return;
    to = Number(to)||0;
    if(reduceMotion){ el.textContent = fmt(to); return; }
    const from = 0, dur = 550, t0 = performance.now();
    (function step(now){
      const p = Math.min(1,(now-t0)/dur), e = 1-Math.pow(1-p,3);
      el.textContent = fmt(from+(to-from)*e);
      if(p<1) requestAnimationFrame(step);
    })(performance.now());
  }

  // ── Advanced stat cards ──
  function renderAdvancedStats(d){
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    const mddAbs = Number(d.maxDrawdownAbs)||0;
    set('adv-mdd', mddAbs>0 ? ('-'+moneyPlain(mddAbs)) : '$0.00');
    set('adv-mdd-pct', '-'+(d.maxDrawdownPct||'0.0')+'%');
    set('adv-payoff', (d.payoffRatio||'0')+'x');
    set('adv-winloss', '+'+moneyPlain(d.avgWin)+' / -'+moneyPlain(d.avgLoss));
    set('adv-streak', (d.longestWinStreak||0)+'W / '+(d.longestLossStreak||0)+'L');
    set('adv-largewin', '+'+moneyPlain(d.largestWin));
    set('adv-largeloss', '-'+moneyPlain(Math.abs(Number(d.largestLoss)||0)));
    set('adv-hold', fmtHold(d.avgHoldMin));
    const bd=d.bestDay||{pnl:0,key:''}, wd=d.worstDay||{pnl:0,key:''};
    set('adv-bestday', (bd.pnl>0?'+':'')+moneyPlain(bd.pnl)+(bd.key?(' · '+fmtDayKey(bd.key)):''));
    set('adv-worstday', (wd.pnl<0?'-':'')+moneyPlain(Math.abs(wd.pnl))+(wd.key?(' · '+fmtDayKey(wd.key)):''));
  }

  // ── Analytics: charts ──
  const AXIS='#9C9CA4', GRID=getComputedStyle(document.body).getPropertyValue('--cal-cell-empty')||'#F2F0EA';
  function baseOpts(extra){ return Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}, extra||{}); }

  function renderRDist(d){
    const b=d.rBuckets||{}; const keys=Object.keys(b); const vals=keys.map(k=>b[k]);
    const total=vals.reduce((a,c)=>a+c,0);
    const empty=document.getElementById('rdist-empty'), cv=document.getElementById('rDistChart');
    if(empty) empty.classList.toggle('d-none', total>0); if(cv){ cv.style.display= total>0?'':'none'; if(cv.parentNode) cv.parentNode.style.display = total>0?'':'none'; }
    if(!total) return;
    const _v=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(); const colors=keys.map(k=> k.indexOf('-')===0||k.charAt(0)==='≤'?_v('--loss'): (k==='0..1R'?_v('--ap-warn'):_v('--profit')));
    if(window._charts.rdist) window._charts.rdist.destroy();
    window._charts.rdist=new Chart(cv.getContext('2d'),{type:'bar',data:{labels:keys,datasets:[{data:vals,backgroundColor:colors,borderRadius:4,maxBarThickness:48}]},
      options:baseOpts({scales:{x:{grid:{display:false},ticks:{color:AXIS,font:{size:10}}},y:{grid:{color:GRID},ticks:{color:AXIS,precision:0}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y+' ไม้'}}}})});
  }

  function renderTagBoards(d){
    const list=d.behaviorList||[];
    const best=list.filter(x=>x.pnl>0).slice(0,6);
    const worst=list.filter(x=>x.pnl<0).slice(-6).reverse();
    const row=x=>'<div class="tj-tagrow"><div><div class="tj-tagname">'+x.key+'</div><div class="tj-tagmeta">'+x.trades+' ไม้ · '+x.winRate+'% win</div></div><div class="tj-tagpnl '+toneClass(x.pnl)+'">'+glyph(x.pnl)+' '+money(x.pnl)+'</div></div>';
    const be=document.getElementById('tag-best'), we=document.getElementById('tag-worst');
    if(be) be.innerHTML = best.length? best.map(row).join('') : '<div class="text-muted small text-center py-3 fw-bold">ยังไม่มีข้อมูลพอ</div>';
    if(we) we.innerHTML = worst.length? worst.map(row).join('') : '<div class="text-muted small text-center py-3 fw-bold"><i class="fa-regular fa-circle-check me-1"></i>ไม่มีพฤติกรรมขาดทุนเด่น</div>';
  }

  function renderAnalytics(d){ try{ renderRDist(d); renderTagBoards(d); }catch(e){ console.error('analytics render',e); } }

  // ── Filter menus (symbol / setup) ──
  function populateFilterMenus(d){
    Object.keys(d.pairStats||{}).forEach(s=> s && window._allSymbols.add(s));
    Object.keys(d.setupStats||{}).forEach(s=> s && window._allSetups.add(s));
    buildCheckMenu('tj-symbol-menu', Array.from(window._allSymbols).sort(), window._globalFilter.symbols, 'symbols');
    buildCheckMenu('tj-setup-menu', Array.from(window._allSetups).sort(), window._globalFilter.setups, 'setups');
    const sb=document.getElementById('tj-symbol-btn'), stb=document.getElementById('tj-setup-btn');
    if(sb) sb.classList.toggle('on', window._globalFilter.symbols.length>0);
    if(stb) stb.classList.toggle('on', window._globalFilter.setups.length>0);
  }
  function buildCheckMenu(menuId, items, selected, key){
    const menu=document.getElementById(menuId); if(!menu) return;
    if(!items.length){ menu.innerHTML='<div class="text-muted small px-2 py-1">ยังไม่มีข้อมูล</div>'; return; }
    menu.innerHTML=items.map((it,i)=>{
      const id=menuId+'-'+i, ck=selected.indexOf(it)>=0?'checked':'';
      return '<div class="form-check"><input class="form-check-input" type="checkbox" value="'+it.replace(/"/g,'&quot;')+'" id="'+id+'" '+ck+'><label class="form-check-label" for="'+id+'">'+it+'</label></div>';
    }).join('');
    menu.querySelectorAll('input').forEach(inp=> inp.addEventListener('change',()=>{
      window._globalFilter[key]=Array.from(menu.querySelectorAll('input:checked')).map(x=>x.value);
      updateChips(); if(typeof loadAllData==='function') loadAllData();
    }));
  }

  // ── Active chips ──
  function updateChips(){
    const host=document.getElementById('tj-active-chips'); if(!host) return;
    const gf=window._globalFilter; const chips=[];
    const presetLbl={'7d':'7 วัน','30d':'30 วัน','90d':'90 วัน','ytd':'YTD','1y':'1 ปี'};
    if(gf.preset!=='all') chips.push(chip('ช่วง: '+presetLbl[gf.preset],'preset'));
    if(gf.side!=='all') chips.push(chip(gf.side==='long'?'Long':'Short','side'));
    gf.symbols.forEach(s=> chips.push(chip(s,'symbol:'+s)));
    gf.setups.forEach(s=> chips.push(chip(s,'setup:'+s)));
    host.innerHTML = chips.length ? (chips.join('')+'<span class="tj-fchip clear" role="button" onclick="_clearAllFilters()">ล้างทั้งหมด <i class="fa-solid fa-xmark"></i></span>') : '';
  }
  function chip(label,token){ return '<span class="tj-fchip">'+label+' <button onclick="_removeFilter(\''+token+'\')">&times;</button></span>'; }
  window._removeFilter=function(token){
    const gf=window._globalFilter;
    if(token==='preset'){ gf.preset='all'; setActive('tj-presets','[data-preset="all"]'); }
    else if(token==='side'){ gf.side='all'; setActive('tj-side','[data-side="all"]'); }
    else if(token.indexOf('symbol:')===0){ gf.symbols=gf.symbols.filter(x=>x!==token.slice(7)); }
    else if(token.indexOf('setup:')===0){ gf.setups=gf.setups.filter(x=>x!==token.slice(6)); }
    populateFilterMenus(window._lastMetrics||{}); updateChips(); if(typeof loadAllData==='function') loadAllData();
  };
  window._clearAllFilters=function(){
    window._globalFilter={preset:'all',symbols:[],setups:[],side:'all'};
    setActive('tj-presets','[data-preset="all"]'); setActive('tj-side','[data-side="all"]');
    populateFilterMenus(window._lastMetrics||{}); updateChips(); if(typeof loadAllData==='function') loadAllData();
  };
  function setActive(groupId, sel){ const g=document.getElementById(groupId); if(!g) return; g.querySelectorAll('button').forEach(b=>b.classList.remove('active')); const t=g.querySelector(sel); if(t) t.classList.add('active'); }

  // ── Wire filter bar controls ──
  function wireControls(){
    const presets=document.getElementById('tj-presets');
    if(presets) presets.querySelectorAll('.tj-preset').forEach(btn=> btn.addEventListener('click',()=>{
      window._globalFilter.preset=btn.dataset.preset;
      presets.querySelectorAll('.tj-preset').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      if(btn.dataset.preset!=='all'){ const fm=document.getElementById('filter-month'), fy=document.getElementById('filter-year'); if(fm) fm.value='all'; if(fy) fy.value='all'; }
      updateChips(); if(typeof loadAllData==='function') loadAllData();
    }));
    const side=document.getElementById('tj-side');
    if(side) side.querySelectorAll('.tj-side').forEach(btn=> btn.addEventListener('click',()=>{
      window._globalFilter.side=btn.dataset.side;
      side.querySelectorAll('.tj-side').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      updateChips(); if(typeof loadAllData==='function') loadAllData();
    }));
    const hb=document.getElementById('tj-hidepnl');
    if(hb) hb.addEventListener('click',()=>{
      const on=document.body.classList.toggle('tj-hidepnl'); hb.classList.toggle('on',on);
      hb.innerHTML = on ? '<i class="fa-solid fa-eye-slash"></i> <span>ซ่อน P&L</span>' : '<i class="fa-solid fa-eye"></i> <span>แสดง P&L</span>';
    });
  }

  // ── Hook into updateDashboardUI ──
  function install(){
    const orig = window.updateDashboardUI;
    if(typeof orig!=='function'){ setTimeout(install,60); return; }
    window.updateDashboardUI = function(data){
      window._lastMetrics = data;
      orig(data);
      try{
        renderAdvancedStats(data);
        renderAnalytics(data);
        populateFilterMenus(data);
        const pnlEl=document.getElementById('stat-pnl');
        if(pnlEl && !reduceMotion){
          const tp=Number(data.totalPnl)||0;
          countUp(pnlEl, tp, v=> (v>=0?'+$':'-$')+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));
        }
      }catch(e){ console.error('ext dashboard',e); }
    };
  }

  // เมื่อสลับมาแท็บ "วิเคราะห์" ให้วาดกราฟใหม่ (canvas ที่ถูกซ่อนตอนวาดครั้งแรกจะมีขนาด 0)
  function hookSwitchTab(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hookSwitchTab,60); return; }
    window.switchTab = function(id){
      orig(id);
      if(id==='analytics' && window._lastMetrics){ setTimeout(()=>{ try{ renderAnalytics(window._lastMetrics); }catch(e){} }, 40); }
    };
  }

  // รันทันที (สคริปต์อยู่ท้าย body → DOM พร้อมแล้ว) เพื่อครอบ updateDashboardUI
  // ก่อน loadAllData() ของ DOMContentLoaded จะจับ reference เดิม
  wireControls();
  install();
  hookSwitchTab();
})();

