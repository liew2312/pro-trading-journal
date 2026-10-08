let globalTradeHistory = []; let equityChartInstance = null; 

const quotes = [
  "วินัย คือสะพานเชื่อมระหว่างเป้าหมายกับความสำเร็จ",
  "ตลาดไม่ได้สนใจว่าคุณจะรู้สึกอย่างไร ทำตามแผนของคุณก็พอ",
  "เทรดเดอร์ที่เก่งที่สุด คือคนที่จัดการความเสี่ยงได้ดีที่สุด",
  "กำไรน้อยๆ แต่สม่ำเสมอ ดีกว่ากำไรก้อนโตแต่ต้องล้างพอร์ต",
  "อย่าพยายามเอาชนะตลาด แต่จงไหลไปตามสิ่งที่ตลาดทำ",
  "Cut your losses short and let your profits run."
];

document.addEventListener("DOMContentLoaded", function() { 
  document.getElementById('daily-quote').innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
  
  // ตั้งค่าเริ่มต้นของตัวกรองให้เป็น "วันนี้", "สัปดาห์นี้", "เดือนนี้"
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  document.getElementById('history-filter-day').value = `${yyyy}-${mm}-${dd}`;
  document.getElementById('history-filter-month').value = `${yyyy}-${mm}`;
  // ตั้งค่า filter เดือนปัจจุบันใน dashboard
  document.getElementById('filter-month').value = String(today.getMonth() + 1);
  
  // คำนวณ Week ปัจจุบัน (ISO Week)
  let dObj = new Date(Date.UTC(yyyy, today.getMonth(), today.getDate()));
  dObj.setUTCDate(dObj.getUTCDate() + 4 - (dObj.getUTCDay()||7));
  let yearStart = new Date(Date.UTC(dObj.getUTCFullYear(),0,1));
  let weekNo = Math.ceil(( ( (dObj - yearStart) / 86400000) + 1)/7);
  document.getElementById('history-filter-week').value = `${yyyy}-W${String(weekNo).padStart(2, '0')}`;
  
  loadAllData(); 
});

function switchTab(tabId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  // remove active from all nav buttons (icon-btn and app-icon)
  document.querySelectorAll('.nav-icon-btn.nav-link, .nav-app-icon.nav-link').forEach(el => el.classList.remove('active'));
  // activate matching buttons
  document.querySelectorAll(`[onclick="switchTab('${tabId}')"]`).forEach(el => el.classList.add('active'));
  document.getElementById(tabId).classList.add('active');
}

function loadAllData() {
  const filterMonth = document.getElementById('filter-month').value;
  const filterYear = document.getElementById('filter-year').value;
  
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  let headerText = "สรุปการเทรด (Trading Report) - ";
  if (filterMonth === "all") headerText += "สรุปรายปี " + (filterYear === "all" ? "ทั้งหมด" : filterYear);
  else headerText += monthNames[parseInt(filterMonth)-1] + " " + (filterYear === "all" ? "ทั้งหมด" : filterYear);
  document.getElementById('print-header-title').innerText = headerText;

  google.script.run.withSuccessHandler(updateDashboardUI).getDashboardMetrics(filterMonth, filterYear);
  loadHistoryData();
}

// ฟังก์ชันสลับการแสดงผลของช่อง Input ค้นหา
function toggleHistoryFilterInput() {
  let type = document.getElementById('history-filter-type').value;
  document.getElementById('history-filter-day').classList.add('d-none');
  document.getElementById('history-filter-week').classList.add('d-none');
  document.getElementById('history-filter-month').classList.add('d-none');
  
  if(type === 'day') document.getElementById('history-filter-day').classList.remove('d-none');
  else if(type === 'week') document.getElementById('history-filter-week').classList.remove('d-none');
  else if(type === 'month') document.getElementById('history-filter-month').classList.remove('d-none');
  
  loadHistoryData();
}

function loadHistoryData() {
  let type = document.getElementById('history-filter-type').value;
  let val = "";
  if(type === 'day') val = document.getElementById('history-filter-day').value;
  else if(type === 'week') val = document.getElementById('history-filter-week').value;
  else if(type === 'month') val = document.getElementById('history-filter-month').value;

  document.getElementById('history-table-body').innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-spinner fa-spin fs-4 mb-2 d-block"></i> กำลังโหลดประวัติ...</td></tr>`;
  document.getElementById('history-summary-footer').style.setProperty('display', 'none', 'important'); // ซ่อนแถบสรุประหว่างโหลด
  
  // ส่ง Object ไปให้ Code.gs แทน string เปล่าๆ
  google.script.run.withSuccessHandler(updateHistoryUI).getTradeHistory({type: type, value: val});
}

