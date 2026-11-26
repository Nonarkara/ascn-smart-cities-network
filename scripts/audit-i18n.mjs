// Every English passage that is still standing on a Thai or Chinese page.
//
// The gate already had a check for this, and it passed — on a page that was
// carrying a good deal of English. Two blind spots, both of them the same
// shape:
//
//   1. It read a chosen list of selectors (p, li, h1–h4, button, label,
//      summary, .label, .card-sub, …). An element nobody thought of — a
//      <strong>, a <caption>, a <span>, a <text> in a chart — kept its
//      English and the check never looked at it.
//   2. It required eight English words before it would call a passage prose,
//      so a four-word sentence of the platform's own copy passed unremarked.
//
// The instrument here is element-agnostic: it walks EVERY element in the
// view, reads each one's own text, and judges what a reader would actually
// see. A passage is judged in three steps:
//
//   · It must be MOSTLY Latin. A Thai or Chinese sentence carrying an
//     English proper noun is translated; a passage that is nearly all Latin
//     letters on a Thai page is not.
//   · Issued names are exempt. A work, a project, a person, a ministry, a
//     headline, a citation — these exist in one language in their source and
//     keep their wording. The exemption is earned: the passage is stripped of
//     the names the site actually publishes, and only what the platform
//     itself wrote is judged.
//   · What the platform wrote must be translated. If the dictionary already
//     carries the sentence, the page is rendering it in English anyway —
//     that is a broken path, not a missing word. If it does not, the
//     sentence is missing a translation.
//
//   ASCN_I18N_LANG=th|zh   ASCN_TEST_URL=http://127.0.0.1:<port>
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { tx, DICT } from "../lib/i18n.mjs";
import { judgePassage, MIN_PASSAGE, buildIssuedStripper } from "../lib/i18n-audit.mjs";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const LANGS = (process.env.ASCN_I18N_LANG || "th,zh").split(",").filter(Boolean);
const OUT = process.env.ASCN_I18N_OUT || "artifacts/i18n";
const ROUTES = ["overview", "innovation", "record", "news", "news/regional", "news/archive",
  "news/discovery", "history", "cities", "projects", "framework", "partners", "insights",
  "research", "essay", "data", "contacts", "ascn9", "archive"];

// Issued names: the names the published datasets carry. These keep the
// wording their source issued. Only NAME fields are collected — a sentence
// stored in a dataset is still the platform's own prose when it is not a
// name, and exempting it would hide a real defect.
//
// The builder lives in lib/i18n-audit.mjs, which the falsifier imports too,
// so the gate and the thing that proves the gate strip the same names.
const stripIssued = await buildIssuedStripper(BASE);

// Every translation the dictionary carries, in every language.
const TRANSLATIONS = new Map();
for (const entry of Object.values(DICT)) {
  if (!entry || typeof entry !== "object") continue;
  for (const lang of ["th", "zh"]) {
    const value = entry[lang];
    if (typeof value !== "string" || value === entry.en) continue;
    if (!TRANSLATIONS.has(lang)) TRANSLATIONS.set(lang, new Set());
    TRANSLATIONS.get(lang).add(value.replace(/\s+/g, " ").trim());
  }
}
const isTranslation = (text, lang) => {
  const set = TRANSLATIONS.get(lang);
  return !!set && set.has(text.replace(/\s+/g, " ").trim());
};

/* One English sentence, one reading.

   The dictionary is looked up by the English text the renderer passes, so
   two entries carrying the same English with different readings are a trap:
   an exact lookup picks whichever was written first, and a whitespace-
   variant lookup finds nothing at all, because the normalised index leaves
   out any group whose members disagree. A reader gets English on a Thai
   page, and no instrument says why.

   The page reads as one sentence, so the dictionary must say one thing.
   This check is the gate that keeps it saying one thing. */
const AMBIGUOUS = (() => {
  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const groups = new Map();
  for (const [key, entry] of Object.entries(DICT)) {
    if (!entry || typeof entry !== "object" || typeof entry.en !== "string") continue;
    const n = norm(entry.en);
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push({ key, th: entry.th, zh: entry.zh });
  }
  const bad = [];
  for (const [en, members] of groups) {
    if (members.length < 2) continue;
    const first = members[0];
    if (members.every((m) => m.th === first.th && m.zh === first.zh)) continue;
    bad.push({ en, members });
  }
  return bad;
})();

/* An entry whose English arm carries a non-Latin letter.

   The renderer looks the dictionary up by the English text it passes, so an
   entry whose English arm is half Thai can never answer for the string the
   renderer asks about: the lookup misses and the page stands in English.
   Six entries were in that state, and one of them was a published paper's
   title that had been given a Thai rendering — the defect the October
   audit restored. This check is what stops it coming back. */
