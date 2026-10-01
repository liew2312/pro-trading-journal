// ══════════ คำถามหลังเทรด: ราคาวิ่งไปถึง TP ไหม / ราคาย้อนกลับมาชน SL ไหม ══════════
// เก็บในช่อง confluences เป็น HITTP:Y|N และ HITSL:Y|N (ไม่ต้องแก้ฐานข้อมูล) · ช่อง MAE/MFE เดิมย้ายไปอยู่ในส่วน "ละเอียด"
(function(){
  const form = document.getElementById('tradeForm'); if(!form) return;
  const oc = form.querySelector('[name="outcome"]');
  const boxTp = document.getElementById('tj-q-tp'), boxSl = document.getElementById('tj-q-sl'), row = document.getElementById('tj-q-row');
  const clear = box => box && box.querySelectorAll('input').forEach(i=>{ i.checked = false; });
  // ถามเฉพาะที่มีความหมายกับผลลัพธ์นั้น: ชน TP ไม่ต้องถามเรื่อง TP · ชน SL ไม่ต้องถามเรื่อง SL
  function sync(){
    const v = oc ? oc.value : '';
    const showTp = v !== 'TP' && v !== 'OPEN', showSl = v !== 'SL' && v !== 'OPEN';
    const missed = v === 'MISSED', T = (id, t) => { const e = document.getElementById(id); if(e) e.textContent = t; };
    T('tj-q-sl-t', missed ? 'ราคาไปชน SL ก่อนไหม?' : 'ราคาย้อนกลับมาชน SL ไหม?');
    T('tj-q-sl-h', missed ? 'ถ้าได้เข้าตามแผน ราคาชน SL ก่อนถึง TP' : 'หลังคุณปิดออเดอร์ไปแล้ว');
    T('tj-q-tp-h', missed ? 'ถ้าได้เข้าตามแผน ราคาวิ่งไปถึง TP' : 'ถึงแม้คุณจะปิดก่อนหรือโดน SL ไปแล้ว');
    if(boxTp){ boxTp.style.display = showTp ? '' : 'none'; if(!showTp) clear(boxTp); }
    if(boxSl){ boxSl.style.display = showSl ? '' : 'none'; if(!showSl) clear(boxSl); }
    if(row) row.style.display = (showTp || showSl) ? '' : 'none';
  }
  if(oc){
    oc.addEventListener('change', sync);
    const box = document.getElementById('pj-oc-chips');
    if(box) new MutationObserver(sync).observe(box, { subtree:true, attributes:true, attributeFilter:['aria-checked'] });
  }
  // กดปุ่มที่เลือกอยู่ซ้ำ = ยกเลิก
  let was = null;
  form.querySelectorAll('.tj-q').forEach(lb=>{
    lb.addEventListener('pointerdown', ()=>{ const i=document.getElementById(lb.htmlFor); was = i && i.checked ? i : null; });
    lb.addEventListener('click', e=>{ const i=document.getElementById(lb.htmlFor); if(i && was===i){ e.preventDefault(); i.checked=false; was=null; } });
  });
  form.addEventListener('reset', ()=>setTimeout(sync, 0));
  sync();
})();