function updateDashboardUI(data) {
  document.getElementById('stat-balance').innerText = "$" + data.balance; 
  document.getElementById('stat-deposit').innerText = "$" + data.totalDeposit;
  document.getElementById('stat-withdraw').innerText = "$" + data.totalWithdraw;
  document.getElementById('stat-trades').innerText = data.trades;
  
  document.getElementById('stat-winrate').innerText = data.winRate + '%';
  document.getElementById('stat-expectancy').innerText = data.expectancy;
  document.getElementById('stat-pf').innerText = data.profitFactor;
  
  document.getElementById('stat-avg-mae').innerText = data.avgMae;
  document.getElementById('stat-avg-mfe').innerText = data.avgMfe;
  document.getElementById('stat-avg-r').innerText = data.avgR + "R";
  
  document.getElementById('stat-tp').innerText = data.outcomeStats.tp + '%';
  document.getElementById('stat-sl').innerText = data.outcomeStats.sl + '%';
  document.getElementById('stat-be').innerText = data.outcomeStats.be + '%';
  document.getElementById('stat-mwin').innerText = data.outcomeStats.mWin + '%';
  document.getElementById('stat-mloss').innerText = data.outcomeStats.mLoss + '%';

  let dScore = data.disciplineScore;
  let dRing = document.getElementById('stat-discipline');
  dRing.innerText = dScore;
  if(dScore >= 80) { dRing.style.borderColor = "#2F7A4F"; dRing.style.color = "#2F7A4F"; }
  else if(dScore >= 50) { dRing.style.borderColor = "#B5791A"; dRing.style.color = "#B5791A"; }
  else { dRing.style.borderColor = "#B93033"; dRing.style.color = "#B93033"; }

  const pnlEl = document.getElementById('stat-pnl');
  pnlEl.innerText = (data.totalPnl >= 0 ? "+$" : "-$") + Math.abs(data.totalPnl);
  pnlEl.style.color = data.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'; 
  
  let insightHtml = "";
  data.aiInsights.forEach(i => {
     let bgClass = i.type === 'danger' ? 'rgba(239, 68, 68, 0.08)' : (i.type==='warning'?'rgba(245, 158, 11, 0.08)':'rgba(16, 185, 129, 0.08)');
     let borderClass = i.type === 'danger' ? '#B93033' : (i.type==='warning'?'#B5791A':'#2F7A4F');
     insightHtml += `<div class="p-3 rounded-3 d-flex align-items-start shadow-sm" style="background: ${bgClass}; border-left: 5px solid ${borderClass};">${/^fa-/.test(i.icon) ? `<span class="tj-ico tj-ico-${i.type} me-3"><i class="fa-solid ${i.icon}"></i></span>` : `<div class="me-3 fs-5">${i.icon}</div>`}<div class="text-dark lh-base fw-medium" style="font-size:0.95rem;">${i.text}</div></div>`;
  });
  document.getElementById('ai-insights-container').innerHTML = insightHtml;

  renderStatsList('pair-stats-container', data.pairStats);
  renderStatsList('setup-stats-container', data.setupStats);
  renderStatsList('session-stats-container', data.sessionStats);
  renderEquityChart(data.equityLabels, data.equityData);
}

