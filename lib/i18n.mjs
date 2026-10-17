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
  "brand.review": text("Independent Review", "บทวิจารณ์อิสระ", "独立评估"),

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