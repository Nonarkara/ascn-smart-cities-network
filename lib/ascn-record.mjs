import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { safeUrl } from "./security.mjs";
import { MERGE, PENDING, SCRAPE, SCRAPE_ALIAS } from "./ascn-scrape.mjs";
import { ACCOUNT, fundingFromItems } from "./ascn-funding.mjs";
import { programmeRows, reconcileDonorSheet, tiedAidClaims } from "./ascn-round2.mjs";

export const ARCHIVE_TYPES = ["grant", "trip", "mou", "communication", "course"];
export const ARCHIVE_OUTCOMES = ["delivered", "partial", "stalled", "failed"];
const TYPE_SET = new Set(ARCHIVE_TYPES);
const OUTCOME_SET = new Set(ARCHIVE_OUTCOMES);
const LANGS = ["en", "th", "zh"];
const ITEM_KEYS = ["id", "type", "date", "title", "counterpart", "outcome", "note", "source", "public", "amount", "confidence", "selfReported", "flow"];
const FLOWS = new Set(["tied-aid", "phantom-aid"]);
const PENDING_KEYS = ["id", "date", "title", "counterpart", "note", "source", "confidence", "status"];
const MONEY_KEYS = ["id", "scope", "claim", "donor", "figure", "year", "source", "confidence", "qualifier"];
const MERGE_KEYS = ["programme", "into", "source"];
const SCOPES = new Set(["general", "ascn"]);
const HIGH_SOURCE = new Set(["hlm3-2021", "usascp-ius-2021", "ascn-site-repo"]);
const UNREAD_REVIEW = /Baguio|financial-management|\bGold\b/;
const DENY_KEYS = new Set([
  "thread_ids", "threadIds", "summary", "participants", "sender_org", "borderline_reason",
  "publishable", "funders", "amounts", "outcome_evidence", "has_outcome", "public_url",
  "email", "phone", "body", "gmail", "passcode",
]);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const OBFUSCATED_EMAIL = /\b[A-Z0-9._%+-]+\s*(?:\(|\[)?\s*at\s*(?:\)|\])?\s*[A-Z0-9.-]+\s*(?:\(|\[)?\s*dot\s*(?:\)|\])?\s*[A-Z]{2,}\b/i;
const PHONE_PATTERNS = [
  /\+\d{1,3}(?:[\s().-]*\d){7,14}/,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
  /\b0[689]\d(?:[-.\s]?\d){7}\b/,
  /\(\d{2,4}\)\s*\d{3,4}[-.\s]?\d{3,4}/,
];
const RAW_EMAIL = /(?:^|[\n\r])\s*(?:from|to|cc|bcc|subject|sent)\s*:|mail\.google\.com|\bgmail\.com\b|\bthread[_ ]?ids?\b|\bwrote:\s*$|original message|begin forwarded message|mime-version:|content-type:\s*text\//im;

const COVERAGE = {
  en: "Public items linked to the ASEAN Smart Cities Network, from one cleared inbox and from public pages. That inbox is a single witness record, not a network-wide total: nothing here counts what the network did, only what one person was shown. Each item says whether that trail shows a result. Figures taken from ASEAN’s own monitoring reports are labelled self-reported. A document that has not been read is listed as pending review and states no findings. This is not the network’s full record.",
  th: "รายการสาธารณะที่เกี่ยวกับเครือข่ายเมืองอัจฉริยะอาเซียน จากกล่องจดหมายที่ตรวจแล้วหนึ่งกล่องและจากหน้าสาธารณะ กล่องจดหมายนั้นเป็นบันทึกจากพยานคนเดียว ไม่ใช่ยอดรวมของทั้งเครือข่าย สิ่งที่อยู่ที่นี่ไม่นับว่าเครือข่ายทำอะไร แต่นับเฉพาะสิ่งที่คนคนเดียวได้เห็น แต่ละรายการบอกว่าเส้นทางนั้นมีผลหรือไม่ ตัวเลขจากรายงานติดตามของอาเซียนเองถูกกำกับว่าเป็นรายงานเอง เอกสารที่ยังไม่ได้อ่านถูกใส่เป็นรอการทบทวนและไม่ระบุข้อค้นพบ นี่ไม่ใช่บันทึกทั้งหมดของเครือข่าย",
  zh: "与东盟智慧城市网络有关的公开事项，来自一个已核可的收件箱和公开网页。该收件箱是一份单一证人记录，不是全网络的总计：这里不计网络做了什么，只计一个人被展示了什么。每一条都写明这条线索有没有结果。取自东盟自己监测报告的数字标为自行报告。尚未读过的文件列为待审阅，并且不陈述结论。这不是整个网络的全部记录。",
};

