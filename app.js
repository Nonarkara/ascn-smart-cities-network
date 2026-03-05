const baseCities = [
  {
    city: "Bandar Seri Begawan",
    country: "Brunei Darussalam",
    year: 2018,
    live: 4,
    completed: 3,
    enterprise: "Government services",
    tags: ["Digital identity", "Mobility"],
    lat: 4.9031,
    lon: 114.9398,
  },
  {
    city: "Battambang",
    country: "Cambodia",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Agri-food logistics",
    tags: ["Public space", "Waste"],
    lat: 13.0957,
    lon: 103.2022,
  },
  {
    city: "Phnom Penh",
    country: "Cambodia",
    year: 2018,
    live: 4,
    completed: 1,
    enterprise: "Government and finance",
    tags: ["Transit", "Innovation"],
    lat: 11.5564,
    lon: 104.9282,
  },
  {
    city: "Siem Reap",
    country: "Cambodia",
    year: 2018,
    live: 5,
    completed: 3,
    enterprise: "Tourism and culture",
    tags: ["Tourism", "Data platform"],
    lat: 13.3671,
    lon: 103.8448,
  },
  {
    city: "Sihanoukville City",
    country: "Cambodia",
    year: 2024,
    live: 2,
    completed: 0,
    enterprise: "Port logistics",
    tags: ["Security", "Parking"],
    lat: 10.6253,
    lon: 103.5234,
  },
  {
    city: "Banyuwangi",
    country: "Indonesia",
    year: 2018,
    live: 4,
    completed: 1,
    enterprise: "Agriculture and tourism",
    tags: ["Education", "Stunting"],
    lat: -8.2192,
    lon: 114.3691,
  },
  {
    city: "Jakarta",
    country: "Indonesia",
    year: 2018,
    live: 5,
    completed: 0,
    enterprise: "Digital economy and services",
    tags: ["Civic apps", "Mobility"],
    lat: -6.2088,
    lon: 106.8456,
  },
  {
    city: "Makassar",
    country: "Indonesia",
    year: 2018,
    live: 5,
    completed: 0,
    enterprise: "Port trade and fisheries",
    tags: ["Health", "Incubation"],
    lat: -5.1477,
    lon: 119.4327,
  },
  {
    city: "Sumedang",
    country: "Indonesia",
    year: 2024,
    live: 3,
    completed: 0,
    enterprise: "Education and public health",
    tags: ["Knowledge city", "Health"],
    lat: -6.858,
    lon: 107.924,
  },
  {
    city: "Denpasar",
    country: "Indonesia",
    year: 2025,
    live: 0,
    completed: 0,
    enterprise: "Tourism and creative economy",
    tags: ["New entrant", "Tourism"],
    lat: -8.65,
    lon: 115.2167,
  },
  {
    city: "Semarang",
    country: "Indonesia",
    year: 2025,
    live: 0,
    completed: 0,
    enterprise: "Manufacturing and logistics",
    tags: ["New entrant", "Urban systems"],
    lat: -6.9667,
    lon: 110.4167,
  },
  {
    city: "Luang Prabang",
    country: "Lao PDR",
    year: 2018,
    live: 3,
    completed: 2,
    enterprise: "Heritage tourism",
    tags: ["Wetlands", "Heritage"],
    lat: 19.8856,
    lon: 102.1347,
  },
  {
    city: "Vientiane",
    country: "Lao PDR",
    year: 2018,
    live: 4,
    completed: 0,
    enterprise: "Public administration and trade",
    tags: ["Transport", "Open data"],
    lat: 17.9757,
    lon: 102.6331,
  },
  {
    city: "Johor Bahru",
    country: "Malaysia",
    year: 2018,
    live: 2,
    completed: 2,
    enterprise: "Manufacturing and logistics",
    tags: ["Analytics", "Mobility"],
    lat: 1.4927,
    lon: 103.7414,
  },
  {
    city: "Kuala Lumpur",
    country: "Malaysia",
    year: 2018,
    live: 4,
    completed: 1,
    enterprise: "Finance and services",
    tags: ["Urban observatory", "Journey planner"],
    lat: 3.139,
    lon: 101.6869,
  },
  {
    city: "Kota Kinabalu",
    country: "Malaysia",
    year: 2018,
    live: 4,
    completed: 0,
    enterprise: "Tourism and maritime trade",
    tags: ["Transport", "Water"],
    lat: 5.9804,
    lon: 116.0735,
  },
  {
    city: "Kuching",
    country: "Malaysia",
    year: 2018,
    live: 4,
    completed: 1,
    enterprise: "Services and innovation",
    tags: ["Traffic", "Flood response"],
    lat: 1.5533,
    lon: 110.3592,
  },
  {
    city: "Ipoh",
    country: "Malaysia",
    year: 2025,
    live: 4,
    completed: 0,
    enterprise: "Industry and services",
    tags: ["Smart CCTV", "Air quality"],
    lat: 4.5975,
    lon: 101.0901,
  },
  {
    city: "Putrajaya",
    country: "Malaysia",
    year: 2025,
    live: 5,
    completed: 0,
    enterprise: "Public administration",
    tags: ["Urban observatory", "EV charging"],
    lat: 2.9264,
    lon: 101.6964,
  },
  {
    city: "Seberang Perai",
    country: "Malaysia",
    year: 2025,
    live: 2,
    completed: 0,
    enterprise: "Manufacturing",
    tags: ["Flood monitoring", "Command center"],
    lat: 5.3848,
    lon: 100.3995,
  },
  {
    city: "Nay Pyi Taw",
    country: "Myanmar",
    year: 2018,
    live: 6,
    completed: 0,
    enterprise: "Public administration",
    tags: ["Housing", "Safe city"],
    lat: 19.7633,
    lon: 96.0785,
  },
  {
    city: "Mandalay",
    country: "Myanmar",
    year: 2018,
    live: 4,
    completed: 1,
    enterprise: "Trade and manufacturing",
    tags: ["Traffic", "Solar"],
    lat: 21.9588,
    lon: 96.0891,
  },
  {
    city: "Yangon",
    country: "Myanmar",
    year: 2018,
    live: 3,
    completed: 0,
    enterprise: "Port commerce and finance",
    tags: ["Conservation", "Transit"],
    lat: 16.8409,
    lon: 96.1735,
  },
  {
    city: "Cebu City",
    country: "Philippines",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "BPO and logistics",
    tags: ["BRT", "Traffic control"],
    lat: 10.3157,
    lon: 123.8854,
  },
  {
    city: "Davao City",
    country: "Philippines",
    year: 2018,
    live: 3,
    completed: 0,
    enterprise: "Agri-logistics",
    tags: ["Command center", "Stormwater"],
    lat: 7.1907,
    lon: 125.4553,
  },
  {
    city: "Manila",
    country: "Philippines",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Finance and services",
    tags: ["E-government", "Safety"],
    lat: 14.5995,
    lon: 120.9842,
  },
  {
    city: "Cauayan City",
    country: "Philippines",
    year: 2025,
    live: 1,
    completed: 0,
    enterprise: "Agriculture and agri-tech",
    tags: ["Waste-wise", "New entrant"],
    lat: 16.9299,
    lon: 121.7663,
  },
  {
    city: "Singapore",
    country: "Singapore",
    year: 2018,
    live: 3,
    completed: 3,
    enterprise: "Advanced services and technology",
    tags: ["Punggol", "Digital twin"],
    lat: 1.3521,
    lon: 103.8198,
  },
  {
    city: "Bangkok",
    country: "Thailand",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Finance and creative industries",
    tags: ["Bang Sue", "Mobility"],
    lat: 13.7563,
    lon: 100.5018,
  },
  {
    city: "Chonburi",
    country: "Thailand",
    year: 2018,
    live: 3,
    completed: 0,
    enterprise: "Automotive and manufacturing",
    tags: ["Microgrid", "Hydrogen"],
    lat: 13.3611,
    lon: 100.9847,
  },
  {
    city: "Phuket",
    country: "Thailand",
    year: 2018,
    live: 4,
    completed: 0,
    enterprise: "Tourism and hospitality",
    tags: ["Smart mobility", "Tourism"],
    lat: 7.8804,
    lon: 98.3923,
  },
  {
    city: "Chiang Mai",
    country: "Thailand",
    year: 2023,
    live: 4,
    completed: 0,
    enterprise: "Creative tech and tourism",
    tags: ["Wildfire", "Mae Kha"],
    lat: 18.7883,
    lon: 98.9853,
  },
  {
    city: "Khon Kaen",
    country: "Thailand",
    year: 2023,
    live: 3,
    completed: 0,
    enterprise: "Logistics and education",
    tags: ["Tram", "Smart bus"],
    lat: 16.4322,
    lon: 102.8236,
  },
  {
    city: "Rayong",
    country: "Thailand",
    year: 2023,
    live: 4,
    completed: 0,
    enterprise: "Energy and petrochemicals",
    tags: ["Wangchan Valley", "Health"],
    lat: 12.6814,
    lon: 101.2816,
  },
  {
    city: "Da Nang",
    country: "Viet Nam",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Tourism and ICT",
    tags: ["Operation centre", "Water"],
    lat: 16.0544,
    lon: 108.2022,
  },
  {
    city: "Ha Noi",
    country: "Viet Nam",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Government and technology",
    tags: ["IOC", "Surveillance"],
    lat: 21.0285,
    lon: 105.8542,
  },
  {
    city: "Ho Chi Minh City",
    country: "Viet Nam",
    year: 2018,
    live: 2,
    completed: 0,
    enterprise: "Manufacturing and finance",
    tags: ["IOC", "Emergency response"],
    lat: 10.8231,
    lon: 106.6297,
  },
  {
    city: "Dili",
    country: "Timor-Leste",
    year: 2026,
    live: 0,
    completed: 0,
    enterprise: "Public services and trade",
    tags: ["Newest member", "Pipeline"],
    lat: -8.5569,
    lon: 125.5603,
  },
];

