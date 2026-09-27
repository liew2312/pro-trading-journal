(async function() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.SUPABASE_CONFIG;
  const sbAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window._signInWithGoogle = async function() {
    const { error } = await sbAuth.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
  };

  window._signOut = async function() {
    if (!confirm('ออกจากระบบ?')) return;
    await sbAuth.auth.signOut();
    window.location.reload();
  };

  // เช็ค session
  const { data: { session } } = await sbAuth.auth.getSession();
  
  document.getElementById('_authLoading').style.display = 'none';

  if (!session) {
    document.getElementById('_loginScreen').style.display = 'flex';
    // ซ่อนแอพ
    document.querySelectorAll('body > *:not(#_loginScreen):not(#_authLoading):not(script):not(link)').forEach(el => {
      if (el.id !== '_loginScreen' && el.id !== '_authLoading') el.style.display = 'none';
    });
    return;
  }

  // login แล้ว → เก็บ user_id ไว้
  window._currentUserId = session.user.id;
  window._currentUserEmail = session.user.email;
  window._currentUserName = session.user.user_metadata?.full_name || session.user.email;
  window._currentUserPicture = session.user.user_metadata?.avatar_url || null;

  // ใช้ access_token แทน anon key สำหรับทุก request
  const newClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + session.access_token } }
  });
  // override sb ใน scope หลัก
  if (window.api && window.api._setSupabaseClient) {
    window.api._setSupabaseClient(newClient);
  }

  // นำข้อมูลโปรไฟล์ไปแสดงใน Settings Modal
  setTimeout(function() {
    const profileArea = document.getElementById('userProfileArea');
    if (profileArea) {
      profileArea.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center">
          ${window._currentUserPicture ? `<img src="${window._currentUserPicture}" style="width:80px;height:80px;border-radius:50%;object-fit:cover; border: 3px solid #E4E1D8; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" referrerpolicy="no-referrer">` : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg, #1E1E24, #131317);color:white;display:flex;align-items:center;justify-content:center;font-weight:700; font-size: 2rem; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">${(window._currentUserName||'U').charAt(0).toUpperCase()}</div>`}
          <h5 class="fw-bold text-dark mb-1">${window._currentUserName}</h5>
          <span class="text-muted small">${window._currentUserEmail || ''}</span>
          <div class="badge bg-success mt-3 px-3 py-2 rounded-pill"><i class="fa-solid fa-circle-check me-1"></i> เชื่อมต่อบัญชีแล้ว</div>
        </div>
      `;
    }
  }, 500);
})();