const NOT_PUBLIC = {
  en: "Not public.",
  th: "ไม่ใช่ข้อมูลสาธารณะ",
  zh: "未公开。",
};

const WITHHELD_COPY = {
  "stgp-korea-2022": {
    en: "Not published.",
    th: "Not published.",
    zh: "Not published.",
  },
  "ascn8-chonburi-2025": {
    en: "Not published.",
    th: "Not published.",
    zh: "Not published.",
  },
  "ascn-linkedin-page": {
    en: "Not published.",
    th: "Not published.",
    zh: "Not published.",
  },
};

const org = (en, th, zh) => ({ en, th, zh });
const text = (en, th, zh) => ({ en, th, zh });

const MLIT = org(
  "Ministry of Land, Infrastructure, Transport and Tourism (Japan)",
  "กระทรวงที่ดิน โครงสร้างพื้นฐาน การขนส่ง และการท่องเที่ยว (ญี่ปุ่น)",
  "日本国土交通省",
);
const ASEAN = org("ASEAN Secretariat", "สำนักเลขาธิการอาเซียน", "东盟秘书处");

// Public wording for inbox rows. Dates stay with the source record so a later
// correction is picked up on the next build. Bodies, thread ids and names of
// private correspondents are never copied across.
const EDITORIAL = {
  "ascn-site-repo": {
    type: "communication",
    outcome: "delivered",
    source: "https://github.com/Nonarkara/ascn-smart-cities-network",
    counterpart: null,
    title: text(
      "Public site and repository for this ASCN record",
      "เว็บไซต์สาธารณะและคลังโค้ดของบันทึก ASCN นี้",
      "本 ASCN 记录的公开网站与代码库",
    ),
    note: text(
      "This public site is live. It is Dr Non’s own output, not a result delivered by the ASCN secretariat.",
      "เว็บไซต์สาธารณะนี้เปิดใช้งานอยู่ เป็นผลงานของ ดร. นนท์ เอง ไม่ใช่ผลที่สำนักเลขาธิการ ASCN ส่งมอบ",
      "这个公开网站已经上线。它是 Non 博士自己的成果，不是 ASCN 秘书处交付的结果。",
    ),
  },
};

export const inboxEditorialIds = Object.keys(EDITORIAL);

function fail(message) {
  throw new Error(message);
}

