/* ═══════════════════════════════════════════════════════
   ASCN — Static JS (no web services, no live feeds)
   ═══════════════════════════════════════════════════════ */

const baseCities = [
  { city: "Bandar Seri Begawan", country: "Brunei Darussalam", year: 2018, live: 4, completed: 3, enterprise: "Government services", tags: ["Digital identity", "Mobility"], lat: 4.9031, lon: 114.9398 },
  { city: "Battambang", country: "Cambodia", year: 2018, live: 2, completed: 0, enterprise: "Agri-food logistics", tags: ["Public space", "Waste"], lat: 13.0957, lon: 103.2022 },
  { city: "Phnom Penh", country: "Cambodia", year: 2018, live: 4, completed: 1, enterprise: "Government and finance", tags: ["Transit", "Innovation"], lat: 11.5564, lon: 104.9282 },
  { city: "Siem Reap", country: "Cambodia", year: 2018, live: 5, completed: 3, enterprise: "Tourism and culture", tags: ["Tourism", "Data platform"], lat: 13.3671, lon: 103.8448 },
  { city: "Sihanoukville City", country: "Cambodia", year: 2024, live: 2, completed: 0, enterprise: "Port logistics", tags: ["Security", "Parking"], lat: 10.6253, lon: 103.5234 },
  { city: "Banyuwangi", country: "Indonesia", year: 2018, live: 4, completed: 1, enterprise: "Agriculture and tourism", tags: ["Education", "Stunting"], lat: -8.2192, lon: 114.3691 },
  { city: "Jakarta", country: "Indonesia", year: 2018, live: 5, completed: 0, enterprise: "Digital economy and services", tags: ["Civic apps", "Mobility"], lat: -6.2088, lon: 106.8456 },
  { city: "Makassar", country: "Indonesia", year: 2018, live: 5, completed: 0, enterprise: "Port trade and fisheries", tags: ["Health", "Incubation"], lat: -5.1477, lon: 119.4327 },
  { city: "Sumedang", country: "Indonesia", year: 2024, live: 3, completed: 0, enterprise: "Education and public health", tags: ["Knowledge city", "Health"], lat: -6.858, lon: 107.924 },
  { city: "Denpasar", country: "Indonesia", year: 2025, live: 0, completed: 0, enterprise: "Tourism and creative economy", tags: ["New entrant", "Tourism"], lat: -8.65, lon: 115.2167 },
  { city: "Semarang", country: "Indonesia", year: 2025, live: 0, completed: 0, enterprise: "Manufacturing and logistics", tags: ["New entrant", "Urban systems"], lat: -6.9667, lon: 110.4167 },
  { city: "Luang Prabang", country: "Lao PDR", year: 2018, live: 3, completed: 2, enterprise: "Heritage tourism", tags: ["Wetlands", "Heritage"], lat: 19.8856, lon: 102.1347 },
  { city: "Vientiane", country: "Lao PDR", year: 2018, live: 4, completed: 0, enterprise: "Public administration and trade", tags: ["Transport", "Open data"], lat: 17.9757, lon: 102.6331 },
  { city: "Johor Bahru", country: "Malaysia", year: 2018, live: 2, completed: 2, enterprise: "Manufacturing and logistics", tags: ["Analytics", "Mobility"], lat: 1.4927, lon: 103.7414 },
  { city: "Kuala Lumpur", country: "Malaysia", year: 2018, live: 4, completed: 1, enterprise: "Finance and services", tags: ["Urban observatory", "Journey planner"], lat: 3.139, lon: 101.6869 },
  { city: "Kota Kinabalu", country: "Malaysia", year: 2018, live: 4, completed: 0, enterprise: "Tourism and maritime trade", tags: ["Transport", "Water"], lat: 5.9804, lon: 116.0735 },
  { city: "Kuching", country: "Malaysia", year: 2018, live: 4, completed: 1, enterprise: "Services and innovation", tags: ["Traffic", "Flood response"], lat: 1.5533, lon: 110.3592 },
  { city: "Ipoh", country: "Malaysia", year: 2025, live: 4, completed: 0, enterprise: "Industry and services", tags: ["Smart CCTV", "Air quality"], lat: 4.5975, lon: 101.0901 },
  { city: "Putrajaya", country: "Malaysia", year: 2025, live: 5, completed: 0, enterprise: "Public administration", tags: ["Urban observatory", "EV charging"], lat: 2.9264, lon: 101.6964 },
  { city: "Seberang Perai", country: "Malaysia", year: 2025, live: 2, completed: 0, enterprise: "Manufacturing", tags: ["Flood monitoring", "Command center"], lat: 5.3848, lon: 100.3995 },
  { city: "Nay Pyi Taw", country: "Myanmar", year: 2018, live: 6, completed: 0, enterprise: "Public administration", tags: ["Housing", "Safe city"], lat: 19.7633, lon: 96.0785 },
  { city: "Mandalay", country: "Myanmar", year: 2018, live: 4, completed: 1, enterprise: "Trade and manufacturing", tags: ["Traffic", "Solar"], lat: 21.9588, lon: 96.0891 },
  { city: "Yangon", country: "Myanmar", year: 2018, live: 3, completed: 0, enterprise: "Port commerce and finance", tags: ["Conservation", "Transit"], lat: 16.8409, lon: 96.1735 },
  { city: "Cebu City", country: "Philippines", year: 2018, live: 2, completed: 0, enterprise: "BPO and logistics", tags: ["BRT", "Traffic control"], lat: 10.3157, lon: 123.8854 },
  { city: "Davao City", country: "Philippines", year: 2018, live: 3, completed: 0, enterprise: "Agri-logistics", tags: ["Command center", "Stormwater"], lat: 7.1907, lon: 125.4553 },
  { city: "Manila", country: "Philippines", year: 2018, live: 2, completed: 0, enterprise: "Finance and services", tags: ["E-government", "Safety"], lat: 14.5995, lon: 120.9842 },
  { city: "Cauayan City", country: "Philippines", year: 2025, live: 1, completed: 0, enterprise: "Agriculture and agri-tech", tags: ["Waste-wise", "New entrant"], lat: 16.9299, lon: 121.7663 },
  { city: "Singapore", country: "Singapore", year: 2018, live: 3, completed: 3, enterprise: "Advanced services and technology", tags: ["Punggol", "Digital twin"], lat: 1.3521, lon: 103.8198 },
  { city: "Bangkok", country: "Thailand", year: 2018, live: 2, completed: 0, enterprise: "Finance and creative industries", tags: ["Bang Sue", "Mobility"], lat: 13.7563, lon: 100.5018 },
  { city: "Chonburi", country: "Thailand", year: 2018, live: 3, completed: 0, enterprise: "Automotive and manufacturing", tags: ["Microgrid", "Hydrogen"], lat: 13.3611, lon: 100.9847 },
  { city: "Phuket", country: "Thailand", year: 2018, live: 4, completed: 0, enterprise: "Tourism and hospitality", tags: ["Smart mobility", "Tourism"], lat: 7.8804, lon: 98.3923 },
  { city: "Chiang Mai", country: "Thailand", year: 2023, live: 4, completed: 0, enterprise: "Creative tech and tourism", tags: ["Wildfire", "Mae Kha"], lat: 18.7883, lon: 98.9853 },
  { city: "Khon Kaen", country: "Thailand", year: 2023, live: 3, completed: 0, enterprise: "Logistics and education", tags: ["Tram", "Smart bus"], lat: 16.4322, lon: 102.8236 },
  { city: "Rayong", country: "Thailand", year: 2023, live: 4, completed: 0, enterprise: "Energy and petrochemicals", tags: ["Wangchan Valley", "Health"], lat: 12.6814, lon: 101.2816 },
  { city: "Da Nang", country: "Viet Nam", year: 2018, live: 2, completed: 0, enterprise: "Tourism and ICT", tags: ["Operation centre", "Water"], lat: 16.0544, lon: 108.2022 },
  { city: "Ha Noi", country: "Viet Nam", year: 2018, live: 2, completed: 0, enterprise: "Government and technology", tags: ["IOC", "Surveillance"], lat: 21.0285, lon: 105.8542 },
  { city: "Ho Chi Minh City", country: "Viet Nam", year: 2018, live: 2, completed: 0, enterprise: "Manufacturing and finance", tags: ["IOC", "Emergency response"], lat: 10.8231, lon: 106.6297 },
  { city: "Dili", country: "Timor-Leste", year: 2026, live: 0, completed: 0, enterprise: "Public services and trade", tags: ["Newest member", "Pipeline"], lat: -8.5569, lon: 125.5603 },
];

