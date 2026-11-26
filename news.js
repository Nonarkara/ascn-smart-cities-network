import { escapeHtml as esc, safeUrl } from "./lib/security.mjs";
import { tx, t, fill, currentLang } from "./lib/i18n.mjs";
import { NEWS_COUNTRIES, NEWS_SOURCES, NEWS_TOPICS, filterArticles, validateNewsPayload } from "./lib/news-sources.mjs";

const $ = (selector) => document.querySelector(selector);
const state = { articles: [], sources: [], checkedAt: null, mode: "saved", ready: false, loading: false, query: "", country: "all", topic: "all", publisher: "all", days: "all" };
const showDate = (value) => value ? new Intl.DateTimeFormat(currentLang() === "en" ? "en-GB" : currentLang(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : tx("Date not supplied");

function story(article, compact = false) {
  const location = article.countries.length ? article.countries.join(", ") : tx("Regional");
  return `<article class="news-story${compact ? " news-story--compact" : ""}">
    <div class="news-story-meta"><span>${esc(article.publisher)}</span><time${article.publishedAt ? ` datetime="${esc(article.publishedAt)}"` : ""}>${esc(showDate(article.publishedAt))}</time>${article.kind && article.kind !== "Report" ? `<span>${esc(tx(article.kind))}</span>` : ""}</div>
    <h2><a data-source-issued href="${esc(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">${esc(article.title)} <span aria-hidden="true">↗</span></a></h2>
    <p class="news-story-tags">${esc(location)}${compact ? "" : `\u00A0· ${esc(article.topics.map(topic => tx(topic)).join("\u00A0· "))}`}</p>
  </article>`;
}

function render() {
  const articles = filterArticles(state.articles, state);
  const pending = !state.ready || state.loading;
  $("#news-results").setAttribute("aria-busy", String(pending));
  $("#news-results").innerHTML = articles.map((article) => story(article)).join("") ||
    (state.articles.length ? `<div class="news-empty"><h2>${esc(t("news.empty.title"))}</h2><p>${esc(t("news.empty.hint"))}</p><button id="news-clear" class="text-button" type="button">${esc(t("news.empty.clear"))}</button></div>` : "");
  $("#news-clear")?.addEventListener("click", clearFilters);
  $("#news-count").textContent = fill("{n} of {m} stories", { n: articles.length, m: state.articles.length });
  const checked = state.checkedAt && fill("Checked {date}", { date: showDate(state.checkedAt) });
  const unavailable = state.sources.filter((source) => source.status === "unavailable").length;
  const readingStatus = {
    live: "Publisher feeds",
    stale: "Saved reading list · newer than the feed response",
    saved: state.articles.length ? "Saved reading list · live feeds unavailable" : "No regional headlines available",
  };
  const mode = !state.ready ? t("news.loading.regional.headlines") : state.loading ? tx("Checking publisher feeds") : tx(readingStatus[state.mode]);
  $("#news-status").textContent = [mode, checked, state.mode === "live" && unavailable &&
    fill("{n} feeds unavailable", { n: unavailable })].filter(Boolean).join(" · ");
  $("#news-refresh").setAttribute("aria-disabled", String(pending));
  $("#news-preview-list").innerHTML = state.articles.slice(0, 3).map((article) => story(article, true)).join("") || `<p class="news-muted">${esc(pending ? t("news.loading.regional.headlines") : tx("No regional headlines available"))}</p>`;
  document.querySelectorAll("#news-topics button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.topic === state.topic)));
  $("#news-mobile-topic").value = state.topic;
  $("#news-country option[value='Regional']").textContent = tx("Regional");
  const activeFilters = [state.country, state.publisher, state.days, state.topic].filter((value) => value !== "all").length;
  $("#news-filter-summary").textContent = activeFilters ? fill("Filters · {n} active", { n: activeFilters }) : t("hd.filters");

  const counts = NEWS_COUNTRIES.map((country) => [country, state.articles.filter((article) => article.countries.includes(country)).length]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...counts.map(([, count]) => count));
  $("#news-coverage").innerHTML = counts.map(([country, count]) => `<button type="button" class="news-country-row" data-source-issued data-country="${esc(country)}"><span>${esc(country)}</span><span class="news-country-bar"><span style="width:${count / max * 100}%"></span></span><strong>${count}</strong></button>`).join("");
  $("#news-coverage").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.country = button.dataset.country; $("#news-country").value = state.country; render(); }));
  $("#news-sources").innerHTML = NEWS_SOURCES.map((source) => {
    const status = state.sources.find((item) => item.id === source.id)?.status;
    return `<div class="news-source"><a href="${esc(source.site)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(tx(source.section))} · ${esc(tx(pending ? "checking" : status === "ok" ? "connected" : "unavailable"))}</span></div>`;
  }).join("");
}

