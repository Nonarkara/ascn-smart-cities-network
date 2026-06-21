"use strict";

/* ============================================================
   ASCN Open Platform — tabbed living observatory
   Data: data/ascn-v2-data.json (project engine, 378 appendix rows)
         data/ascn-knowledge.json (narrative + structured reference)
         data/ascn-cities.json (38 city profiles + geo)
   ============================================================ */

const tileLayers = {
  map: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
  night: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
};

const TABS = ["overview", "history", "cities", "projects", "framework", "partners", "insights", "data", "essay"];

const state = {
  data: null, K: null, C: [], L: null, LF: null,
  country: "all", focus: "all", search: "",
  citySearch: "", cityCountry: "all", selectedCity: null,
  mapMode: "map", map: null, tileLayer: null, markerLayer: null, markers: {}, mapReady: false,
  tab: "overview", rendered: new Set(),
  libSearch: "", libType: "all",
};

const fmt = new Intl.NumberFormat("en-US");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const FOCUS_COLORS = {
  "Civic & Social": "#183a5a",
  "Built Infrastructure": "#b53a2e",
  "Quality Environment": "#2a7a4f",
  "Safety & Security": "#a86d14",
  "Industry & Innovation": "#5a3070",
  "Health & Well-Being": "#5a5a6a",
};

function esc(v) {
  return `${v ?? ""}`.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function latestReport() { return state.data.reports[state.data.reports.length - 1]; }
function usd(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${fmt.format(n)}`;
}
function markerColor(year) {
  if (year >= 2026) return "#101418";
  if (year >= 2025) return "#b53a2e";
  if (year >= 2023) return "#a86d14";
  return "#183a5a";
}
function bar(label, value, max, cls = "", suffix = "", wide = false) {
  const w = max ? Math.max(2, (value / max) * 100) : 0;
  return `<div class="bar-row${wide ? " wide-label" : ""}"><span>${esc(label)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><strong>${fmt.format(value)}${suffix}</strong></div>`;
}

function svgDonut(segments, size = 160) {
  const total = segments.reduce((s, d) => s + d.v, 0);
  const r = 54, cx = size / 2, cy = size / 2, sw = 22;
  const circ = 2 * Math.PI * r;
  let accumulated = 0;
  const arcs = segments.map(({ v, color }) => {
    const dash = (v / total) * circ;
    const dashOffset = circ - accumulated;
    const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />`;
    accumulated += dash;
    return arc;
  });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${arcs.join("")}</svg>`;
}

function svgLine(points, w = 280, h = 90) {
  if (points.length < 2) return "";
  const vals = points.map((p) => p.v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const padT = 6, padB = 18, padL = 6, padR = 6;
  const scX = (i) => padL + (i / (points.length - 1)) * (w - padL - padR);
  const scY = (v) => padT + (1 - (v - minV) / (maxV - minV || 1)) * (h - padT - padB);
  const ptStr = points.map((p, i) => `${scX(i).toFixed(1)},${scY(p.v).toFixed(1)}`);
  const area = `M${scX(0).toFixed(1)},${(h - padB).toFixed(1)} L${ptStr.join(" L")} L${scX(points.length - 1).toFixed(1)},${(h - padB).toFixed(1)} Z`;
  const dots = points.map((p, i) => `<circle cx="${scX(i).toFixed(1)}" cy="${scY(p.v).toFixed(1)}" r="2.5" fill="var(--amber)" />`).join("");
  const labels = points.map((p, i) => `<text x="${scX(i).toFixed(1)}" y="${h - 3}" text-anchor="middle" fill="var(--muted)" font-size="8" font-family="inherit">${esc(p.label)}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${area}" fill="var(--amber)" opacity="0.1" /><polyline points="${ptStr.join(" ")}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round" />${dots}${labels}</svg>`;
}

