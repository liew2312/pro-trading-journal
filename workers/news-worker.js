/**
 * Cloudflare Worker — ข่าวเศรษฐกิจ สำหรับ Pro Trading Journal
 * -----------------------------------------------------------
 * ตั้งชื่อ Worker ว่า:  liewtrade-news
 * URL ที่แอปเรียก:      https://liewtrade-news.lewclassic.workers.dev/api/calendar
 * ตรวจสาเหตุเมื่อใช้ไม่ได้: https://liewtrade-news.lewclassic.workers.dev/api/calendar?debug=1
 *
 * แหล่งข่าวหลัก: TradingView Economic Calendar (มีค่า Actual ด้วย)
 * แหล่งสำรอง:   ForexFactory feed
 * ช่วงเวลา: ย้อนหลัง 7 วัน ถึงล่วงหน้า 14 วัน · แคช 15 นาที · เปิด CORS
 * ถ้าดึงไม่ได้ชั่วคราว จะส่งข้อมูลล่าสุดที่เคยดึงได้ (เก็บไว้ 7 วัน) แทน
 * -----------------------------------------------------------
 */

// ── TradingView ─────────────────────────────────────────────
const TV_URL = "https://economic-calendar.tradingview.com/events";
const TV_COUNTRIES = "US,EU,DE,GB,JP,AU,CA,CH,NZ,CN";
const TV_HEADERS = {
  "Origin": "https://www.tradingview.com",
  "Referer": "https://www.tradingview.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  "Accept": "application/json",
};
const IMPACT = { "1": "High", "0": "Medium", "-1": "Low" };
function fmtVal(v, e) {
  if (v === null || v === undefined || v === "") return "";
  let n = Number(v);
  let s = isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(v);
  return s + (e.scale || "") + (e.unit || "");
}
async function fetchTradingView(log, fromISO, toISO) {
  const url = TV_URL + "?from=" + encodeURIComponent(fromISO) + "&to=" + encodeURIComponent(toISO) + "&countries=" + TV_COUNTRIES;
  try {
    const r = await fetch(url, { headers: TV_HEADERS, cf: { cacheTtl: 300 } });
    const text = await r.text();
    if (!r.ok) { log.push({ src: "tradingview", status: r.status, body: text.slice(0, 160) }); return null; }
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.result;
    if (!Array.isArray(arr)) { log.push({ src: "tradingview", status: r.status, error: "no result" }); return null; }
    log.push({ src: "tradingview", status: r.status, count: arr.length });
    return arr.map(e => ({
      title: e.title || e.indicator || "",
      country: e.currency || e.country || "",
      date: e.date,
      impact: IMPACT[String(e.importance)] || "Low",
      forecast: fmtVal(e.forecast, e),
      previous: fmtVal(e.previous, e),
      actual: fmtVal(e.actual, e),
      period: e.period || "",
    }));
  } catch (err) {
    log.push({ src: "tradingview", error: String(err && err.message || err) });
    return null;
  }
}

// ── ForexFactory (สำรอง) ────────────────────────────────────
const HOSTS = ["https://nfs.faireconomy.media", "https://cdn-nfs.faireconomy.media"];
const WEEKS = ["thisweek", "nextweek"];
const CAL_TTL = 900;              // วินาที — แคชปกติ
const STALE_TTL = 7 * 24 * 3600;  // วินาที — สำรองไว้ใช้ตอนต้นทางล่ม

const HEADER_PROFILES = [
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.forexfactory.com/",
  },
  { "Accept": "application/json" },
];

function corsHeaders(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }, extra || {});
}
function json(obj, status, cacheCtl) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheCtl || "no-store" }),
  });
}

// ดึง 1 สัปดาห์: ลองทุก host × ทุกชุด header จนกว่าจะได้
async function fetchWeek(week, log) {
  for (const host of HOSTS) {
    for (let i = 0; i < HEADER_PROFILES.length; i++) {
      const url = host + "/ff_calendar_" + week + ".json";
      try {
        const r = await fetch(url, { headers: HEADER_PROFILES[i], cf: { cacheTtl: 300 } });
        const text = await r.text();
        if (!r.ok) { log.push({ url, profile: i, status: r.status, body: text.slice(0, 160) }); continue; }
        let arr;
        try { arr = JSON.parse(text); } catch (e) { log.push({ url, profile: i, status: r.status, error: "not JSON", body: text.slice(0, 160) }); continue; }
        if (!Array.isArray(arr)) { log.push({ url, profile: i, status: r.status, error: "not array" }); continue; }
        log.push({ url, profile: i, status: r.status, count: arr.length });
        return arr;
      } catch (e) {
        log.push({ url, profile: i, error: String(e && e.message || e) });
      }
    }
  }
  return null;
}

async function handleCalendar(request, ctx) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  const debug = new URL(request.url).searchParams.has("debug");
  const cache = caches.default;
  const freshKey = new Request("https://cache.local/api/calendar/v3");
  const staleKey = new Request("https://cache.local/api/calendar/v3-stale");

  if (!debug) { const hit = await cache.match(freshKey); if (hit) return hit; }

  const log = [], seen = new Set(), events = [];
  let ok = 0, source = "tradingview";
  const now = Date.now();
  const tv = await fetchTradingView(log, new Date(now - 7 * 864e5).toISOString(), new Date(now + 14 * 864e5).toISOString());
  if (tv && tv.length) { ok = 1; tv.forEach(e => events.push(e)); }
  else source = "forexfactory";
  for (const w of (ok ? [] : WEEKS)) {
    const arr = await fetchWeek(w, log);
    if (!arr) continue;
    ok++;
    for (const e of arr) {
      const k = (e.country || "") + "|" + (e.title || "") + "|" + (e.date || "");
      if (seen.has(k)) continue;
      seen.add(k); events.push(e);
    }
  }

  if (debug) return json({ ok, events: events.length, log });

  if (!ok) {
    const stale = await cache.match(staleKey);
    if (stale) {
      const body = await stale.json();
      body.stale = true;
      return json(body, 200, "public, max-age=120");
    }
    return json({ error: "calendar feed unavailable", hint: "เปิด ?debug=1 เพื่อดูสาเหตุ", log }, 502);
  }

  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const body = { updated: new Date().toISOString(), source, events };
  const resp = json(body, 200, "public, max-age=" + CAL_TTL);
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(freshKey, resp.clone()));
    ctx.waitUntil(cache.put(staleKey, json(body, 200, "public, max-age=" + STALE_TTL)));
  }
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/calendar" || url.pathname === "/") return handleCalendar(request, ctx);
    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};