function renderEquityChart(labels, dataPoints) {
  const ctx = document.getElementById('equityChart').getContext('2d');
  if (equityChartInstance) { equityChartInstance.destroy(); }
  const _cs = getComputedStyle(document.documentElement);
  const _ink = _cs.getPropertyValue('--ink').trim() || '#111114';
  const _grid = _cs.getPropertyValue('--border').trim() || '#E7E7EA';
  const _loss = _cs.getPropertyValue('--loss').trim() || '#DC2626';
  Chart.defaults.color = _cs.getPropertyValue('--muted').trim() || '#9C9CA4';
  Chart.defaults.font.family = "'Prompt', sans-serif";

  // 1. คำนวณค่า Drawdown (หาจุดสูงสุดที่เคยทำได้ แล้วลบด้วยค่าปัจจุบัน)
  let maxEquity = -Infinity;
  let drawdownData = dataPoints.map(val => {
      if (val > maxEquity) maxEquity = val;
      return val - maxEquity; // จะได้ค่าเป็น 0 หรือติดลบ (Absolute Drawdown)
  });

  // แกน X: แสดงเฉพาะวัน/เดือน (ตัดเวลา) และไม่ซ้ำวันเดิม
  const _mob = window.innerWidth < 600;
  const _day = l => String(l||'').split(' ')[0];
  const _firstIdx = []; (labels||[]).forEach((l,i)=>{ if(i===0 || _day(l)!==_day(labels[i-1])) _firstIdx.push(i); });
  const _maxT = _mob ? 5 : 8, _step = Math.max(1, Math.ceil(_firstIdx.length/_maxT));
  const _showIdx = new Set(_firstIdx.filter((_,k)=>k%_step===0));
  equityChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Equity',
          data: dataPoints,
          borderColor: _ink,
          backgroundColor: 'rgba(127,127,135,0.08)',
          borderWidth: 2,
          pointBackgroundColor: _ink,
          pointRadius: 2,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'y' // ผูกกับสเกลแกนซ้าย
        },
        {
          label: 'Drawdown',
          data: drawdownData,
          borderColor: _loss,
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          borderWidth: 2,
          pointRadius: 0, // ซ่อนจุดเพื่อให้ดูเป็น Curve ลึกแบบต่อเนื่อง
          fill: true,
          tension: 0.4,
          yAxisID: 'y1' // ผูกกับสเกลแกนขวา
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false, // ทำให้ตอนเอาเมาส์ชี้ แสดงข้อมูลทั้ง Equity และ DD พร้อมกัน
      },
      plugins: {
        legend: { 
          display: true, // เปิดให้เห็นป้ายกำกับว่าเส้นไหนคืออะไร
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 10, font: {family: "'Prompt', sans-serif", weight: '600'} }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: {family: "'Prompt', sans-serif", size: 13},
          bodyFont: {family: "'Prompt', sans-serif", size: 13},
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: { 
          grid: { display: false }, 
          ticks: { autoSkip: false, maxRotation: 0, minRotation: 0, font: { size: _mob ? 10 : 11 }, callback: (v, i) => _showIdx.has(i) ? _day(labels[i]) : '' } 
        },
        y: { 
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: _grid },
          ticks: { font: { size: _mob ? 10 : 11 }, maxTicksLimit: 6, padding: 4 }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { display: false }, // ปิด grid แกนขวาเพื่อไม่ให้เส้นตีกัน
          suggestedMax: 0, // บังคับให้ 0 อยู่ด้านบนสุดของสเกลฝั่งขวา Drawdown จะได้ห้อยลงมา
          display: !_mob, // มือถือ: ซ่อนแกนขวาเพื่อให้กราฟกว้างขึ้น (ดูค่า DD ได้จาก tooltip)
          ticks: { color: _loss }
        }
      },
      layout: { padding: { left: 0, right: _mob ? 2 : 0 } }
    }
  });
}

function renderStatsList(elementId, statsData) {
  const container = document.getElementById(elementId); container.innerHTML = ""; let items = Object.keys(statsData);
  if(items.length === 0) { container.innerHTML = '<div class="text-muted small text-center fw-bold mt-3">ไม่มีข้อมูลในช่วงเวลานี้</div>'; return; }
  items.sort((a,b) => statsData[b].trades - statsData[a].trades).forEach(item => {
    let stats = statsData[item]; let wr = ((stats.wins / stats.trades) * 100).toFixed(0); 
    let colorClass = wr >= 50 ? 'text-success' : 'text-danger';
    container.innerHTML += `<div class="stat-list-item"><div class="text-truncate text-dark fw-bold" style="max-width:65%; font-size:0.95rem;">${item} <span class="badge bg-light text-muted border ms-2">${stats.trades} Trades</span></div><div class="${colorClass} fw-bold" style="font-size:0.95rem;">${wr}% Win</div></div>`;
  });
}

// ── History Tab State ──────────────────────────────────────
let _activeHistoryTab = 'trades';

