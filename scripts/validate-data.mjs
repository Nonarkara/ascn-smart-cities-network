import { readFile } from "node:fs/promises";

const files = {
  engine: "data/ascn-v2-data.json",
  knowledge: "data/ascn-knowledge.json",
  cities: "data/ascn-cities.json",
  library: "data/ascn-library-full.json",
  cityStats: "data/city-stats-merged.json",
};

const focusAreas = new Set([
  "Civic & Social",
  "Health & Well-Being",
  "Safety & Security",
  "Quality Environment",
  "Built Infrastructure",
  "Industry & Innovation",
]);

const requiredProjectFields = ["report_year", "country", "city", "project", "focus_area", "status", "source_page"];
const requiredCityFields = ["name", "country", "year", "pop", "lat", "lon", "summary", "flagship"];

async function json(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

function fail(errors, message) {
  errors.push(message);
}

function warn(warnings, message) {
  warnings.push(message);
}

function countBy(list, key) {
  const counts = new Map();
  for (const item of list) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return counts;
}

const [engine, knowledge, citiesDoc, library, cityStats] = await Promise.all(Object.values(files).map(json));
const errors = [];
const warnings = [];

if (!Array.isArray(engine.reports) || engine.reports.length < 1) fail(errors, "Engine must include at least one report.");
if (!Array.isArray(engine.projects) || engine.projects.length < 1) fail(errors, "Engine must include project rows.");
if (!Array.isArray(citiesDoc.cities) || citiesDoc.cities.length < 1) fail(errors, "City profile file must include cities[].");

const reportYears = (engine.reports || []).map((report) => report.year);
const sortedYears = [...reportYears].sort((a, b) => a - b);
if (reportYears.join(",") !== sortedYears.join(",")) fail(errors, "Reports must be sorted by year ascending.");

for (const report of engine.reports || []) {
  const statusTotal = Object.values(report.status || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (statusTotal !== report.total_projects) {
    fail(errors, `${report.year}: status counts (${statusTotal}) do not equal total_projects (${report.total_projects}).`);
  }
  for (const [focus, share] of Object.entries(report.focus_share || {})) {
    if (!focusAreas.has(focus)) fail(errors, `${report.year}: unknown focus area "${focus}".`);
    if (!Number.isFinite(Number(share))) fail(errors, `${report.year}: focus share for "${focus}" is not numeric.`);
  }
}

const validYears = new Set(reportYears);
const countrySet = new Set(citiesDoc.cities.map((city) => city.country));
let artifactRows = 0;
for (const [index, project] of (engine.projects || []).entries()) {
  for (const field of requiredProjectFields) {
    if (!(field in project) || project[field] === "") fail(errors, `Project row ${index + 1}: missing ${field}.`);
  }
  if (!validYears.has(project.report_year)) fail(errors, `Project row ${index + 1}: unknown report_year ${project.report_year}.`);
  if (!countrySet.has(project.country)) fail(errors, `Project row ${index + 1}: unknown country "${project.country}".`);
  if (!focusAreas.has(project.focus_area)) fail(errors, `Project row ${index + 1}: unknown focus area "${project.focus_area}".`);
  if (`${project.city}`.length > 60 || /^\d+\.?$/.test(`${project.city}`)) artifactRows++;
}
if (artifactRows) warn(warnings, `${artifactRows} project rows look like wrapped-PDF extraction artifacts; keep methodology caveats visible.`);

const projectsByYear = countBy(engine.projects || [], "report_year");
for (const report of engine.reports || []) {
  const appendixRows = projectsByYear.get(report.year) || 0;
  if (appendixRows > report.total_projects) fail(errors, `${report.year}: appendix rows exceed official report total.`);
  if (appendixRows < report.total_projects) {
    warn(warnings, `${report.year}: ${report.total_projects - appendixRows} official projects lack individual appendix rows.`);
  }
}

for (const [index, city] of citiesDoc.cities.entries()) {
  for (const field of requiredCityFields) {
    if (!(field in city) || city[field] === "") fail(errors, `City row ${index + 1}: missing ${field}.`);
  }
  if (!Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) {
    fail(errors, `${city.name}: lat/lon must be numeric.`);
  }
}

const duplicateCities = [...countBy(citiesDoc.cities, "name").entries()].filter(([, count]) => count > 1);
if (duplicateCities.length) fail(errors, `Duplicate city names: ${duplicateCities.map(([name]) => name).join(", ")}.`);

const statCities = new Set((Array.isArray(cityStats) ? cityStats : []).map((city) => city.city));
const missingStats = citiesDoc.cities.filter((city) => !statCities.has(city.name)).map((city) => city.name);
if (missingStats.length) warn(warnings, `Missing merged population/stat rows for: ${missingStats.join(", ")}.`);

if (!knowledge.summary || !knowledge.framework || !knowledge.ascap) fail(errors, "Knowledge file must include summary, framework, and ascap.");
if (!Array.isArray(knowledge.citizen_impact) || knowledge.citizen_impact.length < 1) warn(warnings, "No citizen impact examples found.");

const libraryEntries = Array.isArray(library.entries) ? library.entries : [];
if (!libraryEntries.length) fail(errors, "Full library must include entries[].");
const duplicateLibrary = [...countBy(libraryEntries, "title").entries()].filter(([, count]) => count > 1);
if (duplicateLibrary.length) warn(warnings, `Duplicate library titles found: ${duplicateLibrary.map(([title]) => title).join("; ")}.`);

if (errors.length) {
  console.error("Data validation failed:");
  for (const message of errors) console.error(`- ${message}`);
  if (warnings.length) {
    console.error("\nWarnings:");
    for (const message of warnings) console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log(`Data validation passed: ${citiesDoc.cities.length} cities, ${engine.projects.length} project rows, ${libraryEntries.length} library sources.`);
for (const message of warnings) console.warn(`Warning: ${message}`);
