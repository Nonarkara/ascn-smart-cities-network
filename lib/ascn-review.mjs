import { safeUrl } from "./security.mjs";

export const REVIEW_STAGES = ["Commitment", "Cooperation", "Implementation", "Output", "Outcome", "Scrutiny"];
export const REVIEW_MANDATES = ["Cooperation", "Bankable projects", "Funding"];
export const SOURCE_TYPES = ["Official statement", "News reporting", "Partner report", "Commentary", "Research", "Official monitoring"];
export const cityKey = (name) => String(name).toLowerCase().replace(/^dki\s+/, "").replace(/\s+city$/, "").replace(/ha\s+noi/, "hanoi").replace(/[^a-z0-9]/g, "");
export const titleKey = (title) => String(title).toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");
export const recordDate = (record) => record.publishedAt || `${record.year}-01-01`;
const string = (value, max = 1500) => typeof value === "string" && value.length > 0 && value.length <= max;
const list = (value, allowed) => Array.isArray(value) && value.length <= 50 && value.every((item) => allowed ? allowed.includes(item) : string(item, 160));
const secureUrl = (value) => { try { return string(value, 3000) && new URL(value).protocol === "https:" && safeUrl(value) !== "#"; } catch { return false; } };

export function validateArchive(archive, cities) {
  if (archive?.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(archive.reviewedAt) || !Number.isFinite(Date.parse(archive.reviewedAt)) || !string(archive.scope) || !list(archive.queries) || !Array.isArray(archive.records) || archive.records.length > 5000) throw new Error("Invalid ASCN evidence archive");
  const reviewYear = Number(archive.reviewedAt.slice(0, 4));
  if (reviewYear < 2018 || reviewYear > 2100 || new Date(archive.reviewedAt).toISOString().slice(0, 10) !== archive.reviewedAt) throw new Error("Invalid archive review date");
  const names = cities?.map((city) => city.name);
  const ids = new Set();
  for (const row of archive.records) {
    if (!string(row.id, 100) || !/^[a-z0-9-]+$/.test(row.id) || ids.has(row.id) || !string(row.eventId, 100) || !string(row.title, 240) || !string(row.publisher, 160) || !secureUrl(row.url) || !Number.isInteger(row.year) || row.year < 2018 || row.year > reviewYear || !string(row.language, 50) || !SOURCE_TYPES.includes(row.sourceType) || !["Full text", "Indexed text"].includes(row.access) || !REVIEW_STAGES.includes(row.stage) || !list(row.mandates, REVIEW_MANDATES) || !list(row.cities, names) || !string(row.claim) || !string(row.analysis) || !string(row.followUp)) throw new Error(`Invalid ASCN evidence record: ${row.id || "unknown"}`);
    if (row.publishedAt !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(row.publishedAt) || !Number.isFinite(Date.parse(row.publishedAt)) || new Date(row.publishedAt).toISOString().slice(0, 10) !== row.publishedAt || row.publishedAt > archive.reviewedAt)) throw new Error(`Invalid publication date: ${row.id}`);
    if (!Array.isArray(row.projectLinks) || row.projectLinks.length > 30 || row.projectLinks.some((link) => !row.cities.includes(link.city) || !string(link.project, 240))) throw new Error(`Invalid project link: ${row.id}`);
    if (!Array.isArray(row.metrics) || row.metrics.length > 30 || row.metrics.some((metric) => !string(metric.label, 200) || !Number.isFinite(metric.value) || metric.value < 0 || !string(metric.unit, 100) || !string(metric.asOf, 30))) throw new Error(`Invalid reported metric: ${row.id}`);
    // Outcomes require an explicit comparison, not an output relabelled as impact.
    if (row.stage === "Outcome" && (!string(row.outcomeBasis) || !row.metrics.length)) throw new Error(`Outcome lacks comparison evidence: ${row.id}`);
    ids.add(row.id);
  }
  return archive;
}

export function filterRecords(records, { query = "", city = "all", year = "all", stage = "all", sourceType = "all", mandate = "all" } = {}) {
  const search = query.trim().toLowerCase();
  return records.filter((row) => (city === "all" || row.cities.includes(city)) && (year === "all" || row.year === Number(year)) && (stage === "all" || row.stage === stage) && (sourceType === "all" || row.sourceType === sourceType) && (mandate === "all" || row.mandates.includes(mandate)) && (!search || [row.title, row.publisher, row.claim, row.analysis, ...row.cities, ...row.projectLinks.map((link) => link.project)].join(" ").toLowerCase().includes(search))).sort((a, b) => recordDate(b).localeCompare(recordDate(a)) || a.id.localeCompare(b.id));
}

export function summarizeEvidence(records, endYear = Math.max(2018, ...records.map((row) => row.year))) {
  return { records: records.length, events: new Set(records.map((row) => row.eventId)).size,
    stages: REVIEW_STAGES.map((stage) => ({ stage, count: records.filter((row) => row.stage === stage).length })),
    years: Array.from({ length: Math.max(1, endYear - 2018 + 1) }, (_, i) => 2018 + i).map((year) => ({ year, count: records.filter((row) => row.year === year).length })),
    outcomeEvents: new Set(records.filter((row) => row.stage === "Outcome").map((row) => row.eventId)).size,
    cityCount: new Set(records.flatMap((row) => row.cities)).size };
}

export function cityEvidence(records, cities, projects = [], reportYear = null) {
  return cities.map((city) => {
    const evidence = records.filter((row) => row.cities.includes(city.name));
    return { ...city, evidence: evidence.length, delivery: evidence.filter((row) => ["Implementation", "Output", "Outcome"].includes(row.stage) && row.projectLinks.some((link) => link.city === city.name)).length,
      outcomes: evidence.filter((row) => row.stage === "Outcome").length,
      projects: reportYear === null ? null : projects.filter((row) => row.report_year === reportYear && cityKey(row.city) === cityKey(city.name)).length };
  });
}

export function linkProjects(record, projects, reportYear) {
  return record.projectLinks.map((link) => ({ ...link,
    row: projects.find((row) => row.report_year === reportYear && cityKey(row.city) === cityKey(link.city) && row.project.toLowerCase() === link.project.toLowerCase()) || null }));
}

export function discoveryInbox(articles, records) {
  const reviewed = new Set(records.map((row) => titleKey(row.title)));
  return articles.filter((article) => !reviewed.has(titleKey(article.title))).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}
