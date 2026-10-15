import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArchive, buildFromDirectory, parseRecordsCsv, privateTextIssue, validateRecordArchive } from "../lib/ascn-record.mjs";

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
  assert.equal(doc.items[0].confidence, "medium");
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
  assert.equal(rewritten.items[0].confidence, "high");
  assert.equal(rewritten.items[0].amount, undefined);
  const month = buildArchive([publicItem({ date: "2024-11" })]);
  assert.equal(month.items[0].date, "2024-11");
  assert.throws(() => buildArchive([publicItem({ date: "2024-13" })]), /not a real month/);
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

test("a public CSV merges duplicates, keeps confidence, and does not quote an unread review", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ascn-archive-csv-"));
  await mkdir(join(dir, "public"), { recursive: true });
  await writeFile(join(dir, "records.json"), JSON.stringify([
    inbox("hlm2-2020", { date: "2020" }),
    inbox("hlm6-2024", { date: "2024-10-29" }),
    inbox("financing-toolkit-2024", { date: "2024-11-26" }),
  ]));
  await writeFile(join(dir, "public", "records.csv"), [
    "id,category,year,date,title,funder_or_party,amount,currency,cities,summary,source_url,source_type,confidence",
    "F06,funding,2020,2020-12,Smart JAMP proposed,Japan MLIT,,,cities,Proposed at the meeting.,https://www.jasca2021.jp/cooperative/,official,high",
    "M05,agreement_framework,2024,2024-10,6th HLM,Japan MLIT,,,cities,Case studies promised.,https://www.jasca2021.jp/ascnjapan2024/common/files/presentation/Summary_Record.pdf,official,high",
    "F11,funding,2024,2024-11,Toolkit launched,Aus4ASEAN,,,cities,Launched.,https://asean.org/wp-content/uploads/2025/11/2025-ASCN-ME-Report-Final_30Sep2025-for-public.pdf,official (ASEAN),high",
    "F01,funding,2018,2018-11-15,USASCP announced,US Department of State,10000000,USD,cities,Initial commitment.,https://www.usascp.org/vice-president-announces-usascp-at-6th-asean-u-s-summit/,official,high",
    "E03,evaluation,2025,2025-09-30,M&E 2025,ASEAN Secretariat,,,35 cities,Self-reported: 134 projects and 13% completed.,https://asean.org/wp-content/uploads/2025/11/2025-ASCN-ME-Report-Final_30Sep2025-for-public.pdf,official (self-reported),high",
    "E01,evaluation,2022,2022,DFAT review,Australia DFAT,,,10 pilot cities,Per search summary: Baguio and financial-management systems and Gold level. PDF not fully read.,https://www.dfat.gov.au/sites/default/files/asean-australia-smart-cities-trust-fund-mid-term-review.pdf,official evaluation,medium",
  ].join("\n"));
  await writeFile(join(dir, "public", "src-note.pdf"), "not a repo file");
  const { document, report } = await buildFromDirectory(dir);
  assert.deepEqual(document.items.map((item) => item.id), ["F01", "hlm2-2020", "hlm6-2024", "financing-toolkit-2024", "E03"]);
  assert.equal(document.items.find((item) => item.id === "hlm2-2020").date, "2020-12");
  assert.equal(document.items.find((item) => item.id === "hlm2-2020").outcome, "partial");
  assert.equal(document.items.find((item) => item.id === "hlm2-2020").confidence, "high");
  assert.equal(document.items.find((item) => item.id === "hlm6-2024").date, "2024-10-29");
  assert.equal(document.items.find((item) => item.id === "hlm6-2024").outcome, "partial");
  assert.equal(document.items.find((item) => item.id === "financing-toolkit-2024").selfReported, true);
  assert.equal(document.items.find((item) => item.id === "F01").amount, "USD 10000000");
  assert.equal(document.items.find((item) => item.id === "E03").selfReported, true);
  assert.match(document.items.find((item) => item.id === "E03").note.en, /134 projects/);
  assert.match(document.items.find((item) => item.id === "E03").note.en, /13%/);
  assert.equal(document.pending.length, 1);
  assert.equal(document.pending[0].id, "E01");
  assert.equal(document.pending[0].status, "pending review");
  assert.equal(document.pending[0].confidence, "medium");
  assert.equal(document.pending[0].outcome, undefined);
  assert.equal(document.pending[0].amount, undefined);
  const raw = JSON.stringify(document);
  assert.equal(raw.includes("Baguio"), false);
  assert.equal(raw.includes("financial-management"), false);
  assert.equal(raw.includes("Gold"), false);
  assert.equal(raw.includes("src-note.pdf"), false);
  assert.match(report, /Source rows 9/);
  assert.match(report, /Merged 3/);
  assert.match(report, /Pending review 1/);
  assert.equal(parseRecordsCsv("id,date,year,amount,currency,source_url,source_type,confidence\n").length, 0);
});

test("the committed public record excludes the three borderline inbox rows", async () => {
  const doc = validateRecordArchive(JSON.parse(await readFile(new URL("../data/ascn-archive.json", import.meta.url), "utf8")));
  assert.equal(doc.items.length, 46);
  assert.equal(doc.pending.length, 1);
  assert.equal(doc.pending[0].status, "pending review");
  assert.equal(doc.pending[0].id, "E01");
  assert.deepEqual(doc.withheld.map((row) => row.id), ["ascn-linkedin-page", "ascn8-chonburi-2025", "stgp-korea-2022"]);
  const counts = Object.fromEntries(["grant", "trip", "mou", "communication", "course"].map((type) => [type, doc.items.filter((item) => item.type === type).length]));
  assert.deepEqual(counts, { grant: 9, trip: 6, mou: 1, communication: 21, course: 9 });
  assert.equal(doc.items.filter((item) => item.confidence === "medium").length, 14);
  assert.equal(doc.items.filter((item) => item.selfReported).length, 11);
  assert.equal(doc.items.find((item) => item.id === "E03").selfReported, true);
  assert.match(doc.items.find((item) => item.id === "E03").note.en, /134 projects/);
  assert.match(doc.items.find((item) => item.id === "E03").note.en, /13%/);
  assert.equal(doc.items.find((item) => item.id === "hlm6-2024").outcome, "partial");
  assert.equal(doc.items.find((item) => item.id === "hlm6-2024").date, "2024-10-29");
  assert.equal(doc.items.find((item) => item.id === "hlm2-2020").date, "2020-12");
  assert.equal(doc.items.find((item) => item.id === "F01").amount, "USD 10000000");
  assert.equal(doc.items.some((item) => ["F06", "M05", "F11", "E01"].includes(item.id)), false);
  const raw = JSON.stringify(doc);
  assert.equal(raw.includes("Baguio"), false);
  assert.equal(raw.includes("financial-management"), false);
  assert.equal(/\bGold\b/.test(raw), false);
  for (const item of [...doc.items, ...doc.pending]) {
    assert.ok(item.source === "cleared by Non" || item.source.startsWith("https://"));
    for (const lang of ["en", "th", "zh"]) assert.ok(item.title[lang] && item.note[lang]);
  }
  for (const item of doc.items) assert.equal(item.public, true);
  assert.equal(privateTextIssue(doc), null);
  assert.equal(raw.includes("thread_ids"), false);
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
