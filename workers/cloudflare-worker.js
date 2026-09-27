/**
 * Cloudflare Worker — Pro Trading Journal
 * -----------------------------------------------------------
 * ทำหน้าที่ "proxy" ให้ URL https://liewtrade.lewclassic.workers.dev/
 * ดึงหน้าเว็บจาก GitHub Pages โดยตรง จึงเสิร์ฟเวอร์ชันล่าสุดเสมอ
 *
 * วิธีอัปเดตแอปต่อจากนี้ (ทำที่เดียว):
 *   1. push / อัปโหลดไฟล์ใหม่ขึ้น GitHub repo (index.html, sw.js, manifest.json)
 *   2. เสร็จ — workers.dev จะอัปเดตตามเองอัตโนมัติ ไม่ต้องแก้ Worker อีก
 * -----------------------------------------------------------
 */

// แหล่งต้นทาง (GitHub Pages ของ repo pro-trading-journal)
const ORIGIN = "https://liew2312.github.io/pro-trading-journal";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // แม็ป path ของ workers.dev -> path บน GitHub Pages
    let path = url.pathname;
    if (path === "/" || path === "") path = "/index.html";

    const target = ORIGIN + path + url.search;

    // ดึงไฟล์จาก GitHub Pages โดยไม่ให้ Cloudflare cache ค้างเวอร์ชันเก่า
    const originResp = await fetch(target, {
      method: request.method,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "follow",
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    // คัดลอก response แล้วปรับ header
    const resp = new Response(originResp.body, originResp);
    const ct = resp.headers.get("content-type") || "";

    // บังคับ no-cache สำหรับไฟล์ที่ต้องสดเสมอ (HTML / service worker / manifest)
    if (
      ct.includes("text/html") ||
      path.endsWith("/sw.js") ||
      path.endsWith("/manifest.json")
    ) {
      resp.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    // อนุญาตให้ service worker คุม scope ทั้งไซต์
    if (path.endsWith("/sw.js")) {
      resp.headers.set("Service-Worker-Allowed", "/");
    }

    return resp;
  },
};
