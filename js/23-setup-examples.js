// ══════════ ตัวอย่างกราฟของแต่ละ Setup ══════════
// 1) ภาพโครงสร้างในตัว (SVG ตามธีม) สำหรับ Setup ที่มีให้ — ตอนนี้: BOS Sweep · ตัวเลขบนภาพ = ข้อในเช็กลิสต์
// 2) ภาพกราฟจริงที่ผู้ใช้อัปโหลด/วางลิงก์ไว้ใน Playbook (p.examples = [url,...])
// ใช้ในหน้า "เช็กก่อนเข้า" และลิงก์ "ดูตัวอย่าง" ในเช็กลิสต์ของฟอร์มบันทึกเทรด
(function(){
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const thumb = u => (window.tjThumb && window.tjThumb(u)) || u;
  const key = pb => pb ? (pb.value || pb.name) : '';

  // ── ภาพโครงสร้าง BOS Sweep · side = 'Buy' | 'Sell' (Sell = กลับหัว) ──
  function bosSweep(side){
    // พิกัดทั้งหมดเขียนในมุมของฝั่ง Buy · ฝั่ง Sell สะท้อนแกนตั้งทั้งภาพ (ป้ายย้ายไปอีกฝั่งของเส้นเอง)
    const H = 236, sell = side === 'Sell';
    const Y = y => sell ? H - y : y;
    const pts = a => a.map(([x,y]) => x+','+Y(y)).join(' ');
    const lbl = (x, y, t, cls, anchor) => `<text x="${x}" y="${Y(y)}" class="${cls||'lb'}"${anchor?` text-anchor="${anchor}"`:''} dominant-baseline="middle">${t}</text>`;
    const badge = (n, x, y) => `<g class="bd"><circle cx="${x}" cy="${Y(y)}" r="9"/><text x="${x}" y="${Y(y)+0.5}" text-anchor="middle" dominant-baseline="middle">${n}</text></g>`;
    return `<svg viewBox="0 0 520 ${H}" class="tj-diag" role="img" aria-label="ภาพตัวอย่างโครงสร้าง BOS Sweep ฝั่ง ${sell?'Sell':'Buy'}">
      <rect x="300" y="${sell ? Y(170) : 112}" width="200" height="58" class="zone"/>
      ${lbl(496, 184, 'Entry Zone', 'lb zl', 'end')}
      <line x1="120" y1="${Y(112)}" x2="300" y2="${Y(112)}" class="ln"/>
      ${lbl(126, 100, 'BOS')}
      <line x1="262" y1="${Y(74)}" x2="392" y2="${Y(74)}" class="ln"/>
      ${lbl(268, 62, 'BOS')}
      <line x1="236" y1="${Y(140)}" x2="270" y2="${Y(140)}" class="ln dash"/>
      ${lbl(230, 140, '#1', 'lb', 'end')}
      <line x1="360" y1="${Y(108)}" x2="420" y2="${Y(108)}" class="ln dash"/>
      ${lbl(426, 108, '$$$', 'lb zl')}
      <polyline points="${pts([[20,214],[120,112],[180,190],[224,122],[236,140],[262,74],[300,170],[344,96],[360,108],[400,40]])}" class="px"/>
      <polyline points="${pts([[400,40],[450,152],[500,14]])}" class="fut"/>
      <circle cx="300" cy="${Y(170)}" r="4.5" class="sw"/>
      ${lbl(306, 188, sell ? 'sweep high = SL' : 'sweep low = SL', 'lb sl')}
      <circle cx="450" cy="${Y(152)}" r="5" class="en"/>
      ${badge(1, 164, 100)}
      ${badge(2, 282, 186)}
      ${badge(3, 306, 62)}
      ${badge(4, 466, 108)}
      ${badge(5, 482, 135)}
      ${badge(6, 428, 156)}
    </svg>`;
  }
  const DIAGRAMS = { 'BOS Sweep': bosSweep };

  function hasDiagram(pb){ return !!DIAGRAMS[key(pb)]; }
  function examples(pb){ return (pb && Array.isArray(pb.examples) ? pb.examples : []).filter(Boolean); }
  function has(pb){ return hasDiagram(pb) || examples(pb).length > 0; }

  // แถบตัวอย่าง (ใช้ในโมดัลเช็กก่อนเข้า)
  function html(pb, side){
    if(!has(pb)) return '';
    const d = DIAGRAMS[key(pb)];
    const ex = examples(pb);
    return `<div class="tj-ex">
      ${d ? `<button type="button" class="tj-ex-diag" data-ex-open="-1" aria-label="ขยายภาพโครงสร้าง">${d(side)}</button>` : ''}
      ${ex.length ? `<div class="tj-ex-strip">${ex.map((u,i)=>`<button type="button" data-ex-open="${i}" aria-label="ดูภาพตัวอย่าง ${i+1}"><img src="${esc(thumb(u))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      <div class="tj-ex-note">${d ? 'เลขบนภาพ = ข้อในเช็กลิสต์ · ' : ''}แตะภาพเพื่อขยาย${ex.length ? '' : ' · เพิ่มภาพกราฟจริงของคุณได้ใน Playbook'}</div>
    </div>`;
  }
  function wire(host, pb, side){
    host.querySelectorAll('[data-ex-open]').forEach(b=>b.onclick = ()=>open(pb, +b.dataset.exOpen, side));
  }

  // ── ตัวดูภาพเต็มจอ ──
  function open(pb, idx, side){
    const d = DIAGRAMS[key(pb)], ex = examples(pb);
    const items = (d ? [{ svg: d(side||'Buy') }] : []).concat(ex.map(u=>({ url: u })));
    if(!items.length) return;
    let i = Math.max(0, Math.min(items.length-1, (d ? idx+1 : idx)));
    const ov = document.createElement('div'); ov.className = 'tj-exv'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','ตัวอย่างกราฟ '+(pb.name||''));
    const draw = ()=>{
      const it = items[i];
      ov.innerHTML = `<div class="tj-exv-top"><b>${esc(pb.name||'')}</b><span>${items.length>1 ? (i+1)+' / '+items.length : ''}</span>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="เปิดภาพต้นฉบับ" title="เปิดภาพต้นฉบับ"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}<button type="button" data-x aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="tj-exv-body">${it.svg ? `<div class="tj-exv-svg">${it.svg}</div>` : `<img src="${esc(thumb(it.url))}" alt="ตัวอย่างกราฟ">`}</div>
        ${items.length>1 ? `<div class="tj-exv-navs"><button type="button" class="tj-exv-nav prev" data-p aria-label="ก่อนหน้า"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="tj-exv-nav next" data-n aria-label="ถัดไป"><i class="fa-solid fa-chevron-right"></i></button></div>` : ''}`;
      ov.querySelector('[data-x]').onclick = close;
      const p = ov.querySelector('[data-p]'), n = ov.querySelector('[data-n]');
      if(p) p.onclick = e=>{ e.stopPropagation(); i = (i-1+items.length)%items.length; draw(); };
      if(n) n.onclick = e=>{ e.stopPropagation(); i = (i+1)%items.length; draw(); };
    };
    const close = ()=>{ ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } else if(e.key==='ArrowRight' && items.length>1){ i=(i+1)%items.length; draw(); } else if(e.key==='ArrowLeft' && items.length>1){ i=(i-1+items.length)%items.length; draw(); } };
    ov.addEventListener('click', e=>{ if(e.target===ov || e.target.classList.contains('tj-exv-body')) close(); });
    let sx = null; ov.addEventListener('touchstart', e=>{ sx = e.touches[0].clientX; }, {passive:true});
    ov.addEventListener('touchend', e=>{ if(sx==null || items.length<2) return; const dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx)>50){ i = (i + (dx<0?1:-1) + items.length) % items.length; draw(); } sx = null; });
    document.addEventListener('keydown', onKey, true);
    draw(); document.body.appendChild(ov);
  }

  window.tjSetupExamples = { has, hasDiagram, examples, html, wire, open, diagram: (pb, side)=>{ const d = DIAGRAMS[key(pb)]; return d ? d(side||'Buy') : ''; } };
})();