const countryFlags = {
  "Brunei Darussalam": "🇧🇳",
  Cambodia: "🇰🇭",
  Indonesia: "🇮🇩",
  "Lao PDR": "🇱🇦",
  Malaysia: "🇲🇾",
  Myanmar: "🇲🇲",
  Philippines: "🇵🇭",
  Singapore: "🇸🇬",
  Thailand: "🇹🇭",
  "Viet Nam": "🇻🇳",
  "Timor-Leste": "🇹🇱",
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
  {
    date: "5 Feb 2026",
    source: "ASEAN Main Portal",
    category: "Governance and roster updates",
    title: "ASEAN Smart Cities Network page reflects the 38-city roster",
    reason:
      "Cited as the official reference for membership expansion and institutional continuity.",
    href: "https://asean.org/our-communities/asean-smart-cities-network/",
    summary:
      "The official ASCN page confirms growth from 26 pilot cities to 38 member cities and provides current source documents.",
  },
  {
    date: "30 Sep 2025",
    source: "ASCN M&E 2025",
    category: "Performance baseline",
    title: "Monitoring and Evaluation report publishes 2025 project baseline",
    reason: "Media and policy stakeholders quote the 134-project baseline to benchmark progress.",
    href: "research/ascn/ascn-monitoring-evaluation-2025.pdf",
    summary:
      "Public baseline includes 134 projects: 108 ongoing, 18 completed, and 8 in planning as of 30 September 2025.",
  },
  {
    date: "15 Nov 2018",
    source: "East Asia Summit",
    category: "Regional mandate",
    title: "EAS leaders statement supports ASEAN smart city cooperation",
    reason: "Referenced to establish high-level political support and partner mobilization.",
    href: "research/ascn/eas-leaders-statement-asean-smart-cities-2018.pdf",
    summary:
      "The statement reinforces support for city-to-city cooperation, innovation, and partner engagement through ASCN.",
  },
  {
    date: "Sep 2024",
    source: "The ASEAN Magazine",
    category: "Connectivity strategy",
    title: "Connectivity narrative positions smart and sustainable urban systems centrally",
    reason: "Used to connect ASCN outcomes to broader ASEAN connectivity and resilience narratives.",
    href: "https://theaseanmagazine.asean.org/article/connecting-for-resilience-aseans-strategic-path-forward/",
    summary:
      "The regional strategy conversation places smart urban infrastructure as a priority for resilience and growth.",
  },
  {
    date: "2025",
    source: "MY ASEAN 2025",
    category: "Chairship platform",
    title: "Malaysia chair year highlights ASCN collaboration agenda",
    reason: "Mentioned for chairship visibility, event framing, and agenda setting.",
    href: "https://myasean2025.my/asean-smart-cities-network-ascn/",
    summary:
      "Malaysia’s chairship platform frames ASCN as part of the regional implementation agenda.",
  },
  {
    date: "27 Oct 2025",
    source: "Philippine Information Agency",
    category: "Upcoming chairship",
    title: "Philippines announced to chair ASCN in 2026",
    reason: "Referenced for transition context and national-level hosting momentum.",
    href: "https://pia.gov.ph/ph-to-chair-asean-smart-city-network-starting-next-year/",
    summary:
      "PIA reports Philippine chairship starting in 2026, linking ASCN work with national local-government priorities.",
  },
  {
    date: "27 Oct 2025",
    source: "Manila Bulletin",
    category: "Public communication",
    title: "Coverage emphasizes Philippines leadership role in the next ASCN cycle",
    reason: "Cited for national awareness and mainstream policy communication.",
    href: "https://mb.com.ph/2025/10/27/ph-to-chair-asean-smart-city-network-starting-next-year",
    summary:
      "Mainstream coverage highlights the Philippines taking the network chairship and preparing implementation focus.",
  },
  {
    date: "9 Sep 2025",
    source: "The Star",
    category: "Chairship outcomes",
    title: "ASCN 8 coverage focuses on growth, infrastructure, and governance",
    reason: "Used to track how external media frames annual-meeting outcomes.",
    href: "https://www.thestar.com.my/news/nation/2025/09/09/asean-smart-cities-network-centres-on-growth-infrastructure-and-governance",
    summary:
      "Chair-year media coverage underlines governance, implementation, and infrastructure collaboration themes.",
  },
  {
    date: "13 Sep 2025",
    source: "The Diplomat",
    category: "Geopolitical framing",
    title: "Regional commentary links smart-city cooperation with strategic competition",
    reason: "Important for understanding geopolitical narratives around digital urban development.",
    href: "https://thediplomat.com/2025/09/china-brings-smart-city-tech-and-surveillance-to-asean/",
    summary:
      "Analytical coverage examines how smart city technology partnerships are interpreted in regional geopolitics.",
  },
  {
    date: "Reference",
    source: "ASEAN Connectivity",
    category: "Policy continuity",
    title: "Sustainable infrastructure priorities continue to cite smart-city relevance",
    reason: "Used to connect ASCN to long-term infrastructure and investment pipelines.",
    href: "https://connectivity.asean.org/strategic-area/sustainable-infrastructure/",
    summary:
      "Connectivity strategy content supports ASCN alignment with sustainable infrastructure and urban systems investment.",
  },
];