const countryFlags = {
  "Brunei Darussalam": "\u{1F1E7}\u{1F1F3}", Cambodia: "\u{1F1F0}\u{1F1ED}", Indonesia: "\u{1F1EE}\u{1F1E9}",
  "Lao PDR": "\u{1F1F1}\u{1F1E6}", Malaysia: "\u{1F1F2}\u{1F1FE}", Myanmar: "\u{1F1F2}\u{1F1F2}",
  Philippines: "\u{1F1F5}\u{1F1ED}", Singapore: "\u{1F1F8}\u{1F1EC}", Thailand: "\u{1F1F9}\u{1F1ED}",
  "Viet Nam": "\u{1F1FB}\u{1F1F3}", "Timor-Leste": "\u{1F1F9}\u{1F1F1}",
};

const focusAreas = [
  { label: "Civic & Social", value: 25 },
  { label: "Health & Well-Being", value: 6 },
  { label: "Safety & Security", value: 14 },
  { label: "Quality Environment", value: 18 },
  { label: "Built Infrastructure", value: 25 },
  { label: "Industry & Innovation", value: 12 },
];

const mentions = [
  { date: "5 Feb 2026", source: "ASEAN Main Portal", category: "Governance", title: "ASCN page reflects the 38-city roster", summary: "Official ASCN page confirms growth from 26 pilot cities to 38 member cities.", href: "https://asean.org/our-communities/asean-smart-cities-network/" },
  { date: "30 Sep 2025", source: "ASCN M&E 2025", category: "Performance", title: "M&E report publishes 2025 project baseline", summary: "134 projects: 108 ongoing, 18 completed, 8 in planning.", href: "research/ascn/ascn-monitoring-evaluation-2025.pdf" },
  { date: "15 Nov 2018", source: "East Asia Summit", category: "Mandate", title: "EAS leaders statement supports ASEAN smart city cooperation", summary: "High-level political support and partner mobilization for ASCN.", href: "research/ascn/eas-leaders-statement-asean-smart-cities-2018.pdf" },
  { date: "Sep 2024", source: "The ASEAN Magazine", category: "Strategy", title: "Connectivity narrative positions smart urban systems centrally", summary: "Smart urban infrastructure as a priority for resilience and growth.", href: "https://theaseanmagazine.asean.org/article/connecting-for-resilience-aseans-strategic-path-forward/" },
  { date: "2025", source: "MY ASEAN 2025", category: "Chairship", title: "Malaysia chair year highlights ASCN collaboration agenda", summary: "Malaysia's chairship frames ASCN as part of the regional implementation agenda.", href: "https://myasean2025.my/asean-smart-cities-network-ascn/" },
  { date: "27 Oct 2025", source: "Philippine Information Agency", category: "Chairship", title: "Philippines to chair ASCN in 2026", summary: "Philippine chairship linking ASCN with local-government priorities.", href: "https://pia.gov.ph/ph-to-chair-asean-smart-city-network-starting-next-year/" },
  { date: "27 Oct 2025", source: "Manila Bulletin", category: "Coverage", title: "Philippines leadership role in the next ASCN cycle", summary: "Mainstream coverage of Philippines taking the network chairship.", href: "https://mb.com.ph/2025/10/27/ph-to-chair-asean-smart-city-network-starting-next-year" },
  { date: "9 Sep 2025", source: "The Star", category: "Chairship", title: "ASCN 8 focuses on growth, infrastructure, and governance", summary: "Chair-year media coverage on governance and infrastructure.", href: "https://www.thestar.com.my/news/nation/2025/09/09/asean-smart-cities-network-centres-on-growth-infrastructure-and-governance" },
  { date: "13 Sep 2025", source: "The Diplomat", category: "Geopolitics", title: "Smart-city cooperation linked with strategic competition", summary: "Analysis of technology partnerships in regional geopolitics.", href: "https://thediplomat.com/2025/09/china-brings-smart-city-tech-and-surveillance-to-asean/" },
  { date: "Reference", source: "ASEAN Connectivity", category: "Policy", title: "Sustainable infrastructure priorities cite smart-city relevance", summary: "ASCN alignment with sustainable infrastructure investment.", href: "https://connectivity.asean.org/strategic-area/sustainable-infrastructure/" },
];

