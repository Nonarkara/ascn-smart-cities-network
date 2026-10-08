import { escapeHtml as esc, safeUrl, csvCell, validateDataset } from "./lib/security.mjs";
import { REVIEW_STAGES, REVIEW_MANDATES, SOURCE_TYPES, validateArchive, filterRecords, summarizeEvidence, cityEvidence, linkProjects, discoveryInbox } from "./lib/ascn-review.mjs";
import { validateDiscovery, mergeDiscovery } from "./lib/ascn-discovery.mjs";

const $ = (selector) => document.querySelector(selector);
const state = { archive: null, cities: [], engine: null, page: 0, discoveryPage: 0, candidates: [], discoveryQuery: "", checkedAt: null, discoveryMode: "saved", discoverySources: [], loading: false,
  filters: { query: "", city: "all", year: "all", stage: "all", sourceType: "all", mandate: "all" } };
const format = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const showDate = (value) => value ? date.format(new Date(value)) : "Publication date unknown";
const external = (url, label) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pageSize = 10;

async function json(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000), credentials: "omit" });
  if (!response.ok) throw new Error(`Cannot load ${path}`);
  return response.json();
}

function route() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const [tab, view = "review"] = path.split("/");
  const selected = ["review", "archive", "discovery", "regional"].includes(view) ? view : "review";
  document.querySelectorAll("[data-news-panel]").forEach((panel) => { panel.hidden = panel.dataset.newsPanel !== selected; });
  document.querySelectorAll("[data-news-view]").forEach((link) => { if (link.dataset.newsView === selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  $("#review-controls").hidden = !["review", "archive"].includes(selected);
  $("#review-status").hidden = !["review", "archive"].includes(selected);
  const city = new URLSearchParams(query).get("city");
  if (tab === "news" && city && state.cities.some((item) => item.name === city)) { state.filters.city = city; $("#review-city").value = city; state.page = 0; render(); }
}

function bars(rows, key, label) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return `<div class="review-bars" role="img" aria-label="${esc(label)}">${rows.map((row) => `<div class="review-bar-row"><span>${esc(row[key])}</span><span class="review-bar-track"><span style="width:${row.count / max * 100}%"></span></span><strong>${row.count}</strong></div>`).join("")}</div>`;
}

function pagination(selector, page, length, change) {
  const pages = Math.max(1, Math.ceil(length / pageSize));
  $(selector).innerHTML = `<button type="button" data-page="${page - 1}" aria-label="Previous page" title="Previous page" ${page === 0 ? "disabled" : ""}>←</button><span>Page ${page + 1} of ${pages} · ${length} records</span><button type="button" data-page="${page + 1}" aria-label="Next page" title="Next page" ${page + 1 >= pages ? "disabled" : ""}>→</button>`;
  $(selector).querySelectorAll("button").forEach((button) => button.addEventListener("click", () => change(Number(button.dataset.page))));
}

function record(row) {
  const year = state.engine?.reports.at(-1)?.year;
  const links = year ? linkProjects(row, state.engine.projects, year) : [];
  return `<article class="review-record" id="evidence-${esc(row.id)}">
    <div class="news-story-meta"><span>${esc(row.publisher)}</span><span>${esc(row.sourceType)}</span><span>${esc(row.stage)}</span><span>${esc(row.language)}</span></div>
    <h2>${external(row.url, row.title)}</h2>
    <p class="review-note">${esc(showDate(row.publishedAt))}${!row.publishedAt ? ` · ${row.year} context` : ""} · ${esc(row.access)} · reviewed ${showDate(state.archive.reviewedAt)}</p>
    <p>${esc(row.claim)}</p>
    <details><summary>Analysis &amp; follow-up</summary><div class="review-record-detail">
      <p><strong>Review interpretation.</strong> ${esc(row.analysis)}</p><p><strong>Evidence needed.</strong> ${esc(row.followUp)}</p>
      ${row.metrics.map((metric) => `<p class="review-reported"><strong>${format.format(metric.value)} ${esc(metric.unit)}</strong> · ${esc(metric.label)} · as of ${esc(metric.asOf)} · source-reported, not audited</p>`).join("")}
      ${row.cities.length ? `<p>City evidence: ${row.cities.map((city) => `<a href="#cities/${slug(city)}">${esc(city)}</a>`).join(", ")}</p>` : "<p>Network-level evidence; not assigned to every member city.</p>"}
      ${links.length ? `<ul class="review-project-links">${links.map((link) => `<li>${esc(link.city)} · ${esc(link.project)}: ${link.row ? `${esc(link.row.status)} in ${year} ${external(`${state.engine.reports.at(-1).url}#page=${link.row.source_page}`, `M&E appendix, PDF page ${link.row.source_page}`)}` : `no exact linked row in the ${year} extracted register`}</li>`).join("")}</ul>` : ""}
      <p class="review-note">ASCN objective: ${esc(row.mandates.join(" · "))}</p>
    </div></details>
  </article>`;
}

function renderBaseline() {
  const reports = state.engine?.reports;
  if (!reports) { $("#review-baseline").innerHTML = '<p class="review-note">Official project comparison unavailable. News evidence remains readable; no status figures are inferred from headlines.</p>'; return; }
  const latest = reports.at(-1);
  const maximum = Math.max(...reports.map((report) => report.total_projects));
  $("#review-baseline").innerHTML = `<h2>Official portfolio baseline</h2><p>${latest.total_projects} projects at ${showDate(latest.as_of)}: ${latest.status.completed} completed, ${latest.status.ongoing} ongoing, ${latest.status.planning} planning.</p>
    <div class="review-bars" role="img" aria-label="Official project totals by reporting year">${reports.map((report) => `<div class="review-bar-row"><span>${report.year}</span><span class="review-bar-track"><span style="width:${report.total_projects / maximum * 100}%"></span></span><strong>${report.total_projects}</strong></div>`).join("")}</div>
    <p class="review-note">Official M&E status, not independently audited impact. ${reports.map((report) => external(report.url, String(report.year))).join(" · ")}. The news archive never overwrites these figures.</p>`;
}

function render() {
  if (!state.archive) return;
  const rows = filterRecords(state.archive.records, state.filters);
  const summary = summarizeEvidence(rows, Number(state.archive.reviewedAt.slice(0, 4)));
  const all = summarizeEvidence(state.archive.records);
  const year = state.engine?.reports.at(-1)?.year ?? null;
  const matrix = cityEvidence(rows, state.cities, state.engine?.projects, year);
  const shownCities = matrix.filter((city) => state.filters.city === "all" || city.name === state.filters.city);
  const gapCount = shownCities.filter((city) => !city.delivery).length;
  $("#review-status").textContent = `${rows.length} of ${all.records} reviewed records · ${summary.events} distinct topics/events · reviewed ${showDate(state.archive.reviewedAt)}`;
  $("#review-verdict").innerHTML = `<h2>${!rows.length ? "No evidence matches this selection" : summary.outcomeEvents ? "Outcome claims need their comparison evidence" : "Activity is documented. Citizen impact remains an evidence gap."}</h2>
    <p>${summary.records} records across ${summary.events} distinct topics/events in this selection. ${summary.outcomeEvents} events have a reviewed outcome comparison; that is a limit of this archive, not proof that cities produced no benefits.</p>
    <dl class="review-measures"><div><dt>City-specific evidence</dt><dd>${summary.cityCount}</dd></div><div><dt>Selected cities without delivery coverage</dt><dd>${gapCount} / ${shownCities.length}</dd></div><div><dt>Outcome comparison events</dt><dd>${summary.outcomeEvents}</dd></div></dl>`;
  $("#review-stage-chart").innerHTML = bars(summary.stages, "stage", "Reviewed records by evidence stage; counts start at zero");
  $("#review-timeline").innerHTML = bars(summary.years, "year", "Archive record count by year, 2018 to 2026");
  const questions = { Cooperation: "Which shared practices were adopted by another city, and what changed after adoption?", "Bankable projects": "Which proposals reached financial close, procurement and operation?", Funding: "Which commitments were disbursed to named city projects, in which currencies and periods?" };
  $("#review-mandates").innerHTML = REVIEW_MANDATES.map((mandate) => {
    const matched = rows.filter((row) => row.mandates.includes(mandate));
    return `<div class="review-mandate"><h3>${esc(mandate)}</h3><p>${matched.length} relevant records · ${new Set(matched.map((row) => row.eventId)).size} topics/events</p><p>${esc(questions[mandate])}</p>${matched.slice(0, 2).map((row) => `<a href="#news/archive?city=${encodeURIComponent(state.filters.city === "all" ? "" : state.filters.city)}" data-evidence-id="${esc(row.id)}">${esc(row.title)} ↗</a>`).join("")}</div>`;
  }).join("");
  const topics = new Set();
  const followups = rows.filter((row) => { if (!(row.projectLinks.length || row.mandates.includes("Funding") || row.stage === "Scrutiny") || topics.has(row.eventId)) return false; topics.add(row.eventId); return true; }).slice(0, 6);
  $("#review-followups").innerHTML = followups.map((row) => `<div class="review-followup"><h3>${esc(row.cities.join(", ") || row.title)}</h3><p>${esc(row.followUp)}</p><p class="review-note">Based on ${external(row.url, row.publisher)} · ${esc(showDate(row.publishedAt))} · review question, not a verified failure</p></div>`).join("") || '<p class="review-note">No project-specific or financing follow-up in this selection. Broaden the evidence filters.</p>';
  $("#review-cities").innerHTML = shownCities.map((city) => `<tr><th><button type="button" data-review-city="${esc(city.name)}">${esc(city.name)}</button><small>${esc(city.country)}</small></th><td>${city.evidence || "No coverage"}</td><td>${city.delivery || "No coverage"}</td><td>${city.outcomes || "Not evidenced"}</td><td>${city.projects === null ? "Unavailable" : city.projects || "No row"}</td></tr>`).join("");
  $("#review-cities").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.filters.city = button.dataset.reviewCity; $("#review-city").value = state.filters.city; state.page = 0; render(); }));
  state.page = Math.min(state.page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  $("#review-archive").innerHTML = rows.slice(state.page * pageSize, (state.page + 1) * pageSize).map(record).join("") || '<p class="review-empty">No evidence matches. Reset or broaden the filters.</p>';
  pagination("#review-pagination", state.page, rows.length, (page) => { state.page = page; render(); $("#review-archive").scrollIntoView(); });
  $("#review-method").innerHTML = `<p>${esc(state.archive.scope)}</p><p>Sources checked ${showDate(state.archive.reviewedAt)}. Search routes: ${esc(state.archive.queries.join("; "))}.</p><p>Commitment = an intention or pledge; Cooperation = a meeting or partnership; Implementation = work in progress; Output = a delivered asset, service reach or published product; Outcome = a measured change with explicit comparison; Scrutiny = attributed research or critique. These are review classifications, not official project statuses.</p><p>Multiple records can cover one event. The distinct-event count uses curated topic/event keys, not an estimate of all activity. Source type does not guarantee accuracy or independence; implementing partners and official releases can be interested parties. Indexed-text records have partial access. Unknown publication dates are not invented.</p><p>Discovery matches are never promoted automatically. An editor must check the source, identify the claim and limits, link a real city/project, and commit a reviewed record. No article bodies or publisher images are republished; summaries and interpretations are this platform's.</p><p>News does not establish ASCN's causal contribution. Absence of news is not absence of activity. Outcome measures, audited financing and service records are needed for a stronger performance verdict.</p>`;
  renderBaseline();
}