function updatePublishers() {
  const publishers = [...new Set(state.articles.map((article) => article.publisher))].sort();
  $("#news-publisher").innerHTML = `<option data-i18n="flt.all.publishers" value="all">${esc(tx("All publishers"))}</option>${publishers.map((publisher) => `<option data-source-issued>${esc(publisher)}</option>`).join("")}`;
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
  if (!state.ready || state.loading) return;
  state.loading = true; render();
  try {
    const response = await fetch("api/news", { signal: AbortSignal.timeout(15_000), credentials: "omit" });
    const payload = validateNewsPayload(await response.json());
    state.sources = payload.sources;
    if (!response.ok || !payload.articles.length || payload.mode === "saved") throw new Error("Feeds unavailable");
    if (state.checkedAt && Date.parse(payload.checkedAt) < Date.parse(state.checkedAt)) {
      state.mode = "stale";
      return;
    }
    Object.assign(state, { articles: payload.articles, checkedAt: payload.checkedAt, mode: "live" });
    try { localStorage.setItem("ascn-news-v1", JSON.stringify({ ...payload, mode: "saved" })); } catch { /* Reading does not require browser storage. */ }
    updatePublishers();
  } catch {
    state.mode = "saved";
    state.sources = [];
  } finally { state.loading = false; render(); }
}

async function init() {
  const phone = matchMedia("(max-width: 600px)");
  $("#news-filter-panel").open = !phone.matches;
  phone.addEventListener("change", () => { $("#news-filter-panel").open = !phone.matches; });
  $("#news-mobile-topic").insertAdjacentHTML("beforeend", NEWS_TOPICS.map((topic) => `<option value="${esc(topic)}">${esc(tx(topic))}</option>`).join(""));
  $("#news-mobile-topic").addEventListener("change", (event) => { state.topic = event.target.value; render(); });
  $("#news-country").insertAdjacentHTML("beforeend", NEWS_COUNTRIES.map((country) => `<option data-source-issued>${esc(country)}</option>`).join("") + `<option value="Regional">${esc(tx("Regional"))}</option>`);
  $("#news-topics").innerHTML = ["all", ...NEWS_TOPICS].map((topic) => topic === "all"
    ? `<button type="button" data-i18n="hd.all.topics" data-topic="all" aria-pressed="true">${esc(tx("All topics"))}</button>`
    : `<button type="button" data-topic="${esc(topic)}" aria-pressed="false">${esc(tx(topic))}</button>`).join("");
  $("#news-topics").addEventListener("click", (event) => { const button = event.target.closest("button[data-topic]"); if (button) { state.topic = button.dataset.topic; render(); } });
  $("#news-search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  for (const name of ["country", "publisher", "days"]) $(`#news-${name}`).addEventListener("change", (event) => { state[name] = event.target.value; render(); });
  $("#news-refresh").addEventListener("click", refresh);
  const localize = () => {
    $("#news-search").placeholder = tx("Search headlines");
    for (const selector of ["#news-refresh", "#news-topics", "#news-results"]) {
      const node = $(selector);
      const label = tx(node.dataset.label);
      node.setAttribute("aria-label", label);
      if (node.hasAttribute("title")) node.title = label;
    }
    for (const topic of NEWS_TOPICS) {
      $("#news-mobile-topic").querySelector(`option[value="${topic}"]`).textContent = tx(topic);
      $("#news-topics").querySelector(`button[data-topic="${topic}"]`).textContent = tx(topic);
    }
    render();
  };
  document.addEventListener("ascn:lang", localize);
  localize();
  let saved;
  try {
    const raw = localStorage.getItem("ascn-news-v1");
    if (raw && raw.length < 250000) saved = validateNewsPayload(JSON.parse(raw));
  } catch { /* Invalid saved data is replaced by the checked reading list. */ }
  if (saved?.articles.length) {
    Object.assign(state, { articles: saved.articles, checkedAt: saved.checkedAt });
    updatePublishers();
    render();
  }
  try {
    const response = await fetch("data/news-snapshot.json", { cache: "no-cache", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Reading list unavailable");
    const published = validateNewsPayload(await response.json());
    if (published.articles.length && (!state.checkedAt || Date.parse(published.checkedAt) >= Date.parse(state.checkedAt))) {
      Object.assign(state, { articles: published.articles, checkedAt: published.checkedAt });
      updatePublishers();
    }
  } catch { /* Browser storage and publisher feeds can still supply headlines. */ }
  state.ready = true;
  await refresh();
}

init();
