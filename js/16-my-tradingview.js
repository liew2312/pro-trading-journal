(function(){
  const $=id=>document.getElementById(id);
  const KEY='tj_tv_layout';
  const get=()=>{ try{ return localStorage.getItem(KEY)||''; }catch(e){ return ''; } };
  const set=v=>{ try{ v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY); }catch(e){} };
  let client=null;
  function sb(){ if(client) return client; try{ const c=window.SUPABASE_CONFIG; client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY); }catch(e){} return client; }
  const TFN={ '1':'1m','5':'5m','15':'15m','30':'30m','60':'1H','240':'4H','D':'1D','W':'1W' };
  function state(){ return window.tjChartState ? window.tjChartState() : { sym:'XAUUSD', tf:'15' }; }
  function layoutId(v){ const m=/tradingview\.com\/chart\/([A-Za-z0-9]+)/i.exec(v||''); return m?m[1]:''; }
  function tvUrl(){
    const { sym, tf }=state(); const id=layoutId(get());
    return 'https://www.tradingview.com/chart/'+(id?id+'/':'')+'?symbol='+encodeURIComponent(sym)+'&interval='+encodeURIComponent(tf);
  }
  function paint(){
    const { sym, tf }=state(); const id=layoutId(get());
    const o=$('tj-mytv-open-sub'); if(o) o.textContent=sym+' · '+(TFN[tf]||tf)+(id?' · Layout ของฉัน':'');
    const u=$('tj-mytv-url'); if(u && document.activeElement!==u) u.value=get();
    const f=document.querySelector('#tradeForm [name="chartBeforeUrl"]'), a=document.querySelector('#tradeForm [name="chartAfterUrl"]');
    document.querySelectorAll('.tj-mytv-pbtn').forEach(b=>{ const inp=b.dataset.slot==='fileBefore'?f:a; b.classList.toggle('done', !!(inp && /tradingview\.com\/x\//.test(inp.value))); });
  }
  let opened=false;
  $('tj-mytv-open') && $('tj-mytv-open').addEventListener('click',()=>{ opened=true; window.open(tvUrl(),'_blank','noopener'); });
  // กลับมาจาก TradingView → ไฮไลต์ขั้นที่ 3
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && opened){ opened=false; const p=document.querySelector('.tj-mytv-step.paste'); if(p){ p.classList.add('pulse'); setTimeout(()=>p.classList.remove('pulse'),6000); } } });
  document.querySelectorAll('.tj-mytv-pbtn').forEach(b=>b.addEventListener('click',async()=>{ if(window.tjUseTvLink){ await window.tjUseTvLink(b.dataset.slot); paint(); } }));
  $('tj-mytv-set') && $('tj-mytv-set').addEventListener('click',()=>{ const e=$('tj-mytv-setup'); e.style.display = e.style.display==='none' ? '' : 'none'; paint(); });
  $('tj-mytv-save') && $('tj-mytv-save').addEventListener('click',async()=>{
    const v=($('tj-mytv-url').value||'').trim();
    if(v && !layoutId(v)){ alertBox('ลิงก์ต้องเป็นแบบ tradingview.com/chart/xxxx/'); return; }
    set(v); $('tj-mytv-setup').style.display='none'; paint();
    try{ const c=sb(); if(c) await c.auth.updateUser({ data:{ tj_tv_layout:v } }); }catch(e){}
    alertBox(v?'บันทึก Layout แล้ว ✓':'ล้าง Layout แล้ว — จะเปิด Layout ล่าสุดของคุณ');
  });
  function alertBox(m){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),3200); }
  (async function load(){ try{ const c=sb(); if(!c) return; const { data }=await c.auth.getUser(); const v=data&&data.user&&data.user.user_metadata&&data.user.user_metadata.tj_tv_layout; if(typeof v==='string' && v!==get()){ set(v); paint(); } }catch(e){} })();
  // อัปเดตข้อความเมื่อเปลี่ยน symbol / TF
  document.addEventListener('click',e=>{ if(e.target.closest('#tj-chart-tf,#tj-chart-chips,#tj-chart-go')) setTimeout(paint,50); });
  const si=$('tj-chart-symbol'); if(si) si.addEventListener('change',()=>setTimeout(paint,50));
  ['chartBeforeUrl','chartAfterUrl'].forEach(n=>{ const i=document.querySelector('#tradeForm [name="'+n+'"]'); if(i) i.addEventListener('input',paint); });
  const fm=$('tradeForm'); if(fm) fm.addEventListener('reset',()=>setTimeout(paint,0));
  (function hookTab(){ const o=window.switchTab; if(typeof o!=='function'){ setTimeout(hookTab,60); return; } window.switchTab=function(id){ const r=o.apply(this,arguments); if(id==='chart') setTimeout(paint,50); return r; }; })();
  paint();
})();