function renderDiscovery() {
  const inbox = discoveryInbox(state.candidates, state.archive?.records || []);
  const search = state.discoveryQuery.toLowerCase().trim();
  const rows = inbox.filter((row) => !search || `${row.title} ${row.publisher}`.toLowerCase().includes(search));
  state.discoveryPage = Math.min(state.discoveryPage, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const unavailable = state.discoverySources.filter((source) => source.status !== "ok").length;
  $("#discovery-status").textContent = `${state.loading ? "Checking index" : state.discoveryMode === "live" ? "Index checked" : "Saved index; live check unavailable"} · ${state.checkedAt ? showDate(state.checkedAt) : "check date unknown"} · ${rows.length} matching leads · ${state.candidates.length - inbox.length} title matches already reviewed${unavailable ? ` · ${unavailable} search feeds unavailable` : ""}`;
  $("#discovery-refresh").disabled = state.loading;
  $("#discovery-results").innerHTML = rows.slice(state.discoveryPage * pageSize, (state.discoveryPage + 1) * pageSize).map((row) => `<article class="review-record"><div class="news-story-meta"><span>${esc(row.publisher)}</span><span>Unreviewed search match</span></div><h2>${external(row.url, row.title)}</h2><p class="review-note">Index date: ${row.publishedAt ? showDate(row.publishedAt) : "unknown"} · Google News link · not included in findings</p></article>`).join("") || '<p class="review-empty">No indexed leads match. The reviewed archive remains available.</p>';
  pagination("#discovery-pagination", state.discoveryPage, rows.length, (page) => { state.discoveryPage = page; renderDiscovery(); $("#discovery-results").scrollIntoView(); });
}

async function refreshDiscovery() {
  if (state.loading) return;
  state.loading = true; renderDiscovery();
  try {
    const payload = validateDiscovery(await json("api/ascn-news"));
    if (!payload.articles.length) throw new Error("Index unavailable");
    state.candidates = mergeDiscovery([payload.articles, state.candidates]);
    state.checkedAt = payload.checkedAt; state.discoverySources = payload.sources; state.discoveryMode = "live";
  } catch { state.discoveryMode = "saved"; }
  finally { state.loading = false; renderDiscovery(); }
}

function exportEvidence() {
  if (!state.archive) return;
  const rows = filterRecords(state.archive.records, state.filters);
  const keys = ["id", "title", "url", "publisher", "publishedAt", "year", "sourceType", "access", "stage", "eventId", "cities", "mandates", "claim", "analysis", "followUp"];
  const csv = [keys.map(csvCell).join(","), ...rows.map((row) => keys.map((key) => csvCell(Array.isArray(row[key]) ? row[key].join("; ") : row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "ascn-reviewed-evidence.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function initArchive() {
  try {
    const [archive, cities] = await Promise.all([json("data/ascn-news-archive.json"), json("data/ascn-cities.json").then((data) => validateDataset("ascn-cities.json", data))]);
    state.cities = cities.cities; state.archive = validateArchive(archive, state.cities);
    const lastYear = Number(archive.reviewedAt.slice(0, 4));
    $("#review-year").insertAdjacentHTML("beforeend", Array.from({ length: lastYear - 2018 + 1 }, (_, index) => `<option>${lastYear - index}</option>`).join(""));
    $("#review-city").insertAdjacentHTML("beforeend", state.cities.map((city) => `<option>${esc(city.name)}</option>`).join(""));
    render(); route(); renderDiscovery();
    try { state.engine = validateDataset("ascn-v2-data.json", await json("data/ascn-v2-data.json")); render(); } catch { renderBaseline(); }
  } catch { $("#review-status").textContent = "ASCN evidence archive unavailable. Regional news and discovery remain available."; }
}

async function initDiscovery() {
  try { const saved = validateDiscovery(await json("data/ascn-news-discovery.json")); state.candidates = saved.articles; state.checkedAt = saved.checkedAt; } catch { /* A live index check may recover independently. */ }
  renderDiscovery(); await refreshDiscovery();
}

for (const [key, values] of [["stage", REVIEW_STAGES], ["sourceType", SOURCE_TYPES], ["mandate", REVIEW_MANDATES]]) {
  $(`#review-${key}`).insertAdjacentHTML("beforeend", values.map((value) => `<option>${esc(value)}</option>`).join(""));
}
for (const key of ["city", "year", "stage", "sourceType", "mandate"]) $(`#review-${key}`).addEventListener("change", (event) => { state.filters[key] = event.target.value; state.page = 0; render(); });
$("#review-search").addEventListener("input", (event) => { state.filters.query = event.target.value; state.page = 0; render(); });
$("#review-clear").addEventListener("click", () => { for (const key of Object.keys(state.filters)) { state.filters[key] = key === "query" ? "" : "all"; $(`#review-${key === "query" ? "search" : key}`).value = state.filters[key]; } state.page = 0; history.replaceState(null, "", location.hash.split("?")[0]); render(); });
$("#review-export").addEventListener("click", exportEvidence);
$("#discovery-refresh").addEventListener("click", refreshDiscovery);
$("#discovery-search").addEventListener("input", (event) => { state.discoveryQuery = event.target.value; state.discoveryPage = 0; renderDiscovery(); });
$("#review-mandates").addEventListener("click", (event) => { const link = event.target.closest("[data-evidence-id]"); if (!link) return; event.preventDefault(); state.filters.query = ""; $("#review-search").value = ""; const rows = filterRecords(state.archive.records, state.filters); state.page = Math.floor(rows.findIndex((row) => row.id === link.dataset.evidenceId) / pageSize); render(); location.hash = "#news/archive"; });
window.addEventListener("hashchange", route);
window.addEventListener("ascn:tabchange", route);
route(); initArchive(); initDiscovery();
