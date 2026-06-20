const cityPoints = [
  { city: "Bandar Seri Begawan", country: "Brunei Darussalam", year: 2018, lat: 4.9031, lon: 114.9398 },
  { city: "Battambang", country: "Cambodia", year: 2018, lat: 13.0957, lon: 103.2022 },
  { city: "Phnom Penh", country: "Cambodia", year: 2018, lat: 11.5564, lon: 104.9282 },
  { city: "Siem Reap", country: "Cambodia", year: 2018, lat: 13.3671, lon: 103.8448 },
  { city: "Sihanoukville City", country: "Cambodia", year: 2024, lat: 10.6253, lon: 103.5234 },
  { city: "Banyuwangi", country: "Indonesia", year: 2018, lat: -8.2192, lon: 114.3691 },
  { city: "Jakarta", country: "Indonesia", year: 2018, lat: -6.2088, lon: 106.8456 },
  { city: "Makassar", country: "Indonesia", year: 2018, lat: -5.1477, lon: 119.4327 },
  { city: "Sumedang", country: "Indonesia", year: 2024, lat: -6.858, lon: 107.924 },
  { city: "Denpasar", country: "Indonesia", year: 2025, lat: -8.65, lon: 115.2167 },
  { city: "Semarang", country: "Indonesia", year: 2025, lat: -6.9667, lon: 110.4167 },
  { city: "Luang Prabang", country: "Lao PDR", year: 2018, lat: 19.8856, lon: 102.1347 },
  { city: "Vientiane", country: "Lao PDR", year: 2018, lat: 17.9757, lon: 102.6331 },
  { city: "Johor Bahru", country: "Malaysia", year: 2018, lat: 1.4927, lon: 103.7414 },
  { city: "Kuala Lumpur", country: "Malaysia", year: 2018, lat: 3.139, lon: 101.6869 },
  { city: "Kota Kinabalu", country: "Malaysia", year: 2018, lat: 5.9804, lon: 116.0735 },
  { city: "Kuching", country: "Malaysia", year: 2018, lat: 1.5533, lon: 110.3592 },
  { city: "Ipoh", country: "Malaysia", year: 2025, lat: 4.5975, lon: 101.0901 },
  { city: "Putrajaya", country: "Malaysia", year: 2025, lat: 2.9264, lon: 101.6964 },
  { city: "Seberang Perai", country: "Malaysia", year: 2025, lat: 5.3848, lon: 100.3995 },
  { city: "Nay Pyi Taw", country: "Myanmar", year: 2018, lat: 19.7633, lon: 96.0785 },
  { city: "Mandalay", country: "Myanmar", year: 2018, lat: 21.9588, lon: 96.0891 },
  { city: "Yangon", country: "Myanmar", year: 2018, lat: 16.8409, lon: 96.1735 },
  { city: "Cebu City", country: "Philippines", year: 2018, lat: 10.3157, lon: 123.8854 },
  { city: "Davao City", country: "Philippines", year: 2018, lat: 7.1907, lon: 125.4553 },
  { city: "Manila", country: "Philippines", year: 2018, lat: 14.5995, lon: 120.9842 },
  { city: "Cauayan City", country: "Philippines", year: 2025, lat: 16.9299, lon: 121.7663 },
  { city: "Singapore", country: "Singapore", year: 2018, lat: 1.3521, lon: 103.8198 },
  { city: "Bangkok", country: "Thailand", year: 2018, lat: 13.7563, lon: 100.5018 },
  { city: "Chonburi", country: "Thailand", year: 2018, lat: 13.3611, lon: 100.9847 },
  { city: "Phuket", country: "Thailand", year: 2018, lat: 7.8804, lon: 98.3923 },
  { city: "Chiang Mai", country: "Thailand", year: 2023, lat: 18.7883, lon: 98.9853 },
  { city: "Khon Kaen", country: "Thailand", year: 2023, lat: 16.4322, lon: 102.8236 },
  { city: "Rayong", country: "Thailand", year: 2023, lat: 12.6814, lon: 101.2816 },
  { city: "Da Nang", country: "Viet Nam", year: 2018, lat: 16.0544, lon: 108.2022 },
  { city: "Ha Noi", country: "Viet Nam", year: 2018, lat: 21.0285, lon: 105.8542 },
  { city: "Ho Chi Minh City", country: "Viet Nam", year: 2018, lat: 10.8231, lon: 106.6297 },
  { city: "Dili", country: "Timor-Leste", year: 2026, lat: -8.5569, lon: 125.5603 },
];

