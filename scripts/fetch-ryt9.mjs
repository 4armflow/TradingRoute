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
const GOLD = /ทองคำ|ราคาทอง|ตลาดทอง|ทองปิด|ทองพุ่ง|ทองร่วง|ทองดิ่ง|ทองขยับ|ทองยืน|ทองบวก|ทองลบ|ทองแตะ|ทองทำ|ทองฟื้น|ทองแกว่ง|\bXAU|\bgold\b/i;
const MAJOR = /สหรัฐ|เฟด|ยูโรโซน|อียู|อังกฤษ|ญี่ปุ่น|จีน|เยอรมนี|ทั่วโลก|\bIMF\b|นิวยอร์ก/;
const TAGS = [
  ["gold",     t => GOLD.test(t)],
  ["fed",      t => /เฟด|\bFed\b|FOMC|พาวเวล/i.test(t)],
  ["central",  t => /ธนาคารกลาง(?!แห่งประเทศไทย)|\bECB\b|\bBoE\b|\bBoJ\b|\bRBA\b|\bPBOC\b|\bSNB\b|อีซีบี|บีโอเจ/i.test(t)],
  ["dollar",   t => /(?<!ล้าน)(?<!พัน)ดอลลาร์(?!สหรัฐ\s*\d)|ตลาดเงินนิวยอร์ก|บอนด์ยีลด์|ยีลด์|พันธบัตรรัฐบาลสหรัฐ|ดัชนีดอลลาร์/.test(t)],
  ["economy",  t => /เงินเฟ้อ|\bCPI\b|\bPCE\b|\bPPI\b|จ้างงาน|ว่างงาน|nonfarm|\bGDP\b|\bISM\b|\bPMI\b|ยอดค้าปลีก|ความเชื่อมั่นผู้บริโภค|เศรษฐกิจ/i.test(t) && MAJOR.test(t)],
  ["oil",      t => /น้ำมัน(ดิบ|โลก)|ตลาดน้ำมัน|ราคาน้ำมัน|\bWTI\b|เบรนท์|โอเปก|\bOPEC\b/i.test(t)],
  ["tariff",   t => /ภาษีนำเข้า|กำแพงภาษี|ภาษีทรัมป์|สงครามการค้า|ข้อตกลงการค้า|ภาษีศุลกากร/.test(t)],
  ["geo",      t => /อิหร่าน|ฮอร์มุซ|อิสราเอล|ยูเครน|รัสเซีย|ขีปนาวุธ|ทะเลแดง|ฮูตี|ไต้หวัน|เกาหลีเหนือ|นิวเคลียร์/.test(t)],
  ["uspol",    t => /ชัตดาวน์|เพดานหนี้|งบประมาณสหรัฐ/.test(t)],
];
const CORE = new Set(["gold", "fed", "central", "dollar", "economy"]);

// ข่าวที่ไม่ต้องการแม้มีคำตรง
const DROP = [
  /ทองแดง|ทองคำขาว/,                                                 // ไม่ใช่ทองคำ
  /ลุ้น|แจก|มอบทอง|ได้ทอง|รับทอง|โปรโมชั่น|กิจกรรม|สมาชิก|ชิงโชค|ของรางวัล/, // ข่าวประชาสัมพันธ์
  /^(World Markets|ภาวะตลาดหุ้น|ภาวะตลาดอนุพันธ์|ภาวะตลาดสินค้าโภคภัณฑ์|ตลาดหุ้น|หุ้น)/, // ข่าวตลาดหุ้น
  /ดาวโจนส์|Nasdaq|S&P\s?500|FTSE|Sensex|นิกเคอิ|ฮั่งเส็ง|\bSET\b|TFEX|NVDR/i,
  /เงินบาท|กรอบบาท|บาท\/ดอลลาร์|\bกนง\b|กนง\.|ธปท|ราคาน้ำมันขายปลีก|ดีเซล|เบนซิน|แก๊สโซฮอล์|สนค\.|ค่ากลางเงินหยวน/, // ข่าวในประเทศไทย / ข่าวประจำวันที่ไม่มีผล
];

export function classify(title, category) {
  if (DROP.some(re => re.test(title))) return null;
  if (category && !["world", "economy"].includes(category)) return null;
  const hit = TAGS.find(([, test]) => test(title));
  if (!hit) return null;
  if (category === "economy" && !CORE.has(hit[0])) return null; // หมวดเศรษฐกิจไทย: เอาเฉพาะข่าวหลัก
  if (/ไทย/.test(title) && hit[0] !== "gold") return null;          // ข่าวเศรษฐกิจไทย (เว้นราคาทองในประเทศ)
  return hit[0];
}

const decode = s => String(s || "")
  .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

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
    return { title, url: link, time: time.toISOString(), tag: t, cat, urgent: /ด่วน/.test(title) || undefined,
             summary: excerpt(tag(it, "description")) || undefined, credit: creditFor(link) };
  }).filter(Boolean);
  if (!xml.includes("<item>")) throw new Error("feed has no items");

  let old = [];
  try { old = JSON.parse(await readFile(OUT, "utf8")).items || []; } catch {}
  const byUrl = new Map();
  for (const it of [...old, ...fresh]) byUrl.set(it.url, it);
  // กรองข่าวเก่าที่เก็บไว้ด้วยกฎล่าสุดเสมอ
  for (const [u, it] of byUrl) { const t = classify(it.title, it.cat); if (!t) byUrl.delete(u); else it.tag = t; }
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

if (import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("fetch-ryt9.mjs"))
  main().catch(e => { console.error(e.message); process.exit(1); });
