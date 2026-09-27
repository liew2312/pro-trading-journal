(function(){
  const KEY='tj_avatar';
  const ls={ get(){ try{ return localStorage.getItem(KEY)||''; }catch(e){ return ''; } }, set(v){ try{ v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY); }catch(e){} } };
  let client=null;
  function sb(){ if(client) return client; try{ const c=window.SUPABASE_CONFIG; client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY); }catch(e){} return client; }
  // ค่า: '' = อัตโนมัติ (รูป Google ถ้ามี) · 'icon' = ไอคอน · URL/dataURL = รูปที่อัปโหลด
  function current(){ const v=ls.get(); if(v==='icon') return ''; if(v) return v; return window._currentUserPicture||''; }
  const escA=s=>String(s).replace(/"/g,'&quot;');
  window.tjAvatarHTML=function(){
    const src=current();
    return `<button type="button" class="tj-av" id="tj-av-btn" title="โปรไฟล์ · ตั้งค่า" aria-label="เปิดตั้งค่าโปรไฟล์">${src?`<img src="${escA(src)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:'<i class="fa-solid fa-seedling main"></i>'}</button>`;
  };
  function refresh(){
    const b=document.getElementById('tj-av-btn');
    if(b){ const t=document.createElement('div'); t.innerHTML=window.tjAvatarHTML(); b.replaceWith(t.firstElementChild); }
    renderProfile();
  }
  async function saveRemote(v){
    try{ const a=sb(); if(a && !/^data:/.test(v)) await a.auth.updateUser({ data:{ tj_avatar:v } }); }catch(e){ console.warn('[avatar] save',e); }
  }
  async function loadRemote(){
    try{ const a=sb(); if(!a) return; const { data }=await a.auth.getUser(); const v=data&&data.user&&data.user.user_metadata&&data.user.user_metadata.tj_avatar;
      if(typeof v==='string' && v!==ls.get() && !/^data:/.test(ls.get()||'x')){ ls.set(v); refresh(); } }catch(e){}
  }
  // ย่อรูปเป็นสี่เหลี่ยมจัตุรัส (crop กลาง)
  function squareJpeg(file,size){
    return new Promise((res,rej)=>{
      const img=new Image(); const url=URL.createObjectURL(file);
      img.onload=()=>{ const m=Math.min(img.width,img.height); const c=document.createElement('canvas'); c.width=c.height=size;
        c.getContext('2d').drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,size,size); URL.revokeObjectURL(url);
        c.toBlob(b=>b?res({blob:b,data:c.toDataURL('image/jpeg',.82)}):rej(new Error('encode')),'image/jpeg',.85); };
      img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('ไฟล์นี้ไม่ใช่รูปภาพ')); };
      img.src=url;
    });
  }
  async function upload(file){
    const btn=document.getElementById('tj-av-btn'); if(btn) btn.classList.add('busy');
    try{
      const sq=await squareJpeg(file,256);
      let v='';
      try{
        const a=sb(); const { data }=await a.auth.getUser(); const uid=(data&&data.user&&data.user.id)||'me';
        const path=`avatars/${uid}_${Date.now()}.jpg`; const bucket=window.SUPABASE_CONFIG.STORAGE_BUCKET;
        const { error }=await a.storage.from(bucket).upload(path,sq.blob,{ contentType:'image/jpeg', upsert:true });
        if(error) throw error;
        v=a.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }catch(e){ console.warn('[avatar] upload',e); }
      if(v){ ls.set(v); await saveRemote(v); }
      else { const small=await squareJpeg(file,128); ls.set(small.data); toast('บันทึกรูปไว้ในเครื่องนี้เท่านั้น (อัปโหลดขึ้นบัญชีไม่สำเร็จ)'); }
      refresh();
    }catch(e){ toast(e.message||'เปลี่ยนรูปไม่สำเร็จ'); }
    finally{ const b=document.getElementById('tj-av-btn'); if(b) b.classList.remove('busy'); }
  }
  function toast(m){ const o=document.querySelector('.tj-toast'); if(o) o.remove(); const t=document.createElement('div'); t.className='tj-toast'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),3500); }
  function pick(){ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=()=>{ if(i.files[0]) upload(i.files[0]); }; i.click(); }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#tj-av-btn');
    if(b){ e.preventDefault(); const m=document.getElementById('settingsModal'); if(m && window.bootstrap) bootstrap.Modal.getOrCreateInstance(m).show(); return; }
  });
  // ── ตัวแก้ไขโปรไฟล์ในหน้าตั้งค่า ──
  const NKEY='tj_name';
  const getName=()=>{ try{ return localStorage.getItem(NKEY)||''; }catch(e){ return ''; } };
  const setName=v=>{ try{ v?localStorage.setItem(NKEY,v):localStorage.removeItem(NKEY); }catch(e){} };
  const escH=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function defaultName(){ return String(window._currentUserName||'Trader').split(/[\s@]/)[0]; }
  function renderProfile(){
    const host=document.getElementById('userProfileArea'); if(!host) return;
    if(!window._currentUserEmail && !window._currentUserName) return;
    const src=current(), v=ls.get(), g=window._currentUserPicture;
    const nameInp=document.getElementById('tj-prof-name');
    const typing = nameInp && document.activeElement===nameInp ? nameInp.value : null;
    host.innerHTML=`<div class="tj-prof">
      <div class="tj-prof-av" id="tj-prof-av">${src?`<img src="${escA(src)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:'<i class="fa-solid fa-seedling"></i>'}</div>
      <div class="tj-prof-btns">
        <button type="button" class="tj-prof-btn main" data-act="pick"><i class="fa-solid fa-camera"></i> เปลี่ยนรูป</button>
        ${g && v && v!==g ? '<button type="button" class="tj-prof-btn" data-act="google"><i class="fa-brands fa-google"></i> ใช้รูป Google</button>' : ''}
        ${src ? '<button type="button" class="tj-prof-btn" data-act="icon"><i class="fa-solid fa-seedling"></i> ใช้ไอคอน</button>' : ''}
      </div>
      <div class="tj-prof-field">
        <label for="tj-prof-name">ชื่อที่แสดงบนหน้าแรก</label>
        <div class="d-flex gap-2"><input type="text" class="form-control" id="tj-prof-name" maxlength="30" placeholder="${escH(defaultName())}" value="${escH(typing!=null?typing:getName())}"><button type="button" class="btn btn-primary px-3" id="tj-prof-save">บันทึก</button></div>
      </div>
      <div class="tj-prof-mail"><i class="fa-regular fa-envelope me-1"></i>${escH(window._currentUserEmail||'')} <span class="tj-prof-ok"><i class="fa-solid fa-circle-check"></i> เชื่อมต่อบัญชีแล้ว</span></div>
    </div>`;
    host.querySelectorAll('.tj-prof-btn').forEach(b=>b.onclick=()=>{
      const a=b.dataset.act;
      if(a==='pick') pick();
      else if(a==='google'){ ls.set(''); saveRemote(''); refresh(); }
      else if(a==='icon'){ ls.set('icon'); saveRemote('icon'); refresh(); }
    });
    const save=async()=>{ const n=(document.getElementById('tj-prof-name').value||'').trim().slice(0,30); setName(n);
      try{ const a=sb(); if(a) await a.auth.updateUser({ data:{ tj_name:n } }); }catch(e){}
      rerenderHello(); toast(n?'บันทึกชื่อแล้ว ✓':'ใช้ชื่อจากบัญชี Google'); };
    document.getElementById('tj-prof-save').onclick=save;
    document.getElementById('tj-prof-name').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); save(); } };
  }
  function rerenderHello(){ document.dispatchEvent(new CustomEvent('tj:hello')); }
  (async function loadName(){ try{ const a=sb(); if(!a) return; const { data }=await a.auth.getUser(); const n=data&&data.user&&data.user.user_metadata&&data.user.user_metadata.tj_name; if(typeof n==='string' && n!==getName()){ setName(n); rerenderHello(); renderProfile(); } }catch(e){} })();
  const sm=document.getElementById('settingsModal'); if(sm) sm.addEventListener('show.bs.modal',renderProfile);
  setTimeout(renderProfile,700); setTimeout(renderProfile,2500);
  refresh(); setTimeout(()=>{ refresh(); loadRemote(); },1500);
  document.addEventListener('tj:rows',()=>setTimeout(refresh,50));
})();