function localized(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be {en, th, zh}`);
  for (const key of Object.keys(value)) if (!LANGS.includes(key)) fail(`${field}: unexpected localized field ${key}`);
  const out = {};
  for (const lang of LANGS) {
    if (typeof value[lang] !== "string" || !value[lang].trim()) fail(`${field}.${lang} is empty`);
    out[lang] = value[lang].trim();
  }
  return out;
}

export function privateTextIssue(value, path = "") {
  if (typeof value === "string") {
    if (EMAIL.test(value) || OBFUSCATED_EMAIL.test(value) || /mailto:/i.test(value)) return `email address in ${path || "text"}`;
    if (PHONE_PATTERNS.some((pattern) => pattern.test(value))) return `phone number in ${path || "text"}`;
    if (RAW_EMAIL.test(value)) return `raw email text in ${path || "text"}`;
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const issue = privateTextIssue(value[index], `${path}[${index}]`);
      if (issue) return issue;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (DENY_KEYS.has(key)) return `raw email field ${path ? `${path}.` : ""}${key}`;
      const issue = privateTextIssue(child, path ? `${path}.${key}` : key);
      if (issue) return issue;
    }
  }
  return null;
}

function assertDate(date, id) {
  if (typeof date !== "string" || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) {
    fail(`${id} is missing a YYYY, YYYY-MM, or YYYY-MM-DD date`);
  }
  if (date.length === 4) return;
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12) fail(`${id} date is not a real month`);
  if (date.length === 7) return;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    fail(`${id} date is not a real day`);
  }
}

function sourceOf(value, field) {
  if (value === "inbox") return value;
  if (typeof value !== "string" || safeUrl(value) === "#" || !/^https?:\/\//i.test(value)) {
    fail(`${field} must be a public http(s) URL or "inbox"`);
  }
  return value;
}

function amountOf(value, field) {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) fail(`${field} is not a public amount`);
    return value;
  }
  if (typeof value !== "string" || !value.trim() || /none stated|not public|^n\/a$/i.test(value)) {
    fail(`${field} is not a public amount`);
  }
  return value.trim();
}

function isScrape(row) {
  return Boolean(row) && typeof row.scrapeId === "string" && typeof row.source_url === "string";
}

function isInbox(row) {
  return Boolean(row) && !isScrape(row) && (typeof row.title === "string" || typeof row.publishable === "string" || Array.isArray(row.thread_ids));
}

function isPublicShape(row) {
  return Boolean(row) && row.public === true && row.title && typeof row.title === "object" && !Array.isArray(row.title) && TYPE_SET.has(row.type);
}

function exclusion(row) {
  if (!row || typeof row !== "object") return "not public";
  if (row.public === false) return "not public";
  const publishable = typeof row.publishable === "string" ? row.publishable : "";
  const borderline = typeof row.borderline_reason === "string" ? row.borderline_reason.trim() : "";
  if (publishable && publishable !== "yes") return borderline || "not public";
  if (borderline) return borderline;
  return null;
}

function dateRank(date) {
  if (typeof date !== "string") return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return 3;
  if (/^\d{4}-\d{2}$/.test(date)) return 2;
  if (/^\d{4}$/.test(date)) return 1;
  return 0;
}

function bestDate(rows, id) {
  let best = "";
  let rank = 0;
  for (const row of rows) {
    const next = dateRank(row?.date);
    if (next > rank || (next === rank && next > 0 && row.date > best)) {
      best = row.date;
      rank = next;
    }
  }
  if (!rank) fail(`${id} is missing a YYYY, YYYY-MM, or YYYY-MM-DD date`);
  return best;
}

function confidenceOf(value, id, fallback) {
  const confidence = value ?? fallback;
  if (confidence !== "high" && confidence !== "medium") fail(`${id} confidence must be high or medium`);
  return confidence;
}

function formatAmount(row) {
  const currency = String(row.currency || "").trim();
  const raw = String(row.amount || "").trim();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`${row.scrapeId} currency is not a public amount`);
  const over = raw.endsWith("+");
  const digits = over ? raw.slice(0, -1) : raw;
  if (!/^\d+$/.test(digits)) fail(`${row.scrapeId} amount is not a public amount`);
  return over ? `over ${currency} ${digits}` : `${currency} ${digits}`;
}

function withScrape(base, scrape) {
  const overlay = MERGE[scrape.scrapeId] || {};
  const next = { ...base, ...overlay, source: scrape.source_url };
  next.confidence = confidenceOf(scrape.confidence, scrape.scrapeId);
  if (base.selfReported === true || overlay.selfReported === true || /self-reported/i.test(scrape.source_type || "")) next.selfReported = true;
  else delete next.selfReported;
  if (next.publicAmount === true) next.amount = formatAmount(scrape);
  else delete next.amount;
  return next;
}

function normalizeItem(raw, id) {
  assertDate(raw.date, id);
  const item = {
    id,
    type: raw.type,
    date: raw.date,
    title: localized(raw.title, `${id} title`),
    counterpart: raw.counterpart == null ? null : localized(raw.counterpart, `${id} counterpart`),
    outcome: raw.outcome,
    note: localized(raw.note, `${id} note`),
    source: sourceOf(raw.source, `${id} source`),
    public: true,
    confidence: confidenceOf(raw.confidence, id, "high"),
  };
  if (!TYPE_SET.has(item.type)) fail(`${id} has an unknown type`);
  if (!OUTCOME_SET.has(item.outcome)) fail(`${id} has an unknown outcome`);
  if (raw.public === false) fail(`${id} is not public`);
  const amount = amountOf(raw.amount, `${id} amount`);
  if (amount != null) item.amount = amount;
  if (raw.selfReported === true) item.selfReported = true;
  else if (raw.selfReported != null && raw.selfReported !== false) fail(`${id} selfReported must be true`);
  if (raw.flow != null) {
    if (!FLOWS.has(raw.flow)) fail(`${id} flow must be tied-aid or phantom-aid`);
    item.flow = raw.flow;
  }
  return item;
}

function normalizePending(raw) {
  assertDate(raw.date, raw.id);
  const row = {
    id: raw.id,
    date: raw.date,
    title: localized(raw.title, `${raw.id} title`),
    counterpart: localized(raw.counterpart, `${raw.id} counterpart`),
    note: localized(raw.note, `${raw.id} note`),
    source: sourceOf(raw.source, `${raw.id} source`),
    confidence: confidenceOf(raw.confidence, raw.id),
    status: "pending review",
  };
  if (raw.status != null && raw.status !== "pending review") fail(`${raw.id} status must be pending review`);
  if (raw.outcome != null || raw.amount != null) fail(`${raw.id} pending review states no findings`);
  if (UNREAD_REVIEW.test(JSON.stringify(row))) fail(`${raw.id} quotes an unread review`);
  return row;
}

function withheldReason(id, rawReason) {
  if (rawReason === "not public") return NOT_PUBLIC;
  if (WITHHELD_COPY[id]) return WITHHELD_COPY[id];
  fail(`No public wording for withheld record ${id}`);
}

function assertNoThreadLeak(rows, document) {
  const output = JSON.stringify(document);
  for (const row of rows) {
    for (const threadId of row?.thread_ids || []) {
      if (threadId && output.includes(threadId)) fail(`Output contains thread id for ${row.id}`);
    }
  }
}

export function archiveSpan(items) {
  const years = items.map((item) => Number(String(item.date).slice(0, 4))).filter((year) => Number.isInteger(year));
  const last = Math.max(2026, 2018, ...years);
  return Array.from({ length: last - 2018 + 1 }, (_, index) => 2018 + index);
}

export function archiveReport(document, meta = {}) {
  const lines = [];
  if (meta.sourceRows != null) lines.push(`Source rows ${meta.sourceRows}`);
  lines.push(`Included ${document.items.length}`);
  for (const item of document.items) {
    lines.push(`- ${item.id}  ${item.type}  ${item.outcome}  ${item.confidence}${item.selfReported ? "  self-reported" : ""}`);
  }
  lines.push(`Excluded ${document.withheld.length}`);
  for (const row of document.withheld) lines.push(`- ${row.id}: ${row.reason.en}`);
  lines.push(`Pending review ${document.pending.length}`);
  for (const row of document.pending) lines.push(`- ${row.id}: ${row.status}`);
  const merged = meta.merged || [];
  lines.push(`Merged ${merged.length}`);
  for (const pair of merged) lines.push(`- ${pair.from} into ${pair.into}`);
  lines.push(`Round 2 files ${meta.round2Files || 0}`);
  lines.push(`Programmes added ${meta.programmesAdded || 0}`);
  const money = document.money || [];
  const general = money.filter((row) => row.scope === "general").length;
  const ascn = money.filter((row) => row.scope === "ascn").length;
  lines.push(`Money claims ${money.length} (general ${general}, ASCN-specific ${ascn})`);
  const folds = document.mergedProgrammes || [];
  lines.push(`Programme merges ${folds.length}`);
  for (const pair of folds) lines.push(`- ${pair.programme} into ${pair.into}`);
  const conflicts = document.reconciliation?.conflicts || [];
  lines.push(`Conflicts ${conflicts.length}`);
  for (const conflict of conflicts) lines.push(`- ${conflict.text?.en || ""}`);
  if (document.funding) {
    for (const donor of document.funding.donors) {
      const figure = (total) => (total ? `${total.currency} ${total.amount}` : "not public");
      lines.push(`Funding ${donor.id}: committed ${figure(donor.committed)}; disbursed ${figure(donor.disbursed)}`);
    }
  }
  return lines.join("\n");
}

export function buildArchive(rows, extras = {}) {
  if (!Array.isArray(rows)) fail("Archive source must be an array of records");
  const byId = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id.trim()) fail("A record is missing id");
    const id = row.id.trim();
    byId.set(id, [...(byId.get(id) || []), row]);
  }

  const items = [];
  const withheld = [];
  const pending = [];
  for (const [id, group] of byId) {
    const rawReason = group.map(exclusion).find(Boolean);
    if (rawReason) {
      withheld.push({ id, reason: localized(withheldReason(id, rawReason), `${id} withheld reason`) });
      continue;
    }
    const published = group.filter(isPublicShape).at(-1);
    const inbox = group.find(isInbox);
    const scrape = group.find(isScrape);
    const date = bestDate(group, id);
    if (scrape && !published && !inbox && PENDING[scrape.scrapeId]) {
      const copy = PENDING[scrape.scrapeId];
      pending.push(normalizePending({
        id: scrape.scrapeId,
        date,
        title: copy.title,
        counterpart: copy.counterpart,
        note: copy.note,
        source: scrape.source_url,
        confidence: scrape.confidence,
      }));
      continue;
    }
    if (published) {
      items.push(normalizeItem({ ...published, date, confidence: published.confidence || "high" }, id));
      continue;
    }
    if (scrape && !inbox && !SCRAPE[scrape.scrapeId]) fail(`No public wording for ${scrape.scrapeId}. Add a scrape entry before publishing.`);
    if (scrape && inbox && scrape.scrapeId !== id && !MERGE[scrape.scrapeId]) {
      fail(`No merge rule for ${scrape.scrapeId} into ${id}`);
    }
    const editorial = inbox ? EDITORIAL[id] : scrape ? SCRAPE[scrape.scrapeId] : null;
    if (inbox && !editorial) fail(`No public wording for ${id}. Add an editorial entry, or supply a public record with en/th/zh text, before publishing.`);
    if (editorial) {
      const next = scrape ? withScrape(editorial, scrape) : { ...editorial };
      if (!next.confidence) next.confidence = HIGH_SOURCE.has(id) ? "high" : "medium";
      items.push(normalizeItem({ ...next, date }, id));
    } else if (group.some((row) => row.public === true)) {
      fail(`${id} is marked public but is missing type, title translations, or outcome`);
    } else {
      withheld.push({ id, reason: localized(NOT_PUBLIC, `${id} withheld reason`) });
    }
  }

  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  withheld.sort((a, b) => a.id.localeCompare(b.id));
  pending.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const document = {
    schema: 1,
    coverage: COVERAGE,
    items,
    withheld,
    pending,
    funding: fundingFromItems(items),
    account: ACCOUNT,
    money: Array.isArray(extras.money) ? extras.money : [],
    reconciliation: extras.reconciliation || { kept: [], conflicts: [] },
    mergedProgrammes: Array.isArray(extras.mergedProgrammes) ? extras.mergedProgrammes : [],
  };
  assertNoThreadLeak(rows, document);
  return validateRecordArchive(document);
}

function validateMoney(data) {
  if (!Array.isArray(data.money)) fail("ascn-archive.json: money must be an array");
  const ids = new Set();
  for (const row of data.money) {
    if (!row || typeof row !== "object") fail("ascn-archive.json: invalid money claim");
    for (const key of Object.keys(row)) if (!MONEY_KEYS.includes(key)) fail(`${row.id || "money"}: unexpected field ${key}`);
    if (typeof row.id !== "string" || !row.id || ids.has(row.id)) fail("ascn-archive.json: duplicate or empty money id");
    ids.add(row.id);
    if (!SCOPES.has(row.scope)) fail(`${row.id} scope must be general or ascn`);
    localized(row.claim, `${row.id} claim`);
    if (typeof row.donor !== "string" || !row.donor.trim()) fail(`${row.id} donor is empty`);
    if (typeof row.year !== "string" || !row.year.trim()) fail(`${row.id} year is empty`);
    sourceOf(row.source, `${row.id} source`);
    if (row.confidence !== "high" && row.confidence !== "medium") fail(`${row.id} confidence must be high or medium`);
    if (row.figure != null && (typeof row.figure !== "string" || !row.figure.trim())) fail(`${row.id} figure is empty`);
    if (row.qualifier != null) localized(row.qualifier, `${row.id} qualifier`);
  }
}

function validateReconciliation(data, itemIds) {
  const rec = data.reconciliation;
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) fail("ascn-archive.json: reconciliation is missing");
  for (const key of Object.keys(rec)) if (key !== "kept" && key !== "conflicts") fail(`reconciliation: unexpected field ${key}`);
  if (!Array.isArray(rec.kept) || !Array.isArray(rec.conflicts)) fail("ascn-archive.json: reconciliation shape is wrong");
  for (const line of rec.kept) localized(line, "reconciliation kept");
  for (const conflict of rec.conflicts) {
    if (!conflict || typeof conflict !== "object") fail("ascn-archive.json: invalid conflict");
    for (const key of Object.keys(conflict)) if (key !== "text" && key !== "sources") fail("conflict: unexpected field");
    localized(conflict.text, "conflict");
    if (!Array.isArray(conflict.sources) || !conflict.sources.length) fail("A conflict needs at least one source");
    for (const source of conflict.sources) sourceOf(source, "conflict source");
  }
  if (!Array.isArray(data.mergedProgrammes)) fail("ascn-archive.json: mergedProgrammes must be an array");
  for (const pair of data.mergedProgrammes) {
    if (!pair || typeof pair !== "object") fail("ascn-archive.json: invalid programme merge");
    for (const key of Object.keys(pair)) if (!MERGE_KEYS.includes(key)) fail("programme merge: unexpected field");
    if (typeof pair.programme !== "string" || !pair.programme.trim()) fail("programme merge is missing a name");
    if (!itemIds.has(pair.into)) fail(`Programme ${pair.programme} matches ${pair.into}, which is not in the items`);
    sourceOf(pair.source, "programme merge source");
  }
}

export function validateRecordArchive(data) {
  if (!data || data.schema !== 1) fail("ascn-archive.json: schema must be 1");
  localized(data.coverage, "coverage");
  if (!Array.isArray(data.items)) fail("ascn-archive.json: items must be an array");
  if (!Array.isArray(data.withheld)) fail("ascn-archive.json: withheld must be an array");
  if (!Array.isArray(data.pending)) fail("ascn-archive.json: pending must be an array");
  const ids = new Set();
  let previous = "";
  for (const item of data.items) {
    if (!item || typeof item !== "object") fail("ascn-archive.json: invalid item");
    for (const key of Object.keys(item)) if (!ITEM_KEYS.includes(key)) fail(`${item.id || "item"}: unexpected field ${key}`);
    if (typeof item.id !== "string" || !item.id || ids.has(item.id)) fail("ascn-archive.json: duplicate or empty id");
    ids.add(item.id);
    const sortKey = `${item.date}\u0000${item.id}`;
    if (previous && sortKey < previous) fail("ascn-archive.json: items must be sorted by date then id");
    previous = sortKey;
    normalizeItem(item, item.id);
    if (item.public !== true) fail(`${item.id} must be public`);
  }
  const withheldIds = new Set();
  for (const row of data.withheld) {
    if (!row || typeof row.id !== "string" || !row.id || withheldIds.has(row.id) || ids.has(row.id)) {
      fail("ascn-archive.json: withheld ids must be unique and absent from items");
    }
    withheldIds.add(row.id);
    localized(row.reason, `${row.id} withheld reason`);
  }
  const pendingIds = new Set();
  for (const row of data.pending) {
    if (!row || typeof row !== "object") fail("ascn-archive.json: invalid pending row");
    for (const key of Object.keys(row)) if (!PENDING_KEYS.includes(key)) fail(`${row.id || "pending"}: unexpected field ${key}`);
    if (typeof row.id !== "string" || !row.id || pendingIds.has(row.id) || ids.has(row.id) || withheldIds.has(row.id)) {
      fail("ascn-archive.json: pending ids must be unique and absent from items");
    }
    pendingIds.add(row.id);
    const pending = normalizePending(row);
    if (pending.status !== "pending review") fail(`${row.id} must be pending review`);
  }
  validateMoney(data);
  validateReconciliation(data, ids);
  if (UNREAD_REVIEW.test(JSON.stringify({
    pending: data.pending,
    money: data.money,
    reconciliation: data.reconciliation,
    mergedProgrammes: data.mergedProgrammes,
  }))) fail("ascn-archive.json quotes an unread review");
  if (JSON.stringify(data.funding) !== JSON.stringify(fundingFromItems(data.items))) {
    fail("ascn-archive.json funding totals do not match the cited rows");
  }
  if (data.account !== null && JSON.stringify(data.account) !== JSON.stringify(ACCOUNT)) fail("ascn-archive.json account is not the firsthand statement");
  if (data.account && (data.account.source != null || data.account.amount != null)) fail("ascn-archive.json account is not a sourced fact");
  const issue = privateTextIssue(data);
  if (issue) fail(`ascn-archive.json contains ${issue}`);
  return data;
}

async function readJsonRows(path) {
  const text = await readFile(path, "utf8");
  if (text.length > 2_000_000) fail(`Archive JSON is too large: ${path}`);
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function walkJson(dir, rows) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkJson(path, rows);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) rows.push(...await readJsonRows(path));
  }
}

function csvTable(text) {
  const table = parseCsv(String(text || "").replace(/^\uFEFF/, ""));
  const filled = table.filter((row) => row.some((cell) => cell.trim()));
  if (!filled.length) return { header: [], rows: [] };
  const header = filled[0].map((cell) => cell.trim());
  const rows = filled.slice(1).filter((cols) => cols.some((cell) => cell.trim())).map((cols) => {
    const raw = {};
    header.forEach((key, index) => { raw[key] = (cols[index] || "").trim(); });
    return raw;
  });
  return { header, rows };
}

function csvKind(header) {
  const keys = new Set(header);
  if (keys.has("id") && keys.has("confidence") && keys.has("source_url")) return "scrape";
  if (keys.has("claim") && keys.has("scope")) return "tied-aid";
  if (keys.has("programme") && keys.has("funder")) return "programmes";
  if (keys.has("donor") && keys.has("committed") && keys.has("disbursed")) return "funding";
  return "";
}

export function parseRecordsCsv(text) {
  const { header, rows } = csvTable(text);
  if (!header.length) fail("Public records CSV is empty");
  for (const key of ["id", "date", "year", "amount", "currency", "source_url", "source_type", "confidence"]) {
    if (!header.includes(key)) fail(`Public records CSV is missing ${key}`);
  }
  const seen = new Set();
  return rows.map((raw) => {
    if (!/^[A-Z]\d{2}$/.test(raw.id)) fail(`Public row ${raw.id || "(blank)"} is not a scrape id`);
    if (seen.has(raw.id)) fail(`Duplicate public row ${raw.id}`);
    seen.add(raw.id);
    return {
      id: SCRAPE_ALIAS[raw.id] || raw.id,
      scrapeId: raw.id,
      date: raw.date || raw.year,
      source_url: raw.source_url,
      source_type: raw.source_type,
      confidence: raw.confidence,
      amount: raw.amount,
      currency: raw.currency,
    };
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function listCsvFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "src") continue;
      files.push(...await listCsvFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".csv")) files.push(path);
  }
  return files;
}

export async function buildFromDirectory(dir) {
  const recordsPath = join(dir, "records.json");
  if (!existsSync(recordsPath)) fail(`No ASCN archive source at ${recordsPath}. Set ASCN_ARCHIVE_DIR when Scrape’s data lands.`);
  const rows = await readJsonRows(recordsPath);
  await walkJson(join(dir, "public"), rows);
  const csvFiles = [];
  const mainCsv = join(dir, "public", "records.csv");
  if (existsSync(mainCsv)) csvFiles.push(mainCsv);
  const round2Files = await listCsvFiles(join(dir, "public", "round2"));
  csvFiles.push(...round2Files);
  const csvRows = [];
  const money = [];
  const programmeItems = [];
  const programmeMerges = [];
  const donorRows = [];
  for (const path of csvFiles) {
    const csvText = await readFile(path, "utf8");
    if (csvText.length > 2_000_000) fail(`Archive CSV is too large: ${path}`);
    if (!csvText.trim()) continue;
    const { header, rows: tableRows } = csvTable(csvText);
    const kind = csvKind(header);
    if (!kind) fail(`Unrecognised archive CSV: ${path}`);
    if (kind === "scrape") csvRows.push(...parseRecordsCsv(csvText));
    else if (kind === "tied-aid") money.push(...tiedAidClaims(tableRows));
    else if (kind === "programmes") {
      const parsed = programmeRows(tableRows);
      programmeItems.push(...parsed.items);
      programmeMerges.push(...parsed.merged);
    } else donorRows.push(...tableRows);
  }
  const seen = new Set();
  for (const row of csvRows) {
    if (seen.has(row.scrapeId)) fail(`Duplicate public row ${row.scrapeId}`);
    seen.add(row.scrapeId);
  }
  const merged = csvRows.filter((row) => row.scrapeId !== row.id).map((row) => ({ from: row.scrapeId, into: row.id }));
  const knownIds = new Set([...rows, ...csvRows].map((row) => row.id));
  for (const pair of programmeMerges) {
    if (!knownIds.has(pair.into)) fail(`Programme ${pair.programme} matches ${pair.into}, which is not in this archive`);
  }
  for (const item of programmeItems) {
    if (knownIds.has(item.id)) fail(`Programme ${item.id} duplicates an existing row`);
    knownIds.add(item.id);
  }
  rows.push(...csvRows, ...programmeItems);
  const document = buildArchive(rows, {
    money,
    reconciliation: reconcileDonorSheet(donorRows),
    mergedProgrammes: programmeMerges,
  });
  return {
    document,
    report: archiveReport(document, {
      sourceRows: rows.length,
      merged,
      round2Files: round2Files.length,
      programmesAdded: programmeItems.length,
    }),
  };
}
