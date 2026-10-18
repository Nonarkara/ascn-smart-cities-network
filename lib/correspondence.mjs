/**
 * Runtime contract for the correspondence ledger.
 *
 * The correspondence dataset is the only part of this platform built from a
 * personal mailbox rather than from published documents. That makes it the
 * easiest place to accidentally overstate a claim, so the invariants below are
 * enforced in code rather than trusted to review:
 *
 *  - fundedTravel is a cost-keyword candidate, never a verified funding offer
 *  - a funding amount must never appear without a cost head to explain it
 *  - every thread must carry a date, an origin and at least one kind
 *  - no personal data may reach the published file at all
 *  - a thread matching no category is labelled "other", never silently dropped
 *
 * Unit tests: tests/correspondence.unit.mjs
 */

const COST_HEADS = new Set([
  "airfare",
  "accommodation",
  "per_diem",
  "local_transport",
  "fee_waived",
  "fully_funded",
]);

const KINDS = new Set(["event", "training", "monitoring", "agreement", "funded_travel", "other"]);

const ANY_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Institutional domains are allowed: they name an organisation, not a person.
const INSTITUTIONAL_DOMAINS = new Set([
  "asean.org", "depa.or.th", "mfa.go.th", "md.go.th", "dopa.go.th",
  "mlit.go.jp", "jica.go.jp", "murc.jp", "uncrd.or.jp", "japan.go.jp", "mofa.go.jp",
  "planmalaysia.gov.my", "kpkt.gov.my", "mybis.gov.my",
  "kindkorea.or.kr", "snu.ac.kr", "molit.go.kr", "keiti.re.kr",
  "mfat.govt.nz", "dilg.gov.ph", "mnd.gov.sg", "smartnation.gov.sg", "smu.edu.sg",
  "un.org", "unhabitat.org", "unescap.org", "ahkfta.org",
  "norway.no", "norad.no", "dfat.gov.au", "aid.gov.au", "ec.europa.eu",
  "mard.gov.vn", "mic.gov.vn", "bpkpm.go.id", "kemenpu.go.id",
]);

/** Returns the first non-institutional address found in a string, or null. */
export function findPersonalAddress(value) {
  for (const match of value.matchAll(ANY_ADDRESS)) {
    const domain = match[0].split("@")[1].toLowerCase();
    if (!INSTITUTIONAL_DOMAINS.has(domain)) return match[0];
  }
  return null;
}
const HONORIFIC = /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * @param {unknown} raw parsed JSON
 * @returns {{ threads: object[], totals: object }}
 * @throws {Error} on the first violated invariant
 */