function switchHistoryTab(tab) {
  _activeHistoryTab = tab;
  var tp=document.getElementById('history-panel-trades'), fp=document.getElementById('history-panel-funding');
  var tb=document.getElementById('tab-btn-trades'), fb=document.getElementById('tab-btn-funding');
  var chips=document.getElementById('hist-outcome-chips');
  var tf=document.getElementById('history-summary-footer'), ff=document.getElementById('funding-summary-footer');
  var tbody=document.getElementById('history-table-body'), fbody=document.getElementById('funding-table-body');
  if(tp) tp.style.display = tab==='trades' ? '' : 'none';
  if(fp) fp.style.display = tab==='funding' ? '' : 'none';
  if(tb) tb.classList.toggle('active', tab==='trades');
  if(fb) fb.classList.toggle('active', tab==='funding');
  if(chips) chips.style.display = tab==='trades' ? '' : 'none';
  var hasT = tbody && tbody.children.length>0 && !tbody.innerHTML.includes('ไม่พบ') && !tbody.innerHTML.includes('กำลังโหลด');
  var hasF = fbody && fbody.children.length>0 && !fbody.innerHTML.includes('ไม่พบ') && !fbody.innerHTML.includes('กำลังโหลด');
  if(tf) tf.style.setProperty('display', (tab==='trades' && hasT) ? 'flex' : 'none', 'important');
  if(ff) ff.style.setProperty('display', (tab==='funding' && hasF) ? 'flex' : 'none', 'important');
}
window.setHistFilter = function(mode, el){
  var b = document.getElementById('history-table-body');
  if (b){ b.classList.remove('f-win','f-loss'); if(mode==='win') b.classList.add('f-win'); else if(mode==='loss') b.classList.add('f-loss'); }
  if (el && el.parentNode){ el.parentNode.querySelectorAll('.tj-chip').forEach(function(c){ c.classList.remove('active'); }); el.classList.add('active'); }
};
window.updateFundingBtnLabel = function(){
  var w = document.getElementById('fund-withdraw'); var btn = document.getElementById('fundingBtn');
  if(!btn) return;
  var isW = w && w.checked;
  btn.textContent = isW ? 'บันทึกการถอนเงิน' : 'บันทึกการฝากเงิน';
  btn.style.background = isW ? 'var(--ap-warn)' : 'var(--profit)';
};
// โหลดข้อมูลเงินทุน + รีเซ็ตปุ่ม เมื่อเปิดโมดัลจัดการทุน
document.addEventListener('DOMContentLoaded', function(){
  var fm = document.getElementById('fundingModal');
  if (fm) fm.addEventListener('show.bs.modal', function(){
    try { if (typeof loadHistoryData === 'function') loadHistoryData(); } catch(e){}
    if (window.updateFundingBtnLabel) window.updateFundingBtnLabel();
  });
});