const people = [
  { name: "Dr. Non Arkaraprasertkul", role: "Thailand / DEPA", detail: "Chief Expert in Smart Promotion, DEPA", contact: "non.ar@depa.or.th" },
  { name: "Mr. Mohd Hazli bin Ahmad @ Adnan", role: "Malaysia", detail: "Deputy Secretary General, Ministry of Housing and Local Government", contact: "pa_tksupm@kpkt.gov.my" },
  { name: "Mr. Juanito Victor C. Remulla", role: "Philippines", detail: "Secretary, Department of the Interior and Local Government", contact: "jcremulla@dilg.gov.ph" },
  { name: "Mr. Jiraroth Sukolrat", role: "Bangkok CSCO", detail: "Director General, Office of Transport and Traffic Policy and Planning", contact: "jiraroth.suk@otp.go.th" },
  { name: "Mr. Mohd Musabri bin Shaharom", role: "Putrajaya CSCO", detail: "Head of Smart City Section, Putrajaya Corporation", contact: "musabri@ppj.gov.my" },
  { name: "Atty. Reina Consorcia M. Santos", role: "Cauayan City CSCO", detail: "Project Coordinator, Smart and Sustainable Cities Program", contact: "cityinfotech@cityofcauayan.gov.ph" },
];

const resources = [
  { title: "ASCN Framework (2018)", note: "Foundational objectives, systems lens, and implementation logic.", href: "research/ascn/ascn-framework-2018.pdf", meta: "Foundational" },
  { title: "ASCN Contact List (31 Jan 2026)", note: "National representatives and CSCO contacts for the 38-city roster.", href: "research/ascn/ascn-contact-list-2026-01-31.pdf", meta: "8 pages" },
  { title: "ASCN M&E 2025", note: "Project counts and status baseline used across this dashboard.", href: "research/ascn/ascn-monitoring-evaluation-2025.pdf", meta: "Sep 2025" },
  { title: "Smart City Planning Guidebook", note: "Planning method, priority areas, and enabling conditions.", href: "research/ascn/asean-smart-city-planning-guidebook-2022.pdf", meta: "Guidebook" },
  { title: "Thailand Chairmanship Activities", note: "Chairship chapter with implementation examples.", href: "research/ascn/ascn-thailand-chairmanship-2019.pdf", meta: "Archive" },
  { title: "Smart City Action Plans (Pilot Cities)", note: "Consolidated SCAP reference for the founding cohort.", href: "research/ascn/ascn-consolidated-scaps.pdf", meta: "SCAP" },
];

const waveLabel = { 2018: "2018 founding cohort", 2023: "2023 expansion", 2024: "2024 expansion", 2025: "2025 expansion", 2026: "2026 frontier" };
const yearWeight = { 2018: 14, 2023: 11, 2024: 9, 2025: 7, 2026: 5 };

// ── State ──────────────────────────────────────────────

const state = { filter: "all", sort: "signal", selectedCity: null };
let cities = baseCities.map((c) => ({ ...c }));
let seaMap = null;
let markerLayer = null;
const markerByCity = new Map();
let currentTileLayer = null;
let mapMode = "map";

// ── Helpers ────────────────────────────────────────────

function normalizeKey(city, country) {
  return `${city}`.toLowerCase().trim() + "::" + `${country}`.toLowerCase().trim();
}

