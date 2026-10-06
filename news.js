import { escapeHtml as esc, safeUrl } from "./lib/security.mjs";
import { NEWS_COUNTRIES, NEWS_SOURCES, NEWS_TOPICS, filterArticles, validateNewsPayload } from "./lib/news-sources.mjs";

const $ = (selector) => document.querySelector(selector);
const state = { articles: [], sources: [], checkedAt: null, mode: "saved", loading: false, query: "", country: "all", topic: "all", publisher: "all", days: "all" };
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const showDate = (value) => value ? date.format(new Date(value)) : "Date not supplied";

function story(article, compact = false) {
  const location = article.countries.length ? article.countries.join(", ") : "Regional";
  return `<article class="news-story${compact ? " news-story--compact" : ""}">
    <div class="news-story-meta"><span>${esc(article.publisher)}</span><time${article.publishedAt ? ` datetime="${esc(article.publishedAt)}"` : ""}>${esc(showDate(article.publishedAt))}</time>${article.kind && article.kind !== "Report" ? `<span>${esc(article.kind)}</span>` : ""}</div>
    <h2><a href="${esc(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">${esc(article.title)} <span aria-hidden="true">↗</span></a></h2>
    <p class="news-story-tags">${esc(location)}${compact ? "" : ` · ${esc(article.topics.join(" · "))}`}</p>
  </article>`;
}

function render() {
  const articles = filterArticles(state.articles, state);
  $("#news-results").setAttribute("aria-busy", String(state.loading));
  $("#news-results").innerHTML = articles.map((article) => story(article)).join("") || `<div class="news-empty"><h2>No stories match</h2><p>Try another location, topic, or date.</p><button id="news-clear" class="text-button" type="button">Clear filters</button></div>`;
  $("#news-clear")?.addEventListener("click", clearFilters);
  $("#news-count").textContent = `${articles.length} of ${state.articles.length} stories`;
  const checked = state.checkedAt ? `checked ${showDate(state.checkedAt)}` : "";
  const unavailable = state.sources.filter((source) => source.status === "unavailable").length;
  $("#news-status").textContent = state.loading ? `Checking publisher feeds${checked ? ` · saved headlines ${checked}` : "…"}` :
    state.mode === "live" ? `Publisher feeds · ${checked}${unavailable ? ` · ${unavailable} feeds unavailable` : ""}` :
      `Saved reading list · ${checked} · live feeds unavailable`;
  $("#news-refresh").disabled = state.loading;
  $("#news-preview-list").innerHTML = state.articles.slice(0, 3).map((article) => story(article, true)).join("") || `<p class="news-muted">No regional headlines available.</p>`;
  document.querySelectorAll("#news-topics button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.topic === state.topic)));
  $("#news-mobile-topic").value = state.topic;
  const activeFilters = [state.country, state.publisher, state.days, state.topic].filter((value) => value !== "all").length;
  $("#news-filter-summary").textContent = activeFilters ? `Filters · ${activeFilters} active` : "Filters";

  const counts = NEWS_COUNTRIES.map((country) => [country, state.articles.filter((article) => article.countries.includes(country)).length]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...counts.map(([, count]) => count));
  $("#news-coverage").innerHTML = counts.map(([country, count]) => `<button type="button" class="news-country-row" data-country="${esc(country)}"><span>${esc(country)}</span><span class="news-country-bar"><span style="width:${count / max * 100}%"></span></span><strong>${count}</strong></button>`).join("");
  $("#news-coverage").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.country = button.dataset.country; $("#news-country").value = state.country; render(); }));
  $("#news-sources").innerHTML = NEWS_SOURCES.map((source) => {
    const status = state.sources.find((item) => item.id === source.id)?.status;
    return `<div class="news-source"><a href="${esc(source.site)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(source.section)} · ${state.loading ? "checking" : status === "ok" ? "connected" : "unavailable"}</span></div>`;
  }).join("");
}

function updatePublishers() {
  const publishers = [...new Set(state.articles.map((article) => article.publisher))].sort();
  $("#news-publisher").innerHTML = `<option value="all">All publishers</option>${publishers.map((publisher) => `<option>${esc(publisher)}</option>`).join("")}`;
  if (!publishers.includes(state.publisher)) state.publisher = "all";
  $("#news-publisher").value = state.publisher;
}

function clearFilters() {
  Object.assign(state, { query: "", country: "all", topic: "all", publisher: "all", days: "all" });
  $("#news-search").value = "";
  for (const name of ["country", "publisher", "days"]) $(`#news-${name}`).value = "all";
  render();
}

async function refresh() {
  if (state.loading) return;
  state.loading = true; render();
  try {
    const response = await fetch("api/news", { signal: AbortSignal.timeout(15_000), credentials: "omit" });
    const payload = validateNewsPayload(await response.json());
    state.sources = payload.sources;
    if (!response.ok || !payload.articles.length) throw new Error("Feeds unavailable");
    Object.assign(state, { articles: payload.articles, checkedAt: payload.checkedAt, mode: "live" });
    try { localStorage.setItem("ascn-news-v1", JSON.stringify({ ...payload, mode: "saved" })); } catch { /* Reading does not require browser storage. */ }
    updatePublishers();
  } catch {
    state.mode = "saved";
  } finally { state.loading = false; render(); }
}

async function init() {
  const phone = matchMedia("(max-width: 600px)");
  $("#news-filter-panel").open = !phone.matches;
  phone.addEventListener("change", () => { $("#news-filter-panel").open = !phone.matches; });
  $("#news-mobile-topic").insertAdjacentHTML("beforeend", NEWS_TOPICS.map((topic) => `<option>${esc(topic)}</option>`).join(""));
  $("#news-mobile-topic").addEventListener("change", (event) => { state.topic = event.target.value; render(); });
  $("#news-country").insertAdjacentHTML("beforeend", [...NEWS_COUNTRIES, "Regional"].map((country) => `<option>${esc(country)}</option>`).join(""));
  $("#news-topics").innerHTML = ["all", ...NEWS_TOPICS].map((topic) => `<button type="button" data-topic="${esc(topic)}" aria-pressed="${topic === "all"}">${topic === "all" ? "All topics" : esc(topic)}</button>`).join("");
  $("#news-topics").addEventListener("click", (event) => { const button = event.target.closest("button[data-topic]"); if (button) { state.topic = button.dataset.topic; render(); } });
  $("#news-search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  for (const name of ["country", "publisher", "days"]) $(`#news-${name}`).addEventListener("change", (event) => { state[name] = event.target.value; render(); });
  $("#news-refresh").addEventListener("click", refresh);
  try {
    let saved;
    try { const raw = localStorage.getItem("ascn-news-v1"); if (raw && raw.length < 250000) saved = validateNewsPayload(JSON.parse(raw)); } catch { /* Invalid saved data is replaced by the checked reading list. */ }
    if (!saved?.articles.length) saved = validateNewsPayload(await (await fetch("data/news-snapshot.json")).json());
    Object.assign(state, { articles: saved.articles, checkedAt: saved.checkedAt, mode: "saved" });
    updatePublishers();
  } catch { /* Feed refresh can still recover if the reading list cannot load. */ }
  render();
  await refresh();
}

init();