// เลขลำดับเทรด (นับจากไม้แรกสุดของบัญชี) — ไม่เปลี่ยนเมื่อกรองข้อมูล
let _tnoSrc = null, _tnoMap = {};
window.tjTradeNo = function(id){
  const rows = window._tjRows || [];
  if(rows !== _tnoSrc){
    _tnoSrc = rows; _tnoMap = {};
    rows.filter(r=>r.type==='Buy'||r.type==='Sell').slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at) || (a.id>b.id?1:-1)).forEach((r,i)=>{ _tnoMap[r.id]=i+1; });
  }
  return _tnoMap[id] || '–';
};
document.addEventListener('tj:rows', ()=>{ document.querySelectorAll('.tj-hist-no[data-id]').forEach(el=>{ el.textContent = '#'+window.tjTradeNo(el.dataset.id); }); });
function updateHistoryUI(historyData) {
  globalTradeHistory = historyData; 
  const tbody       = document.getElementById('history-table-body'); 
  const fundTbody   = document.getElementById('funding-table-body');
  const footer      = document.getElementById('history-summary-footer');
  const fundFooter  = document.getElementById('funding-summary-footer');
  tbody.innerHTML     = ""; 
  fundTbody.innerHTML = "";
  footer.style.setProperty('display', 'none', 'important');
  fundFooter.style.setProperty('display', 'none', 'important');

  let totalTrades = 0, totalPnl = 0;
  let totalDeposit = 0, totalWithdraw = 0, fundCount = 0;

  if (historyData.length === 0) { 
    tbody.innerHTML    = `<tr><td colspan="3" class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-folder-open mb-3 fs-1 d-block opacity-25"></i> ไม่พบรายการในช่วงเวลานี้</td></tr>`;
    fundTbody.innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-folder-open mb-3 fs-1 d-block opacity-25"></i> ไม่พบรายการในช่วงเวลานี้</td></tr>`;
    document.getElementById('tab-badge-trades').textContent  = '0';
    document.getElementById('tab-badge-funding').textContent = '0';
    return; 
  }

  historyData.forEach((trade, index) => {
    const isFunding = (trade.type === 'Deposit' || trade.type === 'Withdraw');
    const pnlValue  = parseFloat(trade.pnl);
    const dateParts = (trade.date || '').split(' ');

    if (isFunding) {
      // ── Funding card ──────────────────────────────────────
      fundCount++;
      const isDeposit = trade.type === 'Deposit';
      if (isDeposit) totalDeposit += Math.abs(pnlValue);
      else           totalWithdraw += Math.abs(pnlValue);
      if (fundTbody) fundTbody.innerHTML += `
        <div class="tj-hist-row" onclick="openTradeModal(${index})">
          <div class="tj-hist-ico ${isDeposit ? 'dep' : 'wd'}"><i class="fa-solid ${isDeposit ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i></div>
          <div class="tj-hist-main">
            <div class="tj-hist-sym">${isDeposit ? 'ฝากเงิน' : 'ถอนเงิน'}</div>
            <div class="tj-hist-sub">${dateParts[0] || ''}${trade.notes ? ' · ' + trade.notes : ''}</div>
          </div>
          <div class="tj-hist-right"><div class="tj-hist-pnl ${isDeposit ? 'text-success' : 'text-warning'}">${isDeposit ? '+$' : '-$'}${Math.abs(pnlValue).toFixed(2)}</div></div>
        </div>`;
    } else {
      // ── Trade card ────────────────────────────────────────
      totalTrades++;
      totalPnl += pnlValue;
      const winCls = pnlValue > 0 ? 'win' : pnlValue < 0 ? 'loss' : 'zero';
      const arrow  = pnlValue >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
      const oc = trade.outcome || '';
      let ocTag = '';
      if (oc === 'TP')      ocTag = '<span class="tj-hist-tag" style="background:var(--metric-mfe-bg);color:var(--profit);">TP</span>';
      else if (oc === 'SL') ocTag = '<span class="tj-hist-tag" style="background:var(--metric-mae-bg);color:var(--loss);">SL</span>';
      else if (oc === 'BE') ocTag = '<span class="tj-hist-tag" style="background:var(--metric-r-bg);color:var(--ap-warn);">BE</span>';
      else if (oc === 'Manual') ocTag = '<span class="tj-hist-tag" style="background:var(--metric-r-bg);color:var(--ink);">' + (pnlValue >= 0 ? 'M.Win' : 'Cut') + '</span>';
      if (trade.emotion === 'QUICK') ocTag += '<span class="tj-hist-tag" style="background:rgba(217,119,6,.14);color:var(--ap-warn);">ยังไม่ครบ</span>';
      let warn = (trade.overtrade === 'Yes' || trade.revenge === 'Yes') ? ' <span class="tj-hist-tag" style="background:var(--metric-mae-bg);color:var(--loss);"><i class="fa-solid fa-triangle-exclamation"></i></span>' : '';
      const rNum = parseFloat(trade.rMult);
      const rDisp = (!isNaN(rNum)) ? `<div class="tj-hist-r">${rNum >= 0 ? '+' : ''}${rNum.toFixed(1)}R</div>` : '';
      tbody.innerHTML += `
        <div class="tj-hist-row hist-${winCls}" onclick="openTradeModal(${index})">
          <div class="tj-hist-no" data-id="${trade.id}" title="เทรดลำดับที่ (นับจากไม้แรก)">#${window.tjTradeNo ? window.tjTradeNo(trade.id) : totalTrades}</div>
          ${window.tjThumb && window.tjThumb(trade.chartBefore || trade.chartAfter) ? `<img class="tj-hist-thumb" src="${window.tjThumb(trade.chartBefore || trade.chartAfter)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;tj-hist-ico ${pnlValue < 0 ? 'loss' : 'win'}&quot;><i class=&quot;fa-solid ${arrow}&quot;></i></div>'">` : `<div class="tj-hist-ico ${pnlValue < 0 ? 'loss' : 'win'}"><i class="fa-solid ${arrow}"></i></div>`}
          <div class="tj-hist-main">
            <div class="tj-hist-sym">${trade.symbol || '-'} ${ocTag}${warn}</div>
            <div class="tj-hist-sub">${dateParts[0] || ''}${dateParts[1] ? ' · ' + dateParts[1] : ''} · ${trade.type || ''}${(()=>{ const c=String(trade.confluences||''); const h=(/HTF:(\w+)/.exec(c)||[])[1], l=(/LTF:(\w+)/.exec(c)||[])[1]; return (h||l) ? ' · <span class="tj-tf-tag">'+(h||'?')+(l?' → '+l:'')+'</span>' : ''; })()}</div>
          </div>
          <div class="tj-hist-right">
            <div class="tj-hist-pnl ${pnlValue >= 0 ? 'text-success' : 'text-danger'}">${pnlValue > 0 ? '+$' + trade.pnl : '$' + trade.pnl}</div>
            ${rDisp}
          </div>
        </div>`;
    }
  });

  // ── Empty state fallback ──────────────────────────────────
  if (totalTrades === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-folder-open mb-3 fs-1 d-block opacity-25"></i> ไม่พบรายการเทรดในช่วงเวลานี้</td></tr>`;
  }
  if (fundCount === 0) {
    fundTbody.innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted fw-bold"><i class="fa-solid fa-folder-open mb-3 fs-1 d-block opacity-25"></i> ไม่พบรายการการเงินในช่วงเวลานี้</td></tr>`;
  }

  // ── Update badges + funding summary cards ─────────────────
  document.getElementById('tab-badge-trades').textContent  = totalTrades;
  document.getElementById('tab-badge-funding').textContent = fundCount;
  var _fd = document.getElementById('fund-total-deposit'); if (_fd) _fd.textContent = '$' + totalDeposit.toFixed(2);
  var _fw = document.getElementById('fund-total-withdraw'); if (_fw) _fw.textContent = '$' + totalWithdraw.toFixed(2);

  // ── Trade footer ──────────────────────────────────────────
  if (totalTrades > 0 && _activeHistoryTab === 'trades') {
    footer.style.setProperty('display', 'flex', 'important');
  }
  const _w = historyData.filter(t=>t.type!=='Deposit'&&t.type!=='Withdraw'&&parseFloat(t.pnl)>0).length;
  footer.innerHTML = `
    <div class="it"><small>จำนวนเทรด</small><b>${totalTrades} ไม้</b></div>
    <div class="it"><small>Win rate</small><b>${totalTrades ? Math.round(_w/totalTrades*100) : 0}%</b></div>
    <div class="it end"><small>Net P/L</small><b class="${totalPnl >= 0 ? 'text-success' : 'text-danger'}">${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}</b></div>`;

  // ── Funding footer ────────────────────────────────────────
  if (fundCount > 0 && _activeHistoryTab === 'funding') {
    fundFooter.style.setProperty('display', 'flex', 'important');
  }
  const netFund = totalDeposit - totalWithdraw;
  fundFooter.innerHTML = `
    <div class="it"><small>ฝาก</small><b class="text-success">+$${totalDeposit.toFixed(2)}</b></div>
    <div class="it"><small>ถอน</small><b class="text-danger">-$${totalWithdraw.toFixed(2)}</b></div>
    <div class="it end"><small>สุทธิ</small><b class="${netFund >= 0 ? 'text-success' : 'text-danger'}">${netFund >= 0 ? '+' : '-'}$${Math.abs(netFund).toFixed(2)}</b></div>`;

  // ── Keep current active tab ───────────────────────────────
  switchHistoryTab(_activeHistoryTab);
}

