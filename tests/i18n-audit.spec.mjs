// The i18n audit's own falsifier.
//
// `scripts/audit-i18n.mjs` sweeps every element of every view in Thai and
// Chinese and reports the passages that are still standing in English. This
// test proves the instrument can still go red, and proves what it must NOT
// report.
//
// The rule is imported from `lib/i18n-audit.mjs` — the same module the gate
// imports. The test used to carry its own copy of the rule, and a change to
// one could leave the other testing a rule the site no longer had: a gate
// that proves itself against itself.
import { test, expect } from "@playwright/test";
import { judgePassage, MIN_PASSAGE, buildIssuedStripper } from "../lib/i18n-audit.mjs";
import { tx, DICT } from "../lib/i18n.mjs";

/* The three things only the caller knows. The gate and the test must judge
   a passage the same way, so these are built the same way here. */
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
  return !!set && set.has(String(text).replace(/\s+/g, " ").trim());
};
// The same issued names the gate strips, from the same published datasets.
const stripIssued = await buildIssuedStripper(process.env.ASCN_TEST_URL || "http://127.0.0.1:4187");
const ctx = { translate: (text, l) => tx(text, l), isTranslation, stripIssued };

/* Judge the passages the page is showing, the way the gate does. */
async function judged(page, lang) {
  const rows = await page.evaluate((min) => {
    const view = document.querySelector("section.view:not([hidden])");
    if (!view) return [];
    const out = [];
    for (const el of view.querySelectorAll("*")) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!own || own.length < min) continue;
      if (el.closest("[data-source-issued]")) continue;
      if (el.closest("blockquote, cite, q")) continue;
      if (el.closest("noscript")) continue;
      out.push({ own, tag: el.tagName.toLowerCase() });
    }
    return out;
  }, MIN_PASSAGE);
  return rows.map((r) => ({ ...r, verdict: judgePassage(r.own, lang, ctx) }))
    .filter((r) => r.verdict);
}

test("the sweep catches a planted English sentence and clears a marked one", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("ascn-lang", "th"); } catch { /* private mode */ } });
  await page.goto("/#overview", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // Plant the defect: the platform's own English sentence, on a Thai page.
  await page.evaluate(() => {
    const view = document.querySelector("section.view:not([hidden])");
    const p = document.createElement("p");
    p.id = "planted-defect";
    p.textContent = "This sentence was written in English and never translated into Thai.";
    view.appendChild(p);
  });
  const withDefect = await judged(page, "th");
  const caught = withDefect.find((row) => row.own.includes("never translated into Thai"));
  expect(caught, "the sweep missed a planted English sentence on a Thai page").toBeTruthy();

  // Mark it as source-issued, the way a citation is marked, and the sweep
  // must stop reporting it.
  await page.evaluate(() => {
    document.getElementById("planted-defect").setAttribute("data-source-issued", "");
  });
  const cleared = await judged(page, "th");
  const stillCaught = cleared.find((row) => row.own.includes("never translated into Thai"));
  expect(stillCaught, "a source-issued passage is still reported").toBeUndefined();
});

test("a planted SHORT label the dictionary carries is a broken render path", async ({ page }) => {
  // The first version of this audit required three English words before it
  // would call a passage prose, so a table head that said "Focus" in English
  // on a Thai page was invisible to it. A broken path is broken at any
  // length: the floor belongs to the "no translation at all" class, where
  // its job is to tell a name from a sentence.
  await page.addInitScript(() => { try { localStorage.setItem("ascn-lang", "th"); } catch { /* private mode */ } });
  await page.goto("/#overview", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const view = document.querySelector("section.view:not([hidden])");
    const th = document.createElement("th");
    th.id = "planted-short";
    th.textContent = "Focus";
    view.appendChild(th);
  });
  const rows = await judged(page, "th");
  const caught = rows.find((r) => r.own === "Focus");
  expect(caught, "the sweep missed a planted one-word label on a Thai page").toBeTruthy();
  expect(caught.verdict.kind, "a label the dictionary carries is a broken render path").toBe("render-path");
});

test("a sentence already partly in the reader's script is not an English leak", () => {
  // The platform wrote this in Thai, keeping the two organisation names in
  // Latin and translating the conjunction between them. The old rule — a
  // ratio of Latin letters — read it as 35 Latin against 3 Thai and called
  // it English. It is already in the reader's language.
  const verdict = judgePassage("Global Digital Forum และ BRICS Cloud Forum", "th", ctx);
  expect(verdict, "a Thai sentence with Latin names was reported as English").toBeNull();

  const chinese = judgePassage("全球数字论坛与金砖云论坛", "zh", ctx);
  expect(chinese, "a Chinese sentence was reported as English").toBeNull();
});

test("a one-word English name is not called a missing sentence", () => {
  // The floor in the "missing" class earns its keep: a single word is far
  // more likely to be a name — a city, a country, an organisation — than
  // the platform's own prose.
  const verdict = judgePassage("Vientiane", "th", ctx);
  expect(verdict, "a one-word name was reported as untranslated prose").toBeNull();
});

test("the shipped views carry no untranslated platform prose", async ({ browser }) => {
  // Each language gets its own context. A page reused across both passes
  // collects one init script per pass, and the last one to run decides the
  // language — so the Thai pass was judging a Chinese page, and the Chinese
  // pass a Thai one. The instrument was measuring a page nobody reads.
  for (const lang of ["th", "zh"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript((l) => { try { localStorage.setItem("ascn-lang", l); } catch { /* private mode */ } }, lang);
    const page = await context.newPage();
    for (const route of ["overview", "insights", "research", "essay", "record", "partners",
      "history", "framework", "data", "cities", "innovation", "projects", "contacts"]) {
      await page.goto(`/#${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(350);
      const found = await judged(page, lang);
      expect(found.map((row) => `${route} ${row.tag}: ${row.own.slice(0, 60)}`), `${lang}/${route} still carries English`).toEqual([]);
    }
    await context.close();
  }
});

test("the dictionary's English arms are English", async () => {
  // An entry whose English arm carries a non-Latin letter can never answer
  // the lookup the renderer makes: the renderer asks for the English text,
  // the dictionary holds something else, and the page stands in English.
  // Six entries were in that state, one of them a published paper's title
  // that had been given a Thai rendering — the defect the October audit
  // restored.
  const bad = [];
  for (const [key, entry] of Object.entries(DICT)) {
    if (!entry || typeof entry !== "object" || typeof entry.en !== "string") continue;
    const letters = entry.en.replace(/[^\p{L}]/gu, "");
    if (!letters.length) continue;
    const latin = (letters.match(/\p{Script=Latin}/gu) || []).length;
    if (latin !== letters.length) bad.push(`${key}: ${JSON.stringify(entry.en).slice(0, 80)}`);
  }
  expect(bad, "a dictionary entry's English arm carries a non-Latin letter").toEqual([]);
});

test("the dictionary says one English sentence in one way", async () => {
  // Two entries carrying the same English with different readings are a
  // trap: an exact lookup picks whichever was written first, and a
  // whitespace-variant lookup finds nothing at all. The page reads as one
  // sentence, so the dictionary must say one thing.
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
    bad.push(`${en}: ${members.map((m) => m.key).join(", ")}`);
  }
  expect(bad, "the dictionary carries one English sentence in two ways").toEqual([]);
});