const people = [
  {
    name: "Dr. Non Arkaraprasertkul",
    role: "Thailand / DEPA",
    detail: "Chief Expert in Smart Promotion, Digital Economy Promotion Agency",
    contact: "non.ar@depa.or.th",
  },
  {
    name: "Mr. Mohd Hazli bin Ahmad @ Adnan",
    role: "Malaysia National Representative",
    detail: "Deputy Secretary General, Ministry of Housing and Local Government",
    contact: "pa_tksupm@kpkt.gov.my",
  },
  {
    name: "Mr. Juanito Victor C. Remulla",
    role: "Philippines National Representative",
    detail: "Secretary, Department of the Interior and Local Government",
    contact: "jcremulla@dilg.gov.ph",
  },
  {
    name: "Mr. Jiraroth Sukolrat",
    role: "Bangkok CSCO",
    detail: "Director General, Office of Transport and Traffic Policy and Planning",
    contact: "jiraroth.suk@otp.go.th",
  },
  {
    name: "Mr. Mohd Musabri bin Shaharom",
    role: "Putrajaya CSCO",
    detail: "Head of Smart City Section, Putrajaya Corporation",
    contact: "musabri@ppj.gov.my",
  },
  {
    name: "Atty. Reina Consorcia M. Santos",
    role: "Cauayan City CSCO",
    detail: "Project Coordinator, Smart and Sustainable Cities Program",
    contact: "cityinfotech@cityofcauayan.gov.ph",
  },
];

