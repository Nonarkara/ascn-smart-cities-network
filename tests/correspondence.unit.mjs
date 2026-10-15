import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCorrespondence } from "../lib/correspondence.mjs";

const dataset = JSON.parse(await readFile(new URL("../data/ascn-correspondence.json", import.meta.url), "utf8"));

const clone = () => JSON.parse(JSON.stringify(dataset));

test("the committed correspondence dataset satisfies its own contract", () => {
  assert.doesNotThrow(() => validateCorrespondence(clone()));
});

test("it carries a stated limitation so it cannot be read as a network total", () => {
  const d = clone();
  assert.match(d.method.limitation, /cannot establish|one member-state official/i);
  assert.match(d.method.fundedTravel, /Automated candidate/);
  assert.match(d.method.fundedTravel, /do not establish a funding offer/);
});

test("every thread is dated, attributed to an organisation, and classified", () => {
  for (const t of dataset.threads) {
    assert.match(t.date, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(t.origin.length > 0, "thread has no origin");
    assert.ok(t.kinds.length > 0, "thread has no kind");
  }
});

test("normalised subject groups have unique keys", () => {
  const keys = dataset.threads.map((t) => t.threadKey);
  assert.equal(new Set(keys).size, keys.length, "duplicate thread keys would double-count");
  const chains = dataset.threads.filter((t) => t.messages > 1);
  assert.ok(chains.length > 0, "fixture should contain at least one multi-message thread");
});

test("cost candidates always carry a cost head, never a bare number", () => {
  for (const t of dataset.threads) {
    if (t.fundedTravel) assert.ok(t.costHeads.length > 0, `${t.threadKey} flagged without a cost head`);
    if (t.fundingAmounts.length) {
      assert.ok(t.costHeads.length > 0, `${t.threadKey} has an amount with nothing to explain it`);
    }
  }
});

test("the funded_travel kind and the fundedTravel flag cannot disagree", () => {
  for (const t of dataset.threads) {
    assert.equal(t.kinds.includes("funded_travel"), t.fundedTravel, t.threadKey);
  }
});

test("no personal identifier reaches the published ledger", () => {
  const raw = JSON.stringify(dataset);
  assert.ok(!/\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s/.test(raw), "personal honorific present");
  assert.ok(!/"attachments"\s*:/.test(raw), "raw attachment filenames present");
  const addresses = raw.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) ?? [];
  const institutional = new Set([
    "asean.org", "depa.or.th", "mlit.go.jp", "uncrd.or.jp", "snu.ac.kr", "un.org",
    "kindkorea.or.kr", "planmalaysia.gov.my", "mfat.govt.nz", "dilg.gov.ph", "smu.edu.sg",
  ]);
  for (const a of addresses) {
    const domain = a.split("@")[1].toLowerCase();
    assert.ok(institutional.has(domain), `unexpected address domain: ${a}`);
  }
});

test("totals agree with the thread list", () => {
  const d = clone();
  d.totals.fundedTravelThreads += 1;
  assert.throws(() => validateCorrespondence(d), /disagrees/);
  const e = clone();
  e.totals.threads += 1;
  assert.throws(() => validateCorrespondence(e), /disagrees/);
});

test("the contract rejects a thread with no origin", () => {
  const d = clone();
  delete d.threads[0].origin;
  assert.throws(() => validateCorrespondence(d), /origin/);
});

test("the contract rejects a thread with no kind", () => {
  const d = clone();
  d.threads[0].kinds = [];
  assert.throws(() => validateCorrespondence(d), /kinds/);
});

test("the contract rejects an unknown cost head and an unknown kind", () => {
  const a = clone();
  a.threads[0].costHeads = ["yacht"];
  assert.throws(() => validateCorrespondence(a), /unknown cost head/);
  const b = clone();
  b.threads[0].kinds = ["vibes"];
  assert.throws(() => validateCorrespondence(b), /unknown kind/);
});

test("the contract rejects a leaked personal email in a subject", () => {
  const d = clone();
  d.threads[0].subject = "documents sent to someone@yonsei.ac.kr";
  assert.throws(() => validateCorrespondence(d), /personal email address/);
});

test("the contract rejects a leaked honorific", () => {
  const d = clone();
  d.threads[0].subjectClean = "Dear Mr. Nakada";
  assert.throws(() => validateCorrespondence(d), /honorific/);
});

test("the contract refuses a dataset that does not state its own limitation", () => {
  const d = clone();
  delete d.method.limitation;
  assert.throws(() => validateCorrespondence(d), /limitation/);
});


test("browser validation retains method, dates and the full ledger", () => {
  const d = clone();
  const validated = validateCorrespondence(d);
  assert.equal(validated, d);
  assert.equal(validated.method.unit, dataset.method.unit);
  assert.equal(validated.generatedAt, dataset.generatedAt);
});

test("private source fields and identifiers cannot bypass the publication contract", () => {
  for (const field of ["body", "attachments", "to", "privateNotes"]) {
    const d = clone(); d.threads[0][field] = "private source";
    assert.throws(() => validateCorrespondence(d), /published field|private source/);
  }
  const d = clone(); d.threads[0].origin = "someone@example.com";
  assert.throws(() => validateCorrespondence(d), /personal identifier/);
  const e = clone(); e.threads[0].senderDomains = ["someone@asean.org"];
  assert.throws(() => validateCorrespondence(e), /domains only/);
});

test("invalid dates, non-integer counts and misleading origin summaries are rejected", () => {
  for (const [field, value] of [["date", "2026-99-99T00:00:00Z"], ["messages", 1.5], ["attachmentCount", -1], ["costHeads", "hotel"]]) {
    const d = clone(); d.threads[0][field] = value;
    assert.throws(() => validateCorrespondence(d));
  }
  const d = clone(); d.totals.fundedTravelByOrigin["ASEAN Secretariat"] += 1;
  assert.throws(() => validateCorrespondence(d), /fundedTravelByOrigin disagrees/);
});


test("institutional email accounts are still personal identifiers in free text", () => {
  const d = clone(); d.threads[0].fundingQuote = "contact individual@asean.org";
  assert.throws(() => validateCorrespondence(d), /personal identifier/);
});