const NON_LATIN_ARMS = (() => {
  const bad = [];
  for (const [key, entry] of Object.entries(DICT)) {
    if (!entry || typeof entry !== "object" || typeof entry.en !== "string") continue;
    const letters = entry.en.replace(/[^\p{L}]/gu, "");
    if (!letters.length) continue;
    const latin = (letters.match(/\p{Script=Latin}/gu) || []).length;
    if (latin !== letters.length) bad.push({ key, en: entry.en });
  }
  return bad;
})();

const browser = await chromium.launch();
const findings = [];
for (const lang of LANGS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript((l) => { try { localStorage.setItem("ascn-lang", l); } catch { /* private mode */ } }, lang);
  for (const route of ROUTES) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
    // The archive view fetches its evidence and renders it after the first
    // paint, so a fixed short wait read it as empty and reported nothing.
    // Wait for its table to have rows before judging it.
    if (route === "archive") {
      await page.waitForFunction(() => {
        const t = document.querySelector("#archive-table");
        return t && t.textContent.trim().length > 0;
      }, null, { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(400);
    const rows = await page.evaluate((min) => {
      const view = document.querySelector("section.view:not([hidden])");
      if (!view) return [];
      const out = [];
      for (const el of view.querySelectorAll("*")) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3)
          .map((n) => n.textContent || "").join(" ").replace(/\s+/g, " ").trim();
        if (!own || own.length < min) continue;
        if (el.closest("[data-source-issued]")) continue;
        // A quotation keeps its wording: it is somebody else's sentence.
        if (el.closest("blockquote, cite, q")) continue;
        // A <noscript> block is the page's fallback for a reader with no
        // JavaScript. It shows markup as text, and the language layer cannot
        // reach it, so it is not a page a reader in Thai ever sees.
        if (el.closest("noscript")) continue;
        out.push({ own, tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().split(" ")[0] });
      }
      return out;
    }, MIN_PASSAGE);
    for (const r of rows) {
      // The rule lives in lib/i18n-audit.mjs, which the falsifier imports
      // too, so the gate and the thing that proves the gate cannot drift
      // apart. Two kinds of defect, and the difference matters:
      //   render-path — the dictionary carries the sentence and the page
      //                 renders it in English anyway. The path is broken.
      //   missing    — no translation exists for it at all.
      const verdict = judgePassage(r.own, lang, {
        translate: (text, l) => tx(text, l),
        isTranslation,
        stripIssued,
      });
      if (!verdict) continue;
      findings.push({
        lang, route, tag: r.tag, cls: r.cls, kind: verdict.kind,
        text: verdict.text.slice(0, 220), remainder: verdict.remainder.slice(0, 220),
        expected: (verdict.expected || "").slice(0, 160),
      });
    }
  }
  await page.close();
}
await browser.close();

await mkdir(OUT, { recursive: true });
// The same sentence leaking into both languages is one defect.
const groups = new Map();
for (const f of findings) {
  const key = `${f.route}|${f.text}`;
  if (!groups.has(key)) groups.set(key, { ...f, langs: [] });
  groups.get(key).langs.push(f.lang);
}
const defects = [...groups.values()].sort((a, b) => a.route.localeCompare(b.route));
await writeFile(`${OUT}/i18n-leaks.json`, JSON.stringify({ base: BASE, langs: LANGS, defects }, null, 2) + "\n");

const brokenPath = defects.filter((d) => d.kind === "render-path");
const missingWord = defects.filter((d) => d.kind === "missing");
console.log(`Untranslated passages on Thai/Chinese pages: ${defects.length} distinct`);
console.log(`  the dictionary carries them, the page renders them in English: ${brokenPath.length}`);
console.log(`  no translation exists at all: ${missingWord.length}`);
for (const d of defects) {
  console.log(`\n[${d.langs.join("/")}] ${d.route} <${d.tag}.${d.cls}> ${d.kind === "render-path" ? "RENDER PATH" : "NO TRANSLATION"}`);
  console.log(`   "${d.remainder}"`);
}
if (AMBIGUOUS.length) {
  console.log(`\nThe dictionary says one English sentence in two ways: ${AMBIGUOUS.length}`);
  for (const g of AMBIGUOUS) {
    console.log(`\n   "${g.en}"`);
    for (const m of g.members) console.log(`      ${m.key}\n         th: ${m.th}\n         zh: ${m.zh}`);
  }
}
if (NON_LATIN_ARMS.length) {
  console.log(`\nDictionary entries whose English arm is not English: ${NON_LATIN_ARMS.length}`);
  for (const e of NON_LATIN_ARMS) console.log(`   ${e.key}\n      ${JSON.stringify(e.en).slice(0, 140)}`);
}
if (defects.length || AMBIGUOUS.length || NON_LATIN_ARMS.length) process.exitCode = 1;