const tileLayers = {
  map: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attr: "&copy; OpenStreetMap &copy; CARTO",
  },
  night: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "&copy; OpenStreetMap &copy; CARTO",
  },
};

const milestones = [
  { year: "2018", text: "Network established at the 32nd ASEAN Summit; framework adopted at the 33rd Summit." },
  { year: "2022", text: "M&E baseline reached 77 projects and planning guidebook activity matured." },
  { year: "2024", text: "Roster expanded to 31 cities and the portfolio reached 108 projects." },
  { year: "2025", text: "Malaysia chair year: 134 projects and ASCAP 2026-2035 adopted." },
  { year: "2026", text: "Official roster reaches 38 cities across 11 countries with Dili included." },
];

const state = {
  data: null,
  country: "all",
  focus: "all",
  reportYear: 2025,
  mapMode: "map",
  map: null,
  tileLayer: null,
  markerLayer: null,
};

const fmt = new Intl.NumberFormat("en-US");

function $(selector) {
  return document.querySelector(selector);
}

function esc(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function latestReport() {
  return state.data.reports[state.data.reports.length - 1];
}

function markerColor(year) {
  if (year >= 2026) return "#101418";
  if (year >= 2025) return "#b53a2e";
  if (year >= 2023) return "#a86d14";
  return "#183a5a";
}

function renderKpis() {
  const report = latestReport();
  const items = [
    ["Cities", state.data.network.latest_cities, "Current official roster"],
    ["Projects", report.total_projects, "2025 M&E portfolio"],
    ["Ongoing", report.status.ongoing, "In implementation"],
    ["Completed", report.status.completed, "Successfully concluded"],
    ["Planning", report.status.planning, "Proposal or feasibility stage"],
  ];
  $("#kpi-grid").innerHTML = items.map(([label, value, note]) => `
    <article class="kpi">
      <strong>${fmt.format(value)}</strong>
      <span>${label} - ${note}</span>
    </article>
  `).join("");
  $("#evidence-status").textContent = `${state.data.reports.length} M&E reports, ${state.data.projects.length} appendix rows, ${state.data.sources.length} cited sources.`;
}

function renderMilestones() {
  $("#milestone-list").innerHTML = milestones.map((item) => `
    <div class="milestone">
      <time>${item.year}</time>
      <p>${item.text}</p>
    </div>
  `).join("");
}

function initMap() {
  if (!window.L || !$("#sea-map")) return;
  state.map = L.map("sea-map", {
    zoomControl: true,
    scrollWheelZoom: false,
    minZoom: 3,
    maxZoom: 8,
  }).setView([8.5, 112], 4);
  state.tileLayer = L.tileLayer(tileLayers.map.url, { attribution: tileLayers.map.attr }).addTo(state.map);
  state.map.setMaxBounds([[-15, 90], [25, 140]]);
  state.markerLayer = L.layerGroup().addTo(state.map);
  renderMarkers();
}

function renderMarkers() {
  if (!state.markerLayer) return;
  state.markerLayer.clearLayers();
  for (const point of cityPoints) {
    const marker = L.circleMarker([point.lat, point.lon], {
      radius: point.year >= 2025 ? 7 : 5,
      color: state.mapMode === "night" ? "rgba(255,255,255,0.75)" : "#fff",
      weight: 1.5,
      fillColor: markerColor(point.year),
      fillOpacity: 0.92,
    });
    marker.bindTooltip(`${point.city} - ${point.country} (${point.year})`, { direction: "top", offset: [0, -3] });
    marker.addTo(state.markerLayer);
  }
}

function wireMapMode() {
  $("#map-mode").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button || !state.map) return;
    state.mapMode = button.dataset.mode;
    $("#map-mode").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    if (state.tileLayer) state.map.removeLayer(state.tileLayer);
    state.tileLayer = L.tileLayer(tileLayers[state.mapMode].url, { attribution: tileLayers[state.mapMode].attr }).addTo(state.map);
    renderMarkers();
  });
}

