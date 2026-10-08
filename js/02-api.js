(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET, TABLE_NAME } = window.SUPABASE_CONFIG;
  let sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // เผื่อให้ auth module เปลี่ยน client (พร้อม access token) ได้
  if (!window.api) window.api = {};
  window.api._setSupabaseClient = function(newClient) { sb = newClient; };

  /* ---------- helper: ย่อ/บีบอัดภาพกราฟก่อนอัปโหลด (v63) ----------
     ภาพแคปหน้าจอ PNG มักใหญ่ 1–3 MB → แปลงเป็น WebP (หรือ JPEG ถ้าเครื่องไม่รองรับ) ด้านยาวสุด 1920px
     เหลือราว 150–300 KB · ถ้าบีบแล้วไม่เล็กลง ใช้ไฟล์เดิม */
  async function compressImage(blob) {
    try {
      if (!blob || !/^image\/(png|jpe?g|webp|bmp)$/i.test(blob.type || "") || blob.size < 250 * 1024) return blob;
      const url = URL.createObjectURL(blob);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      URL.revokeObjectURL(url);
      const MAX = 1920, k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, w, h);
      let out = await new Promise(r => cv.toBlob(r, "image/webp", 0.86));
      if (!out || out.type !== "image/webp") out = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.88));
      return (out && out.size < blob.size) ? out : blob;
    } catch (e) { console.warn("compressImage", e); return blob; }
  }

  /* ---------- helper: อัปโหลดไฟล์ขึ้น Supabase Storage ---------- */
  async function uploadImageToStorage(fileObj) {
    if (!fileObj || !fileObj.data) return "";
    try {
      // แปลง base64 -> Blob
      const byteChars = atob(fileObj.data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const raw  = new Blob([byteArray], { type: fileObj.mimeType || "image/png" });
      const blob = await compressImage(raw);

      // ตั้งชื่อไฟล์ไม่ให้ซ้ำ
      const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };
      const ext = blob !== raw ? (EXT[blob.type] || "jpg")
                : ((fileObj.name && fileObj.name.includes(".")) ? fileObj.name.split(".").pop() : "png");
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `charts/${fileName}`;

      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, blob, {
        contentType: blob.type || fileObj.mimeType || "image/png",
        upsert: false
      });
      if (error) { console.error("Upload error:", error); return ""; }

      const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      return urlData.publicUrl || "";
    } catch (e) {
      console.error("uploadImageToStorage error:", e);
      return "";
    }
  }

  /* ---------- saveTradeData ---------- */
  async function buildTradeRow(data) {
    let beforeUrl = data.chartBeforeUrl || "";
    let afterUrl  = data.chartAfterUrl  || "";

    if (data.fileBeforeObj) {
      const url = await uploadImageToStorage(data.fileBeforeObj);
      if (url) beforeUrl = url;
    }
    if (data.fileAfterObj) {
      const url = await uploadImageToStorage(data.fileAfterObj);
      if (url) afterUrl = url;
    }
    // ภาพ HTF (v63) — มีเฉพาะเมื่อมาจากฟอร์มที่มีช่องนี้ จะได้ไม่ลบค่าเดิมโดยไม่ตั้งใจ
    const hasHtf = Object.prototype.hasOwnProperty.call(data, "chartHtfUrl") || !!data.fileHtfObj;
    let htfUrl = data.chartHtfUrl || "";
    if (window._tjHtfCol === false && (htfUrl || data.fileHtfObj)) {
      // ฐานข้อมูลยังไม่มีคอลัมน์ chart_htf → ไม่อัปโหลดให้เปลืองพื้นที่ แจ้งผู้ใช้แทน
      try { document.dispatchEvent(new CustomEvent("tj:htfcol", { detail: { lost: true } })); } catch (e) {}
      data.fileHtfObj = null;
    }
    if (data.fileHtfObj) {
      const url = await uploadImageToStorage(data.fileHtfObj);
      if (url) htfUrl = url;
    }

    // โหมดบันทึกด่วน: ช่องวินัยที่ไม่ได้กรอก = "-" (ไม่นับในคะแนนวินัย) ยกเว้นที่ระบบตรวจพบเอง
    const quick = String(data.emotion || "") === "QUICK";
    const priceInZone   = quick ? "-" : (data.priceInZone   ? "Yes" : "No");
    const confirmed     = quick ? "-" : (data.confirmation  ? "Yes" : "No");
    const violatedRule  = quick ? "-" : ((priceInZone === "No" || confirmed === "No") ? "Yes" : "No");
    const followedPlan  = quick ? "-" : (data.followedPlan  ? "Yes" : "No");
    const overtrade     = data.overtrade ? "Yes" : (quick ? "-" : "No");
    const revenge       = data.revenge   ? "Yes" : (quick ? "-" : "No");
    const lotRespected  = data.lotRespected  ? "Yes" : "No";

    const ent  = parseFloat(data.entryPrice);
    const sl   = parseFloat(data.slPrice);
    const lots = parseFloat(data.lots);
    const pnl  = parseFloat(data.pnl);
    const riskAmt = parseFloat(data.riskAmount); // Risk$ ที่ user กรอก

    // R-Multiple = Net P/L ÷ Risk$  (สูตรถูกต้อง)
    let rMult = null;
    if (!isNaN(pnl) && !isNaN(riskAmt) && riskAmt > 0) {
      rMult = parseFloat((pnl / riskAmt).toFixed(2));
    }

    const row = {
      symbol:        String(data.symbol || "").toUpperCase().trim(),
      type:          data.type,
      lots:          isFinite(lots) ? lots : null,
      pnl:           isFinite(pnl) ? pnl : null,
      notes:         data.notes || "",
      chart_before:  beforeUrl,
      chart_after:   afterUrl,
      ...((hasHtf && window._tjHtfCol !== false) ? { chart_htf: htfUrl } : {}),
      setup:         data.setup    || "",
      grade:         data.grade    || "",
      emotion:       data.emotion  || "",
      mae:           data.mae ? parseFloat(data.mae) : null,
      mfe:           data.mfe ? parseFloat(data.mfe) : null,
      session:       data.session  || "",
      entry_price:   isFinite(ent) ? ent : null,
      sl_price:      isFinite(sl)  ? sl  : null,
      tp_price:      data.tpPrice ? parseFloat(data.tpPrice) : null,
      outcome:       data.outcome  || "",
      price_in_zone: priceInZone,
      confirmation:  confirmed,
      violated_rule: violatedRule,
      followed_plan: followedPlan,
      overtrade:     overtrade,
      revenge:       revenge,
      lot_respected: lotRespected,
      market_context: data.marketContext || "",
      confidence:    data.confidence  || "",
      confluences:   data.confluences || "",
      entry_time:    data.entryTime   || "",
      exit_time:     data.exitTime    || "",
      r_mult:        rMult,
      user_id:       window._currentUserId || null
    };

    // วันที่เทรด (+ เวลาเข้า) → created_at เพื่อให้ปฏิทิน/เซสชัน/สถิติตามเวลาถูกต้อง แม้บันทึกย้อนหลัง
    if (data.tradeDate && /^\d{4}-\d{2}-\d{2}$/.test(data.tradeDate)) {
      const [yy, mm, dd] = data.tradeDate.split("-").map(Number);
      const tm = /^(\d{1,2}):(\d{2})/.exec(String(data.entryTime || ""));
      const now = new Date();
      const d = tm ? new Date(yy, mm - 1, dd, +tm[1], +tm[2], 0)
                   : new Date(yy, mm - 1, dd, now.getHours(), now.getMinutes(), now.getSeconds());
      if (!isNaN(d)) row.created_at = d.toISOString();
    }
    return row;
  }

  // ถ้าฐานข้อมูลยังไม่มีคอลัมน์ chart_htf → บันทึกต่อได้โดยตัดภาพ HTF ออก แล้วแจ้งวิธีเพิ่มคอลัมน์
  function dropMissingCol(row, error) {
    const msg = String((error && error.message) || "");
    if (row.created_at && /created_at/i.test(msg)) { delete row.created_at; return true; }
    if ("chart_htf" in row && /chart_htf/i.test(msg)) {
      const lost = !!row.chart_htf; delete row.chart_htf; window._tjHtfCol = false;
      try { document.dispatchEvent(new CustomEvent("tj:htfcol", { detail: { lost } })); } catch (e) {}
      return true;
    }
    return false;
  }

  async function saveTradeData(data) {
    const row = await buildTradeRow(data);
    let { error } = await sb.from(TABLE_NAME).insert(row);
    for (let k = 0; error && k < 2 && dropMissingCol(row, error); k++) ({ error } = await sb.from(TABLE_NAME).insert(row));
    if (error) throw new Error(error.message);
    return true;
  }

  /* ---------- updateTradeData: แก้ไขออเดอร์ที่บันทึกไว้ ---------- */
  async function updateTradeData(id, data) {
    const row = await buildTradeRow(data);
    delete row.user_id;
    let q = sb.from(TABLE_NAME).update(row).eq("id", id);
    if (window._currentUserId) q = q.eq("user_id", window._currentUserId);
    let { error } = await q;
    for (let k = 0; error && k < 2 && dropMissingCol(row, error); k++) {
      q = sb.from(TABLE_NAME).update(row).eq("id", id);
      if (window._currentUserId) q = q.eq("user_id", window._currentUserId);
      ({ error } = await q);
    }
    if (error) throw new Error(error.message);
    return true;
  }

  /* ---------- saveFundingData ---------- */
  async function saveFundingData(formObject) {
    let amount = parseFloat(formObject.amount);
    if (formObject.fundType === "Withdraw") amount = -Math.abs(amount);

    const row = {
      symbol: "FUNDING",
      type:   formObject.fundType,                  // Deposit หรือ Withdraw
      lots:   null,
      pnl:    isFinite(amount) ? amount : 0,
      notes:  formObject.fundNotes || "",
      price_in_zone: "-", confirmation: "-", violated_rule: "-",
      followed_plan: "-", overtrade: "-", revenge: "-", lot_respected: "-",
      user_id: window._currentUserId || null
    };
    const { error } = await sb.from(TABLE_NAME).insert(row);
    if (error) throw new Error(error.message);
    return true;
  }

  /* ---------- helper: ดึงทุกแถวเรียงจากเก่าไปใหม่ ---------- */
  // ออเดอร์ที่ยังเปิดอยู่ (outcome = OPEN) ไม่นับในสถิติ/ประวัติ — แยกไว้ที่ window._tjOpenRows
  const isOpenRow = r => String(r.outcome||'') === 'OPEN' && (r.type === 'Buy' || r.type === 'Sell');
  const isMissedRow = r => String(r.outcome||'') === 'MISSED';
  const isSideRow = r => isOpenRow(r) || isMissedRow(r);   // ไม่นับในสถิติ
  async function fetchAllRows(includeOpen) {
    const all = await fetchAllRowsRaw();
    window._tjOpenRows = all.filter(isOpenRow);
    window._tjMissedRows = all.filter(isMissedRow);
    if (all.length) { const had = window._tjHtfCol; window._tjHtfCol = Object.prototype.hasOwnProperty.call(all[0], 'chart_htf');
      if (had !== window._tjHtfCol) try{ document.dispatchEvent(new CustomEvent('tj:htfcol', { detail: { lost:false } })); }catch(e){} }
    try{ document.dispatchEvent(new CustomEvent('tj:open')); }catch(e){}
    return includeOpen === true ? all : all.filter(r => !isSideRow(r));
  }
  async function fetchAllRowsRaw() {
    // Supabase default limit 1000; ถ้ามีเยอะกว่านั้นวนดึงเพิ่ม
    const all = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from(TABLE_NAME)
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  /* ---------- Backup / Import / Clear (Settings > ข้อมูล) ---------- */
  async function exportDataCSV(){
    try{
      var rows = await fetchAllRows(true);
      if(!rows.length){ alert('ยังไม่มีข้อมูลให้สำรอง'); return; }
      var cols = Object.keys(rows[0]);
      var esc = function(v){ if(v===null||v===undefined) return ''; var s=String(v).replace(/"/g,'""'); return /[",\n\r]/.test(s)?'"'+s+'"':s; };
      var lines = [cols.join(',')];
      rows.forEach(function(r){ lines.push(cols.map(function(c){ return esc(r[c]); }).join(',')); });
      var blob = new Blob(["﻿"+lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
      var url = URL.createObjectURL(blob); var a=document.createElement('a'); var d=new Date();
      var pad = function(n){ return (n<10?'0':'')+n; };
      a.href=url; a.download='trading-journal-backup-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); },1000);
    }catch(e){ alert('สำรองข้อมูลไม่สำเร็จ: '+(e.message||e)); }
  }
  function _parseCSV(text){
    text=text.replace(/^﻿/,''); var rows=[],cur=[],field='',inQ=false;
    for(var i=0;i<text.length;i++){ var c=text[i];
      if(inQ){ if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; } else field+=c; }
      else { if(c==='"') inQ=true; else if(c===','){ cur.push(field); field=''; } else if(c==='\n'){ cur.push(field); field=''; rows.push(cur); cur=[]; } else if(c==='\r'){} else field+=c; } }
    if(field!==''||cur.length){ cur.push(field); rows.push(cur); }
    if(rows.length<2) return [];
    var header=rows[0], out=[];
    for(var j=1;j<rows.length;j++){ if(rows[j].length===1&&rows[j][0]==='') continue; var o={}; header.forEach(function(h,k){ o[h]=rows[j][k]!==undefined?rows[j][k]:''; }); out.push(o); }
    return out;
  }
  async function importData(){
    var inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,text/csv';
    inp.onchange=async function(){
      var file=inp.files&&inp.files[0]; if(!file) return;
      try{
        var text=await file.text(); var records=_parseCSV(text);
        if(!records.length){ alert('ไม่พบข้อมูลในไฟล์ CSV'); return; }
        if(!confirm('นำเข้า '+records.length+' รายการเข้าสู่พอร์ต? (ข้อมูลเดิมจะยังอยู่)')) return;
        var numCols=['lots','pnl','mae','mfe','entry_price','sl_price','tp_price','r_mult'];
        var clean=records.map(function(r){ var o={}; Object.keys(r).forEach(function(k){ if(k!=='id'&&k!=='created_at') o[k]=r[k]; });
          numCols.forEach(function(k){ if(o[k]===''||o[k]===undefined) o[k]=null; else { var n=parseFloat(o[k]); o[k]=isNaN(n)?null:n; } });
          o.user_id=window._currentUserId||o.user_id||null; return o; });
        var res=await sb.from(TABLE_NAME).insert(clean);
        if(res.error) throw new Error(res.error.message);
        alert('นำเข้าสำเร็จ '+clean.length+' รายการ'); location.reload();
      }catch(e){ alert('นำเข้าไม่สำเร็จ: '+(e.message||e)); }
    };
    inp.click();
  }
  async function clearAllData(){
    if(!confirm('⚠️ ลบข้อมูลการเทรดทั้งหมดถาวร? การกระทำนี้ย้อนกลับไม่ได้')) return;
    if(!confirm('ยืนยันอีกครั้ง — ต้องการลบข้อมูลทั้งหมดจริงหรือไม่?')) return;
    try{
      var q=sb.from(TABLE_NAME).delete();
      if(window._currentUserId) q=q.eq('user_id', window._currentUserId); else q=q.not('id','is',null);
      var res=await q; if(res.error) throw new Error(res.error.message);
      alert('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว'); location.reload();
    }catch(e){ alert('ลบไม่สำเร็จ: '+(e.message||e)); }
  }
  window.exportDataCSV=exportDataCSV; window.importData=importData; window.clearAllData=clearAllData;

  /* ---------- getDashboardMetrics ---------- */
  async function getDashboardMetrics(filterMonth, filterYear) {
    const rows = await fetchAllRows();

    const result = {
      trades: 0, winRate: 0, totalPnl: 0, profitFactor: 0, maxDrawdown: 0,
      avgRR: 0, expectancy: 0, disciplineScore: 100,
      balance: "0.00", totalDeposit: "0.00", totalWithdraw: "0.00",
      avgMae: "0.00", avgMfe: "0.00", avgR: "0.00",
      dailyStats: {}, pairStats: {}, setupStats: {}, sessionStats: {},
      outcomeStats: { tp: "0.0", sl: "0.0", be: "0.0", mWin: "0.0", mLoss: "0.0" },
      equityLabels: [], equityData: [], aiInsights: []
    };
    if (rows.length === 0) {
      result.aiInsights.push({ icon: "fa-chart-column", type: "info", text: "ระบบต้องการข้อมูลการเทรดอย่างน้อย 5 ออเดอร์เพื่อใช้ AI วิเคราะห์จุดแข็งจุดอ่อน" });
      return result;
    }

    let wins = 0, grossProfit = 0, grossLoss = 0, totalPnl = 0, totalTrades = 0;
    let totalDeposits = 0, totalWithdrawals = 0;
    const dailyStatsMap = {}, pairStatsMap = {}, setupStatsMap = {}, sessionStatsMap = {};
    const outcomes = { TP: 0, SL: 0, BE: 0, ManualWin: 0, ManualLoss: 0 };
    const equityLabels = [], equityData = [];
    let currentBalance = 0;

    let disciplinePoints = 0, totalPossiblePoints = 0;
    let overtradeCount = 0, revengeCount = 0;
    let totalMae = 0, maeCount = 0, totalMfe = 0, mfeCount = 0, totalR = 0, rCount = 0;

    // ── (ใหม่) ตัวสะสมสำหรับ metric เชิงลึก + ข้อมูลกราฟวิเคราะห์ ──
    let grossProfitCount = 0;               // = wins (นับซ้ำเพื่อความชัด)
    let largestWin = 0, largestLoss = 0;    // ไม้กำไร/ขาดทุนสูงสุด
    let curWinStreak = 0, curLossStreak = 0, longestWinStreak = 0, longestLossStreak = 0;
    let holdSum = 0, holdCount = 0;         // เวลาถือครองเฉลี่ย (นาที)
    const rBuckets = { "≤-2R":0, "-2..-1R":0, "-1..0R":0, "0..1R":0, "1..2R":0, "2..3R":0, ">3R":0 };
    const behaviorMap = {};                 // tag/behavior leaderboard: {key:{pnl,trades,wins}}
    const addBehavior = (key, pnlv) => {
      if (!key) return;
      if (!behaviorMap[key]) behaviorMap[key] = { pnl:0, trades:0, wins:0 };
      behaviorMap[key].pnl += pnlv; behaviorMap[key].trades++; if (pnlv > 0) behaviorMap[key].wins++;
    };

    // ── (ใหม่) global cross-filter: preset วันที่ / symbol / setup / side ──
    const gf = window._globalFilter || null;
    let dateCutoff = null;
    if (gf && gf.preset && gf.preset !== "all") {
      const now = new Date();
      if (gf.preset === "ytd") dateCutoff = new Date(now.getFullYear(), 0, 1);
      else {
        const days = { "7d":7, "30d":30, "90d":90, "1y":365 }[gf.preset];
        if (days) { dateCutoff = new Date(now); dateCutoff.setDate(dateCutoff.getDate() - days); }
      }
    }

    for (const r of rows) {
      const rawDate = new Date(r.created_at);
      const m = rawDate.getMonth() + 1;
      const y = rawDate.getFullYear();
      const dateStr = ("0" + rawDate.getDate()).slice(-2) + "/" + ("0" + m).slice(-2)
                    + " " + ("0" + rawDate.getHours()).slice(-2) + ":" + ("0" + rawDate.getMinutes()).slice(-2);
      const symbol = String(r.symbol || "").toUpperCase().trim();
      const type = String(r.type || "").trim();
      const pnlOrAmount = parseFloat(r.pnl);
      if (isNaN(pnlOrAmount)) continue;

      if (type === "Deposit") {
        totalDeposits += pnlOrAmount; currentBalance += pnlOrAmount;
      } else if (type === "Withdraw") {
        totalWithdrawals += Math.abs(pnlOrAmount); currentBalance -= Math.abs(pnlOrAmount);
      } else {
        currentBalance += pnlOrAmount;
      }

      let isMatch = true;
      if (filterMonth && filterMonth !== "all" && m != filterMonth) isMatch = false;
      if (filterYear  && filterYear  !== "all" && y != filterYear)  isMatch = false;
      // global cross-filter
      if (gf) {
        if (dateCutoff && rawDate < dateCutoff) isMatch = false;
        if (type === "Buy" || type === "Sell") {
          if (gf.symbols && gf.symbols.length && !gf.symbols.includes(symbol)) isMatch = false;
          if (gf.setups && gf.setups.length && !gf.setups.includes(String(r.setup || "").trim())) isMatch = false;
          if (gf.side === "long"  && type !== "Buy")  isMatch = false;
          if (gf.side === "short" && type !== "Sell") isMatch = false;
        }
      }
      if (!isMatch) continue;

      if (type === "Deposit" || type === "Withdraw") {
        equityLabels.push(dateStr); equityData.push(currentBalance.toFixed(2));
        continue;
      }

      if ((type === "Buy" || type === "Sell") && symbol !== "") {
        totalTrades++; totalPnl += pnlOrAmount;
        equityLabels.push(dateStr); equityData.push(currentBalance.toFixed(2));

        const setup   = r.setup   ? String(r.setup).trim()   : "";
        const session = r.session ? String(r.session).trim() : "";
        const outcome = r.outcome ? String(r.outcome).trim() : "";

        const maeVal = parseFloat(r.mae);
        const mfeVal = parseFloat(r.mfe);
        const rVal   = parseFloat(r.r_mult);
        if (!isNaN(maeVal)) { totalMae += maeVal; maeCount++; }
        if (!isNaN(mfeVal)) { totalMfe += mfeVal; mfeCount++; }
        if (!isNaN(rVal))   { totalR   += rVal;   rCount++; }

        const fPlan  = r.followed_plan;
        const oTrade = r.overtrade;
        const rev    = r.revenge;
        const lResp  = r.lot_respected;

        if (fPlan !== undefined && fPlan !== "" && fPlan !== "-" && fPlan !== null) {
          totalPossiblePoints += 4;
          if (fPlan  === "Yes") disciplinePoints++;
          if (oTrade === "No")  disciplinePoints++; else if (oTrade === "Yes") overtradeCount++;
          if (rev    === "No")  disciplinePoints++; else if (rev    === "Yes") revengeCount++;
          if (lResp  === "Yes") disciplinePoints++;
        }

        if (!pairStatsMap[symbol]) pairStatsMap[symbol] = { trades: 0, wins: 0, pnl: 0 };
        pairStatsMap[symbol].trades++; pairStatsMap[symbol].pnl += pnlOrAmount;

        if (setup !== "") {
          if (!setupStatsMap[setup]) setupStatsMap[setup] = { trades: 0, wins: 0, pnl: 0 };
          setupStatsMap[setup].trades++; setupStatsMap[setup].pnl += pnlOrAmount;
        }
        if (session !== "") {
          if (!sessionStatsMap[session]) sessionStatsMap[session] = { trades: 0, wins: 0, pnl: 0 };
          sessionStatsMap[session].trades++; sessionStatsMap[session].pnl += pnlOrAmount;
        }

        if      (outcome === "TP") outcomes.TP++;
        else if (outcome === "SL") outcomes.SL++;
        else if (outcome === "BE") outcomes.BE++;
        else if (outcome === "Manual") {
          if      (pnlOrAmount > 0) outcomes.ManualWin++;
          else if (pnlOrAmount < 0) outcomes.ManualLoss++;
          else                       outcomes.BE++;
        }

        if (pnlOrAmount > 0) {
          wins++; grossProfit += pnlOrAmount;
          pairStatsMap[symbol].wins++;
          if (setup !== "")   setupStatsMap[setup].wins++;
          if (session !== "") sessionStatsMap[session].wins++;
        } else if (pnlOrAmount < 0) {
          grossLoss += Math.abs(pnlOrAmount);
        }

        const dateKey = y + "-" + String(m).padStart(2, "0") + "-" + String(rawDate.getDate()).padStart(2, "0");
        if (!dailyStatsMap[dateKey]) dailyStatsMap[dateKey] = { pnl: 0, count: 0 };
        dailyStatsMap[dateKey].pnl += pnlOrAmount;
        dailyStatsMap[dateKey].count++;

        // ── (ใหม่) metric เชิงลึก ──
        if (pnlOrAmount > largestWin)  largestWin  = pnlOrAmount;
        if (pnlOrAmount < largestLoss) largestLoss = pnlOrAmount;

        // streak (ไม้เรียงตามเวลาอยู่แล้ว)
        if (pnlOrAmount > 0) {
          curWinStreak++; curLossStreak = 0;
          if (curWinStreak > longestWinStreak) longestWinStreak = curWinStreak;
        } else if (pnlOrAmount < 0) {
          curLossStreak++; curWinStreak = 0;
          if (curLossStreak > longestLossStreak) longestLossStreak = curLossStreak;
        }

        // เวลาถือครอง (จาก entry_time / exit_time รูปแบบ HH:MM)
        const et = String(r.entry_time || "").trim(), xt = String(r.exit_time || "").trim();
        if (/^\d{1,2}:\d{2}/.test(et) && /^\d{1,2}:\d{2}/.test(xt)) {
          const [eh, emi] = et.split(":").map(Number), [xh, xmi] = xt.split(":").map(Number);
          let mins = (xh * 60 + xmi) - (eh * 60 + emi);
          if (mins < 0) mins += 24 * 60; // ข้ามวัน
          if (mins >= 0 && mins <= 24 * 60) { holdSum += mins; holdCount++; }
        }

        // R distribution
        if (!isNaN(rVal)) {
          if      (rVal <= -2) rBuckets["≤-2R"]++;
          else if (rVal <  -1) rBuckets["-2..-1R"]++;
          else if (rVal <   0) rBuckets["-1..0R"]++;
          else if (rVal <   1) rBuckets["0..1R"]++;
          else if (rVal <   2) rBuckets["1..2R"]++;
          else if (rVal <=  3) rBuckets["2..3R"]++;
          else                 rBuckets[">3R"]++;
        }

        // behavior / tag leaderboard
        if (setup)   addBehavior("Setup: " + setup, pnlOrAmount);
        if (session) addBehavior("Session: " + session, pnlOrAmount);
        if (r.market_context) addBehavior("ตลาด: " + r.market_context, pnlOrAmount);
        if (r.confidence)     addBehavior("มั่นใจ " + r.confidence + "★", pnlOrAmount);
        if (r.followed_plan === "No") addBehavior("ไม่ทำตามแผน", pnlOrAmount);
        if (r.followed_plan === "Yes") addBehavior("ทำตามแผน", pnlOrAmount);
        if (r.overtrade === "Yes") addBehavior("Overtrade", pnlOrAmount);
        if (r.revenge === "Yes")   addBehavior("Revenge", pnlOrAmount);
        if (r.lot_respected === "No") addBehavior("Over-lot", pnlOrAmount);
        String(r.confluences || "").split(",").map(s => s.trim()).filter(Boolean)
          .forEach(cf => { const m = /^(HTF|LTF):(\w+)$/.exec(cf); const q = { 'HITTP:Y':'ราคาวิ่งไปถึง TP (แต่ไม่ได้ชน TP)', 'HITTP:N':'ราคาไม่ถึง TP', 'HITSL:Y':'ราคาย้อนกลับมาชน SL', 'HITSL:N':'ราคาไม่ย้อนกลับมาชน SL' }[cf]; addBehavior(q ? q : m ? (m[1]==='HTF' ? 'TF วิเคราะห์ ' : 'TF เข้า ') + m[2] : "Confluence: " + cf, pnlOrAmount); });
      }
    }

    const wrDec   = totalTrades > 0 ? wins / totalTrades : 0;
    const avgWin  = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = (totalTrades - wins) > 0 ? grossLoss / (totalTrades - wins) : 0;
    const expectancy = (wrDec * avgWin) - ((1 - wrDec) * avgLoss);
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);

    // ── (ใหม่) Max Drawdown จาก equity curve (peak-to-trough) ──
    let mddAbs = 0, mddPct = 0, peakEq = -Infinity;
    for (const s of equityData) {
      const v = parseFloat(s);
      if (v > peakEq) peakEq = v;
      const dd = peakEq - v;
      if (dd > mddAbs) mddAbs = dd;
      if (peakEq > 0) { const p = (dd / peakEq) * 100; if (p > mddPct) mddPct = p; }
    }

    // ── (ใหม่) best / worst day ──
    let bestDay = { key: "", pnl: -Infinity }, worstDay = { key: "", pnl: Infinity };
    for (const k in dailyStatsMap) {
      if (dailyStatsMap[k].pnl > bestDay.pnl)  bestDay  = { key: k, pnl: dailyStatsMap[k].pnl };
      if (dailyStatsMap[k].pnl < worstDay.pnl) worstDay = { key: k, pnl: dailyStatsMap[k].pnl };
    }
    if (bestDay.pnl === -Infinity)  bestDay  = { key: "", pnl: 0 };
    if (worstDay.pnl === Infinity)  worstDay = { key: "", pnl: 0 };


    // ── (ใหม่) behavior / tag leaderboard ──
    const behaviorList = Object.keys(behaviorMap)
      .filter(k => behaviorMap[k].trades >= 2)
      .map(k => ({ key: k, pnl: +behaviorMap[k].pnl.toFixed(2), trades: behaviorMap[k].trades,
                   winRate: +((behaviorMap[k].wins / behaviorMap[k].trades) * 100).toFixed(0) }))
      .sort((a, b) => b.pnl - a.pnl);

    const insights = [];
    if (totalTrades > 5) {
      let bestSetup = ""; let maxSetupProfit = -Infinity;
      for (const s in setupStatsMap) {
        if (setupStatsMap[s].pnl > maxSetupProfit && setupStatsMap[s].trades > 1) {
          maxSetupProfit = setupStatsMap[s].pnl; bestSetup = s;
        }
      }
      if (bestSetup && maxSetupProfit > 0) insights.push({ icon: "fa-bullseye", type: "success", text: `Setup แบบ <b>${bestSetup}</b> ทำกำไรได้ดีที่สุด ($${maxSetupProfit.toFixed(2)}) ควรโฟกัสระบบนี้` });

      let worstSession = ""; let minSessionPnl = 0;
      for (const s in sessionStatsMap) {
        if (sessionStatsMap[s].pnl < minSessionPnl) { minSessionPnl = sessionStatsMap[s].pnl; worstSession = s; }
      }
      if (worstSession && minSessionPnl < 0) insights.push({ icon: "fa-arrow-trend-down", type: "warning", text: `คุณมักเสียเงินใน <b>${worstSession} Session</b> ($${minSessionPnl.toFixed(2)}) ควรลดความเสี่ยง` });

      if (revengeCount > 0)     insights.push({ icon: "fa-fire", type: "danger",  text: `คุณเทรดแบบ <b>Revenge (เอาคืน)</b> ถึง ${revengeCount} ครั้ง ระวังพอร์ตพังเพราะอารมณ์!` });
      if (overtradeCount >= 3)  insights.push({ icon: "fa-triangle-exclamation", type: "danger",  text: `พบพฤติกรรม <b>Overtrading</b> บ่อยครั้ง หากเสียติดกันควรพักทันที` });
      if (expectancy < 0)       insights.push({ icon: "fa-calculator", type: "warning", text: `<b>Expectancy ติดลบ ($${expectancy.toFixed(2)})</b> ในระยะยาวระบบนี้อาจขาดทุน ต้องปรับ RR หรือ Win Rate` });
      if (insights.length === 0) insights.push({ icon: "fa-gem", type: "success", text: "จิตวิทยาและการเทรดของคุณนิ่งมาก รักษาความมีวินัยแบบนี้ต่อไป!" });
    } else {
      insights.push({ icon: "fa-chart-column", type: "info", text: "ระบบต้องการข้อมูลการเทรดอย่างน้อย 5 ออเดอร์เพื่อใช้ AI วิเคราะห์จุดแข็งจุดอ่อน" });
    }

    return {
      balance: currentBalance.toFixed(2),
      totalDeposit:  totalDeposits.toFixed(2),
      totalWithdraw: totalWithdrawals.toFixed(2),
      trades: totalTrades,
      totalPnl: totalPnl.toFixed(2),
      winRate: (wrDec * 100).toFixed(2),
      profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? "∞" : 0),
      expectancy: expectancy.toFixed(2),
      disciplineScore: totalPossiblePoints > 0 ? Math.round((disciplinePoints / totalPossiblePoints) * 100) : 100,
      avgMae: maeCount > 0 ? (totalMae / maeCount).toFixed(2) : "0.00",
      avgMfe: mfeCount > 0 ? (totalMfe / mfeCount).toFixed(2) : "0.00",
      avgR:   rCount   > 0 ? (totalR   / rCount  ).toFixed(2) : "0.00",
      dailyStats:  dailyStatsMap,
      pairStats:   pairStatsMap,
      setupStats:  setupStatsMap,
      sessionStats: sessionStatsMap,
      outcomeStats: {
        tp:    totalTrades > 0 ? ((outcomes.TP         / totalTrades) * 100).toFixed(1) : "0.0",
        sl:    totalTrades > 0 ? ((outcomes.SL         / totalTrades) * 100).toFixed(1) : "0.0",
        be:    totalTrades > 0 ? ((outcomes.BE         / totalTrades) * 100).toFixed(1) : "0.0",
        mWin:  totalTrades > 0 ? ((outcomes.ManualWin  / totalTrades) * 100).toFixed(1) : "0.0",
        mLoss: totalTrades > 0 ? ((outcomes.ManualLoss / totalTrades) * 100).toFixed(1) : "0.0"
      },
      equityLabels: equityLabels,
      equityData:   equityData,
      aiInsights:   insights,

      // ── (ใหม่) metric เชิงลึก ──
      maxDrawdownAbs: mddAbs.toFixed(2),
      maxDrawdownPct: mddPct.toFixed(1),
      avgWin:         avgWin.toFixed(2),
      avgLoss:        avgLoss.toFixed(2),
      payoffRatio:    isFinite(payoffRatio) ? payoffRatio.toFixed(2) : "∞",
      largestWin:     largestWin.toFixed(2),
      largestLoss:    largestLoss.toFixed(2),
      longestWinStreak:  longestWinStreak,
      longestLossStreak: longestLossStreak,
      avgHoldMin:     holdCount > 0 ? Math.round(holdSum / holdCount) : null,
      bestDay:        bestDay,
      worstDay:       worstDay,

      // ── (ใหม่) ข้อมูลกราฟวิเคราะห์ ──
      rBuckets:       rBuckets,
      behaviorList:   behaviorList
    };
  }

  /* ---------- getTradeHistory ---------- */
  async function getTradeHistory(filterObj) {
    const rows = await fetchAllRows();
    if (!rows.length) return [];

    const fType = filterObj ? filterObj.type  : "all";
    const fVal  = filterObj ? filterObj.value : "";

    // เรียงจากใหม่ไปเก่าสำหรับการแสดงผล
    const sorted = rows.slice().reverse();
    const history = [];

    for (const r of sorted) {
      if (String(r.type || "") === "Review") continue;   // บันทึกทบทวนสัปดาห์ ไม่ใช่เทรด
      const dateObj = new Date(r.created_at);
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth() + 1;
      const d = dateObj.getDate();

      let isMatch = true;
      if (fType !== "all" && fVal) {
        if (fType === "day") {
          const dateStr = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          if (dateStr !== fVal) isMatch = false;
        } else if (fType === "month") {
          const monthStr = y + "-" + String(m).padStart(2, "0");
          if (monthStr !== fVal) isMatch = false;
        } else if (fType === "week") {
          const dObj = new Date(Date.UTC(y, dateObj.getMonth(), d));
          dObj.setUTCDate(dObj.getUTCDate() + 4 - (dObj.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(dObj.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((dObj - yearStart) / 86400000) + 1) / 7);
          const weekStr = dObj.getUTCFullYear() + "-W" + String(weekNo).padStart(2, "0");
          if (weekStr !== fVal) isMatch = false;
        }
      }
      if (!isMatch) continue;

      const formattedDate = ("0" + d).slice(-2) + "/" + ("0" + m).slice(-2)
                          + " " + ("0" + dateObj.getHours()).slice(-2) + ":" + ("0" + dateObj.getMinutes()).slice(-2);

      const pnlNum = parseFloat(r.pnl);
      history.push({
        id:          r.id,
        date:        formattedDate,
        symbol:      r.symbol || "",
        type:        r.type || "",
        lots:        r.lots != null ? r.lots : "-",
        pnl:         isFinite(pnlNum) ? pnlNum.toFixed(2) : "0.00",
        notes:       r.notes || "",
        chartBefore: r.chart_before || "",
        chartAfter:  r.chart_after  || "",
        chartHtf:    r.chart_htf    || "",
        setup:       r.setup    || "-",
        grade:       r.grade    || "-",
        emotion:     r.emotion  || "-",
        mae:         r.mae != null && r.mae !== "" ? r.mae : "-",
        mfe:         r.mfe != null && r.mfe !== "" ? r.mfe : "-",
        session:     r.session  || "-",
        entryPrice:  r.entry_price != null ? r.entry_price : "",
        slPrice:     r.sl_price    != null ? r.sl_price    : "",
        tpPrice:     r.tp_price    != null ? r.tp_price    : "",
        outcome:     r.outcome  || "-",
        priceInZone: r.price_in_zone || "-",
        confirmation: r.confirmation || "-",
        violatedRule: r.violated_rule || "No",
        followedPlan: r.followed_plan || "-",
        overtrade:    r.overtrade     || "-",
        revenge:      r.revenge       || "-",
        lotRespected: r.lot_respected || "-",
        marketContext: r.market_context || "-",
        confluences:  r.confluences || "",
        rMult:        r.r_mult != null ? r.r_mult : "-"
      });
    }
    return history;
  }

  /* ---------- export api + เลียนแบบ google.script.run ---------- */
  /* ---------- deleteTrade: ลบรายการเดียว ---------- */
  async function deleteTrade(id) {
    if (id === undefined || id === null || id === "") throw new Error("ไม่พบรหัสรายการ");
    let q = sb.from(TABLE_NAME).delete().eq("id", id);
    if (window._currentUserId) q = q.eq("user_id", window._currentUserId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return true;
  }

  /* ---------- insertRows / updateRow (นำเข้า MT5, ทบทวนสัปดาห์) ---------- */
  async function insertRows(rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).map(r => Object.assign({ user_id: window._currentUserId || null }, r));
    for (let i = 0; i < list.length; i += 200) {
      let chunk = list.slice(i, i + 200);
      let { error } = await sb.from(TABLE_NAME).insert(chunk);
      if (error && /created_at/i.test(error.message || "")) {
        chunk = chunk.map(r => { const o = Object.assign({}, r); delete o.created_at; return o; });
        ({ error } = await sb.from(TABLE_NAME).insert(chunk));
      }
      if (error) throw new Error(error.message);
    }
    return list.length;
  }
  async function updateRow(id, patch) {
    let q = sb.from(TABLE_NAME).update(patch).eq("id", id);
    if (window._currentUserId) q = q.eq("user_id", window._currentUserId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return true;
  }

  async function deleteMany(ids) {
    ids = (ids || []).filter(v => v !== null && v !== undefined && v !== "");
    for (let i = 0; i < ids.length; i += 200) {
      let q = sb.from(TABLE_NAME).delete().in("id", ids.slice(i, i + 200));
      if (window._currentUserId) q = q.eq("user_id", window._currentUserId);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }
    return ids.length;
  }

  window.api = { saveTradeData, updateTradeData, saveFundingData, getDashboardMetrics, getTradeHistory, getAllRows: fetchAllRows, deleteTrade, insertRows, updateRow, deleteMany };

  // Polyfill: ทำให้โค้ดเดิมที่เรียก google.script.run.xxx ใช้งานได้ทันที
  function makeRunner() {
    let onSuccess = null, onFailure = null;
    const runner = {
      withSuccessHandler(fn) { onSuccess = fn; return runner; },
      withFailureHandler(fn) { onFailure = fn; return runner; }
    };
    // wrap ทุก method ของ window.api ให้รองรับ pattern เดิม
    for (const key of Object.keys(window.api)) {
      runner[key] = function (...args) {
        window.api[key](...args)
          .then(res => { if (onSuccess) onSuccess(res); })
          .catch(err => {
            console.error(`[${key}] error:`, err);
            if (onFailure) onFailure(err); else alert("เกิดข้อผิดพลาด: " + (err.message || err));
          });
        return runner;
      };
    }
    return runner;
  }
  window.google = window.google || {};
  Object.defineProperty(window.google, "script", {
    get() { return { run: makeRunner() }; }
  });
})();

