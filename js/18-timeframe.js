(function(){
  const form=document.getElementById('tradeForm'); if(!form) return;
  const KEY='tj_last_tf';
  const last=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } };
  function applyDefault(){ const l=last(); ['HTF','LTF'].forEach(g=>{ if(form.querySelector('.tj-tf-in[name="tf_'+g.toLowerCase()+'"]:checked')) return; const el=l[g] && document.getElementById(g.toLowerCase()+'_'+l[g]); if(el) el.checked=true; }); }
  // กดซ้ำที่ปุ่มที่เลือกอยู่ = ยกเลิกการเลือก
  let was=null;
  form.querySelectorAll('.tj-tf').forEach(lb=>{
    lb.addEventListener('pointerdown',()=>{ const i=document.getElementById(lb.htmlFor); was = i && i.checked ? i : null; });
    lb.addEventListener('click',e=>{ const i=document.getElementById(lb.htmlFor); if(i && was===i){ e.preventDefault(); i.checked=false; was=null; i.dispatchEvent(new Event('change',{bubbles:true})); } });
  });
  form.addEventListener('change',e=>{ const t=e.target; if(!t.classList || !t.classList.contains('tj-tf-in')) return;
    const l=last(); const g=t.name==='tf_htf'?'HTF':'LTF'; if(t.checked) l[g]=t.value.split(':')[1]; else delete l[g];
    try{ localStorage.setItem(KEY, JSON.stringify(l)); }catch(_){} });
  form.addEventListener('reset',()=>setTimeout(()=>{ if(!(window.tjIsEditing && window.tjIsEditing())) applyDefault(); },0));
  applyDefault();
})();