/* ---------------- Routing ---------------- */
function setTab(tab, push = true) {
  if (!TABS.includes(tab)) tab = "overview";
  state.tab = tab;
  $$(".view").forEach((v) => { v.hidden = v.dataset.view !== tab; });
  $$("#tab-nav a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  renderTab(tab);
  if (push && location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function renderTab(tab) {
  if (tab === "cities") ensureMap();
  if (state.rendered.has(tab)) return;
  ({
    overview: renderOverview, history: renderHistory, cities: renderCitiesView,
    projects: renderProjects, framework: renderFramework, partners: renderPartners,
    insights: renderInsights, data: renderOpenData, essay: renderEssay,
  }[tab] || (() => {}))();
  state.rendered.add(tab);
}

/* ---------------- Overview ---------------- */
function renderOverview() {
  const s = state.K.summary;
  const kpis = [
    [s.cities, "Cities", "across 11 countries"],
    [s.countries, "Countries", "10 AMS + Timor-Leste"],
    [s.projects, "Projects", "latest M&E cycle"],
    [s.ongoing, "Ongoing", "in implementation"],
    [s.completed, "Completed", "concluded"],
  ];
  $("#kpi-grid").innerHTML = kpis.map(([v, l, n]) => `<article class="kpi"><strong>${fmt.format(v)}</strong><span>${l} — ${n}</span></article>`).join("");
  $("#gap-headline").textContent = "The dashboard the network never had.";
  $("#gap-body").textContent = s.the_gap;
  $("#evidence-status").textContent = `${state.data.reports.length} M&E reports · ${state.data.projects.length} appendix rows · ${state.K.documents.length} source documents.`;
  const fa = [...state.K.framework.focus_areas].sort((a, b) => b.share - a.share);
  const max = Math.max(...fa.map((f) => f.share));
  $("#focus-mini").innerHTML = fa.map((f) => bar(f.name, f.share, max, f.name.includes("Built") ? "red" : "", "%")).join("");
  $("#glance-note").innerHTML = `<strong>Established</strong>${esc(s.established)} · ${esc(s.established_event)}.<br><strong>Framework</strong>${esc(s.framework_adopted)}.<br><strong>Mission</strong>${esc(s.mission)}`;
  renderPerspective();
}

function renderPerspective() {
  const p = state.K.perspective, st = state.K.stance;
  $("#perspective").innerHTML = `
    <div class="persp-stance">
      <p class="label">The stance</p>
      <h2>${esc(st.headline)}</h2>
      <p class="lede">${esc(st.body)}</p>
    </div>
    <div class="persp-article">
      <p class="label">${esc(p.kicker)}</p>
      <h3>${esc(p.author)}</h3>
      <p class="persp-role">${esc(p.role)} · ${esc(p.credentials)}</p>
      <p class="persp-framing">${esc(p.framing)}</p>
      <blockquote class="persp-quote">${esc(p.pull_quote)}</blockquote>
      <div class="persp-points">${p.points.map((pt) => `<div class="persp-point"><b>${esc(pt.h)}</b><span>${esc(pt.t)}</span></div>`).join("")}</div>
      <a class="persp-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">Read the full essay — ${esc(p.source)} ↗</a>
    </div>`;
}

/* ---------------- History ---------------- */
function renderHistory() {
  const h = state.K.history;
  $("#history-timeline").innerHTML = h.milestones.map((m) => `
    <div class="timeline-item"><time>${esc(m.year)}</time><div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div></div>`).join("");
  const maxTotal = Math.max(...h.membership_evolution.map((e) => e.total));
  $("#growth-bars").innerHTML = h.membership_evolution.map((e) => bar(`${e.year}`, e.total, maxTotal, "", "")).join("");
  const chairs = state.K.governance.chairs.map((c) => `
    <div class="chair-row"><b>${esc(c.year)}</b><span>${esc(c.chair)} chair${c.note ? `<em>${esc(c.note)}</em>` : ""}</span></div>`).join("");
  const sheps = state.K.governance.shepherds.map((s) => `
    <div class="chair-row"><b>${esc(s.term)}</b><span>${esc(s.country)} — Shepherd<em>${esc(s.note)}</em></span></div>`).join("");
  $("#chair-roster").innerHTML = chairs + `<div class="chair-row"><b>Shepherd</b><span class="muted" style="text-transform:none;letter-spacing:0">Multi-year continuity role</span></div>` + sheps;

  if (h.clc_quote) {
    const q = h.clc_quote;
    $("#history-quote").innerHTML = `
      <blockquote>${esc(q.text)}</blockquote>
      <cite><b>${esc(q.attribution)}</b> · ${esc(q.role)}<br><span class="quote-source">${esc(q.source)}</span></cite>`;
  }

  if (h.moments) {
    $("#history-moments").innerHTML = h.moments.map((m) => `
      <div class="moment-card">
        <figure><img src="${esc(m.photo)}" alt="${esc(m.label)}" loading="lazy" /></figure>
        <div class="moment-body">
          <span class="moment-year">${esc(m.year)}</span>
          <span class="moment-label">${esc(m.label)}</span>
          <p class="moment-caption">${esc(m.caption)}</p>
        </div>
      </div>`).join("");
  }

  $("#meetings-grid").innerHTML = h.annual_meetings.map((m) => `
    <article class="meeting-card"><span class="yr">${esc(m.year)}</span><b>${esc(m.n)} ASCN</b><p>${esc(m.host)} — ${esc(m.outcome)}</p></article>`).join("");
  $("#ascap-panel").innerHTML = ascapHtml();
}

function ascapHtml() {
  const a = state.K.ascap;
  return `<p class="label">Forward agenda</p><h3>${esc(a.name)}</h3><p class="lede" style="margin:0.5rem 0 0">${esc(a.note)} Adopted ${esc(a.adopted)}.</p>
    <div class="pillars">${a.pillars.map((p, i) => `<div class="ascap-pillar"><span class="num">P${i + 1}</span><b>${esc(p)}</b></div>`).join("")}</div>`;
}

/* ---------------- Cities ---------------- */
function normCity(s) { return `${s}`.toLowerCase().replace(/\s+city$/, "").trim(); }
function projectsForCity(name) {
  const t = normCity(name);
  const ly = latestReport().year;
  let rows = state.data.projects.filter((p) => p.report_year === ly && normCity(p.city) === t);
  if (!rows.length) rows = state.data.projects.filter((p) => normCity(p.city) === t);
  const seen = new Set();
  return rows.filter((p) => { const k = `${p.project}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function renderCitiesView() {
  const countries = [...new Set(state.C.map((c) => c.country))].sort();
  $("#city-country").insertAdjacentHTML("beforeend", countries.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join(""));
  $("#map-legend").innerHTML = [["#183a5a", "2018 founding"], ["#a86d14", "2023–24"], ["#b53a2e", "2025"], ["#101418", "2026"]]
    .map(([col, lab]) => `<span><i style="background:${col}"></i>${lab}</span>`).join("");
  renderCityCards();
  selectCity(state.C.find((c) => c.name === "Bangkok") || state.C[0]);
  $("#city-search").addEventListener("input", (e) => { state.citySearch = e.target.value; renderCityCards(); });
  $("#city-country").addEventListener("change", (e) => { state.cityCountry = e.target.value; renderCityCards(); syncMarkers(); });
}

function visibleCities() {
  const q = state.citySearch.trim().toLowerCase();
  return state.C.filter((c) =>
    (state.cityCountry === "all" || c.country === state.cityCountry) &&
    (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)));
}

function renderCityCards() {
  const list = visibleCities();
  $("#city-cards").innerHTML = list.map((c) => `
    <button class="city-card${state.selectedCity && c.name === state.selectedCity.name ? " active" : ""}" data-city="${esc(c.name)}">
      <b>${esc(c.name)}</b><span class="cc-country">${esc(c.country)}</span>
      <span class="cc-meta">Joined ${c.year} · ${esc(c.pop)}</span></button>`).join("") ||
    `<p class="muted" style="padding:1rem 0">No cities match.</p>`;
  $$("#city-cards .city-card").forEach((b) => b.addEventListener("click", () => {
    const city = state.C.find((c) => c.name === b.dataset.city);
    if (city) { selectCity(city); if (state.map) state.map.setView([city.lat, city.lon], Math.max(state.map.getZoom(), 6), { animate: true }); }
  }));
}

function selectCity(city) {
  state.selectedCity = city;
  const projects = projectsForCity(city.name);
  const flagshipNames = new Set((city.flagship || []).map((f) => f.name.toLowerCase()));
  const extra = projects.filter((p) => !flagshipNames.has(`${p.project}`.toLowerCase()));
  const flagHtml = (city.flagship || []).map((f) => `
    <div class="cd-project"><div><div class="p-name">${esc(f.name)}</div><div class="p-focus">${esc(f.focus || "")}${f.note ? ` · ${esc(f.note)}` : ""}</div></div><span class="cd-tag">Flagship</span></div>`).join("");
  const extraHtml = extra.slice(0, 14).map((p) => `
    <div class="cd-project"><div><div class="p-name">${esc(p.project)}</div><div class="p-focus">${esc(p.focus_area || "")}</div></div><span class="cd-tag" style="color:var(--muted)">${esc(p.report_year)}</span></div>`).join("");
  $("#city-detail").innerHTML = `
    <div class="cd-place">${esc(city.country)} · joined ${city.year}</div>
    <h2>${esc(city.name)}</h2>
    <div class="cd-meta"><span>Population <b>${esc(city.pop)}</b></span><span>Documented projects <b>${projects.length || city.flagship.length}</b></span></div>
    <p style="color:var(--ink-2);margin:0 0 0.4rem">${esc(city.summary)}</p>
    ${flagHtml ? `<div class="cd-section-label">Flagship work</div><div class="cd-projects">${flagHtml}</div>` : ""}
    ${extraHtml ? `<div class="cd-section-label">From the M&E appendix</div><div class="cd-projects">${extraHtml}</div>` : (projects.length ? "" : `<p class="cd-empty">Detailed project rows pending in the public appendix.</p>`)}
    ${city.portal ? `<a class="cd-portal" href="${esc(city.portal)}" target="_blank" rel="noreferrer">Open city data portal ↗</a>` : ""}`;
  $$("#city-cards .city-card").forEach((b) => b.classList.toggle("active", b.dataset.city === city.name));
}

/* ---------------- Map ---------------- */
function ensureMap() {
  if (state.mapReady) { setTimeout(() => state.map && state.map.invalidateSize(), 60); return; }
  if (!window.L || !$("#sea-map")) return;
  state.map = L.map("sea-map", { zoomControl: true, scrollWheelZoom: false, minZoom: 3, maxZoom: 9, worldCopyJump: false }).setView([8.5, 112], 4);
  state.tileLayer = L.tileLayer(tileLayers.map.url, { attribution: tileLayers.map.attr }).addTo(state.map);
  state.map.setMaxBounds([[-15, 88], [25, 142]]);
  state.markerLayer = L.layerGroup().addTo(state.map);
  buildMarkers();
  $("#map-mode").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    state.mapMode = btn.dataset.mode;
    $$("#map-mode button").forEach((b) => b.classList.toggle("active", b === btn));
    if (state.tileLayer) state.map.removeLayer(state.tileLayer);
    state.tileLayer = L.tileLayer(tileLayers[state.mapMode].url, { attribution: tileLayers[state.mapMode].attr }).addTo(state.map);
    buildMarkers();
  });
  state.mapReady = true;
  setTimeout(() => state.map.invalidateSize(), 60);
}

function buildMarkers() {
  if (!state.markerLayer) return;
  state.markerLayer.clearLayers();
  state.markers = {};
  for (const c of state.C) {
    const m = L.circleMarker([c.lat, c.lon], {
      radius: c.year >= 2025 ? 7 : 5,
      color: state.mapMode === "night" ? "rgba(255,255,255,0.8)" : "#fff",
      weight: 1.5, fillColor: markerColor(c.year), fillOpacity: 0.92,
    });
    m.bindTooltip(`${c.name} — ${c.country} (${c.year})`, { direction: "top", offset: [0, -3] });
    m.on("click", () => selectCity(c));
    m.addTo(state.markerLayer);
    state.markers[c.name] = m;
  }
  syncMarkers();
}
function syncMarkers() {
  const vis = new Set(visibleCities().map((c) => c.name));
  Object.entries(state.markers).forEach(([name, m]) => m.setStyle({ opacity: vis.has(name) ? 1 : 0.15, fillOpacity: vis.has(name) ? 0.92 : 0.1 }));
}

/* ---------------- Projects ---------------- */
function latestProjects() { const ly = latestReport().year; return state.data.projects.filter((p) => p.report_year === ly); }
function filteredProjects() {
  const q = state.search.trim().toLowerCase();
  return latestProjects().filter((p) => {
    const cm = state.country === "all" || p.country === state.country;
    const fm = state.focus === "all" || p.focus_area === state.focus;
    const sm = !q || [p.city, p.country, p.project, p.focus_area].some((v) => `${v}`.toLowerCase().includes(q));
    return cm && fm && sm;
  });
}

function renderProjects() {
  const r = latestReport();
  const k = [[r.total_projects, "Projects"], [r.status.ongoing, "Ongoing"], [r.status.completed, "Completed"], [r.status.planning, "Planning"]];
  $("#project-kpis").innerHTML = k.map(([v, l]) => `<article class="kpi"><strong>${fmt.format(v)}</strong><span>${l}</span></article>`).join("");
  $("#status-count").textContent = `${r.total_projects} projects`;
  const fe = Object.entries(r.focus_share);
  const fmax = Math.max(...fe.map(([, v]) => v));
  $("#focus-bars").innerHTML = fe.map(([l, v]) => bar(l, v, fmax, l.includes("Built") ? "red" : "", "%", true)).join("");
  $("#status-bars").innerHTML = [["Ongoing", r.status.ongoing, "green"], ["Completed", r.status.completed, ""], ["Planning", r.status.planning, "amber"]]
    .map(([l, v, cls]) => bar(l, v, r.total_projects, cls)).join("");
  const countries = [...new Set(state.C.map((c) => c.country))].sort();
  $("#country-filter").insertAdjacentHTML("beforeend", countries.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join(""));
  $("#focus-filter").insertAdjacentHTML("beforeend", Object.keys(r.focus_share).map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join(""));
  $("#big-projects").innerHTML = state.K.financing.big_projects.map((p) => `
    <div class="big-project"><div><b>${esc(p.project)}</b><div class="bp-city">${esc(p.city)}</div><div class="bp-fund">${esc(p.funders)}</div></div><div class="bp-amt">${usd(p.investment_usd)}</div></div>`).join("");
  $("#search-filter").addEventListener("input", (e) => { state.search = e.target.value; renderProjectTables(); });
  $("#country-filter").addEventListener("change", (e) => { state.country = e.target.value; renderProjectTables(); });
  $("#focus-filter").addEventListener("change", (e) => { state.focus = e.target.value; renderProjectTables(); });
  $("#export-csv").addEventListener("click", () => downloadBlob("ascn-projects-filtered.csv", projectsCsv(filteredProjects()), "text/csv"));
  renderProjectTables();
}

function statusPill(s) {
  const v = `${s}`.toLowerCase();
  const cls = v.includes("complete") ? "completed" : v.includes("plan") ? "planning" : "ongoing";
  return `<span class="status-pill ${cls}">${esc(s)}</span>`;
}
function renderProjectTables() {
  const rows = filteredProjects();
  const counts = new Map();
  rows.forEach((p) => counts.set(p.city, (counts.get(p.city) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  const cmax = Math.max(...top.map((t) => t[1]), 1);
  $("#city-load").innerHTML = top.map(([c, n]) => bar(c, n, cmax, "red")).join("") || `<p class="muted">No rows.</p>`;
  $("#project-count").textContent = `${rows.length} rows`;
  $("#project-table").innerHTML = rows.slice(0, 200).map((p) => `
    <tr><td>${esc(p.city)}</td><td>${esc(p.country)}</td><td>${esc(p.project)}</td><td>${esc(p.focus_area)}</td><td>${statusPill(p.status)}</td></tr>`).join("");
}

/* ---------------- Framework ---------------- */
function renderFramework() {
  const f = state.K.framework, g = state.K.governance;
  $("#framework-status").textContent = f.status;
  const block = (label, items) => `<p class="label">${label}</p><ul class="fw-list">${items.map((i) => `<li><b>${esc(i)}</b></li>`).join("")}</ul>`;
  $("#fw-outcomes").innerHTML = `<h3>Three strategic outcomes</h3>` + block("Outcomes", f.strategic_outcomes);
  $("#fw-systems").innerHTML = `<h3>Two urban systems</h3>` + block("Systems", f.urban_systems);
  $("#fw-enablers").innerHTML = `<h3>Two enablers</h3>` + block("Enablers", f.enablers);
  const fmax = Math.max(...f.focus_areas.map((a) => a.share));
  $("#focus-detail").innerHTML = f.focus_areas.map((a) => `
    <div class="focus-item"><div class="fi-head"><b>${esc(a.name)}</b><span class="fi-share">${a.share}%</span></div>
      <p>${esc(a.blurb)}</p><div class="bar-track"><div class="bar-fill${a.name.includes("Built") ? " red" : ""}" style="width:${(a.share / fmax) * 100}%"></div></div></div>`).join("");
  $("#gov-grid").innerHTML = `
    <article class="gov-card"><h3>Leadership model</h3><p>${esc(g.model)}</p></article>
    <article class="gov-card"><h3>Decisions &amp; legal status</h3><p>${esc(g.decision_making)}</p><p class="muted" style="text-transform:none;letter-spacing:0;margin-top:0.5rem">Reporting: ${esc(g.reporting_chain)}</p></article>
    <article class="gov-card"><h3>Open challenges</h3><ul>${g.challenges.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></article>`;
  $("#framework-ascap").innerHTML = ascapHtml();
}

/* ---------------- Partners ---------------- */
function renderPartners() {
  $("#partner-cards").innerHTML = state.K.partnerships.map((p) => `
    <article class="partner-card"><div class="pc-head"><b>${esc(p.partner)}</b><span class="pc-prog">${esc(p.programme)}</span></div>
      <div class="pc-budget">${esc(p.budget)}</div><div class="pc-cov">${esc(p.coverage)}</div><p>${esc(p.note)}</p></article>`).join("");
  $("#multi-list").innerHTML = state.K.multilateral_partners.map((m) => `
    <div class="def-row"><b>${esc(m.org)}</b><span>${esc(m.role)} — </span><em>${esc(m.activity)}</em></div>`).join("");
  const f = state.K.financing;
  $("#finance-block").innerHTML = `
    <div class="finance-stat">${esc(f.scale_note)}</div>
    <div class="finance-stat"><b>Financing Toolkit.</b> ${esc(f.toolkit)}</div>
    <div class="finance-stat"><b>Blended finance.</b> ${esc(f.blended)}</div>
    <div class="finance-stat"><b>Open challenges.</b> ${esc(f.challenges.join(" "))}</div>`;
}

/* ---------------- Insights ---------------- */
function renderInsights() {
  const r = latestReport();

  // 1 · Focus-area donut
  const fa = Object.entries(r.focus_share).sort((a, b) => b[1] - a[1]);
  const donutSegs = fa.map(([name, v]) => ({ v, color: FOCUS_COLORS[name] || "#888" }));
  const donutLegend = fa.map(([name, v]) => `<div class="donut-legend-row"><span class="dl-dot" style="background:${FOCUS_COLORS[name] || "#888"}"></span><span>${esc(name)}</span><strong>${v}%</strong></div>`).join("");
  $("#ig-focus").innerHTML = `<div class="donut-wrap">${svgDonut(donutSegs, 160)}<div class="donut-legend">${donutLegend}</div></div>`;

  // 2 · Membership growth line
  const me = state.K.history.membership_evolution;
  const linePoints = me.map((e) => ({ v: e.total, label: `'${String(e.year).slice(2)}` }));
  $("#ig-growth").innerHTML = `<div class="line-wrap">${svgLine(linePoints, 240, 90)}<p class="chart-note">${me[me.length - 1].total} cities as of ${me[me.length - 1].year}</p></div>`;

  // 3 · Implementation status — big numbers
  $("#ig-status").innerHTML = `<div class="status-nums">${[["Ongoing", r.status.ongoing, "green"], ["Completed", r.status.completed, ""], ["Planning", r.status.planning, "amber"]].map(([l, v, cls]) => `<div class="sn-row"><strong class="${cls}">${v}</strong><span>${l}</span></div>`).join("")}</div>`;

  // 4 · Citizen impact
  $("#ig-impact").innerHTML = state.K.citizen_impact.map((c) => `<div class="impact-stat"><strong>${esc(c.metric)}</strong><span>${esc(c.project)}</span><em>${esc(c.city)}</em></div>`).join("");

  // 5 · Investment landscape
  const investments = [...state.K.financing.big_projects].sort((a, b) => b.investment_usd - a.investment_usd);
  const invMax = investments[0]?.investment_usd || 1;
  $("#ig-investment").innerHTML = investments.map((p) => bar(`${p.city} — ${p.project.slice(0, 38)}`, p.investment_usd, invMax, "amber", "", true)).join("");

  // 6 · Projects by country (computed)
  const counts = {};
  latestProjects().forEach((p) => { counts[p.country] = (counts[p.country] || 0) + 1; });
  const cList = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const cMax = cList[0]?.[1] || 1;
  $("#ig-country").innerHTML = cList.map(([c, n]) => bar(c, n, cMax, "red")).join("");

  // 7 · M&E maturity comparison
  $("#ig-compare").innerHTML = `<table><thead><tr><th>Network</th><th>M&amp;E approach</th><th>Maturity</th></tr></thead><tbody>${state.K.me_gap.comparison.map((c) => `<tr class="${c.network === "ASCN" ? "is-ascn" : ""}"><td><b>${esc(c.network)}</b></td><td>${esc(c.approach)}</td><td>${esc(c.maturity)}</td></tr>`).join("")}</tbody></table>`;
}

/* ---------------- Open Data / Library ---------------- */
function renderOpenData() {
  $("#data-lede").textContent = "Everything behind this platform is open. Download the structured datasets, read the source documents, and search the full knowledge base — 62 sources, each with what we took from it.";

  const downloads = [
    ["Project evidence (CSV)", "378 appendix rows across four M&E cycles: city, country, project, focus area, status.", () => downloadBlob("ascn-projects.csv", projectsCsv(state.data.projects, true), "text/csv")],
    ["City profiles (CSV)", "38 member cities: country, join year, population, coordinates, flagship projects.", () => downloadBlob("ascn-cities.csv", citiesCsv(), "text/csv")],
    ["Full dataset (JSON)", "The complete knowledge layer, city profiles, and project engine in one bundle.", () => downloadBlob("ascn-open-dataset.json", JSON.stringify({ knowledge: state.K, cities: state.C, engine: state.data }, null, 2), "application/json")],
  ];
  $("#dataset-downloads").innerHTML = downloads.map(([t, d], i) => `
    <article class="download-card"><b>${esc(t)}</b><p>${esc(d)}</p><button class="text-button" type="button" data-dl="${i}">Download</button></article>`).join("");
  $$("#dataset-downloads [data-dl]").forEach((b) => b.addEventListener("click", () => downloads[Number(b.dataset.dl)][2]()));

  $("#document-grid").innerHTML = state.K.documents.map((d) => `
    <article class="doc-card"><span class="dc-kind">${esc(d.kind)} · ${d.year}</span><b>${esc(d.title)}</b><p>${esc(d.note)}</p>
      <div class="dc-foot"><span class="dc-size">${esc(d.size || "PDF")}</span><a class="dc-dl" href="docs/${encodeURIComponent(d.file)}" download>Download ↓</a></div></article>`).join("");

  $("#source-list").innerHTML = state.K.data_sources.map((s) => `
    <div class="def-row"><b><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.name)} ↗</a></b><em>${esc(s.type)}</em></div>`).join("");

  const m = state.data.metadata || {};
  const methods = [
    ["Source model", "Structured JSON and source URLs are committed; raw PDFs are served from the build, not stored in git."],
    ["Freshness", `Engine generated ${m.generated_at || "—"}. Knowledge layer synthesized ${state.K.meta.research_date} from official documents.`],
    ["Counts", "Network KPIs use figures stated in report text. Appendix rows are extracted from PDF tables — treat row-level counts as indicative."],
    ["The honest limit", "ASCN M&E counts projects, not outcomes. This platform surfaces the official record faithfully; it does not invent metrics the network does not yet collect."],
    ["Public information", "The 2026 contact list is cited as a source, but personal contact details are not exposed in this dataset."],
  ];
  $("#method-list").innerHTML = methods.map(([t, b]) => `<div class="method-row"><b>${esc(t)}</b><span>${esc(b)}</span></div>`).join("");

  // Searchable library
  renderLibrary();
  $("#lib-search").addEventListener("input", (e) => { state.libSearch = e.target.value; renderLibrary(); });
  $$("#lib-type-chips .lib-chip").forEach((btn) => btn.addEventListener("click", () => {
    state.libType = btn.dataset.type;
    $$("#lib-type-chips .lib-chip").forEach((b) => b.classList.toggle("active", b === btn));
    renderLibrary();
  }));
}

function renderLibrary() {
  const src = state.LF ? state.LF.entries : (state.L ? state.L.groups.flatMap((g) => g.items.map((it) => ({ type: "official", category: g.group, title: it.title, source: it.source, year: it.year, file: it.file, takeaway: it.takeaway, url: null }))) : []);
  const q = state.libSearch.trim().toLowerCase();
  const filtered = src.filter((e) => {
    const typeMatch = state.libType === "all" || e.type === state.libType;
    const textMatch = !q || [e.title, e.source, e.takeaway, e.category, ...(e.tags || [])].some((v) => `${v || ""}`.toLowerCase().includes(q));
    return typeMatch && textMatch;
  });

  const total = src.length;
  $("#lib-count").textContent = filtered.length === total ? `${total} sources` : `${filtered.length} of ${total}`;

  if (!filtered.length) {
    $("#lib-results").innerHTML = `<p class="lib-empty">No sources match "${esc(q)}".</p>`;
    return;
  }

  $("#lib-results").innerHTML = filtered.map((e) => {
    const actions = [];
    if (e.file) actions.push(`<a class="le-dl" href="docs/${encodeURIComponent(e.file)}" download>PDF ↓</a>`);
    if (e.url) actions.push(`<a class="le-ext" href="${esc(e.url)}" target="_blank" rel="noreferrer">View ↗</a>`);
    return `<div class="lib-entry">
      <span class="le-badge ${esc(e.type)}">${esc(e.type)}</span>
      <div class="le-body">
        <div class="le-title">${esc(e.title)}</div>
        <div class="le-meta">${esc(e.source)}${e.year ? ` · ${e.year}` : ""}${e.category ? ` · ${esc(e.category)}` : ""}</div>
        <p class="le-takeaway">${esc(e.takeaway)}</p>
      </div>
      <div class="le-actions">${actions.join("")}</div>
    </div>`;
  }).join("");
}

/* ---------------- Exports ---------------- */
function csvCell(v) { return `"${`${v ?? ""}`.replaceAll('"', '""')}"`; }
function projectsCsv(rows, all = false) {
  const head = ["report_year", "country", "city", "project", "focus_area", "status", "source_page"];
  return [head.join(","), ...rows.map((p) => head.map((k) => csvCell(p[k])).join(","))].join("\n");
}
function citiesCsv() {
  const head = ["name", "country", "year", "pop", "lat", "lon", "flagship_projects", "portal"];
  return [head.join(","), ...state.C.map((c) => [c.name, c.country, c.year, c.pop, c.lat, c.lon, (c.flagship || []).map((f) => f.name).join("; "), c.portal || ""].map(csvCell).join(","))].join("\n");
}
function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Boot ---------------- */
function wireNav() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-tab]");
    if (!link) return;
    e.preventDefault();
    setTab(link.dataset.tab);
  });
  window.addEventListener("hashchange", () => setTab((location.hash || "#overview").slice(1), false));
}

async function loadJson(path) {
  const res = await fetch(`${path}?v=32`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

/* ---------------- Essay ---------------- */
function renderEssay() {
  const p = (text) => `<p class="essay-p">${text}</p>`;
  const h = (n, text) => `<h${n} class="essay-h${n}">${text}</h${n}>`;
  const pull = (text, attr) => `<blockquote class="essay-pull">${text}${attr ? `<cite>${attr}</cite>` : ""}</blockquote>`;
  const note = (n, text) => `<div class="essay-note"><span class="essay-n">[${n}]</span>${text}</div>`;

  const essay = `
<div class="essay-header">
  <p class="label">Essay</p>
  <h2 class="essay-title">Cities are the whole story.<br>We just never had the data to tell it.</h2>
  <p class="essay-byline">Non Arkaraprasertkul, PhD — Senior Expert, Smart City Promotion, DEPA Thailand · Architect · Urban Planner</p>
  <p class="essay-meta-line">Published 2026 · ASCN Open Platform · <span class="essay-tag">Perspective</span></p>
</div>

<div class="essay-body">

  <div class="essay-section">
    ${h(3, "I. The room where it started")}
    ${p("It was a Sunday morning in Singapore, July 2018. I was sitting in a meeting room at Marina Bay Sands — that building shaped like a tray balanced on three towers, which Singapore built to show the world what ambition looks like when you have enough money and a good architect — listening to Lee Hsien Loong announce something called the ASEAN Smart Cities Network. Twenty-six cities. Ten countries. One network. He sounded very certain about it. I was less certain, but polite about it, which is a skill you develop quickly when you are Thai, surrounded by Singaporeans, in a room where Singapore wrote the agenda.")}
    ${p("What struck me was not the announcement. Announcements in ASEAN are cheap. What struck me was the governance structure that came with it: a rotating annual Chair, which is how ASEAN does everything, and a 'Shepherd' — a new concept, proposed by Singapore, accepted without much debate, which would hold institutional continuity across the rotating chairs. Singapore was the Inaugural Shepherd. I noted this and said nothing, which is also a skill you develop quickly.")}
    ${p("I have been working in this network since its founding year. DEPA — Thailand's Digital Economy Promotion Agency — was the national focal point during Thailand's chair year in 2019, and has remained one of the more active member institutions since. I have attended enough ASCN meetings to know which of the 26 cities in the original pilot have serious programs and which sent someone from the communications department who was not entirely sure why they were there. I have read all four M&E reports. I built this platform because I got tired of information that existed only in PDF appendices that nobody reads.")}
    ${p("This essay is my read on why any of this matters, what is actually happening, and what is being carefully not said.")}
  </div>

  <div class="essay-section">
    ${h(3, "II. Why cities at all")}
    ${p("The city is not a policy problem. It is the oldest human invention. For ten thousand years — before electricity, before sewage systems, before anything we would recognise as governance — people chose to live in density. They chose the noise and the competition and the disease risk because the alternative, being alone or in a small group away from other people, was worse. Cities are where ideas meet other ideas and produce things neither could produce alone. They are, if you want to get philosophical about it (and I do), the physical infrastructure of civilisation.")}
    ${p("The urbanisation happening in ASEAN right now is not unprecedented in human history, but it is unprecedented in speed. By 2030, the region will add roughly 90 million new urban residents — the population of Germany — in cities that were not designed for this density, managed by administrations that were not designed for this speed, with data systems that were built for the populations that used to live there. Phnom Penh's population doubled in fifteen years. Da Nang went from a provincial town to a regional hub in a decade. Vientiane is absorbing migrants from across Lao PDR faster than its housing stock can accommodate them. None of this is happening according to a masterplan. It is happening because people are making rational individual decisions to move to where the opportunities are, which is what cities have always been: the place where the opportunities are.")}
    ${pull("Without data, decisions are made based on precedents, heuristics and beliefs, which are only useful when the problem you face now is the same as the problem you faced before. City governments managing rapid urbanisation are not facing the same problems they faced before. They are facing new problems at speed, with old tools.", "Non Arkaraprasertkul — The ASEAN Magazine, Issue 14, 2021")}
    ${p("What makes cities legible to themselves — what allows them to manage rather than just react — is data. Traffic patterns. Energy loads. Health outcomes by district. School enrollment against housing density. Air quality against industrial zoning decisions. Most of this data already exists, in sensors and cameras and phones and payment terminals scattered across every major ASEAN city. The question is not whether the data exists. The question is whether anybody is reading it, and what they are authorised to do when they do.")}
  </div>

  <div class="essay-section">
    ${h(3, "III. Why smart cities, and why markets")}
    ${p("When DEPA published the Smart City Primer — a framework document I helped develop, which I mention only because most government publications have no named author, which is its own kind of institutional critique — the framing we chose was deliberately not about technology. The technology was always secondary. The argument was about governance: that the gap between what cities know about themselves and what they are managing to is the fundamental problem, and that closing it is a precondition for everything else.")}
    ${p("The version of smart cities I am not interested in is the one that leads with surveillance infrastructure. Facial recognition at transit stations. Social credit systems that rank citizen behaviour. The authoritarian applications of the same underlying sensor networks that, in a different governance context, would show you which intersections are dangerous, which clinics are overcrowded, which neighborhoods are being underserved. The technology is neutral. The governance is not.")}
    ${p("The version I am interested in starts from a different premise: that a viable, competitive market introduces and scales technology faster and more effectively than any government mandate. One Laptop per Child is the cautionary tale everybody who works in this space should have memorised. The programme spent over a billion dollars placing laptops in the hands of children who did not have reliable electricity, in schools whose teachers had not been trained to use them, in countries whose infrastructure could not support them. Meanwhile, cheap smartphones scaled on their own because people wanted them and the market obliged. The lesson should be obvious: technology that serves a genuine human need does not need to be mandated. It gets adopted. What government can do is not push technology, but remove the obstacles that prevent adoption — interoperability standards, open data infrastructure, regulatory clarity for private actors who want to build on city data, procurement rules that do not automatically favour the largest vendor over the most appropriate solution.")}
    ${p("This is what makes ASCN worth defending. In its best reading, it is a network that creates exactly these conditions: a shared framework that reduces the coordination cost of cross-border data exchange, a bilateral-partner ecosystem that brings financing for infrastructure that individual cities cannot fund alone, and a learning platform that lets Mandalay benefit from what Da Nang figured out about water management without having to spend ten years figuring it out independently. The problem is that this best reading is aspirational. The actual reading is more complicated.")}
  </div>

  <div class="essay-section">
    ${h(3, "IV. The Singapore problem")}
    ${p("In early 2024, the Thai entertainment industry was furious. Taylor Swift was coming to Southeast Asia — six shows in Singapore, none anywhere else. This was not an accident of logistics. Thailand's Prime Minister Srettha Thavisin publicly claimed that Singapore had paid approximately USD $3 million per show to AEG, Swift's promoter, with a contractual condition that no other ASEAN country could host the Eras Tour. Singapore's Culture Minister Edwin Tong confirmed that grants had been paid but said the actual figure was 'not accurate and not anywhere as high as speculated'; the precise amount remained undisclosed behind a confidentiality clause. PM Lee Hsien Loong confirmed 'certain incentives' and called it a 'very successful arrangement.' Thailand, the Philippines, and Indonesia lodged formal protests. Philippines lawmaker Joey Salceda estimated USD $60 million in regional tourism revenue that would have been distributed across the region had Swift performed in multiple cities. Singapore said it was doing what cities do: compete for investment.")}
    ${p("I want to sit with that phrase: compete for investment. Singapore is a city-state of 6 million people with a GDP per capita that exceeds Switzerland, a public transport system that is a graduate-school case study in urban infrastructure, and a government that owns the land its citizens live on and therefore controls its urban development with a precision that no other ASEAN member could legally replicate even if it wanted to. Using public tourism grants to lock a concert out of countries that collectively have 600 million people and significantly less capital is not competition between comparable actors. It is a much larger and richer player purchasing exclusivity at its neighbors' expense. The former Singapore Permanent Secretary for Foreign Affairs dismissed the criticism as 'sour grapes' and called it 'being better, faster and more creative than the competition.' You may judge for yourself how that reads.")}
    ${p("The ASEAN Smart Cities Network has the same structure. Singapore wrote the governance framework. Singapore proposed the Shepherd model, which it designed as a role distinct from the annual rotating Chair — a role that holds institutional memory, coordinates bilateral partnerships, and sets the knowledge agenda across administrations. Singapore was the Inaugural Shepherd, from 2019 to 2023. When that term ended, Indonesia took over, which is better, but the institutional patterns were set. The frameworks, the capacity-building curricula, the bilateral partnership channels that generate data and implementation experience — all of these were routed through Singapore's institutional apparatus during the formative years of the network. This is not a conspiracy. It is a design choice, and design choices have consequences even when the intentions are benign.")}
    ${pull("The city-model that gets held up as the ASCN exemplar — Jurong Innovation District, Tengah eco-town, the city-state's various masterplanned developments — is built by a government that owns the land, manages a population that has no independent city government to vote against the plan, and operates with a budget that no other ASEAN municipality commands. Translating that model to Bangkok or Manila or Phnom Penh is not a knowledge-transfer problem. It is a category error.")}
    ${p("I have colleagues who work at the Singaporean institutions involved in ASCN and they are serious people doing serious work. I am not arguing that Singapore is malicious. I am arguing that the structure produces malicious effects even when the individuals within it are acting in good faith, which is what structural critique actually means. The network should not be dissolved. It should be restructured. Indonesia's shepherdship, which began in 2023, is a meaningful step. What comes next matters more than what has happened so far.")}
  </div>

  <div class="essay-section">
    ${h(3, "V. A note on the Centre for Livable Cities")}
    ${p("The Centre for Livable Cities is Singapore's research institution that produces most of the published knowledge product circulated through ASCN. It publishes reports. They are well-designed, professionally produced, and packaged in layouts that make government officials feel that something serious has been accomplished. The question I want to answer precisely, because precision matters more than politeness here, is: how much of this is actually read and used, and by whom?")}
    ${p("The academic literature on ASCN — which I have read in full, because it is not long — cites CLC rarely. Taeihagh, Tan & Sivarajah, writing in Sustainability in 2021, conducted nineteen key-informant interviews with ASCN participants and produced the most rigorous empirical analysis of the network to date. They cite ASEAN Secretariat documents. They cite the policy transfer and regional governance literature. They do not cite CLC. Costoya, writing in Politics and Governance in 2022, characterised ASCN as 'experimentalist governance without diagnostic monitoring' — a phrase that is simultaneously the most accurate description of the network I have encountered and a polite way of saying that the knowledge production is not connected to outcomes measurement. Kong and Woods, in Cities in 2021, examined 'technocratic regionalism' in ASCN — the way a Singapore-led technical network can inadvertently export Singapore's institutional assumptions as if they were neutral methodologies. They do not cite CLC either.")}
    ${p("CLC publishes what is called grey literature: government reports and white papers that circulate within the institutional system that funded them. Grey literature is not automatically useless — it can be an excellent primary source for understanding what institutions believe about themselves. But CLC's Urban Systems Studies series are essentially Singapore's city management practices, packaged as transferable models, distributed at workshops attended by the mid-level officials of cities where the conditions that made those practices work in Singapore simply do not exist. The report goes to the bookshelf. The bookshelf is in the office of someone who attended the workshop because their director told them to, and who will be transferred to a different portfolio in eighteen months. I have been in this room. I know what happens to the book.")}
    ${p("A blank page is more honest than a report that asserts knowledge transfer that is not happening. What knowledge-building actually requires is the accumulation of city-specific evidence by people who live in those cities and have to answer for the results. That work, for most ASEAN cities, has barely started. CLC is not doing it, and is not designed to do it. An institution that answers to Singapore's Ministry of National Development is not designed to produce findings that are inconvenient for Singapore's institutional position in the network. This is not a criticism of the people who work there. It is a description of what institutions do.")}
  </div>

  <div class="essay-section">
    ${h(3, "VI. So why are we here")}
    ${p("I built this platform because the data existed and had no public face. Four M&E reports. Thirty-eight cities. A hundred and thirty-four projects. Hundreds of rows in PDF appendix tables that nobody downloads because the PDFs themselves are not easy to find, and the tables require extraction to be useful. Seven years of accumulated evidence about what the network is actually doing, invisible to everyone who is not already inside the institutional system.")}
    ${p("The harder problem — whether ASCN evolves from a Singapore-Shepherd model into something that genuinely belongs to all ten member states, whether the M&E framework starts measuring outcomes instead of outputs, whether the knowledge production escapes the institutional gravity of its current configuration — is not a dashboard problem. It is a political problem. What a dashboard can do is make the political problem visible. Which city has the most projects? Bangkok, because Thailand staffed its participation seriously. Which has the fewest? Several, because the capacity to participate is not evenly distributed and the network has not addressed this. Which focus area is most funded? Transport, where bilateral partners like Japan and Australia have specific infrastructure interests. Which is least? Health and wellbeing, where outcomes are hardest to measure and therefore easiest to deprioritise.")}
    ${p("You can see all of this in the data here. Whether it changes anything is a question I cannot answer. But the data is public, the platform is open, and the network — whatever its structural problems — is real. Thirty-eight cities. Eleven countries. Seven years. A hundred and thirty-four projects, some number of which have actually improved some number of people's lives in ways that nobody has yet measured. That is a starting point. The network that decides to own this data, and to use it to hold itself accountable, could be something different from the network that currently exists. Whether it will decide to be is what I am watching.")}
  </div>

</div>

<div class="essay-refs">
  <p class="label">Sources cited</p>
  <div class="essay-ref-grid">
    <div class="essay-ref-item">
      <span class="essay-ref-n">[1]</span>
      <div><b>Taeihagh, A., Tan, J.S. & Sivarajah, U.</b> (2021). "Smart City Policies and the Policy Transfer Process: A Case Study of the ASEAN Smart Cities Network." <i>Sustainability</i>, 13(11), 6502. MDPI. Based on 19 key informant interviews.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[2]</span>
      <div><b>Costoya, X.</b> (2022). "South-South Cooperation and the Promise of Experimentalist Governance in ASCN." <i>Politics and Governance</i>, 10(3). Source of the characterisation "experimentalist governance without diagnostic monitoring."</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[3]</span>
      <div><b>Kong, L. & Woods, O.</b> (2021). "Scaling smartness, (de)provincialising the city? Singapore, ASEAN and the politics of smart urbanism." <i>Cities</i>, 115. Analysis of technocratic regionalism in ASCN.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[4]</span>
      <div><b>Putra, B.A.</b> (2025). "Human Rights and the ASEAN Smart Cities Network." <i>F1000Research</i>, 14:733. The most direct critical analysis of ASCN's risks for marginalised communities.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[5]</span>
      <div><b>Non Arkaraprasertkul, PhD</b> (2021). "Read the market. Respect the behaviour. Choose for yourselves." <i>The ASEAN Magazine</i>, Issue 14 — "The Road to Sustainable Cities." ASEAN Secretariat.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[6]</span>
      <div><b>DEPA Thailand</b> (2023). <i>Smart City Primer</i> (Article No. 33). Digital Economy Promotion Agency. The framework document referenced in Section III.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[7]</span>
      <div><b>Singapore Tourism Board / AEG grant, 2024</b>. Reported by Reuters, Bangkok Post, Philippine Star, Bloomberg. Thai PM Srettha Thavisin publicly claimed USD $3M per show paid to AEG (Anschutz Entertainment Group) with ASEAN exclusivity clause. Singapore's Culture Minister Edwin Tong confirmed grants were paid but denied the reported figure; PM Lee Hsien Loong confirmed "certain incentives." Estimated SGD $500M (~USD $370M) in tourist spending return. Formal protests from Thailand, Philippines, Indonesia.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[8]</span>
      <div><b>ASCN M&E Reports 2022–2025</b>. ASEAN Secretariat. The primary data source for all project counts, city rosters, and focus-area breakdowns cited in Section VI. Full reports downloadable in the Library tab.</div>
    </div>
    <div class="essay-ref-item">
      <span class="essay-ref-n">[9]</span>
      <div><b>Prayogo, D. & Juned, M.</b> (2025). "Indonesia's Smart City Diplomacy Through ASCN Shepherdship (2023–2025)." <i>Journal of Social and Political Sciences</i>. Analyses Indonesia's shift from Singapore's conceptual framing toward pragmatic implementation.</div>
    </div>
  </div>
</div>`;

  $("#essay-content").innerHTML = essay;
}

async function init() {
  try {
    const [data, K, cities, library, libraryFull] = await Promise.all([
      loadJson("data/ascn-v2-data.json"),
      loadJson("data/ascn-knowledge.json"),
      loadJson("data/ascn-cities.json"),
      loadJson("data/ascn-library.json"),
      loadJson("data/ascn-library-full.json").catch(() => null),
    ]);
    state.data = data; state.K = K; state.C = cities.cities; state.L = library; state.LF = libraryFull;
    wireNav();
    setTab((location.hash || "#overview").slice(1), false);
  } catch (err) {
    console.error(err);
    const el = $("#evidence-status");
    if (el) el.textContent = err.message;
  }
}

init();