const resources = [
  {
    title: "ASCN Framework (2018)",
    note: "Foundational objectives, systems lens, and implementation logic.",
    href: "research/ascn/ascn-framework-2018.pdf",
    meta: "Foundational document",
  },
  {
    title: "ASCN Contact List (31 Jan 2026)",
    note: "National representatives and CSCO contacts for the 38-city roster.",
    href: "research/ascn/ascn-contact-list-2026-01-31.pdf",
    meta: "8 pages",
  },
  {
    title: "ASCN Monitoring & Evaluation 2025",
    note: "Project counts and status baseline used across this dashboard.",
    href: "research/ascn/ascn-monitoring-evaluation-2025.pdf",
    meta: "As of 30 Sep 2025",
  },
  {
    title: "ASEAN Smart City Planning Guidebook",
    note: "Planning method, priority areas, and practical enabling conditions.",
    href: "research/ascn/asean-smart-city-planning-guidebook-2022.pdf",
    meta: "Guidebook",
  },
  {
    title: "ASCN Activities under Thailand’s Chairmanship",
    note: "Chairship chapter with implementation examples and network operations.",
    href: "research/ascn/ascn-thailand-chairmanship-2019.pdf",
    meta: "Chairship archive",
  },
  {
    title: "Smart City Action Plans (Pilot Cities)",
    note: "Consolidated SCAP reference for the founding cohort.",
    href: "research/ascn/ascn-consolidated-scaps.pdf",
    meta: "SCAP source pack",
  },
];

