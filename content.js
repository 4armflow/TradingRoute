// ===== ข้อมูลของเว็บ: แก้ไฟล์นี้ไฟล์เดียวเพื่อเปลี่ยนข้อความ ลิงก์ โปรโมชั่น และรีวิว =====
window.SITE = {
  name: "ชื่อกลุ่มของคุณ",
  tag: "Forex Trading Community",
  tagline: "วิเคราะห์ข่าวเศรษฐกิจทุกวัน สรุปให้รู้ว่าวันนี้ต้องระวังข่าวไหน พร้อมคอมมูนิตี้เทรดเดอร์ที่ช่วยกันเรียนรู้",
  logo: "images/logo.svg",

  // ช่องทางติดต่อ (ปุ่มแรกจะเป็นสีทอง เด่นที่สุด)
  links: [
    { type: "line",    title: "เข้ากลุ่ม / ติดต่อแอดมิน", detail: "LINE OA @yourgroup",   url: "https://line.me/" },
    { type: "youtube", title: "YouTube",                 detail: "คลิปวิเคราะห์และไลฟ์", url: "https://www.youtube.com/" },
    { type: "tiktok",  title: "TikTok",                  detail: "สรุปข่าวสั้นรายวัน",   url: "https://www.tiktok.com/" }
  ],

  // โปรโมชั่น: เพิ่มหรือลบได้ทีละก้อน { ... }  ถ้าไม่มีโปร ให้เหลือ promos: []
  promos: [
    { image: "images/promos/promo-1.svg", until: "ถึง 30 พ.ย. 2569", title: "สมาชิก VIP ราคาพิเศษ",
      detail: "รับบทวิเคราะห์ข่าวทุกเช้า ไลฟ์คืนข่าวแรง และห้องถามตอบกับแอดมิน", url: "https://line.me/" },
    { image: "images/promos/promo-2.svg", until: "ดูฟรีบน YouTube", title: "ไลฟ์วิเคราะห์ข่าว NFP",
      detail: "วางแผนก่อนข่าวออก และสรุปผลหลังข่าวออกทันที", url: "https://www.youtube.com/" }
  ],

  // รีวิว: ใส่รูปไว้ในโฟลเดอร์ images/reviews แล้วเพิ่มชื่อไฟล์ที่นี่ (4 รูปแรกจะโชว์ในหน้าหลัก)
  reviews: [
    { image: "images/reviews/review-1.svg", caption: "สมาชิก A · 3 เดือน" },
    { image: "images/reviews/review-2.svg", caption: "สมาชิก B · 1 เดือน" },
    { image: "images/reviews/review-3.svg", caption: "สมาชิก C · 6 เดือน" },
    { image: "images/reviews/review-4.svg", caption: "สมาชิก D · 2 เดือน" },
    { image: "images/reviews/review-5.svg", caption: "สมาชิก E · 4 เดือน" },
    { image: "images/reviews/review-6.svg", caption: "สมาชิก F · 2 เดือน" }
  ],

  disclaimer: "ข้อมูลในเว็บนี้มีไว้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน การเทรด Forex มีความเสี่ยงสูง โปรดศึกษาก่อนตัดสินใจ"
};
