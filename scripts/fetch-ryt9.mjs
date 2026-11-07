// ดึงหัวข่าวจาก RSS ของ ryt9 แล้วกรองเฉพาะข่าวที่เกี่ยวกับทอง/ดอลลาร์/ดอกเบี้ย/น้ำมัน/ภูมิรัฐศาสตร์
// เก็บ หัวข่าว + ลิงก์ + เวลา + ข้อความนำสั้นๆ จาก RSS (ไม่เกิน ~280 ตัวอักษร ไม่เก็บเนื้อข่าวเต็ม) ลง data/live-news.json
// ใช้: node scripts/fetch-ryt9.mjs   (Node 18+ ไม่ต้องติดตั้งอะไรเพิ่ม)
import { readFile, writeFile, mkdir } from "node:fs/promises";

const FEED = "https://www.ryt9.com/news/rss.xml";
const OUT = new URL("../data/live-news.json", import.meta.url);
const KEEP_DAYS = 3;
const MAX_ITEMS = 60;
const EXCERPT = 280;

function excerpt(text) {
  if (text.length <= EXCERPT) return text;
  const cut = text.slice(0, EXCERPT);
  const sp = cut.lastIndexOf(" ");
  return (sp > EXCERPT * 0.6 ? cut.slice(0, sp) : cut).trim() + "…";
}
const creditFor = url => /\/s\/iq\//.test(url) ? "สำนักข่าวอินโฟเควสท์ (IQ) ผ่าน ryt9.com" : "ryt9.com";

// ลำดับมีผล: ข่าวหนึ่งได้ป้ายแรกที่ตรง
const TAGS = [
  ["gold",     /ทอง/],
  ["fed",      /เฟด|\bFed\b|FOMC|พาวเวล/i],
  ["central",  /ธนาคารกลาง|\bECB\b|\bBoE\b|\bBoJ\b|\bRBA\b|\bPBOC\b|อีซีบี|บีโอเจ/i],
  ["dollar",   /(?<!ล้าน)(?<!พัน)ดอลลาร์(?!สหรัฐ\s*\d)|ตลาดเงิน|บอนด์|ยีลด์|พันธบัตร|ดัชนีดอลลาร์/],
  ["economy",  /เงินเฟ้อ|\bCPI\b|\bPCE\b|จ้างงาน|ว่างงาน|nonfarm|\bGDP\b|\bISM\b|\bPMI\b|ค้าปลีก|ความเชื่อมั่นผู้บริโภค|เศรษฐกิจสหรัฐ|\bIMF\b/i],
  ["oil",      /น้ำมัน|\bWTI\b|เบรนท์|โอเปก|\bOPEC\b/i],
  ["tariff",   /ภาษีนำเข้า|กำแพงภาษี|ภาษีทรัมป์|สงครามการค้า|ข้อตกลงการค้า|ภาษีศุลกากร/],
  ["geo",      /อิหร่าน|ฮอร์มุซ|อิสราเอล|ยูเครน|รัสเซีย|สงคราม|ขีปนาวุธ|โจมตี|ทะเลแดง|ฮูตี/],
  ["uspol",    /เดโมแครต|รีพับลิกัน|สภาคองเกรส|วุฒิสภาสหรัฐ|ชัตดาวน์|เพดานหนี้/],
];
const CORE = new Set(["gold", "fed", "central", "dollar", "economy"]);

const decode = s => String(s || "")
  .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

function classify(title, category) {
  const hit = TAGS.find(([, re]) => re.test(title));
  if (!hit) return null;
  const t = hit[0];
  // ตัดข่าวหุ้นรายตัว/การเมืองไทย/ภาวะตลาดหุ้น เว้นแต่เป็นข่าวหลัก (ทอง เฟด ดอลลาร์ เศรษฐกิจ)
  if (!CORE.has(t) && (["stock", "politics", "general"].includes(category) || /^ภาวะตลาดหุ้น/.test(title))) return null;
  return t;
}

async function main() {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TradingRoute headline reader; +https://4armflow.github.io/TradingRoute/)" } });
  if (!res.ok) throw new Error("feed HTTP " + res.status);
  const xml = await res.text();
  const fresh = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const it = m[1];
    const title = tag(it, "title"), link = tag(it, "link"), cat = tag(it, "category");
    const time = new Date(tag(it, "pubDate"));
    const t = classify(title, cat);
    if (!t || !/^https:\/\/www\.ryt9\.com\//.test(link) || isNaN(time)) return null;
    return { title, url: link, time: time.toISOString(), tag: t, urgent: /ด่วน/.test(title) || undefined,
             summary: excerpt(tag(it, "description")) || undefined, credit: creditFor(link) };
  }).filter(Boolean);
  if (!xml.includes("<item>")) throw new Error("feed has no items");

  let old = [];
  try { old = JSON.parse(await readFile(OUT, "utf8")).items || []; } catch {}
  const byUrl = new Map();
  for (const it of [...old, ...fresh]) byUrl.set(it.url, it);
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  const items = [...byUrl.values()]
    .filter(it => Date.parse(it.time) >= cutoff)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, MAX_ITEMS);

  const sameItems = JSON.stringify(items) === JSON.stringify(old);
  if (sameItems) { console.log("no change"); return; }
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify({ source: "ryt9", sourceUrl: "https://www.ryt9.com/news-latest", updated: new Date().toISOString(), items }, null, 2) + "\n");
  console.log(`saved ${items.length} items (${fresh.length} matched in feed)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