const yearWeight = {
  2018: 14,
  2023: 11,
  2024: 9,
  2025: 7,
  2026: 5,
};

const waveLabel = {
  2018: "2018 founding cohort",
  2023: "2023 expansion",
  2024: "2024 expansion",
  2025: "2025 expansion",
  2026: "2026 frontier",
};

const state = {
  filter: "all",
  sort: "signal",
  selectedCity: null,
};

let cities = baseCities.map((city) => ({ ...city }));
let seaMap = null;
let markerLayer = null;
const markerByCity = new Map();

const countryFilter = document.querySelector("#country-filter");
const mapCalloutsWest = document.querySelector("#map-callouts-west");
const mapCalloutsEast = document.querySelector("#map-callouts-east");
const cityDetail = document.querySelector("#city-detail");
const cityDetailName = document.querySelector("#city-detail-name");
const peopleGrid = document.querySelector("#people-grid");
const libraryGrid = document.querySelector("#library-grid");
const signalFeed = document.querySelector("#signal-feed");
const mentionReasons = document.querySelector("#mention-reasons");
const cohortMotion = document.querySelector("#cohort-motion");

function formatPopulation(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "n/a";
  }
  return value.toLocaleString();
}

function formatArea(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "n/a";
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`;
}

function normalizeKey(city, country) {
  return `${city}`.toLowerCase().trim() + "::" + `${country}`.toLowerCase().trim();
}

async function loadCityStats() {
  try {
    const response = await fetch("research/ascn/city-stats-merged.json");
    if (!response.ok) {
      return;
    }
    const stats = await response.json();
    const byKey = new Map(stats.map((item) => [normalizeKey(item.city, item.country), item]));
    cities = cities.map((city) => {
      const stat = byKey.get(normalizeKey(city.city, city.country));
      return {
        ...city,
        population: stat?.population ?? null,
        area_km2: stat?.area_km2 ?? null,
      };
    });
  } catch (_error) {
    // Keep rendering with base data if local stats file is unavailable.
  }
}

function enrichCities() {
  for (const city of cities) {
    city.flag = countryFlags[city.country] || "🏳️";
    city.projects = city.live + city.completed;
    city.signal = city.live * 13 + city.completed * 7 + (yearWeight[city.year] || 0);
  }
}

function renderBars(target, items, maxValue) {
  if (!target) {
    return;
  }
  target.innerHTML = items
    .map(
      (item) => `
        <div class="bar-row">
          <span>${item.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width: ${(item.value / maxValue) * 100}%"></div></div>
          <span>${item.suffix ? `${item.value}${item.suffix}` : item.value}</span>
        </div>
      `
    )
    .join("");
}

function renderFocusAndCohorts() {
  renderBars(
    document.querySelector("#focus-bars"),
    focusAreas.map((item) => ({ ...item, suffix: "%" })),
    25
  );

  const countsByYear = cities.reduce((acc, city) => {
    acc.set(city.year, (acc.get(city.year) || 0) + 1);
    return acc;
  }, new Map());

  const cohortItems = [...countsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ label: waveLabel[year] || `${year}`, value }));

  renderBars(document.querySelector("#cohort-bars"), cohortItems, Math.max(...cohortItems.map((item) => item.value), 1));
}

function renderCohortMotion() {
  if (!cohortMotion) {
    return;
  }

  const grouped = [...new Set(cities.map((city) => city.year))]
    .sort((a, b) => a - b)
    .map((year) => {
      const group = cities.filter((city) => city.year === year);
      const projects = group.reduce((sum, city) => sum + city.projects, 0);
      const average = group.length ? projects / group.length : 0;
      return {
        year,
        label: waveLabel[year] || `${year}`,
        members: group.length,
        projects,
        average,
      };
    });

  const maxProjects = Math.max(...grouped.map((item) => item.projects), 1);
  const maxAverage = Math.max(...grouped.map((item) => item.average), 1);

  cohortMotion.innerHTML = grouped
    .map(
      (item) => `
        <div class="motion-row">
          <div>
            <h4>${item.label}</h4>
            <span>${item.members} cities</span>
          </div>
          <div class="motion-bars">
            <div class="motion-bar">
              <i style="width: ${(item.projects / maxProjects) * 100}%"></i>
            </div>
            <div class="motion-bar avg">
              <i style="width: ${(item.average / maxAverage) * 100}%"></i>
            </div>
          </div>
          <div class="motion-value">${item.projects} / ${item.average.toFixed(1)}</div>
        </div>
      `
    )
    .join("");
}

function getVisibleCities() {
  const filtered = state.filter === "all" ? [...cities] : cities.filter((city) => city.country === state.filter);

  switch (state.sort) {
    case "projects":
      return filtered.sort((a, b) => b.projects - a.projects || b.live - a.live || a.city.localeCompare(b.city));
    case "newest":
      return filtered.sort((a, b) => b.year - a.year || b.signal - a.signal || a.city.localeCompare(b.city));
    case "signal":
    default:
      return filtered.sort((a, b) => b.signal - a.signal || b.projects - a.projects || a.city.localeCompare(b.city));
  }
}

function renderCountryFilter() {
  if (!countryFilter) {
    return;
  }
  const countries = [...new Set(cities.map((city) => city.country))];
  countryFilter.insertAdjacentHTML(
    "beforeend",
    countries.map((country) => `<option value="${country}">${country}</option>`).join("")
  );
}

function getMarkerColor(year) {
  if (year >= 2025) {
    return "#cf2738";
  }
  if (year === 2024 || year === 2023) {
    return "#f0b41b";
  }
  return "#1d4aa8";
}

function initMap() {
  if (!window.L || !document.querySelector("#sea-map")) {
    return;
  }

  seaMap = L.map("sea-map", {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false,
    minZoom: 3,
    maxZoom: 8,
  }).setView([8.5, 112], 4);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(seaMap);

  seaMap.setMaxBounds([
    [-15, 90],
    [25, 140],
  ]);

  markerLayer = L.layerGroup().addTo(seaMap);
}

function renderMapMarkers(visible) {
  if (!seaMap || !markerLayer) {
    return;
  }

  markerLayer.clearLayers();
  markerByCity.clear();

  for (const city of visible) {
    const marker = L.circleMarker([city.lat, city.lon], {
      radius: 6,
      color: "#ffffff",
      weight: 1.2,
      fillColor: getMarkerColor(city.year),
      fillOpacity: 0.95,
    });

    marker.bindTooltip(`${city.flag} ${city.city}`, { direction: "top", offset: [0, -2] });
    marker.on("click", () => selectCity(city.city, true));
    marker.addTo(markerLayer);
    markerByCity.set(city.city, marker);
  }

  if (!state.selectedCity || !visible.some((city) => city.city === state.selectedCity)) {
    state.selectedCity = visible[0]?.city || null;
  }
  updateMarkerHighlight(false);
}

function renderMapCallouts(visible) {
  if (!mapCalloutsWest || !mapCalloutsEast) {
    return;
  }

  const sortedByLatitude = [...visible].sort((a, b) => b.lat - a.lat || a.lon - b.lon);
  const west = sortedByLatitude.filter((city) => city.lon < 110);
  const east = sortedByLatitude.filter((city) => city.lon >= 110);

  const makeCallout = (city) => `
    <button class="map-callout${state.selectedCity === city.city ? " is-active" : ""}" type="button" data-city="${city.city}">
      <strong>${city.flag} ${city.city}</strong>
      <small>${city.country} • ${city.enterprise}</small>
    </button>
  `;

  mapCalloutsWest.innerHTML = west.map(makeCallout).join("");
  mapCalloutsEast.innerHTML = east.map(makeCallout).join("");

  document.querySelectorAll(".map-callout").forEach((button) => {
    button.addEventListener("click", () => selectCity(button.dataset.city, true));
  });
}

function renderCityDetail() {
  if (!cityDetail || !cityDetailName) {
    return;
  }
  const city = cities.find((item) => item.city === state.selectedCity);
  if (!city) {
    cityDetailName.textContent = "Choose a city from the map callouts.";
    cityDetail.innerHTML = "";
    return;
  }

  cityDetailName.textContent = `${city.flag} ${city.city}`;
  cityDetail.innerHTML = `
    <article><span>Country</span><strong>${city.country}</strong></article>
    <article><span>Joined network</span><strong>${city.year}</strong></article>
    <article><span>Public projects</span><strong>${city.projects}</strong></article>
    <article><span>Pulse signal</span><strong>${city.signal}</strong></article>
    <article><span>Population</span><strong>${formatPopulation(city.population)}</strong></article>
    <article><span>Area</span><strong>${formatArea(city.area_km2)}</strong></article>
    <article><span>Basic enterprise</span><strong>${city.enterprise}</strong></article>
    <article><span>Current focus</span><strong>${city.tags.join(" / ")}</strong></article>
  `;
}

function updateMarkerHighlight(shouldPan) {
  for (const [cityName, marker] of markerByCity.entries()) {
    const active = cityName === state.selectedCity;
    marker.setStyle({
      radius: active ? 10 : 6,
      fillOpacity: active ? 1 : 0.86,
      color: active ? "#0f172a" : "#ffffff",
      weight: active ? 2 : 1.2,
    });
  }

  document.querySelectorAll(".map-callout").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.city === state.selectedCity);
  });

  if (shouldPan && seaMap && markerByCity.has(state.selectedCity)) {
    const marker = markerByCity.get(state.selectedCity);
    seaMap.flyTo(marker.getLatLng(), 6, { duration: 0.7 });
    marker.openTooltip();
  }
}

function selectCity(cityName, shouldPan) {
  state.selectedCity = cityName;
  updateMarkerHighlight(shouldPan);
  renderCityDetail();
}

function renderCities() {
  const visible = getVisibleCities();
  renderMapCallouts(visible);
  renderMapMarkers(visible);
  renderCityDetail();
}

function renderSignals() {
  if (!signalFeed) {
    return;
  }
  signalFeed.innerHTML = mentions
    .map(
      (item) => `
        <article class="signal-card">
          <time>${item.date} • ${item.source}</time>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <span class="signal-tag">${item.category}</span>
          <a href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>Open Source</a>
        </article>
      `
    )
    .join("");
}

function renderMentionReasons() {
  if (!mentionReasons) {
    return;
  }

  const grouped = mentions.reduce((acc, item) => {
    const group = acc.get(item.category) || [];
    group.push(item.reason);
    acc.set(item.category, group);
    return acc;
  }, new Map());

  mentionReasons.innerHTML = [...grouped.entries()]
    .map(([category, reasons]) => {
      const uniqueReasons = [...new Set(reasons)];
      return `
        <article class="mention-reason">
          <h3>${category}</h3>
          <p><strong>${uniqueReasons.length}</strong> dominant reporting angle(s).</p>
          <p>${uniqueReasons.join(" ")}</p>
        </article>
      `;
    })
    .join("");
}

function renderPeople() {
  if (!peopleGrid) {
    return;
  }
  peopleGrid.innerHTML = people
    .map(
      (person) => `
        <article class="person-card">
          <span>${person.role}</span>
          <h3>${person.name}</h3>
          <p>${person.detail}</p>
          <a href="mailto:${person.contact}">${person.contact}</a>
        </article>
      `
    )
    .join("");
}

function renderLibrary() {
  if (!libraryGrid) {
    return;
  }
  libraryGrid.innerHTML = resources
    .map(
      (resource) => `
        <article class="library-card">
          <span>${resource.meta}</span>
          <h3>${resource.title}</h3>
          <p>${resource.note}</p>
          <a href="${resource.href}">Open Document</a>
        </article>
      `
    )
    .join("");
}

function renderTrendEmbeds() {
  const widgets = [...document.querySelectorAll(".gtrend")];
  for (const node of widgets) {
    const query = node.dataset.query;
    const req = encodeURIComponent(
      JSON.stringify({
        comparisonItem: [{ keyword: query, geo: "", time: "today 12-m" }],
        category: 0,
        property: "",
      })
    );

    node.innerHTML = `
      <iframe
        title="${query} trend chart"
        loading="lazy"
        src="https://trends.google.com/trends/embed/explore/TIMESERIES?hl=en-US&tz=0&req=${req}"
      ></iframe>
      <p class="trend-fallback">If this widget fails to load, use the direct link above.</p>
    `;
  }
}

function animateCount(node) {
  const target = Number(node.dataset.count || 0);
  const duration = 1200;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased).toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function wireCounters() {
  const observer = new IntersectionObserver(
    (entries, view) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        animateCount(entry.target);
        view.unobserve(entry.target);
      }
    },
    { threshold: 0.45 }
  );

  document.querySelectorAll(".count").forEach((node) => observer.observe(node));
}

function wireReveal() {
  const nodes = [...document.querySelectorAll(".reveal")];
  nodes.forEach((node, index) => node.style.setProperty("--reveal-index", `${index % 4}`));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
  );

  nodes.forEach((node) => observer.observe(node));
}

function wireSorting() {
  document.querySelectorAll(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.sort = button.dataset.sort;
      document.querySelectorAll(".sort-button").forEach((node) => node.classList.remove("is-active"));
      button.classList.add("is-active");
      renderCities();
    });
  });

  if (countryFilter) {
    countryFilter.addEventListener("change", (event) => {
      state.filter = event.target.value;
      renderCities();
    });
  }
}

function wireTabs() {
  const buttons = [...document.querySelectorAll(".tab-button")];
  const panels = [...document.querySelectorAll(".tab-panel")];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      buttons.forEach((node) => {
        const active = node === button;
        node.classList.toggle("is-active", active);
        node.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        const active = panel.id === tab;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    });
  });
}

function wireSignalTabs() {
  const buttons = [...document.querySelectorAll(".signal-tab-button")];
  const panels = {
    mentions: document.querySelector("#mentions-panel"),
    reasons: document.querySelector("#reasons-panel"),
    trends: document.querySelector("#trends-panel"),
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.signalTab;
      buttons.forEach((node) => {
        const active = node === button;
        node.classList.toggle("is-active", active);
        node.setAttribute("aria-selected", String(active));
      });

      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) {
          return;
        }
        const active = key === tab;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    });
  });
}

async function init() {
  await loadCityStats();
  enrichCities();
  initMap();
  renderCountryFilter();
  renderFocusAndCohorts();
  renderCohortMotion();
  renderCities();
  renderSignals();
  renderMentionReasons();
  renderPeople();
  renderLibrary();
  renderTrendEmbeds();
  wireCounters();
  wireReveal();
  wireSorting();
  wireTabs();
  wireSignalTabs();
}

init();