function openTradeModal(index) {
  showTradeModal(globalTradeHistory[index]);
}
window.showTradeModal = function(trade) {
  if (!trade) return;
  const isFunding = (trade.type === 'Deposit' || trade.type === 'Withdraw');
  
  document.getElementById('modalDate').innerText = trade.date;
  const pnlEl = document.getElementById('modalPnl'); pnlEl.innerText = (parseFloat(trade.pnl) > 0 ? "+$" : "$") + trade.pnl; pnlEl.className = parseFloat(trade.pnl) >= 0 ? "mb-0 fw-bold text-success display-5" : "mb-0 fw-bold text-danger display-5";
  
  let alertsHtml = "";
  if (trade.violatedRule === "Yes") alertsHtml += `<div class="badge bg-danger p-3 text-start fs-6 shadow-sm"><i class="fa-solid fa-skull me-2"></i> <b>แหกกฎ:</b> เข้าผิดโซน หรือไม่มีสัญญาณยืนยัน</div>`;
  if (trade.overtrade === "Yes") alertsHtml += `<div class="badge bg-warning text-dark p-3 text-start fs-6 shadow-sm"><i class="fa-solid fa-triangle-exclamation me-2"></i> พบพฤติกรรม <b>Overtrade</b></div>`;
  if (trade.revenge === "Yes") alertsHtml += `<div class="badge bg-danger p-3 text-start fs-6 shadow-sm"><i class="fa-solid fa-fire me-2"></i> พบพฤติกรรม <b>Revenge Trading</b> (เทรดเอาคืน)</div>`;
  document.getElementById('modalAlerts').innerHTML = alertsHtml;

  if(isFunding) {
    document.getElementById('modalSymbol').innerText = trade.type === 'Deposit' ? 'Deposit (ฝากเงิน)' : 'Withdraw (ถอนเงิน)';
    document.getElementById('modalTypeLot').innerText = 'Wallet Transaction';
    document.getElementById('modalTypeLot').className = 'badge bg-warning text-dark fs-6 py-2 px-3 shadow-sm';
    document.getElementById('modalNotes').innerText = trade.notes || "ไม่มีบันทึกรายละเอียด"; 
    
    document.getElementById('priceDataView').style.display = 'none';
    document.getElementById('chartLinksDiv').style.display = 'none';
  } else {
    document.getElementById('modalSymbol').innerText = trade.symbol; 
    document.getElementById('modalTypeLot').innerHTML = `${trade.type === 'Buy'?'<span class="text-success fw-bold">Long</span>':'<span class="text-danger fw-bold">Short</span>'} &bull; ${trade.lots} Lot`; 
    document.getElementById('modalTypeLot').className = 'badge bg-white text-dark border fs-6 py-2 px-3 shadow-sm';
    document.getElementById('modalNotes').innerText = trade.notes || "ไม่ได้บันทึกไว้";
    
    document.getElementById('priceDataView').style.display = 'block';
    document.getElementById('chartLinksDiv').style.display = 'flex';
    
    document.getElementById('modalEntry').innerText = trade.entryPrice || "-"; document.getElementById('modalSl').innerText = trade.slPrice || "-"; document.getElementById('modalTp').innerText = trade.tpPrice || "-";
    document.getElementById('modalSetup').innerText = trade.setup; document.getElementById('modalSession').innerText = trade.session || "-";
    
    // Show R-Mult and Context
    document.getElementById('modalRMult').innerText = trade.rMult !== "-" ? `R-Mult: ${trade.rMult}R` : "R-Mult: -";
    document.getElementById('modalContext').innerText = trade.marketContext !== "-" ? `Market: ${trade.marketContext}` : "Market: -";
    
    let outcomeBadgeClass = "bg-secondary"; let outcomeText = trade.outcome || "-";
    if(trade.outcome === 'TP') outcomeBadgeClass = "bg-success"; 
    else if(trade.outcome === 'SL') outcomeBadgeClass = "bg-danger"; 
    else if(trade.outcome === 'BE') outcomeBadgeClass = "bg-warning text-dark"; 
    else if(trade.outcome === 'Manual') { 
        if (parseFloat(trade.pnl) > 0) { outcomeBadgeClass = "bg-primary"; outcomeText = "Manual Win"; } 
        else { outcomeBadgeClass = "bg-danger opacity-75"; outcomeText = "Cut Loss"; } 
    }
    document.getElementById('modalOutcome').className = "badge " + outcomeBadgeClass + " fs-6 shadow-sm py-2 px-3"; 
    document.getElementById('modalOutcome').innerText = "Exit: " + outcomeText;

    const setBtn = (id, url) => { 
        const el = document.getElementById(id); 
        if(url && url.toString().trim() !== "" && url !== "-") { 
            el.href = url; el.classList.remove('disabled'); el.classList.replace('btn-outline-secondary', id !== 'modalBtnAfter' ? 'btn-outline-primary' : 'btn-outline-success');
        } 
        else { 
            el.href = "javascript:void(0)"; el.classList.add('disabled'); el.classList.replace(id !== 'modalBtnAfter' ? 'btn-outline-primary' : 'btn-outline-success', 'btn-outline-secondary');
        }
    };
    setBtn('modalBtnBefore', trade.chartBefore); setBtn('modalBtnAfter', trade.chartAfter);
    const hb = document.getElementById('modalBtnHtf'); if (hb) { setBtn('modalBtnHtf', trade.chartHtf); hb.style.display = trade.chartHtf ? '' : 'none'; }
  }
  new bootstrap.Modal(document.getElementById('tradeModal')).show();
}

