/* Site-wide language layer.

   The Archive tab shipped its own EN/TH/ZH switch first and proved the shape:
   every user-facing string is a `{en, th, zh}` object, the switch sets an
   attribute, and the copy falls back to English when a language is missing.
   This lifts that pattern to the whole site so the other fourteen views stop
   being English-only.

   Two rules this module enforces, both of them learned the hard way:

   1. A missing translation FALLS BACK TO ENGLISH and says so in the console.
      It never renders a key name. A reader must never see "nav.overview".

   2. Setting a language sets `document.documentElement.lang`. The document was
      hardcoded `<html lang="en">`, so a screen reader mispronounced every Thai
      and Chinese passage on the site — the one Layer 5 failure a single
      attribute fixes. */

export const LANGS = ["en", "th", "zh"];

export const LANG_LABEL = { en: "EN", th: "TH", zh: "ZH" };
export const LANG_NAME = { en: "English", th: "ไทย", zh: "中文" };

const text = (en, th, zh) => ({ en, th, zh });

/* The navigational spine: everything a reader uses to move around the site.
   Thai is modern professional first-person where the sentence has a speaker,
   and declarative where it does not. Chinese is short and declarative — never
   a sentence-for-sentence rendering of the English. */
export const DICT = {
"view.iaas": text("Innovation-as-a-Service", "นวัตกรรมในรูปแบบบริการ", "创新即服务"),
  "lede.iaas": text("Flood intelligence in the field, at the operations desk, and on the map. Data made useful for cities.", "ข้อมูลน้ำท่วมที่ใช้ได้จริง ทั้งในหน้างาน ที่ห้องปฏิบัติการ และบนแผนที่ เพื่อให้เมืองนำไปใช้ได้จริง", "洪水情报在田间、在指挥台、在地图上。让数据真正对城市有用。"),
  "h.flood-field": text("Flood intelligence in the field", "ข้อมูลน้ำท่วมในหน้างาน", "田间洪水情报"),
  "h.across-region": text("Across the region", "ทั่วทั้งภูมิภาค", "区域动态"),
  "h.what-they-did": text("What they actually did", "สิ่งที่พวกเขาทำจริง", "他们实际做了什么"),
  "h.how-performing": text("38 cities. 134 projects. How is it performing?", "38 เมือง 134 โครงการ — ผลงานเป็นอย่างไร", "38 座城市，134 个项目。做得如何？"),
  "h.twins": text("From static reports to living cities: 5 operational digital twins", "จากรายงานนิ่งสู่เมืองที่มีชีวิต: ดิจิทัลทวิน 5 แห่งที่ใช้งานจริง", "从静态报告到活的城市：5 个在运行的数字孪生"),
  "h.not-a-product": text("Not a product. A method.", "ไม่ใช่ผลิตภัณฑ์ แต่เป็นวิธีการ", "不是产品。是方法。"),
  "h.flooddash": text("FloodDash and Airdash", "FloodDash และ Airdash", "FloodDash 与 Airdash"),
  "h.countries-glance": text("Whole countries, read at a glance", "อ่านทั้งประเทศได้ในพริบตา", "一眼读懂一个国家"),
  "h.city-dashboards": text("City dashboards across the network", "แดชบอร์ดของเมืองทั่วเครือข่าย", "全网城市仪表盘"),
  "h.demos": text("Demonstrations in action", "การสาธิตที่ใช้งานจริง", "实地演示"),
  "h.open-to-cities": text("Open to any city that asks", "เปิดให้ทุกเมืองที่ต้องการ", "向任何提出的城市开放"),
  "h.ten-years": text("Ten years, counted", "สิบปี ในรูปของตัวเลข", "十年，数字说话"),
  "h.first-finding": text("The first finding is the accounting", "ข้อค้นพบแรกคือ บัญชี", "第一个发现是账目"),
  "h.instrument-late": text("The instrument that would have measured this never arrived on time", "เครื่องมือที่ควรจะวัดสิ่งนี้ไม่เคยมาตรงเวลา", "本该用来衡量的工具，从未按时到位"),
  "h.projects-accumulate": text("Projects accumulate faster than they finish", "โครงการสะสมเร็วกว่าที่จะเสร็จ", "项目的累积快于它们的完成"),
  "h.committed-orbit": text("What was committed to the network's orbit", "สิ่งที่ถูกผูกมัดไว้ในวงโคจรของเครือข่าย", "被承诺给网络轨道的事项"),
  "h.correspondence": text("What the correspondence records", "สิ่งที่เอกสารติดต่อบันทึกไว้", "往来函件记录了什么"),
  "h.productive-output": text("The most productive output, by volume", "ผลงานที่มีปริมาณมากที่สุด", "按数量计，产出最多的是什么"),
  "h.public-record": text("ASCN in the public record", "ASCN ในบันทึกสาธารณะ", "ASCN 在公开记录中"),
  "h.coverage-establishes": text("What the coverage establishes", "สิ่งที่หลักฐานยืนยันได้", "这些报道能证明什么"),
  "h.coverage-time": text("Coverage over time", "การครอบคลุมตามเวลา", "按时间分布的覆盖"),
  "h.three-objectives": text("Against ASCN's three objectives", "เมื่อเทียบกับสามวัตถุประสงค์ของ ASCN", "对照 ASCN 的三项目标"),
  "h.open-questions": text("Questions the record leaves open", "คำถามที่บันทึกยังไม่ตอบ", "记录尚未回答的问题"),
  "h.city-gaps": text("City evidence gaps", "ช่องว่างของหลักฐานรายเมือง", "城市证据缺口"),
  "h.evidence-ledger": text("Historical evidence ledger", "บัญชีหลักฐานย้อนหลัง", "历史证据账"),
  "h.history-title": text("From 26 pilot cities to a regional network", "จาก 26 เมืองนำร่อง สู่เครือข่ายระดับภูมิภาค", "从26个试点城市到区域网络"),
  "lede.history": text("Established at the 32nd ASEAN Summit in April 2018, the network has grown across eight chair years and five rounds of expansion.", "ก่อตั้งเมื่อการประชุมสุดยอดอาเซียนครั้งที่ 32 เมื่อเมื่อน 2018 เครือข่ายนี้เติบโตผ่านการเป็นประธานแปดปี และการขยายสมาชิกห้ารอบ", "2018年4月成立于第32届东盟峰会，历经八届主席国与五轮扩员。"),
  "h.cities-title": text("38 cities, 11 countries — and what each is building", "38 เมือง 11 ประเทศ — และสิ่งที่แต่ละเมืองกำลังสร้าง", "38座城市，11个国家——以及各自在建设什么"),
  "h.projects-title": text("The smart-city project portfolio", "ชุดโครงการเมืองอัจฉริยะ", "智慧城市项目组合"),
  "h.framework-title": text("The ASEAN Smart Cities Framework", "กรอบเมืองอัจฉริยะอาเซียน", "东盟智慧城市框架"),
  "h.partners-title": text("A multi-stakeholder ecosystem", "ระบบนิเวศน์ที่มีผู้มีส่วนได้ส่วนเสียหลายฝ่าย", "多方参与的生态系统"),
  "lede.partners": text("ASCN coordinates rather than funds. Bilateral partners, multilateral banks, and blended finance carry the projects.", "ASCN ทำหน้าที่ประสานงาน ไม่ใช่ผู้ให้เงิน คู่ความร่วมมือสองฝ่าย ธนาคารพัฒนาระหว่างประเทศ และการเงินผสมเป็นผู้ขับเคลื่อนโครงการ", "ASCN 负责协调，而非出资。双边伙伴、多边银行与混合融资承担项目。"),
  "h.insights-title": text("The network in numbers", "เครือข่ายในเชิงตัวเลข", "网络里的数字"),
  "lede.insights": text("Four M&E cycles, 134 projects, 38 cities. What the official record shows — and what it doesn't.", "สี่รอบการติดตามและประเมิน 134 โครงการ 38 เมือง สิ่งที่บันทึกทางการแสดงให้เห็น — และสิ่งที่มันไม่แสดง", "四轮监测评估、134个项目、38座城市。官方记录显示了——也未显示什么。"),
  "h.data-title": text("The knowledge base behind this platform.", "ฐานความรู้เบื้องหลังแพลตฟอร์มนี้", "这个平台背后的知识库。"),
  "h.archive-title": text("ASCN, 2018–2026", "ASCN, 2018–2026", "ASCN，2018–2026"),
  "lede.overview.hero": text("134 projects tracked since 2018. Not one public platform has asked how the network is performing against its own goals. This one does.", "134 โครงการที่ติดตามมาตั้งแต่ปี 2018 ไม่เคยมีแพลตฟอร์มสาธารณะใดถามว่าเครือข่ายทำงานได้ผลแค่ไหน เว็บนี้คือคำถามนั้น", "134 个项目，自2018年起跟踪。从未有公开平台问过这个网络做得如何。这就是那个问题。",),
  "lede.innovation.hero": text("Live systems, not a roadmap. Two national watches, three country dashboards, seven ASCN city dashboards — each one built inside a city, on data the city already had.", "ระบบที่ใช้งานจริง ไม่ใช่แผนงาน ระบบเฝ้าระวังระดับประเทศสองระบบ แดชบอร์ดระดับประเทศสามชุด และแดชบอร์ดเมืองของ ASCN เจ็ดชุด แต่ละชุดสร้างอยู่ภายในเมือง ใช้ข้อมูลที่เมืองมีอยู่แล้ว", "在运行的系统，不是路线图。两套国家监测、三套国家仪表盘、七套 ASCN 城市仪表盘——每一套都建在城内，用的是城市已有的数据。",),
  "lede.record.hero": text("ASCN turns ten this year. This page counts what was committed to it, what it holds, and what can be shown to have reached a citizen — separating money announced from money moved, and activity held from outcome delivered.", "ปีนี้ ASCN อายุครบสิบปี หน้านี้นับสิ่งที่ถูกผูกมัดไว้ สิ่งที่ยังถืออยู่ และสิ่งที่พิสูจน์ได้ว่าไปถึงประชาชน โดยแยกเงินที่ประกาศจากเงินที่เคลื่อนจริง และแยกกิจกรรมที่จัดขึ้นจากผลลัพธ์ที่ส่งมอบ", "今年 ASCN 满十年。本页清点：被承诺了什么、仍持有什么、什么能证明抵达了市民。公告的钱与实际流动的钱分开；举办的活动与交付的成果分开。",),
  "lede.news.hero": text("Public services, transport, infrastructure, and the technology shaping Southeast Asia’s cities.", "บริการสาธารณะ การคมนาคม โครงสร้างพื้นฐาน และเทคโนโลยีที่กำลังกำหนดรูปเมืองในเอเชียตะวันออก", "公共服务、交通、基础设施，以及正在塑造东南亚城市的技术。",),
  "lede.ascn9.hero": text("On 20 July 2026 the ASEAN Smart Cities Network met on a video call. The Philippines ran it. Twenty-five cities were on the line. Draft record, 13 August 2026. Not yet adopted.", "เมื่อวันที่ 20 กรกฎาคม 2026 เครือข่ายเมืองอัจฉริยะอาเซียนประชุมผ่านวิดีโอคอล ฟิลิปปินส์เป็นเจ้าภาพ มีเมืองเข้าร่วมยี่สิบห้าเมือง บันทึกฉบับร่าง ณ 13 สิงหาคม 2026 ยังไม่ได้รับการรับรอง", "2026年7月20日，东盟智慧城市网络举行视频会议。菲律宾主持，二十五座城市在线。本记录为8月13日草案，尚未通过。",),
  "footer.depa": text("This platform is developed by the <strong>Digital Economy Promotion Agency (DEPA)</strong> and the <strong>Smart City Thailand Office</strong>, under the Ministry of Digital Economy and Society of Thailand — a contribution to the ASEAN Smart Cities Network.", "แพลตฟอร์มนี้พัฒนาโดย <strong>สำนักงานส่งเสริมเศรษฐกิจดิจิทัล (DEPA)</strong> และ <strong>สำนักงานเมืองอัจฉริยะ</strong> ภายใต้กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม — เป็นการมีส่วนร่วมต่อเครือข่ายเมืองอัจฉริยะอาเซียน", "本平台由<strong>数字经济促进署（DEPA）</strong>与<strong>泰国智慧城市办公室</strong>开发，隶属泰国数字经济和社会部——是对东盟智慧城市网络的贡献"),

  "nav.overview": text("Overview", "ภาพรวม", "概览"),
  "nav.innovation": text("Innovation", "นวัตกรรม", "创新"),
  "nav.record": text("The Record", "บันทึก", "档案记录"),
  "nav.news": text("News", "ข่าว", "新闻"),
  "nav.ascn9": text("ASCN 9", "ASCN 9", "ASCN 9"),
  "nav.history": text("History", "ประวัติศาสตร์", "历史"),
  "nav.cities": text("Cities", "เมือง", "城市"),
  "nav.projects": text("Projects", "โครงการ", "项目"),
  "nav.framework": text("Framework", "กรอบงาน", "框架"),
  "nav.partners": text("Partners", "พันธมิตร", "合作伙伴"),
  "nav.contacts": text("Contacts", "ติดต่อ", "联系方式"),
  "nav.insights": text("Insights", "ข้อมูลเชิงลึก", "洞察"),
  "nav.data": text("Library", "คลังข้อมูล", "资料库"),
  "nav.archive": text("Archive", "คลังเอกสาร", "档案"),
  "nav.research": text("Research", "งานวิจัย", "研究"),
  "nav.essay": text("Essay", "บทความ", "文章"),

  "brand.review": text("Independent Review", "บทวิจารณ์อิสระ", "独立评估"),

  "lang.label": text("Language", "ภาษา", "语言"),
  "lang.switch": text("Change language", "เปลี่ยนภาษา", "切换语言"),
};

