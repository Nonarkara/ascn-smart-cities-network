import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tx, fill, DICT } from "../lib/i18n.mjs";

// Every literal handed to tx() / fill() is authored copy. A wrapped string with no
// dictionary entry renders in English in every language and looks translated in
// the source, which is how an unfinished handoff reads as finished.
const FILES = ["app.js", "ascn-news.js"];
const CALL = /\b(?:tx|fillText)\(\s*"((?:\\.|[^"\\])*)"/g;
const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

function literals() {
  const found = new Map();
  for (const file of FILES) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(CALL)) found.set(JSON.parse(`"${match[1]}"`), file);
  }
  return found;
}

test("every wrapped literal has a Thai and a Chinese entry with the same slots", () => {
  const missing = [];
  for (const [en, file] of literals()) {
    for (const lang of ["th", "zh"]) {
      const out = tx(en, lang);
      if (out === en) missing.push(`${file} ${lang}: ${en.slice(0, 70)}`);
      else if (slots(out) !== slots(en)) missing.push(`${file} ${lang} slots: ${en.slice(0, 70)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("fill substitutes every slot and never leaves a marker behind", () => {
  for (const lang of ["en", "th", "zh"]) {
    const out = fill("{n} of {m} reviewed records\u00A0· {k} distinct topics/events\u00A0· reviewed {date}", { n: 3, m: 44, k: 9, date: "28 Oct 2026" }, lang);
    assert.doesNotMatch(out, /[{}]/);
    for (const value of ["3", "44", "9", "28 Oct 2026"]) assert.ok(out.includes(value), `${lang} lost ${value}`);
  }
});

test("a string with no entry is returned unchanged, never a key", () => {
  assert.equal(tx("A sentence nobody translated"), "A sentence nobody translated");
});

/* ── Data-driven prose ────────────────────────────────────────────────────
   The archive, the source library and the knowledge layer carry their own
   sentences. They reach the page through tx() as values, not as literals, so
   the check above cannot see them: a value with no dictionary entry renders in
   English in every language while the source reads as though it were
   translated. This test closes that hole by asking the same question the
   release audit asks of the rendered page: is this string English prose?

   A string counts as prose on the same rule the audit uses — at least eight
   Latin words and three English function words. Anything shorter is a label,
   a heading or a name, and a name keeps the wording its source issued. So do
   the names themselves: a headline, a work title, a document title or a URL
   exists in exactly one language in its source, and rendering a Thai version
   of a title no publisher issued would put an unsourced sentence on a platform
   whose whole argument is that every claim traces to a source. */
const DATA_FILES = [
  "data/ascn-knowledge.json",
  "data/ascn-library.json",
  "data/ascn-library-full.json",
  "data/ascn-news-archive.json",
];
// The fields that carry a name a source issued. The audit exempts the same
// kind of value; this list is the unit-test equivalent of that exemption.
const ISSUED_FIELDS = new Set(["title", "project", "url", "file", "photo", "name", "source", "venue", "author", "publisher"]);
const STOP = new Set(["the", "and", "of", "to", "in", "is", "that", "with",
  "for", "are", "was", "were", "on", "as", "at", "by", "from", "it",
  "its", "this", "which", "not", "but", "has", "have", "been", "or",
  "we", "they", "one", "every", "their", "than", "into", "also"]);
const isProse = (value) => {
  const words = (String(value).toLowerCase().match(/[a-z]+/g) || []);
  if (words.length < 8) return false;
  return words.filter((w) => STOP.has(w)).length >= 3;
};
function dataStrings(node, out = []) {
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { for (const child of node) dataStrings(child, out); return out; }
  if (node && typeof node === "object") for (const child of Object.values(node)) dataStrings(child, out);
  return out;
}
function issuedNames(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  for (const [key, child] of Object.entries(node)) {
    if (ISSUED_FIELDS.has(key) && typeof child === "string") out.add(child.replace(/\s+/g, " ").trim());
    else if (child && typeof child === "object") issuedNames(child, out);
  }
  return out;
}

test("every authored prose string in the published data has a Thai and a Chinese entry", () => {
  const issued = new Set();
  for (const file of DATA_FILES) {
    const doc = JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    issuedNames(doc, issued);
  }
  const missing = [];
  for (const file of DATA_FILES) {
    const doc = JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    for (const value of dataStrings(doc)) {
      if (!isProse(value)) continue;
      if (issued.has(value.replace(/\s+/g, " ").trim())) continue;
      for (const lang of ["th", "zh"]) {
        if (tx(value, lang) === value) missing.push(`${file} ${lang}: ${value.slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("no wrapped literal renders a dictionary key", () => {
  // tx() looks a string up by its ENGLISH TEXT, not by its key. Handing it a
  // key returns the key, and the key lands on the page — the same failure the
  // Research route had with "a.eight.themes.from.the.literature". Any literal
  // that comes back looking like a key is the reader seeing one.
  const offenders = [];
  for (const file of FILES) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(CALL)) {
      const en = JSON.parse(`"${match[1]}"`);
      for (const lang of ["th", "zh"]) {
        const out = tx(en, lang);
        if (DICT[out]) { offenders.push(`${file} ${lang}: ${en} -> ${out}`); continue; }
        if (/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(out)) offenders.push(`${file} ${lang}: ${en} -> ${out}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("no two dictionary entries claim the same English text with different wording", () => {
  // BY_TEXT keeps the first match, so a second entry with the same English
  // text is unreachable through tx() — it reads as translated in the source
  // and never reaches the page. Two entries may share an English text when
  // they say the same thing: t() resolves each key directly, and tx() would
  // return the same words either way. The hazard is a second entry that
  // claims the same English text and says something different.
  const seen = new Map();
  const clashes = [];
  for (const [key, entry] of Object.entries(DICT)) {
    if (!entry || typeof entry !== "object" || typeof entry.en !== "string") continue;
    const flat = entry.en.replace(/\s+/g, " ").trim();
    const other = seen.get(flat);
    if (other && (other.entry.th !== entry.th || other.entry.zh !== entry.zh)) {
      clashes.push(`${key} and ${other.key} share English text but differ`);
    } else if (!other) {
      seen.set(flat, { key, entry });
    }
  }
  assert.deepEqual(clashes, []);
});


