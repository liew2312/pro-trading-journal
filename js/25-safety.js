// ══════════ v69: กันข้อมูลหาย ══════════
// 1) ร่างฟอร์มบันทึกเทรด: เก็บในเครื่องอัตโนมัติขณะกรอก (เฉพาะออเดอร์ใหม่) · เปิดฟอร์มอีกครั้งถามว่าจะกรอกต่อไหม
//    ลบร่างเมื่อบันทึกสำเร็จ หรือกด "ทิ้งร่าง" · ภาพที่แนบเป็นไฟล์เก็บในร่างไม่ได้ (ลิงก์ภาพเก็บได้)
// 2) สถานะออฟไลน์: แสดงป้ายเมื่อใช้ข้อมูลสำเนาในเครื่อง (จาก 02-api.js) · เน็ตกลับมาโหลดใหม่เอง
// 3) บันทึกไม่ผ่านเพราะเน็ต → ข้อความที่บอกว่าข้อมูลไม่หาย
// 4) เตือนสำรองข้อมูล (Export CSV) ทุก 30 วัน บนหน้าภาพรวม
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LS = {
    get(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } },
    set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  };
  const pad = n => String(n).padStart(2,'0');
  const hhmm = t => { const d = new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
  function ago(t){
    const m = Math.round((Date.now()-t)/60000);
    if(m < 1) return 'เมื่อสักครู่'; if(m < 60) return m+' นาทีที่แล้ว';
    const h = Math.round(m/60); if(h < 24) return h+' ชั่วโมงที่แล้ว';
    return Math.round(h/24)+' วันที่แล้ว';
  }
  function toast(msg, ms){
    const o = document.querySelector('.tj-toast'); if(o) o.remove();
    const t = document.createElement('div'); t.className = 'tj-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(()=>t.remove(), ms || 2800);
  }

  // ───────────────────────── 1) ร่างฟอร์ม ─────────────────────────
  const form = $('tradeForm');
  const DKEY = () => 'tj_trade_draft_' + (window._currentUserId || 'anon');
  const MEANINGFUL = ['symbol','entryPrice','slPrice','tpPrice','lots','pnl','notes','riskAmount','chartBeforeUrl','chartAfterUrl','chartHtfUrl'];
  const MAX_AGE = 14 * 24 * 3600 * 1000;
  const keyOf = (el, i) => el.id || (el.name ? el.name + (el.type==='checkbox'||el.type==='radio' ? '|'+el.value : '') : 'i'+i);
  const editing = () => (window.tjIsEditing && window.tjIsEditing() != null);

  function fields(){ return form ? [...form.querySelectorAll('input,select,textarea')] : []; }
  function snapshot(){
    const vals = {}, checks = {};
    fields().forEach((el,i)=>{
      if(el.type==='file' || el.type==='button' || el.type==='submit') return;
      const k = keyOf(el,i);
      if(el.type==='checkbox' || el.type==='radio') checks[k] = el.checked; else vals[k] = el.value;
    });
    const sh = window._tjShots || {};
    const hasImg = fields().some(el=>el.type==='file' && el.files && el.files.length) || Object.keys(sh).some(k=>sh[k]);
    return { t: Date.now(), vals, checks, hasImg };
  }
  function meaningful(vals){
    return MEANINGFUL.some(n=>{
      const el = form && form.querySelector('[name="'+n+'"]'); if(!el) return false;
      const v = vals ? vals[keyOf(el, fields().indexOf(el))] : el.value;
      return v != null && String(v).trim() !== '';
    });
  }
  let saveTimer = null;
  function scheduleSave(){
    if(!form || editing()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>{
      if(editing()) return;
      const snap = snapshot();
      if(meaningful(snap.vals)) LS.set(DKEY(), snap);
    }, 500);
  }
  function clearDraft(){ clearTimeout(saveTimer); LS.del(DKEY()); hideBanner(); }
  if(form){
    ['input','change'].forEach(ev=>form.addEventListener(ev, scheduleSave));
    form.addEventListener('click', scheduleSave);   // ชิปที่ตั้งค่าให้ช่องโดยไม่ยิง input
  }

  function restore(d){
    const list = fields();
    const fire = el => { el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };
    // รอบแรก: ช่องข้อความ/ตัวเลือก (Setup จะสร้างเช็กลิสต์ของมันเอง)
    list.forEach((el,i)=>{
      if(el.type==='file' || el.type==='checkbox' || el.type==='radio') return;
      const k = keyOf(el,i); if(!(k in d.vals)) return;
      if(el.tagName==='SELECT' && d.vals[k] && ![...el.options].some(o=>o.value===d.vals[k])){
        const o = document.createElement('option'); o.value = o.textContent = d.vals[k]; el.appendChild(o);
      }
      el.value = d.vals[k];
    });
    list.forEach(el=>{ if(el.type!=='file' && el.type!=='checkbox' && el.type!=='radio') fire(el); });
    // รอบสอง: ช่องติ๊ก (รอให้เช็กลิสต์ของ Setup ถูกสร้างก่อน)
    setTimeout(()=>{
      fields().forEach((el,i)=>{
        if(el.type!=='checkbox' && el.type!=='radio') return;
        const k = keyOf(el,i); if(!(k in d.checks)) return;
        if(el.checked !== d.checks[k]){ el.checked = d.checks[k]; el.dispatchEvent(new Event('change', {bubbles:true})); }
      });
      if(typeof window.autoCalcRR === 'function') try{ window.autoCalcRR(); }catch(e){}
      toast(d.hasImg ? 'กรอกต่อจากร่างแล้ว — ภาพที่แนบเป็นไฟล์ต้องแนบใหม่' : 'กรอกต่อจากร่างแล้ว', 3600);
    }, 120);
  }

  function hideBanner(){ const b = $('tj-draft-banner'); if(b) b.remove(); }
  function showBanner(){
    hideBanner();
    if(!form || editing()) return;
    const d = LS.get(DKEY());
    if(!d || !d.vals) return;
    if(Date.now() - d.t > MAX_AGE){ LS.del(DKEY()); return; }
    if(meaningful()) return;                         // ฟอร์มมีข้อมูลอยู่แล้ว (กำลังกรอก) ไม่ต้องถาม
    const symEl = form.querySelector('[name="symbol"]'), typeEl = form.querySelector('[name="type"]');
    const sym = symEl ? d.vals[keyOf(symEl, fields().indexOf(symEl))] : '';
    const typ = typeEl ? d.vals[keyOf(typeEl, fields().indexOf(typeEl))] : '';
    const b = document.createElement('div');
    b.id = 'tj-draft-banner'; b.className = 'tj-goal tj-draft';
    b.innerHTML = '<span class="tj-ico tj-ico-warning"><i class="fa-solid fa-pen-to-square"></i></span>'
      + '<div style="flex:1;min-width:0"><b>มีออเดอร์ที่กรอกค้างไว้</b>'
      + '<div class="small text-muted" style="font-size:.74rem">' + esc([sym, typ].filter(Boolean).join(' ') || 'ยังไม่ระบุ Symbol') + ' · บันทึกร่างไว้ ' + ago(d.t) + (d.hasImg ? ' · ภาพที่แนบเป็นไฟล์ต้องแนบใหม่' : '') + '</div>'
      + '<div class="tj-draft-act"><button type="button" class="btn btn-primary btn-sm" data-a="go">กรอกต่อ</button><button type="button" class="tj-linkbtn" data-a="drop">ทิ้งร่าง</button></div></div>';
    b.querySelector('[data-a=go]').onclick = ()=>{ hideBanner(); restore(d); };
    b.querySelector('[data-a=drop]').onclick = ()=>{ clearDraft(); toast('ทิ้งร่างแล้ว'); };
    form.parentNode.insertBefore(b, form);
  }

  // ───────────────────────── 3) บันทึกไม่ผ่านเพราะเน็ต ─────────────────────────
  const isNetErr = e => !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(String(e && e.message || e));
  (function wrapApi(){
    if(!window.api || !window.api.saveTradeData){ setTimeout(wrapApi, 60); return; }
    ['saveTradeData','updateTradeData'].forEach(name=>{
      const orig = window.api[name];
      window.api[name] = async function(){
        try{
          const r = await orig.apply(this, arguments);
          if(name==='saveTradeData') clearDraft();   // บันทึกสำเร็จ → ไม่ต้องเก็บร่างแล้ว
          return r;
        }catch(e){
          if(name==='saveTradeData'){ const snap = snapshot(); if(meaningful(snap.vals)) LS.set(DKEY(), snap); }
          if(isNetErr(e)) throw new Error('ไม่มีอินเทอร์เน็ต — ข้อมูลที่กรอกยังอยู่ในฟอร์มและเก็บร่างไว้ในเครื่องแล้ว ลองกดบันทึกอีกครั้งเมื่อเน็ตกลับมา');
          throw e;
        }
      };
    });
  })();

  // ───────────────────────── 2) สถานะออฟไลน์ ─────────────────────────
  const pill = document.createElement('div');
  pill.className = 'tj-net'; pill.hidden = true; pill.setAttribute('role', 'status');
  document.body.appendChild(pill);
  function paintNet(){
    const st = window._tjNetState;
    const off = !navigator.onLine || (st && st.online === false);
    pill.hidden = !off;
    if(off){
      const t = st && st.t;
      pill.innerHTML = '<i class="fa-solid fa-plug-circle-xmark"></i> ออฟไลน์' + (t ? ' · แสดงข้อมูลล่าสุดเมื่อ ' + (Date.now()-t > 864e5 ? ago(t) : hhmm(t)) : '');
    }
  }
  document.addEventListener('tj:netstate', paintNet);
  window.addEventListener('offline', paintNet);
  window.addEventListener('online', ()=>{ paintNet(); if(typeof window.loadAllData === 'function') setTimeout(()=>window.loadAllData(), 300); });

  // ───────────────────────── 4) เตือนสำรองข้อมูล ─────────────────────────
  const BK_DAYS = 30, MIN_TRADES = 10;
  function renderBackup(){
    const host = $('tj-backup-prompt'); if(!host) return;
    const rows = window._tjRows || [];
    const trades = rows.filter(r => r.type === 'Buy' || r.type === 'Sell').length;
    const last = Number(LS.get('tj_last_backup')) || 0;
    const snooze = Number(LS.get('tj_backup_snooze')) || 0;
    const due = trades >= MIN_TRADES && Date.now() - last > BK_DAYS*864e5 && Date.now() > snooze;
    if(!due){ host.innerHTML = ''; return; }
    host.innerHTML = '<div class="tj-goal tj-backup"><span class="tj-ico"><i class="fa-solid fa-floppy-disk"></i></span>'
      + '<div style="flex:1;min-width:0"><b>สำรองข้อมูลประจำเดือน</b>'
      + '<div class="small text-muted" style="font-size:.74rem">' + (last ? 'สำรองล่าสุด ' + ago(last) : 'ยังไม่เคยสำรอง') + ' · ' + trades + ' ไม้ · ได้ไฟล์ .csv เก็บไว้ในเครื่องหรือ Google Drive (นำเข้ากลับได้ที่ตั้งค่า)</div>'
      + '<div class="tj-draft-act"><button type="button" class="btn btn-primary btn-sm" data-a="bk">สำรองเลย</button><button type="button" class="tj-linkbtn" data-a="later">เตือนอีก 7 วัน</button></div></div></div>';
    host.querySelector('[data-a=bk]').onclick = async ()=>{ if(typeof window.exportDataCSV === 'function') await window.exportDataCSV(); };
    host.querySelector('[data-a=later]').onclick = ()=>{ LS.set('tj_backup_snooze', Date.now() + 7*864e5); renderBackup(); };
  }
  (function mountBackup(){
    const after = $('tj-review-prompt');
    if(after && !$('tj-backup-prompt')){ const d = document.createElement('div'); d.id = 'tj-backup-prompt'; after.parentNode.insertBefore(d, after.nextSibling); }
  })();
  document.addEventListener('tj:rows', renderBackup);
  document.addEventListener('tj:backup', ()=>{ renderBackup(); toast('ดาวน์โหลดไฟล์สำรองแล้ว — เก็บไว้ที่ปลอดภัยนะครับ', 3600); });

  // ── wire ──
  (function hookTab(){
    const o = window.switchTab;
    if(typeof o !== 'function'){ setTimeout(hookTab, 60); return; }
    window.switchTab = function(id){ const r = o.apply(this, arguments); if(id === 'add-trade') setTimeout(showBanner, 80); else hideBanner(); return r; };
  })();
  setTimeout(()=>{ const pg = document.querySelector('.page-section.active'); if(pg && pg.id === 'add-trade') showBanner(); paintNet(); }, 1200);
  window.tjDraft = { clear: clearDraft, show: showBanner };
})();