// ── Auto-calculate RR ratio ─────────────────────────────────
function autoCalcRR() {
  const entry = parseFloat(document.getElementById('f_entry').value);
  const sl    = parseFloat(document.getElementById('f_sl').value);
  const tp    = parseFloat(document.getElementById('f_tp').value);
  const pnl   = parseFloat(document.getElementById('f_pnl').value);
  const risk  = parseFloat(document.getElementById('f_risk').value);

  const rrBox    = document.getElementById('rr-preview-box');
  const rmultBox = document.getElementById('rmult-preview');
  const rmultVal = document.getElementById('rmult-value');

  // ── RR Ratio Preview (Entry / SL / TP) ────────────────────
  if (!isNaN(entry) && !isNaN(sl) && entry !== sl) {
    const slDist = Math.abs(entry - sl);
    const tpDist = (!isNaN(tp) && tp !== 0) ? Math.abs(tp - entry) : null;
    const rrRatio = tpDist !== null ? (tpDist / slDist).toFixed(2) : null;

    document.getElementById('rr-sl-dist').textContent = slDist.toFixed(5);
    document.getElementById('rr-tp-dist').textContent = tpDist !== null ? tpDist.toFixed(5) : '—';
    document.getElementById('rr-ratio').textContent   = rrRatio !== null ? '1 : ' + rrRatio : '—';
    rrBox.classList.remove('d-none');
  } else {
    rrBox.classList.add('d-none');
  }

  // ── R-Multiple Preview (PnL / Risk$) ─────────────────────
  if (!isNaN(pnl) && !isNaN(risk) && risk > 0) {
    const rMult = pnl / risk;
    const sign  = rMult >= 0 ? '+' : '';
    rmultVal.textContent = sign + rMult.toFixed(2) + 'R';
    rmultVal.style.color = rMult >= 0 ? '#276B44' : '#B93033';
    rmultBox.classList.remove('d-none');
  } else {
    rmultBox.classList.add('d-none');
  }
}

