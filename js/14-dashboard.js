(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const dkey = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const isTrade = r => (r.type==='Buy'||r.type==='Sell') && isFinite(parseFloat(r.pnl));

  // ── ภาพย่อกราฟในประวัติ ──
  window.tjThumb = function(url){
    if(!url) return '';
    const m = /tradingview\.com\/x\/([A-Za-z0-9]+)/.exec(url);
    if(m) return 'https://s3.tradingview.com/snapshots/'+m[1].charAt(0).toLowerCase()+'/'+m[1]+'.png';
    if(/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || /\/storage\/v1\/object\//.test(url)) return url;
    return '';
  };

  // ── สีหลัก ──
  const TC = { pastel:'#F4F3EE', pop:'#FAF6EC', green:'#F4F7F2', red:'#F6F6F7', blue:'#F4F6FA', mono:'#F6F6F7' };
  // "ป๊อป" ใช้โครงของธีมพาสเทล + data-skin="pop" (css/09-pop.css)
  function curAccent(){ try{ return localStorage.getItem('tj_accent') || 'pastel'; }catch(e){ return document.documentElement.getAttribute('data-skin')==='pop' ? 'pop' : (document.documentElement.getAttribute('data-accent')||'pastel'); } }
  function setAccent(a){
    document.documentElement.setAttribute('data-accent', a==='pop' ? 'pastel' : a);
    if(a==='pop') document.documentElement.setAttribute('data-skin','pop'); else document.documentElement.removeAttribute('data-skin');
    try{ localStorage.setItem('tj_accent', a); }catch(e){}
    const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', TC[a]||TC.pastel);
    document.querySelectorAll('#tj-accents button').forEach(b=>b.classList.toggle('active', b.dataset.a===a));
    try{ if(window.tjRenderV2) window.tjRenderV2(); if(window._lastMetrics && window.updateDashboardUI) window.updateDashboardUI(window._lastMetrics); }catch(e){}
    renderDisc();
  }
  document.querySelectorAll('#tj-accents button').forEach(b=>b.addEventListener('click', ()=>setAccent(b.dataset.a)));
  document.querySelectorAll('#tj-accents button').forEach(b=>b.classList.toggle('active', b.dataset.a===curAccent()));

  // ── คำทักทาย ──
  function renderHello(){
    const host = $('tj-hello'); if(!host) return;
    const h = new Date().getHours();
    const g = h<5 ? 'สวัสดีตอนดึก' : (h<12 ? 'สวัสดีตอนเช้า' : (h<17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'));
    let _dn=''; try{ _dn=localStorage.getItem('tj_name')||''; }catch(e){}
    const name = _dn || String(window._currentUserName || 'Trader').split(/[\s@]/)[0];
    host.innerHTML = `<div><div class="hi">${g}</div><h3>${esc(name)}</h3><div class="sub">เทรดตามแผน · คุมความเสี่ยง · ทบทวนทุกสัปดาห์</div></div>${window.tjAvatarHTML ? window.tjAvatarHTML() : '<div class="ico"><i class="fa-solid fa-seedling"></i></div>'}`;
  }

  // ── การ์ดวินัย: คะแนน 30 วัน + วันทำตามกฎติดต่อกัน ──
  function tradeBroke(r){ return r.revenge==='Yes' || r.overtrade==='Yes' || r.followed_plan==='No' || r.lot_respected==='No'; }
  function dayBroke(k, list){
    if(list.some(tradeBroke)) return true;
    return false;
  }
  function renderDisc(){
    const host = $('tj-disc'); if(!host) return;
    const rows = (window._tjRows||[]).filter(isTrade);
    if(!rows.length){ host.innerHTML=''; return; }
    const byDay = {}; rows.forEach(r=>{ const k=dkey(new Date(r.created_at)); (byDay[k]=byDay[k]||[]).push(r); });
    const since = new Date(); since.setDate(since.getDate()-30);
    const recent = rows.filter(r=>new Date(r.created_at)>=since && r.followed_plan!=='-');
    const score = recent.length ? Math.round(recent.filter(r=>!tradeBroke(r)).length / recent.length * 100) : null;
    // วันทำตามกฎติดต่อกัน (ข้ามวันที่ไม่ได้เทรด)
    let streak = 0; const days = Object.keys(byDay).sort().reverse();
    for(const k of days){ if(dayBroke(k, byDay[k])) break; streak++; }
    // จุดสัปดาห์นี้ จ–อา
    const now = new Date(); const ws = new Date(now.getFullYear(), now.getMonth(), now.getDate()); ws.setDate(ws.getDate()-((ws.getDay()+6)%7));
    const names = ['จ','อ','พ','พฤ','ศ','ส','อา'];
    const dots = names.map((n,i)=>{ const d = new Date(ws); d.setDate(d.getDate()+i); const k = dkey(d); const l = byDay[k];
      const cls = l ? (dayBroke(k,l)?'bad':'ok') : ''; return `<div>${n}<i class="${cls} ${k===dkey(now)?'today':''}"></i></div>`; }).join('');
    const pct = score==null ? 0 : score, C = 2*Math.PI*44;
    const col = score==null ? 'var(--border)' : (score>=80 ? 'var(--brand)' : (score>=50 ? 'var(--ap-warn)' : 'var(--loss)'));
    host.innerHTML = `<div class="tj-ring"><svg width="104" height="104"><circle cx="52" cy="52" r="44" fill="none" stroke="var(--panel)" stroke-width="10"/><circle cx="52" cy="52" r="44" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}"/></svg>
      <div class="num"><b>${score==null?'—':score}</b><small>/100 · 30 วัน</small></div></div>
      <div class="tj-streak"><div class="t"><i class="fa-solid fa-fire" style="color:${streak?'var(--ap-warn)':'var(--muted)'}"></i> ทำตามกฎติดต่อกัน</div><div class="big">${streak} <span style="font-size:.85rem;font-weight:600;color:var(--muted)">วันที่เทรด</span></div>
      <div class="tj-dots">${dots}</div><div class="small text-muted mt-2" style="font-size:.68rem">คะแนนวินัย = % ไม้ที่ไม่มี Revenge / Overtrade / OverLot / ผิดแผน</div></div>`;
  }

  // ── เมนูมือถือ ──
  let sheet, bg;
  window.tjOpenMenu = function(){
    if(!sheet){
      bg = document.createElement('div'); bg.className='tj-sheet-bg'; bg.onclick = close;
      sheet = document.createElement('div'); sheet.className='tj-sheet';
      const items = [
        ['fa-solid fa-file-arrow-up','นำเข้า MT5',()=>tjOpenImport()],
        ['fa-solid fa-chart-simple','กราฟ',()=>switchTab('chart')],
        ['fa-regular fa-newspaper','ข่าว',()=>switchTab('news'),'news'],
        ['fa-solid fa-book','Playbook',()=>tjOpenPlaybook()],
        ['fa-solid fa-clipboard-list','ทบทวน',()=>tjOpenReview()],
        ['fa-solid fa-shield-halved','กฎความเสี่ยง',()=>tjOpenRules()],
        ['fa-solid fa-wallet','ฝาก / ถอน',()=>bootstrap.Modal.getOrCreateInstance($('fundingModal')).show()],
        ['fa-solid fa-gear','ตั้งค่า',()=>bootstrap.Modal.getOrCreateInstance($('settingsModal')).show()],
      ];
      sheet.innerHTML = '<div class="grab"></div><div class="tj-sheet-grid">'+items.map((it,i)=>`<button type="button" data-i="${i}"><i class="${it[0]}"></i>${it[1]}${it[3]==='news'?'<span class="dot" id="tj-menu-news-dot" style="display:none"></span>':''}</button>`).join('')+'</div>';
      sheet.querySelectorAll('button').forEach(b=>b.onclick = ()=>{ close(); setTimeout(items[+b.dataset.i][2], 180); });
      document.body.appendChild(bg); document.body.appendChild(sheet);
    }
    const nd = $('tj-menu-news-dot'), bd = $('tj-news-dot-bottom'); if(nd) nd.style.display = bd && bd.classList.contains('on') ? '' : 'none';
    bg.style.display='block'; requestAnimationFrame(()=>{ bg.classList.add('open'); sheet.classList.add('open'); });
  };
  function close(){ if(!sheet) return; sheet.classList.remove('open'); bg.classList.remove('open'); setTimeout(()=>{ bg.style.display='none'; }, 220); }

  document.addEventListener('tj:rows', ()=>{ renderHello(); renderDisc(); });
  document.addEventListener('tj:hello', renderHello);
  (function hookTab(){
    const orig = window.switchTab;
    if(typeof orig!=='function'){ setTimeout(hookTab,60); return; }
    window.switchTab = function(id){ close(); const r = orig.apply(this, arguments); if(id==='dashboard'){ renderHello(); renderDisc(); } return r; };
  })();
  renderHello();
  setTimeout(renderHello, 1500);
})();

