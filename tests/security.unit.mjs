import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, access, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { escapeHtml, safeUrl, csvCell, validateDataset } from "../lib/security.mjs";
import { copySiteEntry } from "../scripts/site-assets.mjs";
import { SECURITY_HEADERS } from "../lib/response-policy.mjs";

test("navigation rejects executable schemes, disguised schemes, and embedded credentials", () => {
  for (const input of ["javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)", "file:///etc/passwd", "https://user:pass@example.com", "https:\\evil.example", "\u0000https://example.com", null]) {
    assert.equal(safeUrl(input), "#");
  }
  assert.equal(safeUrl("https://asean.org/"), "https://asean.org/");
  assert.equal(safeUrl("docs/test.pdf", "https://example.com/"), "https://example.com/docs/test.pdf");
});

test("CSV exports neutralize formulas while preserving numeric values and quotation", () => {
  for (const input of ["=1+1", "+SUM(A1:A2)", "-cmd", "@SUM(A1)", " \t=1", "\ttext", "\r=1", "\ntext"]) {
    assert.ok(csvCell(input).startsWith('"\''));
  }
  assert.equal(csvCell(-12.5), '"-12.5"');
  assert.equal(csvCell('City, "quoted"'), '"City, ""quoted"""');
  assert.equal(csvCell(null), '""');
});

test("escaping keeps untrusted markup inert in tooltips and HTML attributes", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test("runtime contracts reject missing rows, malicious numeric fields, and invalid coordinates", async () => {
  const cities = JSON.parse(await readFile(new URL("../data/ascn-cities.json", import.meta.url)));
  assert.equal(validateDataset("data/ascn-cities.json", cities), cities);
  assert.throws(() => validateDataset("data/ascn-cities.json", { cities: null }), /invalid cities/);
  const invalid = structuredClone(cities); invalid.cities[0].lat = 999;
  assert.throws(() => validateDataset("data/ascn-cities.json", invalid), /city.lat/);
  const engine = JSON.parse(await readFile(new URL("../data/ascn-v2-data.json", import.meta.url)));
  engine.reports[0].year = "<img src=x onerror=alert(1)>";
  assert.throws(() => validateDataset("data/ascn-v2-data.json", engine), /report.year/);
});

test("every committed browser dataset passes the shared runtime contract", async () => {
  for (const name of ["ascn-cities.json", "ascn-v2-data.json", "ascn-knowledge.json", "ascn-library.json", "ascn-library-full.json", "city-stats-merged.json"]) {
    const data = JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
    assert.doesNotThrow(() => validateDataset(name, data));
  }
});

test("publication excludes hidden files, notes, and executable files in document folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "ascn-build-security-"));
  const output = join(root, "out");
  try {
    await mkdir(join(root, "docs"));
    for (const name of ["public.pdf", ".env", "security-audit.md", "script.js", "local.txt"]) {
      await writeFile(join(root, "docs", name), "test");
    }
    await copySiteEntry(root, output, "docs");
    await access(join(output, "docs", "public.pdf"));
    for (const name of [".env", "security-audit.md", "script.js", "local.txt"]) {
      await assert.rejects(access(join(output, "docs", name)));
    }
    await symlink(join(root, "docs", ".env"), join(root, "docs", "linked.pdf"));
    await assert.rejects(copySiteEntry(root, output, "docs"), /symbolic link/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("HTML fallback CSP and Pages CSP stay consistent", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const headers = await readFile(new URL("../_headers", import.meta.url), "utf8");
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const csp = headers.match(/Content-Security-Policy: (.*)/)[1];
  assert.equal(SECURITY_HEADERS["Content-Security-Policy"], csp);
  assert.equal(csp.replace("; frame-ancestors 'none'", ""), meta);
  assert.ok(csp.includes("script-src 'self' https://static.cloudflareinsights.com;"));
  assert.ok(!/script-src[^;]*'unsafe-(inline|eval)'/.test(csp));
});