export function validateCorrespondence(raw) {
  if (!raw || typeof raw !== "object") throw new Error("correspondence dataset must be an object");
  if (!Array.isArray(raw.threads)) throw new Error("correspondence dataset must carry a threads array");
  if (!raw.totals || typeof raw.totals !== "object") throw new Error("correspondence dataset must carry totals");
  if (!raw.method || typeof raw.method.limitation !== "string" || !raw.method.limitation.trim()) {
    throw new Error("correspondence dataset must state its own limitation");
  }

  if (!Number.isFinite(Date.parse(raw.generatedAt))) throw new Error("generatedAt must be a valid date");
  if (typeof raw.method.unit !== "string" || typeof raw.method.fundedTravel !== "string") {
    throw new Error("correspondence method must describe its unit and funding classification");
  }
  const allowedFields = new Set(["threadKey", "subject", "subjectClean", "date", "dateLast", "messages", "senderDomains", "origin", "kinds", "fundedTravel", "costHeads", "fundingAmounts", "funders", "eventKinds", "trainingKinds", "monitoringKinds", "agreementKinds", "attachmentCount", "messageFiles", "fundingQuote"]);
  function inspect(value, path = "dataset") {
    if (typeof value === "string" && (value.match(ANY_ADDRESS) || HONORIFIC.test(value))) throw new Error(`${path} leaks a personal identifier`);
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      if (["body", "from", "to", "cc", "bcc", "attachments", "raw", "file", "path"].includes(key)) throw new Error(`${path}.${key} is private source material`);
      inspect(child, `${path}.${key}`);
    }
  }
  const { threads, totals } = raw;
  const seenKeys = new Set();

  for (const [i, t] of threads.entries()) {
    const at = `threads[${i}]`;
    if (!t || typeof t !== "object") throw new Error(`${at} must be an object`);
    if (typeof t.threadKey !== "string" || !t.threadKey) throw new Error(`${at}.threadKey must be a non-empty string`);
    if (seenKeys.has(t.threadKey)) throw new Error(`${at}.threadKey duplicates an earlier thread: ${t.threadKey}`);
    seenKeys.add(t.threadKey);
    for (const key of Object.keys(t)) if (!allowedFields.has(key)) throw new Error(`${at}.${key} is not a published field`);
    if (typeof t.date !== "string" || !ISO_DATE.test(t.date) || !Number.isFinite(Date.parse(t.date))) throw new Error(`${at}.date must be an ISO timestamp`);
    if (typeof t.origin !== "string" || !t.origin) throw new Error(`${at}.origin must name the sending organisation`);
    if (!Array.isArray(t.kinds) || t.kinds.length === 0) throw new Error(`${at}.kinds must not be empty`);

    for (const k of t.kinds) {
      if (!KINDS.has(k)) throw new Error(`${at}.kinds contains an unknown kind: ${k}`);
    }
    if (!Array.isArray(t.senderDomains) || t.senderDomains.length === 0) {
      throw new Error(`${at}.senderDomains must not be empty`);
    }
    if (!Number.isSafeInteger(t.messages) || t.messages < 1) {
      throw new Error(`${at}.messages must be a positive reply count`);
    }
    if (!Number.isSafeInteger(t.attachmentCount) || t.attachmentCount < 0) {
      throw new Error(`${at}.attachmentCount must be a non-negative count`);
    }

    for (const key of ["costHeads", "fundingAmounts"]) {
      if (!Array.isArray(t[key]) || t[key].some((v) => typeof v !== "string")) throw new Error(`${at}.${key} must be a string array`);
    }
    for (const domain of t.senderDomains) if (typeof domain !== "string" || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error(`${at}.senderDomains must contain domains only`);
    for (const head of t.costHeads ?? []) {
      if (!COST_HEADS.has(head)) throw new Error(`${at}.costHeads contains an unknown cost head: ${head}`);
    }
    if (typeof t.fundedTravel !== "boolean") throw new Error(`${at}.fundedTravel must be boolean`);
    if (t.fundedTravel && !(t.costHeads ?? []).length) {
      throw new Error(`${at} is flagged fundedTravel but records no cost head`);
    }
    // An amount without a cost head is a document reference, not a subsidy.
    if ((t.fundingAmounts ?? []).length && !(t.costHeads ?? []).length) {
      throw new Error(`${at} carries a funding amount with no cost head explaining it`);
    }
    if (t.kinds.includes("funded_travel") !== t.fundedTravel) {
      throw new Error(`${at} lists the funded_travel kind but is not flagged as funded travel`);
    }

    for (const field of ["subject", "subjectClean", "fundingQuote", "threadKey"]) {
      const v = t[field];
      if (v == null) continue;
      if (typeof v !== "string") throw new Error(`${at}.${field} must be a string when present`);
      if (HONORIFIC.test(v)) throw new Error(`${at}.${field} leaks a personal honorific`);
      if (findPersonalAddress(v)) throw new Error(`${at}.${field} leaks a personal email address`);
    }
  }

  inspect(raw);
  const counted = (key) => threads.filter((t) => t.kinds.includes(key)).length;
  for (const key of KINDS) {
    if ((totals.threadsByKind?.[key] ?? 0) !== counted(key)) {
      throw new Error(`totals.threadsByKind.${key} disagrees with the thread list`);
    }
  }
  const travel = threads.filter((t) => t.fundedTravel).length;
  if (totals.fundedTravelThreads !== travel) {
    throw new Error("totals.fundedTravelThreads disagrees with the thread list");
  }
  if (totals.threads !== threads.length) throw new Error("totals.threads disagrees with the thread list");
  if (typeof totals.emails !== "number" || totals.emails < totals.threads) {
    throw new Error("totals.emails must be at least the thread count");
  }

  if (totals.emails !== threads.reduce((n, t) => n + t.messages, 0)) throw new Error("totals.emails disagrees with the thread list");
  const aggregate = (rows, field) => rows.reduce((out, t) => { const k = field === "year" ? t.date.slice(0, 4) : t[field]; out[k] = (out[k] || 0) + 1; return out; }, {});
  for (const [key, expected] of Object.entries({
    fundedTravelByOrigin: aggregate(threads.filter((t) => t.fundedTravel), "origin"),
    fundedTravelByYear: aggregate(threads.filter((t) => t.fundedTravel), "year"),
    threadsByYear: aggregate(threads, "year"),
  })) {
    const actual = totals[key];
    if (!actual || Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([k, v]) => actual[k] !== v)) throw new Error(`totals.${key} disagrees with the thread list`);
  }
  if (!Array.isArray(totals.correspondenceSpan) || totals.correspondenceSpan.length !== 2 || totals.correspondenceSpan.some((d) => !Number.isFinite(Date.parse(d)))) throw new Error("correspondenceSpan must contain two dates");
  inspect(raw);
  return raw;
}

export const __testing = { COST_HEADS, KINDS };
