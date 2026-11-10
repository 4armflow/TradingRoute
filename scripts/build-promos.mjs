// สร้าง data/promos.json จากรูปในโฟลเดอร์ promos/
// - เรียงตามชื่อไฟล์ (ตั้งชื่อขึ้นต้นด้วย 01-, 02- เพื่อกำหนดลำดับ)
// - ถ้ามีไฟล์ .txt ชื่อเดียวกับรูป จะอ่านหัวข้อ/รายละเอียด/หมดเขต/ลิงก์จากไฟล์นั้น
// - ย่อรูปเป็น .webp กว้างไม่เกิน 1200px ไว้ที่ data/promo-img/ (ถ้ามี sharp) ให้โหลดเร็วบนมือถือ
// - โปรที่เลยวันหมดเขตแล้วจะไม่แสดง
// ใช้: node scripts/build-promos.mjs
import { readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "promos");
const OUT_DIR = path.join(ROOT, "data", "promo-img");
const OUT = path.join(ROOT, "data", "promos.json");
const IMG = /\.(jpe?g|png|webp)$/i;
const MAX_W = 1200;

let sharp = null;
try { sharp = (await import("sharp")).default; } catch { console.log("sharp not available: using original images"); }

const todayTH = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

function parseDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, mo, d;
  if (m) [, y, mo, d] = m.map(Number);
  else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) [, d, mo, y] = m.map(Number);
  else return null;
  if (y > 2400) y -= 543; // ปี พ.ศ.
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseText(txt) {
  const out = { title: "", detail: "", until: "", url: "", button: "" };
  const lines = txt.replace(/^﻿/, "").replace(/\r/g, "").split("\n");
  const keys = { "หัวข้อ": "title", "หมดเขต": "until", "ลิงก์": "url", "ลิงค์": "url", "ปุ่ม": "button" };
  let inDetail = false; const detail = [];
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue; // บรรทัดที่ขึ้นต้นด้วย # คือคำอธิบาย ไม่แสดงบนเว็บ
    const m = line.match(/^\s*(หัวข้อ|หมดเขต|ลิงก์|ลิงค์|ปุ่ม|รายละเอียด)\s*[:：]\s*(.*)$/);
    if (m && m[1] === "รายละเอียด") { inDetail = true; if (m[2].trim()) detail.push(m[2]); continue; }
    if (m && !inDetail) { out[keys[m[1]]] = m[2].trim(); continue; }
    if (inDetail) detail.push(line);
    else if (!out.title && line.trim()) out.title = line.trim(); // บรรทัดแรกที่ไม่มีหัวข้อ = หัวข้อ
    else if (line.trim()) detail.push(line);
  }
  out.detail = detail.join("\n").trim();
  return out;
}

async function main() {
  let files = [];
  try { files = (await readdir(SRC)).sort((a, b) => a.localeCompare(b, "th", { numeric: true })); } catch {}
  const images = files.filter(f => IMG.test(f) && !f.startsWith("."));
  await mkdir(OUT_DIR, { recursive: true });

  const items = [], keep = new Set();
  for (const f of images) {
    const base = f.replace(IMG, "");
    const txtName = files.find(x => x.toLowerCase() === (base + ".txt").toLowerCase());
    const meta = txtName ? parseText(await readFile(path.join(SRC, txtName), "utf8")) : { title: "", detail: "", until: "", url: "", button: "" };
    const until = parseDate(meta.until);
    if (until && until < todayTH) { console.log("expired:", f); continue; }
    const url = /^https:\/\//.test(meta.url) ? meta.url : "";

    const buf = await readFile(path.join(SRC, f));
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
    let image = "promos/" + f, w = null, h = null;
    if (sharp) {
      const outName = hash + ".webp", outPath = path.join(OUT_DIR, outName);
      keep.add(outName);
      try { await stat(outPath); }
      catch { await sharp(buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 82 }).toFile(outPath); }
      const md = await sharp(outPath).metadata(); w = md.width; h = md.height;
      image = "data/promo-img/" + outName;
    }
    items.push({ id: "promo-" + (items.length + 1), image, w, h, title: meta.title, detail: meta.detail, until: until || "", url, button: meta.button });
  }

  if (sharp) for (const f of await readdir(OUT_DIR)) if (!keep.has(f) && !f.startsWith(".")) await rm(path.join(OUT_DIR, f));

  const json = JSON.stringify({ updated: new Date().toISOString(), items }, null, 2) + "\n";
  let old = "";
  try { old = await readFile(OUT, "utf8"); } catch {}
  if (old && JSON.stringify(JSON.parse(old).items) === JSON.stringify(items)) { console.log("no change"); return; }
  await writeFile(OUT, json);
  console.log(`saved ${items.length} promos`);
}

main().catch(e => { console.error(e); process.exit(1); });