function barRow(label, value, max, cls = "") {
  const width = max ? Math.max(2, (value / max) * 100) : 0;
  return `
    <div class="focus-row">
      <span>${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div>
      <strong>${fmt.format(value)}</strong>
    </div>
  `;
}

function renderProgress() {
  const maxProjects = Math.max(...state.data.reports.map((report) => report.total_projects));
  $("#year-bars").innerHTML = state.data.reports.map((report) => `
    <div class="year-row">
      <strong>${report.year}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${(report.total_projects / maxProjects) * 100}%"></div></div>
      <span>${fmt.format(report.total_projects)} projects</span>
    </div>
  `).join("");

  const report = latestReport();
  $("#status-bars").innerHTML = [
    ["Ongoing", report.status.ongoing, "green"],
    ["Completed", report.status.completed, ""],
    ["Planning", report.status.planning, "amber"],
  ].map(([label, value, cls]) => `
    <div class="stack-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${(value / report.total_projects) * 100}%"></div></div>
      <strong>${value}</strong>
    </div>
  `).join("");

  const focusSelect = $("#focus-year");
  focusSelect.innerHTML = state.data.reports.map((item) => `<option value="${item.year}">${item.year}</option>`).join("");
  focusSelect.value = state.reportYear;
  renderFocusBars();
  renderFocusTrend();
}

function renderFocusBars() {
  const report = state.data.reports.find((item) => item.year === Number($("#focus-year").value)) || latestReport();
  $("#focus-bars").innerHTML = Object.entries(report.focus_share)
    .map(([label, value]) => barRow(label, value, 30, label.includes("Infrastructure") ? "red" : ""))
    .join("");
}

function renderFocusTrend() {
  const years = state.data.reports.map((item) => item.year);
  $("#trend-grid").innerHTML = Object.entries(state.data.derived.focus_trends).map(([focus, byYear]) => `
    <div class="trend-row">
      <strong>${esc(focus)}</strong>
      ${years.map((year) => {
        const val = byYear[String(year)] || 0;
        return `<span><i class="spark" style="--h:${val * 2.9}%"></i>${year}: ${val}%</span>`;
      }).join("")}
    </div>
  `).join("");
}

function populateFilters() {
  const countries = [...new Set(cityPoints.map((item) => item.country))].sort();
  $("#country-filter").insertAdjacentHTML("beforeend", countries.map((country) => `<option value="${esc(country)}">${esc(country)}</option>`).join(""));
  const focusAreas = Object.keys(latestReport().focus_share);
  $("#focus-filter").insertAdjacentHTML("beforeend", focusAreas.map((focus) => `<option value="${esc(focus)}">${esc(focus)}</option>`).join(""));
}

function latestProjects() {
  const latestYear = latestReport().year;
  return state.data.projects.filter((project) => project.report_year === latestYear);
}

function filteredProjects() {
  return latestProjects().filter((project) => {
    const countryMatch = state.country === "all" || project.country === state.country;
    const focusMatch = state.focus === "all" || project.focus_area === state.focus;
    return countryMatch && focusMatch;
  });
}

