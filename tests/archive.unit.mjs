import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArchive, buildFromDirectory, privateTextIssue, validateRecordArchive } from "../lib/ascn-record.mjs";

const inbox = (id, extra = {}) => ({
  id,
  date: "2021-01-02",
  title: "Inbox title that must not be published",
  publishable: "yes",
  borderline_reason: "",
  thread_ids: ["17c6cd4a2a5f7f38"],
  summary: "From: secret@example.com\nCall +1 202 555 0147",
  ...extra,
});

function publicItem(extra = {}) {
  return {
    id: "scraped-course",
    type: "course",
    date: "2024-05-01",
    title: { en: "Scraped course", th: "หลักสูตรใหม่", zh: "新课程" },
    counterpart: { en: "ASEAN Secretariat", th: "สำนักเลขาธิการอาเซียน", zh: "东盟秘书处" },
    outcome: "delivered",
    note: { en: "A public course record.", th: "บันทึกหลักสูตรสาธารณะ", zh: "一条公开培训记录。" },
    source: "https://asean.org/example",
    public: true,
    ...extra,
  };
}

test("dates and ordinary prose are not treated as private contact text", () => {
  assert.equal(privateTextIssue("Met on 2021-10-18, range 2026-2035, slide 16:9."), null);
  assert.equal(privateTextIssue("From the secretariat, with no header"), null);
  assert.match(privateTextIssue("Write a@b.co"), /email address/);
  assert.match(privateTextIssue("Call +66 81 234 5678"), /phone number/);
  assert.match(privateTextIssue("Subject: the meeting"), /raw email text/);
});

test("publishable inbox rows are rewritten and borderline or private rows stay out", () => {
  const doc = buildArchive([
    inbox("hlm2-2020", { date: "2020" }),
    inbox("stgp-korea-2022", { date: "2022-10-10", publishable: "borderline", borderline_reason: "Names a person" }),
    inbox("hidden-grant", { date: "2024-01-01", public: false }),
  ]);
  assert.deepEqual(doc.items.map((item) => item.id), ["hlm2-2020"]);
  assert.equal(doc.items[0].type, "communication");
  assert.equal(doc.items[0].outcome, "stalled");
  assert.equal(doc.items[0].source, "cleared by Non");
  assert.equal(Object.hasOwn(doc.items[0], "amount"), false);
  const raw = JSON.stringify(doc);
  assert.equal(raw.includes("17c6cd4a2a5f7f38"), false);
  assert.equal(raw.includes("secret@example.com"), false);
  assert.equal(raw.includes("Inbox title"), false);
  assert.equal(raw.includes("Names a person"), false);
  assert.deepEqual(doc.withheld.map((row) => row.id), ["hidden-grant", "stgp-korea-2022"]);
  assert.equal(doc.withheld[0].reason.en, "Not public.");
});

test("a public-schema record can arrive later and unpublished wording is refused", () => {
  const rewritten = buildArchive([
    inbox("hlm2-2020", { date: "2020" }),
    publicItem({
      id: "hlm2-2020",
      date: "2020",
      title: { en: "Public rewrite", th: "สาธารณะ", zh: "公开改写" },
      note: { en: "Cleared public note.", th: "บันทึกสาธารณะ", zh: "公开说明。" },
      outcome: "delivered",
      type: "communication",
    }),
  ]);
  assert.equal(rewritten.items[0].title.en, "Public rewrite");
  assert.equal(rewritten.items[0].amount, undefined);
  const kept = buildArchive([publicItem({ amount: 250000 })]);
  assert.equal(kept.items[0].amount, 250000);
  assert.throws(() => buildArchive([inbox("not-a-real-id")]), /No public wording for not-a-real-id/);
  assert.throws(() => buildArchive([publicItem({ amount: "none stated" })]), /not a public amount/);
  assert.throws(() => buildArchive([publicItem({ note: { en: "Write a@b.co", th: "ก", zh: "字" } })]), /email address/);
  assert.throws(() => buildArchive([publicItem({ note: { en: "Call +1 202 555 0147", th: "ก", zh: "字" } })]), /phone number/);
  assert.throws(() => buildArchive([publicItem({ note: { en: "Subject: hello", th: "ก", zh: "字" } })]), /raw email text/);
  assert.throws(() => buildArchive([{
    id: "new-private", date: "2023-01-01", title: "x", publishable: "borderline", borderline_reason: "Contains a private name",
  }]), /No public wording for withheld record new-private/);
});

test("the builder reads records.json, merges later public JSON, and ignores other files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ascn-archive-"));
  await mkdir(join(dir, "public", "src"), { recursive: true });
  await writeFile(join(dir, "records.json"), JSON.stringify([inbox("hlm2-2020", { date: "2020" })]));
  await writeFile(join(dir, "public", "extra.json"), JSON.stringify([publicItem()]));
  await writeFile(join(dir, "public", "src", "note.txt"), "secret@example.com +66 81 234 5678");
  const { document, report } = await buildFromDirectory(dir);
  assert.deepEqual(document.items.map((item) => item.id), ["hlm2-2020", "scraped-course"]);
  assert.match(report, /Included 2/);
  assert.match(report, /Excluded 0/);
  await assert.rejects(buildFromDirectory(join(dir, "missing")), /No ASCN archive source/);
});

test("the committed public record excludes the three borderline inbox rows", async () => {
  const doc = validateRecordArchive(JSON.parse(await readFile(new URL("../data/ascn-archive.json", import.meta.url), "utf8")));
  assert.equal(doc.items.length, 16);
  assert.deepEqual(doc.withheld.map((row) => row.id), ["ascn-linkedin-page", "ascn8-chonburi-2025", "stgp-korea-2022"]);
  assert.equal(doc.items.some((item) => item.type === "mou" || Object.hasOwn(item, "amount")), false);
  const counts = Object.fromEntries(["grant", "trip", "mou", "communication", "course"].map((type) => [type, doc.items.filter((item) => item.type === type).length]));
  assert.deepEqual(counts, { grant: 1, trip: 3, mou: 0, communication: 9, course: 3 });
  for (const item of doc.items) {
    assert.equal(item.public, true);
    assert.ok(item.source === "cleared by Non" || item.source.startsWith("https://"));
    for (const lang of ["en", "th", "zh"]) assert.ok(item.title[lang] && item.note[lang]);
  }
  assert.equal(privateTextIssue(doc), null);
  assert.equal(JSON.stringify(doc).includes("thread_ids"), false);
});

test("rebuilding the mailbox source matches the committed record when the source is present", async () => {
  const source = "/cursor/stores/bot/ascn-archive/records.json";
  try { await access(source); } catch { return; }
  const { document } = await buildFromDirectory("/cursor/stores/bot/ascn-archive");
  const committed = JSON.parse(await readFile(new URL("../data/ascn-archive.json", import.meta.url), "utf8"));
  assert.deepEqual(document, committed);
});

test("the archive script is external and both build lists publish it", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<a href="#archive" data-tab="archive">Archive<\/a>/);
  assert.match(html, /<section class="view" id="view-archive" data-view="archive"/);
  assert.match(html, /<script type="module" src="archive\.js\?v=\d+"><\/script>/);
  const archiveHtml = html.slice(html.indexOf('id="view-archive"'), html.indexOf('id="view-contacts"'));
  assert.doesNotMatch(archiveHtml, /<script/i);
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /"data", "archive", "research"/);
  for (const file of ["../scripts/site-assets.mjs", "../scripts/build-static.mjs"]) {
    assert.match(await readFile(new URL(file, import.meta.url), "utf8"), /"archive\.js"/);
  }
});
