export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function safeUrl(value, base = "https://ascn.nonarkara.org/") {
  if (typeof value !== "string" || !value || /[\u0000-\u0020\u007f\\]/.test(value)) return "#";
  try {
    const url = new URL(value, base);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "#";
    return url.href;
  } catch {
    return "#";
  }
}

export function csvCell(value) {
  let text = String(value ?? "");
  // Spreadsheet applications interpret these string prefixes as formulas.
  if (typeof value === "string" && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function validateDataset(path, data) {
  const file = path.split("/").at(-1);
  const fail = (field) => { throw new Error(`${file}: invalid ${field}`); };
  const object = (value, field) => { if (!value || typeof value !== "object" || Array.isArray(value)) fail(field); };
  const array = (value, field) => { if (!Array.isArray(value)) fail(field); };
  const string = (value, field) => { if (typeof value !== "string") fail(field); };
  const number = (value, field, min = 0, max = Infinity) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(field);
  };

  if (file === "city-stats-merged.json") { array(data, "rows"); return data; }
  object(data, "root");
  if (file === "ascn-v2-data.json") {
    array(data.reports, "reports"); array(data.projects, "projects"); object(data.derived, "derived");
    if (!data.reports.length) fail("reports");
    for (const report of data.reports) {
      object(report, "report"); number(report.year, "report.year", 2000, 2200);
      number(report.total_projects, "report.total_projects"); object(report.status, "report.status");
      for (const field of ["ongoing", "completed", "planning"]) number(report.status[field], `report.status.${field}`);
      object(report.focus_share, "report.focus_share");
      for (const share of Object.values(report.focus_share)) number(share, "report.focus_share", 0, 100);
    }
    for (const project of data.projects) {
      object(project, "project"); number(project.report_year, "project.report_year", 2000, 2200);
      for (const field of ["country", "city", "project", "focus_area", "status"]) string(project[field], `project.${field}`);
    }
  } else if (file === "ascn-cities.json") {
    array(data.cities, "cities");
    for (const city of data.cities) {
      object(city, "city");
      for (const field of ["name", "country", "summary"]) string(city[field], `city.${field}`);
      number(city.year, "city.year", 2000, 2200); number(city.lat, "city.lat", -90, 90); number(city.lon, "city.lon", -180, 180);
      array(city.flagship, "city.flagship");
      for (const project of city.flagship) string(project?.name, "city.flagship.name");
      if (city.connectivity && !["advanced", "expanding", "limited"].includes(city.connectivity)) fail("city.connectivity");
      if (city.imd_rank != null) number(city.imd_rank, "city.imd_rank", 1);
      if (city.imd_rating != null) string(city.imd_rating, "city.imd_rating");
    }
  } else if (file === "ascn-knowledge.json") {
    for (const field of ["summary", "framework", "ascap", "history", "governance", "meta", "perspective", "stance", "financing"]) object(data[field], field);
    for (const field of ["documents", "data_sources", "partnerships", "multilateral_partners", "citizen_impact"]) array(data[field], field);
    for (const field of ["cities", "countries", "projects", "ongoing", "completed", "planning"]) {
      if (data.summary[field] != null) number(data.summary[field], `summary.${field}`);
    }
  } else if (file === "ascn-library-full.json") {
    array(data.entries, "entries");
    for (const entry of data.entries) {
      object(entry, "entry"); string(entry.title, "entry.title"); string(entry.type, "entry.type");
      if (entry.year != null) number(entry.year, "entry.year", 1900, 2200);
      if (entry.tags != null) { array(entry.tags, "entry.tags"); entry.tags.forEach((tag) => string(tag, "entry.tag")); }
    }
  } else if (file === "ascn-library.json") {
    array(data.groups, "groups"); data.groups.forEach((group) => array(group?.items, "group.items"));
  } else {
    fail("dataset name");
  }
  return data;
}