function renderCityLoad() {
  const counts = new Map();
  for (const project of filteredProjects()) {
    counts.set(project.city, (counts.get(project.city) || 0) + 1);
  }
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14);
  const max = Math.max(...items.map((item) => item[1]), 1);
  $("#city-load").innerHTML = items.map(([city, count]) => `
    <div class="city-row">
      <span>${esc(city)}</span>
      <div class="bar-track"><div class="bar-fill red" style="width:${(count / max) * 100}%"></div></div>
      <strong>${count}</strong>
    </div>
  `).join("");
}

function renderProjectTable() {
  const rows = filteredProjects();
  $("#project-count").textContent = `${rows.length} rows`;
  $("#project-table").innerHTML = rows.slice(0, 160).map((project) => `
    <tr>
      <td>${esc(project.city)}</td>
      <td>${esc(project.country)}</td>
      <td>${esc(project.project)}</td>
      <td>${esc(project.focus_area)}</td>
      <td>${esc(project.status)}</td>
    </tr>
  `).join("");
}

function renderCities() {
  renderCityLoad();
  renderProjectTable();
}

function wireFilters() {
  $("#country-filter").addEventListener("change", (event) => {
    state.country = event.target.value;
    renderCities();
  });
  $("#focus-filter").addEventListener("change", (event) => {
    state.focus = event.target.value;
    renderCities();
  });
  $("#focus-year").addEventListener("change", renderFocusBars);
}

function renderReportTabs() {
  $("#report-tabs").innerHTML = state.data.reports.map((report) => `
    <button type="button" class="${report.year === state.reportYear ? "active" : ""}" data-year="${report.year}">${report.year}</button>
  `).join("");
  $("#report-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-year]");
    if (!button) return;
    state.reportYear = Number(button.dataset.year);
    $("#report-tabs").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    renderReportDetail();
  });
  renderReportDetail();
}

function renderReportDetail() {
  const report = state.data.reports.find((item) => item.year === state.reportYear) || latestReport();
  const delta = state.data.derived.project_deltas.find((item) => item.to === report.year);
  $("#report-detail").innerHTML = `
    <div>
      <p class="label">${report.title}</p>
      <h2>${report.total_projects} projects as of ${report.as_of}</h2>
      <p class="muted">${esc(report.status_note)}</p>
      ${delta ? `<p>Change from ${delta.from}: <strong>+${delta.project_delta}</strong> projects, <strong>+${delta.ongoing_delta}</strong> ongoing, <strong>+${delta.completed_delta}</strong> completed.</p>` : "<p>Baseline report for this V2 trend layer.</p>"}
      <a href="${report.url}" target="_blank" rel="noreferrer">Open source report</a>
    </div>
    <div>
      <div class="report-stat-grid">
        <div class="mini-stat"><strong>${report.status.ongoing}</strong><span>Ongoing</span></div>
        <div class="mini-stat"><strong>${report.status.completed}</strong><span>Completed</span></div>
        <div class="mini-stat"><strong>${report.status.planning}</strong><span>Planning</span></div>
      </div>
      <h3 style="margin-top:1rem">Report highlights</h3>
      <ul>${report.network_highlights.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderSources() {
  $("#source-grid").innerHTML = state.data.sources.map((source) => `
    <article>
      <p class="label">${esc(source.kind)} - ${esc(source.year)}</p>
      <h3>${esc(source.title)}</h3>
      <p>${esc(source.note)}</p>
      <a href="${source.url}" target="_blank" rel="noreferrer">Open source</a>
    </article>
  `).join("");
}

async function loadData() {
  const response = await fetch("data/ascn-v2-data.json?v=1");
  if (!response.ok) throw new Error(`Unable to load ASCN data: ${response.status}`);
  state.data = await response.json();
}

async function init() {
  try {
    await loadData();
    renderKpis();
    renderMilestones();
    initMap();
    wireMapMode();
    renderProgress();
    populateFilters();
    wireFilters();
    renderCities();
    renderReportTabs();
    renderSources();
  } catch (error) {
    $("#evidence-status").textContent = error.message;
    console.error(error);
  }
}

init();