function formatPop(v) { return Number.isFinite(v) && v > 0 ? v.toLocaleString() : "n/a"; }
function formatArea(v) { return Number.isFinite(v) && v > 0 ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} km\u00B2` : "n/a"; }

// ── Data enrichment ────────────────────────────────────

let slicData = {};

async function loadCityStats() {
  try {
    const r = await fetch("research/ascn/city-stats-merged.json");
    if (!r.ok) return;
    const stats = await r.json();
    const map = new Map(stats.map((s) => [normalizeKey(s.city, s.country), s]));
    cities = cities.map((c) => {
      const s = map.get(normalizeKey(c.city, c.country));
      return { ...c, population: s?.population ?? null, area_km2: s?.area_km2 ?? null };
    });
  } catch (_) {}
}

async function loadSlicData() {
  try {
    const r = await fetch("slic-enrichment.json?v=4");
    if (!r.ok) return;
    slicData = await r.json();
  } catch (_) {}
}

function enrichCities() {
  for (const c of cities) {
    c.flag = countryFlags[c.country] || "";
    c.projects = c.live + c.completed;
    c.signal = c.live * 13 + c.completed * 7 + (yearWeight[c.year] || 0);
  }
}

// ── Render: bars ───────────────────────────────────────

function renderBars(el, items, max) {
  if (!el) return;
  el.innerHTML = items.map((i) => `
    <div class="bar-row">
      <span>${i.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(i.value / max) * 100}%"></div></div>
      <span>${i.suffix ? i.value + i.suffix : i.value}</span>
    </div>
  `).join("");
}

function renderFocusAndCohorts() {
  renderBars(document.querySelector("#focus-bars"), focusAreas.map((a) => ({ ...a, suffix: "%" })), 25);
  const counts = cities.reduce((m, c) => m.set(c.year, (m.get(c.year) || 0) + 1), new Map());
  const items = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ label: waveLabel[y] || `${y}`, value: v }));
  renderBars(document.querySelector("#cohort-bars"), items, Math.max(...items.map((i) => i.value), 1));
}

// ── Render: cohort motion ──────────────────────────────

function renderCohortMotion() {
  const el = document.querySelector("#cohort-motion");
  if (!el) return;
  const grouped = [...new Set(cities.map((c) => c.year))].sort().map((y) => {
    const g = cities.filter((c) => c.year === y);
    const p = g.reduce((s, c) => s + c.projects, 0);
    return { year: y, label: waveLabel[y] || `${y}`, members: g.length, projects: p, avg: g.length ? p / g.length : 0 };
  });
  const maxP = Math.max(...grouped.map((i) => i.projects), 1);
  const maxA = Math.max(...grouped.map((i) => i.avg), 1);
  el.innerHTML = grouped.map((i) => `
    <div class="motion-row">
      <div><h4>${i.label}</h4><span class="sub">${i.members} cities</span></div>
      <div class="motion-bars">
        <div class="motion-bar"><i style="width:${(i.projects / maxP) * 100}%"></i></div>
        <div class="motion-bar avg"><i style="width:${(i.avg / maxA) * 100}%"></i></div>
      </div>
      <div class="motion-value">${i.projects} / ${i.avg.toFixed(1)}</div>
    </div>
  `).join("");
}

// ── Render: cities ─────────────────────────────────────

function getVisible() {
  const f = state.filter === "all" ? [...cities] : cities.filter((c) => c.country === state.filter);
  if (state.sort === "projects") return f.sort((a, b) => b.projects - a.projects || a.city.localeCompare(b.city));
  if (state.sort === "newest") return f.sort((a, b) => b.year - a.year || a.city.localeCompare(b.city));
  return f.sort((a, b) => b.signal - a.signal || a.city.localeCompare(b.city));
}

function renderCountryFilter() {
  const el = document.querySelector("#country-filter");
  if (!el) return;
  const cs = [...new Set(cities.map((c) => c.country))].sort();
  el.insertAdjacentHTML("beforeend", cs.map((c) => `<option value="${c}">${c}</option>`).join(""));
}

function markerColor(y) {
  if (y >= 2025) return "#b22";
  if (y >= 2023) return "#c90";
  return "#1a3c6e";
}

const tileLayers = {
  map: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Tiles &copy; Esri" },
  night: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
};

function initMap() {
  if (!window.L || !document.querySelector("#sea-map")) return;
  seaMap = L.map("sea-map", { zoomControl: true, scrollWheelZoom: false, minZoom: 3, maxZoom: 8 }).setView([8.5, 112], 4);
  currentTileLayer = L.tileLayer(tileLayers.map.url, { attribution: tileLayers.map.attr }).addTo(seaMap);
  seaMap.setMaxBounds([[-15, 90], [25, 140]]);
  markerLayer = L.layerGroup().addTo(seaMap);
}

function switchMapLayer(mode) {
  if (!seaMap || mode === mapMode) return;
  mapMode = mode;
  if (currentTileLayer) seaMap.removeLayer(currentTileLayer);
  const t = tileLayers[mode];
  currentTileLayer = L.tileLayer(t.url, { attribution: t.attr }).addTo(seaMap);
  // Restyle markers for the new layer
  for (const [name, m] of markerByCity) {
    const isActive = name === state.selectedCity;
    if (mode === "night") {
      m.setStyle({ radius: isActive ? 10 : 7, fillColor: "#00e5ff", fillOpacity: 1, color: isActive ? "#fff" : "rgba(0,229,255,0.4)", weight: isActive ? 2.5 : 3 });
    } else if (mode === "satellite") {
      m.setStyle({ radius: isActive ? 9 : 5, fillColor: markerColor(m._cityYear), fillOpacity: 0.95, color: "#fff", weight: isActive ? 2.5 : 1.5 });
    } else {
      m.setStyle({ radius: isActive ? 8 : 5, fillColor: markerColor(m._cityYear), fillOpacity: isActive ? 1 : 0.85, color: isActive ? "#111" : "#fff", weight: isActive ? 2 : 1 });
    }
  }
}

function wireMapLayerToggle() {
  document.querySelectorAll(".map-layer-toggle .sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".map-layer-toggle .sort-btn").forEach((b) => b.classList.toggle("active", b === btn));
      switchMapLayer(btn.dataset.layer);
    });
  });
}

function renderMarkers(vis) {
  if (!seaMap || !markerLayer) return;
  markerLayer.clearLayers();
  markerByCity.clear();
  for (const c of vis) {
    const isNight = mapMode === "night";
    const isSat = mapMode === "satellite";
    const style = isNight
      ? { radius: 7, color: "rgba(0,229,255,0.4)", weight: 3, fillColor: "#00e5ff", fillOpacity: 1 }
      : isSat
        ? { radius: 5, color: "#fff", weight: 1.5, fillColor: markerColor(c.year), fillOpacity: 0.95 }
        : { radius: 5, color: "#fff", weight: 1, fillColor: markerColor(c.year), fillOpacity: 0.9 };
    const m = L.circleMarker([c.lat, c.lon], style);
    m._cityYear = c.year;
    m.bindTooltip(`${c.flag} ${c.city}`, { direction: "top", offset: [0, -2] });
    m.on("click", () => selectCity(c.city, true));
    m.addTo(markerLayer);
    markerByCity.set(c.city, m);
  }
  if (!state.selectedCity || !vis.some((c) => c.city === state.selectedCity)) state.selectedCity = vis[0]?.city || null;
  highlightMarker(false);
}

function renderCallouts(vis) {
  const west = document.querySelector("#map-callouts-west");
  const east = document.querySelector("#map-callouts-east");
  if (!west || !east) return;
  const sorted = [...vis].sort((a, b) => b.lat - a.lat || a.lon - b.lon);
  const w = sorted.filter((c) => c.lon < 110);
  const e = sorted.filter((c) => c.lon >= 110);
  const html = (c) => `<button class="map-callout${state.selectedCity === c.city ? " is-active" : ""}" type="button" data-city="${c.city}"><strong>${c.flag} ${c.city}</strong><small>${c.country}</small></button>`;
  west.innerHTML = w.map(html).join("");
  east.innerHTML = e.map(html).join("");
  document.querySelectorAll(".map-callout").forEach((b) => b.addEventListener("click", () => selectCity(b.dataset.city, true)));
}

const indicatorLabels = {
  air_quality_pm25: "PM2.5 (\u00b5g/m\u00b3)",
  homicide_rate: "Homicide rate /100k",
  water_sanitation: "Water & sanitation %",
  healthcare: "Healthcare quality",
  education: "Education quality",
  digital_infra: "Digital infra (Gbps/cap)",
  work_hours: "Avg work hours/wk",
  mental_strain: "Suicide rate /100k",
  belonging: "Belonging index",
  tolerance: "Tolerance index",
  cultural_life: "Cultural life",
  r_and_d: "R&D (% GDP)",
  fertility: "Fertility rate",
  climate_comfort: "Climate comfort",
};

function fmtNum(v, dec = 1) {
  if (v == null) return "n/a";
  return typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: dec }) : v;
}

function renderDetail() {
  const el = document.querySelector("#city-detail");
  const name = document.querySelector("#city-detail-name");
  const econSection = document.querySelector("#city-economy");
  const econGrid = document.querySelector("#city-economy-grid");
  const indSection = document.querySelector("#city-indicators");
  const indGrid = document.querySelector("#city-indicators-grid");
  const indNote = document.querySelector("#city-indicators-note");
  const slicSection = document.querySelector("#city-slic");
  const slicGrid = document.querySelector("#city-slic-grid");

  if (!el || !name) return;
  const c = cities.find((x) => x.city === state.selectedCity);
  if (!c) {
    name.textContent = "Select a city above.";
    el.innerHTML = "";
    if (econSection) econSection.hidden = true;
    if (indSection) indSection.hidden = true;
    if (slicSection) slicSection.hidden = true;
    return;
  }

  name.textContent = `${c.flag} ${c.city}`;
  el.innerHTML = `
    <article><span>Country</span><strong>${c.country}</strong></article>
    <article><span>Joined</span><strong>${c.year}</strong></article>
    <article><span>Projects</span><strong>${c.projects}</strong></article>
    <article><span>Signal</span><strong>${c.signal}</strong></article>
    <article><span>Population</span><strong>${formatPop(c.population)}</strong></article>
    <article><span>Area</span><strong>${formatArea(c.area_km2)}</strong></article>
    <article><span>Enterprise</span><strong>${c.enterprise}</strong></article>
    <article><span>Focus</span><strong>${c.tags.join(" / ")}</strong></article>
  `;

  // SLIC enrichment
  const slic = slicData[c.city];

  // Economy
  if (econSection && econGrid) {
    const ec = slic?.economy;
    if (ec) {
      econSection.hidden = false;
      econGrid.innerHTML = `
        ${ec.gdp_ppp ? `<article><span>GDP per capita (PPP)</span><strong>$${ec.gdp_ppp.toLocaleString()}</strong></article>` : ""}
        ${ec.gdp_growth != null ? `<article><span>GDP growth</span><strong>${ec.gdp_growth}%</strong></article>` : ""}
        ${ec.gini != null ? `<article><span>Gini coefficient</span><strong>${ec.gini}</strong></article>` : ""}
        ${ec.household_debt != null ? `<article><span>Household debt / GDP</span><strong>${ec.household_debt}%</strong></article>` : ""}
      `;
    } else {
      econSection.hidden = true;
      econGrid.innerHTML = "";
    }
  }

  // Indicators
  if (indSection && indGrid) {
    const ind = slic?.indicators;
    if (ind && Object.keys(ind).length) {
      indSection.hidden = false;
      indNote.textContent = slic.indicators_note || "";
      indGrid.innerHTML = Object.entries(ind)
        .map(([k, v]) => `<article><span>${indicatorLabels[k] || k}</span><strong>${fmtNum(v)}</strong></article>`)
        .join("");
    } else {
      indSection.hidden = true;
      indGrid.innerHTML = "";
    }
  }

  // SLIC section — hidden (scores not shown publicly)
  if (slicSection && slicGrid) {
    const sc = slic?.slic;
    if (false && sc) {
      slicSection.hidden = false;
      const pillars = [
        ["Pressure", sc.pressure],
        ["Viability", sc.viability],
        ["Capability", sc.capability],
        ["Community", sc.community],
        ["Creative", sc.creative],
      ];
      slicGrid.innerHTML = `
        <article><span>SLIC Score</span><strong>${sc.score}</strong></article>
        <article><span>Global Rank</span><strong>#${sc.rank} / 102</strong></article>
        ${sc.proxy ? `<article><span>Proxy</span><strong>${sc.proxy}</strong></article>` : ""}
        <article><span>Coverage</span><strong>Grade ${sc.coverage}</strong></article>
      `;
      // Add pillar bars after the grid
      const barsHtml = pillars.map(([label, val]) => `
        <div class="slic-bar-row">
          <span>${label}</span>
          <div class="slic-bar-track"><div class="slic-bar-fill" style="width:${val}%"></div></div>
          <span>${val.toFixed(1)}</span>
        </div>
      `).join("");
      slicGrid.insertAdjacentHTML("afterend", "");
      // Remove any previous bars
      const prev = slicSection.querySelector(".slic-bars-container");
      if (prev) prev.remove();
      const barsContainer = document.createElement("div");
      barsContainer.className = "slic-bars-container";
      barsContainer.style.marginTop = "0.8rem";
      barsContainer.innerHTML = barsHtml;
      slicSection.appendChild(barsContainer);
    } else {
      slicSection.hidden = true;
      slicGrid.innerHTML = "";
      const prev = slicSection.querySelector(".slic-bars-container");
      if (prev) prev.remove();
    }
  }
}

function highlightMarker(pan) {
  for (const [name, m] of markerByCity) {
    const a = name === state.selectedCity;
    if (mapMode === "night") {
      m.setStyle({ radius: a ? 10 : 7, fillColor: "#00e5ff", fillOpacity: 1, color: a ? "#fff" : "rgba(0,229,255,0.4)", weight: a ? 2.5 : 3 });
    } else if (mapMode === "satellite") {
      m.setStyle({ radius: a ? 9 : 5, fillColor: markerColor(m._cityYear), fillOpacity: 0.95, color: "#fff", weight: a ? 2.5 : 1.5 });
    } else {
      m.setStyle({ radius: a ? 8 : 5, fillOpacity: a ? 1 : 0.85, color: a ? "#111" : "#fff", weight: a ? 2 : 1 });
    }
  }
  document.querySelectorAll(".map-callout").forEach((b) => b.classList.toggle("is-active", b.dataset.city === state.selectedCity));
  if (pan && seaMap && markerByCity.has(state.selectedCity)) {
    seaMap.flyTo(markerByCity.get(state.selectedCity).getLatLng(), 6, { duration: 0.6 });
  }
}

function selectCity(name, pan) {
  state.selectedCity = name;
  highlightMarker(pan);
  renderDetail();
}

function renderCities() {
  const vis = getVisible();
  renderCallouts(vis);
  renderMarkers(vis);
  renderDetail();
}

// ── Render: signals, people, library ───────────────────

function renderSignals() {
  const el = document.querySelector("#signal-feed");
  if (!el) return;
  el.innerHTML = mentions.map((m) => `
    <article>
      <time>${m.date} \u00B7 ${m.source}</time>
      <h3>${m.title}</h3>
      <p>${m.summary}</p>
      <span class="tag">${m.category}</span>
      <a class="source-link" href="${m.href}" ${m.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>Source</a>
    </article>
  `).join("");
}

function renderPeople() {
  const el = document.querySelector("#people-grid");
  if (!el) return;
  el.innerHTML = people.map((p) => `
    <article>
      <span class="card-meta">${p.role}</span>
      <h3>${p.name}</h3>
      <p>${p.detail}</p>
      <a class="source-link" href="mailto:${p.contact}">${p.contact}</a>
    </article>
  `).join("");
}

function renderLibrary() {
  const el = document.querySelector("#library-grid");
  if (!el) return;
  el.innerHTML = resources.map((r) => `
    <article>
      <span class="card-meta">${r.meta}</span>
      <h3>${r.title}</h3>
      <p>${r.note}</p>
      <a class="source-link" href="${r.href}">Open</a>
    </article>
  `).join("");
}

// ── Chair tracker ──────────────────────────────────────

function renderChair() {
  const fill = document.querySelector("#chair-progress-fill");
  const note = document.querySelector("#chair-progress-note");
  const items = [...document.querySelectorAll("#chair-milestones li")];
  if (!fill || !note || !items.length) return;

  const start = Date.parse("2025-09-09"), end = Date.parse("2026-12-31"), now = Date.now();
  const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  fill.style.width = `${pct.toFixed(1)}%`;
  note.textContent = `${pct.toFixed(0)}% through the 2025\u20132026 transition cycle.`;

  let marked = false;
  for (const li of items.sort((a, b) => Date.parse(a.dataset.date) - Date.parse(b.dataset.date))) {
    li.classList.remove("done", "current", "upcoming");
    if (now >= Date.parse(li.dataset.date)) { li.classList.add("done"); continue; }
    if (!marked) { li.classList.add("current"); marked = true; continue; }
    li.classList.add("upcoming");
  }
}

// ── Counters + reveal ──────────────────────────────────

function animateCount(node) {
  const target = +node.dataset.count || 0;
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / 1000, 1);
    node.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

function wireCounters() {
  const obs = new IntersectionObserver((entries, o) => {
    for (const e of entries) { if (e.isIntersecting) { animateCount(e.target); o.unobserve(e.target); } }
  }, { threshold: 0.4 });
  document.querySelectorAll(".count").forEach((n) => obs.observe(n));
}

function wireReveal() {
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) { if (e.isIntersecting) e.target.classList.add("visible"); }
  }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((n) => obs.observe(n));
}

// ── Tabs ───────────────────────────────────────────────

function wireTabs() {
  const tabs = [...document.querySelectorAll(".ref-tab")];
  const panels = {
    mentions: document.querySelector("#panel-mentions"),
    library: document.querySelector("#panel-library"),
    people: document.querySelector("#panel-people"),
    chair: document.querySelector("#panel-chair"),
    studio: document.querySelector("#panel-studio"),
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", String(t === tab)); });
      Object.entries(panels).forEach(([k, p]) => { if (p) { p.hidden = k !== id; p.classList.toggle("active", k === id); } });
    });
  });
}

function wireSorting() {
  document.querySelectorAll(".sort-btn").forEach((b) => {
    b.addEventListener("click", () => {
      state.sort = b.dataset.sort;
      document.querySelectorAll(".sort-btn").forEach((n) => n.classList.toggle("active", n === b));
      renderCities();
    });
  });
  const cf = document.querySelector("#country-filter");
  if (cf) cf.addEventListener("change", (e) => { state.filter = e.target.value; renderCities(); });
}

// ── SLIC Index Lite (ASCN Version) ─────────────────────

const pillarNames = { momentum: "Momentum", productivity: "Productivity", livability: "Livability", affordability: "Affordability", digital: "Digital", social: "Social" };
const pillarKeys = Object.keys(pillarNames);
let slicLiteData = [];
let slicLitePillar = "momentum";

// Absolute-benchmark scoring: 100 = genuinely world-class, not just "best in group"
// Each metric has a global reference ceiling so no city gets inflated scores

function absScore(val, floor, ceiling) {
  // Score against absolute benchmark, not group min/max
  if (val == null) return null;
  return Math.max(0, Math.min(100, ((val - floor) / (ceiling - floor)) * 100));
}

function invScore(val, bestVal, worstVal) {
  // Lower raw value = better (e.g. PM2.5, homicide). bestVal < worstVal.
  if (val == null) return null;
  return Math.max(0, Math.min(100, ((worstVal - val) / (worstVal - bestVal)) * 100));
}

function avgValid(...vals) {
  const v = vals.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function computeSlicLite() {
  const raw = cities.map((c) => {
    const s = slicData[c.city] || {};
    const ind = s.indicators || {};
    const ec = s.economy || {};
    return {
      city: c,
      gdp_ppp: ec.gdp_ppp ?? null,
      gdp_growth: ec.gdp_growth ?? null,
      water: ind.water_sanitation ?? null,
      healthcare: ind.healthcare ?? null,
      pm25: ind.air_quality_pm25 ?? null,
      digital: ind.digital_infra ?? null,
      homicide: ind.homicide_rate ?? null,
      mental: ind.mental_strain ?? null,
      belonging: ind.belonging ?? null,
      tolerance: ind.tolerance ?? null,
      cultural: ind.cultural_life ?? null,
      projects: c.projects,
      live: c.live,
      completed: c.completed,
      year: c.year,
    };
  });

  // Max project score for momentum
  const maxProjScore = Math.max(...raw.map((r) => r.live * 3 + r.completed * 5), 1);
  const years = raw.map((r) => r.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  slicLiteData = raw.map((r) => {
    const c = r.city;

    const slic = slicData[c.city]?.slic;
    const ind = slicData[c.city]?.indicators || {};

    // ── Productivity ──
    // Growth weighted 55% (Indonesia 5% > Singapore 4.4%), GDP level 35%, project bonus 10%
    let productivity = null;
    if (r.gdp_ppp != null) {
      const gdpS = absScore(Math.min(r.gdp_ppp, 80000), 5000, 80000) ?? 0;
      const growS = absScore(r.gdp_growth, 0, 8) ?? 40;
      const projBonus = (r.projects / Math.max(maxProjScore, 1)) * 10;
      productivity = Math.min(100, gdpS * 0.35 + growS * 0.55 + projBonus);
    }

    // ── Livability ──
    // TRUE livability = infrastructure quality MINUS stress/pressure
    // Singapore has great infra but high stress → score should be moderate, not 84
    // Kuching/Bangkok have good infra AND lower stress → should score higher
    let livability = null;
    if (slic) {
      // Blend: viability (infra) + inverted pressure (affordability helps livability)
      // + penalize high work hours and suicide
      const infraS = slic.viability; // SG 84, KCH 73.9, JKT 44.4
      const stressBonus = slic.pressure; // Higher = more affordable = less stress. SG 45.7, JKT 84.6
      const workPenalty = ind.work_hours ? invScore(ind.work_hours, 35, 50) ?? 50 : 50; // SG 42.6→49, KL 44.7→35
      const mentalPenalty = ind.mental_strain ? invScore(ind.mental_strain, 2, 20) ?? 50 : 50; // SG 8.1→66, TH 16.59→19
      livability = Math.round(infraS * 0.30 + stressBonus * 0.25 + workPenalty * 0.20 + mentalPenalty * 0.25);
    } else {
      // Non-SLIC: water + healthcare + inverted PM2.5 + inverted suicide
      const waterS = r.water != null ? Math.min(r.water, 100) : null;
      const hcS = absScore(r.healthcare, 40, 95);
      const pm25S = invScore(r.pm25, 5, 50);
      const mentS = ind.mental_strain != null ? invScore(ind.mental_strain, 2, 20) : null;
      livability = avgValid(waterS, hcS, pm25S, mentS);
    }

    // ── Affordability ──
    // SLIC pressure: higher = more affordable
    // Fallback: inverse GDP PPP
    let affordability = null;
    if (slic) {
      affordability = slic.pressure;
    } else if (r.gdp_ppp != null) {
      affordability = invScore(Math.min(r.gdp_ppp, 80000), 5000, 80000);
    }

    // ── Digital ──
    // Bangkok 18.0 Gbps/cap, Singapore 27.43, Thai cities ~15.75
    // Benchmark: 0 = 0, 30 = 100 (global reference)
    const digital = ind.digital_infra != null ? absScore(ind.digital_infra, 0, 30) : (r.digital != null ? absScore(r.digital, 0, 30) : null);

    // ── Social ──
    // Directly use raw indicators — NOT the SLIC community score alone
    // Singapore: tolerance 29, belonging 52.8, work_hours 42.6 (long!) → should score LOW
    // Weight tolerance heavily (diversity matters), penalize long work hours
    let social = null;
    const tolS = ind.tolerance != null ? absScore(ind.tolerance, 0, 50) : null; // SG 29→58, KL 13.5→27, CM 19.4→39
    const belS = ind.belonging != null ? absScore(ind.belonging, 30, 70) : null; // SG 52.8→57, KL 54.7→62
    const culS = ind.cultural_life != null ? absScore(ind.cultural_life, 30, 80) : null; // SG 66→72, KL 58→56
    const workS = ind.work_hours != null ? invScore(ind.work_hours, 35, 50) : null; // SG 42.6→49, BKK 42.53→50, JKT 38.36→77
    social = avgValid(tolS, belS, culS, workS);

    // ── Momentum ── (always computable)
    const projScore = (r.live * 3 + r.completed * 5) / maxProjScore;
    const recency = maxYear > minYear ? (r.year - minYear) / (maxYear - minYear) : 0.5;
    const momentum = Math.round(projScore * 60 + recency * 40);

    const pillars = { productivity, livability, affordability, digital, social, momentum };
    const coverage = pillarKeys.filter((k) => pillars[k] != null).length;
    const coverageGrade = coverage >= 5 ? "A" : coverage >= 3 ? "B" : coverage >= 2 ? "C" : "D";

    // Best pillar
    let bestPillar = "momentum";
    let bestScore = momentum;
    for (const k of pillarKeys) {
      if (pillars[k] != null && pillars[k] > bestScore) { bestScore = pillars[k]; bestPillar = k; }
    }

    return {
      city: c.city, country: c.country, flag: c.flag, tags: c.tags,
      pillars, coverage, coverageGrade, bestPillar,
    };
  });

  // Update data count
  const dataCount = slicLiteData.filter((d) => d.coverage >= 2).length;
  const el = document.querySelector("#sl-data-count");
  if (el) el.textContent = dataCount;
}

function scoreColor(val) {
  if (val == null) return "sc-none";
  if (val >= 80) return "sc-green";
  if (val >= 65) return "sc-navy";
  if (val >= 50) return "sc-amber";
  return "sc-red";
}

function fmtScore(val) {
  return val != null ? Math.round(val) : "---";
}

function renderSlicLiteTable(data) {
  const wrap = document.querySelector("#sl-table-wrap");
  if (!wrap) return;
  if (!data.length) { wrap.innerHTML = ""; return; }
  const dots = (d) => pillarKeys.map((k) => `<td class="sl-dot-cell">${d.pillars[k] != null ? '<span class="sl-dot has-data"></span>' : '<span class="sl-dot"></span>'}</td>`).join("");
  const rows = data.map((d) => {
    return `<tr>
      <td>${d.flag} ${d.city}</td>
      <td>${d.country}</td>
      ${dots(d)}
    </tr>`;
  }).join("");
  const pillarHeaders = pillarKeys.map((k) => `<th class="sl-pillar-th">${pillarNames[k].substring(0, 4)}</th>`).join("");
  wrap.innerHTML = `<table class="sl-table">
    <thead><tr><th>City</th><th>Country</th>${pillarHeaders}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderSlicLite() {
  const sorted = [...slicLiteData].sort((a, b) => a.city.localeCompare(b.city));
  renderSlicLiteTable(sorted);
}

function wireSlicLitePillars() {
  const btns = document.querySelectorAll("#sl-pillar-btns .sort-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      slicLitePillar = btn.dataset.pillar;
      btns.forEach((b) => b.classList.toggle("active", b === btn));
      renderSlicLite();
    });
  });
}

// ── Init ───────────────────────────────────────────────

async function init() {
  await Promise.all([loadCityStats(), loadSlicData()]);
  enrichCities();
  computeSlicLite();
  initMap();
  renderCountryFilter();
  renderFocusAndCohorts();
  renderCohortMotion();
  renderCities();
  renderSignals();
  renderPeople();
  renderLibrary();
  renderChair();
  renderSlicLite();
  wireCounters();
  wireReveal();
  wireTabs();
  wireSorting();
  wireSlicLitePillars();
  wireMapLayerToggle();
}

init();