function getFileBase64(fileInputId) {
  return new Promise((resolve) => {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return resolve(null);
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) { resolve({ name: file.name, mimeType: file.type, data: e.target.result.split(',')[1] }); };
    reader.readAsDataURL(file);
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังบันทึกข้อมูลและอัปโหลดภาพ...';
  
  const form = document.getElementById('tradeForm');
  const data = Object.fromEntries(new FormData(form).entries());
  
  // Checkboxes logic
  data.followedPlan = document.getElementById('followedPlan').checked ? 'on' : '';
  data.lotRespected = document.getElementById('lotRespected').checked ? 'on' : '';
  data.overtrade = document.getElementById('overtrade').checked ? 'on' : '';
  data.revenge = document.getElementById('revenge').checked ? 'on' : '';
  
  const checks = []; document.querySelectorAll('.conf-check:checked').forEach(c => checks.push(c.value));
  data.confluences = checks.join(', ');

  try {
    data.fileBeforeObj = await getFileBase64('fileBefore');
    data.fileAfterObj = await getFileBase64('fileAfter');
    data.fileHtfObj = await getFileBase64('fileHtf');

    await window.api.saveTradeData(data);
    form.reset();
    document.getElementById('rr-preview-box').classList.add('d-none');
    document.getElementById('rmult-preview').classList.add('d-none');
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save me-2"></i> บันทึกข้อมูลการเทรด'; 
    loadAllData(); switchTab('dashboard'); window.scrollTo(0, 0); 
  } catch (err) { alert("เกิดข้อผิดพลาด: " + (err.message || err)); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save me-2"></i> บันทึกข้อมูลการเทรด'; }
}

async function handleFundingSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('fundingBtn'); 
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังประมวลผล...';
  const fundForm = document.getElementById('fundingForm');
  const fundData = Object.fromEntries(new FormData(fundForm).entries());
  try {
    await window.api.saveFundingData(fundData);
    fundForm.reset(); btn.disabled = false; btn.innerText = 'ยืนยันทำรายการ';
    bootstrap.Modal.getInstance(document.getElementById('fundingModal')).hide(); 
    loadAllData();
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + (err.message || err));
    btn.disabled = false; btn.innerText = 'ยืนยันทำรายการ';
  }
}

