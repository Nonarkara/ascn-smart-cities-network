import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tx, fill } from "../lib/i18n.mjs";

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
