// The rule the i18n audit applies, in one place.
//
// The gate (`scripts/audit-i18n.mjs`) and its falsifier
// (`tests/i18n-audit.spec.mjs`) both import this module. Before this existed,
// the test carried its own copy of the rule and a change to one could leave
// the other testing a rule the site no longer had — a gate that proves
// itself against itself.

/* The page's own script. A passage that carries ANY character of it is
   already partly in the reader's language.

   This replaced a ratio of Latin letters to all letters with a small
   allowance for the other script, and that allowance was too tight. A
   sentence the platform wrote in Thai, keeping two organisation names in
   Latin and translating the conjunction between them, reads as 35 Latin
   letters against 3 Thai ones — and the old rule called it English. The
   sentence was already in the reader's language.

   A leaked English paragraph carries no character of the page's script, and
   is still caught. */
export function pageScriptRegex(lang) {
  return lang === "th" ? /\p{Script=Thai}/u : /\p{Script=Han}/u;
}

/* Below this share of Latin letters, a passage is not an English sentence on
   a Thai or Chinese page. */
export const LATIN_SHARE = 0.6;

/* A passage shorter than this cannot be judged: it is a label, a number or
   a symbol, and the word-count rule in the missing class is what decides
   whether it is a name or a sentence. */
export const MIN_PASSAGE = 3;

/* The minimum number of words a passage must carry, once the issued names
   have been stripped out of it, before it is called a sentence the platform
   forgot to translate. One word is far more likely to be a name — a city, a
   country, an organisation — than the platform's own prose, and calling
   every one of them untranslated would bury the real sentences. */
export const MIN_SENTENCE_WORDS = 3;

const wordCount = (text) => (String(text).toLowerCase().match(/[a-z]{2,}/g) || []).length;

/* The published names, and the function that takes them out of a passage.

   Only NAME fields are collected. A sentence stored in a dataset is still
   the platform's own prose when it is not a name, and exempting it would
   hide a real defect. */
export const NAME_FIELDS = new Set(["title", "project", "name", "country", "publisher", "author",
  "venue", "organisation", "organization", "org", "city", "file", "url", "photo", "source"]);

export const ISSUED_DATASETS = ["ascn-cities.json", "ascn-knowledge.json", "ascn-library.json",
  "ascn-library-full.json", "ascn-news-archive.json", "ascn-news-discovery.json",
  "ascn-v2-data.json", "ascn-issued-names.json", "news-snapshot.json"];

/* Build the stripper from the published datasets served beside the site.
   Both the gate and its falsifier call this, so both judge a passage the
   same way. */
export async function buildIssuedStripper(baseUrl) {
  const issued = new Set();
  const collect = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (NAME_FIELDS.has(key) && typeof child === "string") {
        issued.add(child.replace(/\s+/g, " ").replace(/[‐-―−]/g, "-").replace(/ /g, " ").trim());
      } else if (child && typeof child === "object") collect(child);
      else if (typeof child === "string" && key === "text") {
        issued.add(child.replace(/\s+/g, " ").trim());
      }
    }
  };
  for (const name of ISSUED_DATASETS) {
    const res = await fetch(`${baseUrl}/data/${name}`).catch(() => null);
    if (!res?.ok) { await res?.body?.cancel(); continue; }
    collect(await res.json());
  }
  const list = [...issued].filter(Boolean).sort((a, b) => b.length - a.length);
  return (text) => {
    let flat = String(text).replace(/\s+/g, " ").trim();
    for (const value of list) {
      const at = flat.indexOf(value);
      if (at >= 0) flat = `${flat.slice(0, at)} ${flat.slice(at + value.length)}`;
    }
    return flat.replace(/\s+/g, " ").trim();
  };
}

/* Walk an element's own text — the text it holds directly, not the text of
   its descendants. A paragraph holding <b>9</b> public sources reads as
   "9 public sources", and the emphasis is not part of the sentence. */
export function ownText(el) {
  return [...el.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Every element in a view that carries text of its own, with the slot it
   sits in. The audit is element-agnostic on purpose: an element nobody
   thought of — a <strong>, a <caption>, a <span>, a <text> in a chart —
   keeps its English and a chosen list of selectors never looks at it. */
export function collectOwnTexts(root) {
  const out = [];
  for (const el of root.querySelectorAll("*")) {
    const own = ownText(el);
    if (!own || own.length < MIN_PASSAGE) continue;
    if (el.closest("[data-source-issued]")) continue;
    // A quotation keeps its wording: it is somebody else's sentence.
    if (el.closest("blockquote, cite, q")) continue;
    // A <noscript> block is the page's fallback for a reader with no
    // JavaScript. It shows markup as text, and the language layer cannot
    // reach it, so it is not a page a reader in Thai ever sees.
    if (el.closest("noscript")) continue;
    const cls = el.className && el.className.baseVal !== undefined
      ? String(el.className.baseVal)
      : String(el.className || "");
    out.push({ own, tag: el.tagName.toLowerCase(), cls: cls.split(" ")[0] });
  }
  return out;
}

/* Judge one passage.

   Returns null when the passage is not a defect, or
   { kind: "render-path" | "missing", text, remainder, expected } when it is.

   ctx carries the three things only the caller knows:
     translate(text, lang)  → what the dictionary says the passage should read
     isTranslation(text, lang) → whether the passage IS one of the
                              dictionary's translations (a Thai sentence
                              carrying an issued name in Latin is translated
                              by definition)
     stripIssued(text) → the passage with the published names taken out

   Two kinds of defect, and the difference matters:
     render-path — the dictionary carries the sentence and the page is
                   rendering it in English anyway. The path is broken.
     missing    — no translation exists for it at all. The word is absent. */
export function judgePassage(own, lang, ctx) {
  const text = String(own).replace(/\s+/g, " ").trim();
  if (!text || text.length < MIN_PASSAGE) return null;
  if (pageScriptRegex(lang).test(text)) return null;
  const letters = text.replace(/[^\p{L}]/gu, "");
  const latin = (text.match(/\p{Script=Latin}/gu) || []).length;
  if (!letters.length || latin / letters.length < LATIN_SHARE) return null;

  const expected = ctx.translate(text, lang);
  if (expected !== text) {
    return { kind: "render-path", text, remainder: text, expected };
  }
  if (ctx.isTranslation(text, lang)) return null;
  const remainder = ctx.stripIssued(text);
  if (wordCount(remainder) < MIN_SENTENCE_WORDS) return null;
  return { kind: "missing", text, remainder, expected };
}