const missing = new Set();

export function t(key, lang = current) {
  const entry = DICT[key];
  if (!entry) return key;
  const value = entry[lang];
  if (value) return value;
  missing.add(`${key}:${lang}`);
  return entry.en;
}

let current = "en";

export function currentLang() { return current; }

export function applyLang(lang, { root = document } = {}) {
  const next = LANGS.includes(lang) ? lang : "en";
  current = next;
  // The attribute a screen reader reads before it reads a single word.
  root.documentElement.lang = next;

  for (const el of root.querySelectorAll("[data-i18n]")) {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;      // e.g. "aria-label" or "placeholder"
    if (attr) el.setAttribute(attr, t(key, next));
    else el.textContent = t(key, next);
  }
  for (const el of root.querySelectorAll("[data-i18n-html]")) {
    el.innerHTML = t(el.dataset.i18nHtml, next);
  }

  for (const button of root.querySelectorAll("[data-lang-set]")) {
    const on = button.dataset.langSet === next;
    button.setAttribute("aria-pressed", String(on));
  }
  try { localStorage.setItem("ascn-lang", next); } catch { /* private mode */ }
  return next;
}

/* Read the language from three places, in order of explicitness:
   ?lang= wins (so a link can carry a language), then the reader's last
   choice, then English. Never guess from the browser — a reader who chose
   Thai last week does not want English back because their OS changed. */
export function initLang() {
  const q = new URLSearchParams(location.search).get("lang");
  let stored = null;
  try { stored = localStorage.getItem("ascn-lang"); } catch { /* private mode */ }
  return applyLang(q || stored || "en");
}

export function missingTranslations() { return [...missing]; }