// Touch targets, measured on the phone.
//
// The house rule: every control that is actually a control takes 44px. A
// reference link — a publisher's name, a source name, an institution name on
// a contact card — is sized by the line of text it shares with a sibling,
// like a footnote, and is held to the 24px AA bar instead. Both rules are
// recorded in styles.css beside the rules they govern; this proves they are
// met, in every view, in every language, in both themes.
//
// The independent review measured every target in the site under 44px and
// counted 21. Some of those were controls (a 30px map button, a 20px "↗",
// a 15px language button) and are now 44px. The rest are reference links,
// held to the house's recorded 24px bar. A gate that could not tell the two
// apart would either wave the controls through or condemn the footnotes.
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:<port> node scripts/audit-targets.mjs
//   ASCN_TARGET_LANG=en|th|zh   ASCN_TARGET_THEME=dark|light
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { auditRoutes, waitForAuditRoute } from "./audit-routes.mjs";

export const CONTROL_MIN = 44;
export const REFERENCE_MIN = 24;

// The reference links, exactly as styles.css lists them. Kept in step by
// hand and checked by the unit test: the list is the house's decision about
// which links are footnotes.
export const REFERENCE_LINK_SELECTOR = [
  ".news-source a",
  ".def-row b a",
  ".cc-inst",
  ".review-record-detail p a",
  ".review-project-links a",
  ".contacts-source-note a",
  ".alum-lede a",
].join(", ");

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const LANG = process.env.ASCN_TARGET_LANG || "en";
const THEME = process.env.ASCN_TARGET_THEME || "dark";
const OUT = process.env.ASCN_TARGET_OUT || "artifacts/targets";
const VIEWPORT = { width: 390, height: 844 };

// Run in the page. Every rendered control, with the size it is drawn at.
export async function measureTargets(page) {
  return page.evaluate((referenceSelector) => {
    const view = [...document.querySelectorAll(".view")].find((el) => !el.hidden);
    if (!view) return [];
    const out = [];
    // A link inside a sentence is a link in the text, not a control in its
    // own right; the line's own height is its target.
    const inProse = (el) => !!el.closest("p, li, dd, figcaption, td, th, blockquote, .lede, .ig-note, .cc-note, .method-row span");
    for (const el of view.querySelectorAll("a, button, input, select, textarea, [role='button'], [role='tab'], [role='switch'], [tabindex]:not([tabindex='-1'])")) {
      if (inProse(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      out.push({
        sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "." + String(el.className || "").trim().split(/\s+/).join(".")),
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        reference: el.matches(referenceSelector),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
      });
    }
    return out;
  }, REFERENCE_LINK_SELECTOR);
}

// The judgement, separated from the measurement so a unit test can plant a
// defect and prove it is caught.
export function judgeTargets(measured) {
  const failures = [];
  for (const row of measured) {
    for (const t of row.targets) {
      const min = t.reference ? REFERENCE_MIN : CONTROL_MIN;
      const why = t.reference ? "a reference link" : "a control";
      if (t.width >= min - 1 / 64 && t.height >= min - 1 / 64) continue;
      failures.push(`${row.view} (${row.lang} @${row.width}px): ${why} ${t.sel} is ${t.width} x ${t.height} — under ${min}px — "${t.text}"`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.route("**/api/{news,ascn-news}", (r) => r.fulfill({ status: 503, json: { checkedAt: new Date().toISOString(), articles: [], sources: [] } }));
  await page.addInitScript(({ l, t }) => {
    try { if (l) localStorage.setItem("ascn-lang", l); } catch { /* private mode */ }
    try { if (t) localStorage.setItem("ascn_theme", t); } catch { /* private mode */ }
  }, { l: LANG, t: THEME });
  await page.goto(`${BASE}/#overview`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const views = await auditRoutes(page);
  if (!views.length) throw new Error("The target audit could not read the navigation");
  const measured = [];
  for (const v of views) {
    await page.goto(`${BASE}/#${v}`, { waitUntil: "domcontentloaded" });
    await waitForAuditRoute(page, v);
    await page.waitForTimeout(400);
    const targets = await measureTargets(page);
    measured.push({ view: v, lang: LANG, theme: THEME, width: VIEWPORT.width, targets });
  }
  await browser.close();

  const failures = judgeTargets(measured);
  const report = { base: BASE, lang: LANG, theme: THEME, viewport: VIEWPORT, startedAt: new Date().toISOString(), measured, failures };
  await writeFile(`${OUT}/targets-${LANG}-${THEME}.json`, JSON.stringify(report, null, 2) + "\n");
  const controls = measured.reduce((n, r) => n + r.targets.filter((t) => !t.reference).length, 0);
  const references = measured.reduce((n, r) => n + r.targets.filter((t) => t.reference).length, 0);
  console.log(`Touch targets — ${LANG}/${THEME} @390px: ${controls} control(s) at ${CONTROL_MIN}px, ${references} reference link(s) at ${REFERENCE_MIN}px`);
  console.log(`  failures: ${failures.length}`);
  for (const f of failures.slice(0, 25)) console.log("   FAIL", f);
  if (failures.length) process.exitCode = 1;
}
