#!/usr/bin/env node
/**
 * audit-media-order.mjs — find responsive rules that never take effect.
 *
 * A rule inside an @media / @container block is DEAD when a later rule in the
 * cascade overwrites it, so the media block is a lie: the author believes a
 * phone/tablet layout is active when it is not.
 *
 * The test is unit-safe and measured, not string-matched:
 *   1. record the computed value of each property the rule declares,
 *      on every element the rule's selector matches;
 *   2. re-apply that exact rule at the END of the cascade;
 *   3. if any computed value CHANGES, the original rule was overridden —
 *      it was dead.
 *
 * ── The band problem ───────────────────────────────────────────────────────
 * A rule is dead only if it is overridden EVERYWHERE it could apply. Testing
 * one viewport proves nothing: a `max-width: 900px` rule that hands over to
 * a `max-width: 600px` rule at 390px is not dead — it governs 601–900px,
 * which is exactly the band it was written for.
 *
 * So this tool enumerates the widths where the breakpoint boundaries fall,
 * tests each rule at every one of them, and calls the rule dead only when it
 * is overridden at all of them. Media conditions are read off the viewport;
 * container conditions are read off the container's own inline size, because
 * the plate is narrower than the window by the width of the rail.
 *
 * Run:  node scripts/audit-media-order.mjs [url] [--viewport=390]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const URL = process.argv.find((a) => a.startsWith('http')) || process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const VP = Number((process.argv.find((a) => a.startsWith('--viewport=')) || '--viewport=390').split('=')[1]);
const TABS = (process.argv.find((a) => a.startsWith('--tabs=')) || '--tabs=overview,innovation,record,news,cities,projects,history,framework,partners,contacts,insights,data,archive,research,essay')
  .split('=')[1].split(',');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: VP, height: 900 } });

const CONTAINER_SELECTORS = { rail: '.index', view: '.view:not([hidden])', city: '.city-cell' };

// ── the breakpoint ladder, read out of the stylesheet ─────────────────────
const css = readFileSync('styles.css', 'utf8');
const mediaWidths = [...css.matchAll(/@media\s*\((?:min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g)].map((m) => Number(m[1]));
const containerWidths = [
  ...[...css.matchAll(/@container\s+\w+\s*\((?:min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g)].map((m) => Number(m[1])),
  ...[...css.matchAll(/@container\s+\w+\s*\((?:min|max)-width:\s*(\d+(?:\.\d+)?)rem\)/g)].map((m) => Number(m[1]) * 16),
];

// How much of the window the plate loses to the rail — measured, not assumed.
await page.goto(`${URL}/#overview`, { waitUntil: 'load' });
await page.waitForTimeout(900);
const loss = await page.evaluate(() => {
  const view = document.querySelector('.view:not([hidden])');
  return view ? window.innerWidth - view.getBoundingClientRect().width : 0;
});

// Probe widths: every breakpoint and its neighbours, plus the widths asked for.
const probes = new Set([VP, 360, 390, 430, 601, 768, 861, 1024, 1080, 1440, 1920, 2103]);
for (const v of mediaWidths) { probes.add(v); probes.add(v - 1); probes.add(v + 1); }
// Container thresholds are widths of the PLATE, not of the window.
for (const t of containerWidths) { probes.add(Math.round(t + loss)); probes.add(Math.round(t + loss) - 1); }
const PROBES = [...probes].filter((w) => w >= 320 && w <= 2400).sort((a, b) => a - b);

// ── pass 1: collect the rules, with their declared values ─────────────────
const perTab = [];
for (const tab of TABS) {
  await page.goto(`${URL}/#${tab}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const rules = await page.evaluate(() => {
    const out = [];
    const walk = (list, mediaText, containerText) => {
      for (const r of list) {
        if (r.type === CSSRule.MEDIA_RULE) {
          walk(r.cssRules, mediaText ? `${mediaText} && ${r.conditionText}` : r.conditionText, containerText);
        } else if (r.type === CSSRule.CONTAINER_RULE) {
          walk(r.cssRules, mediaText, containerText ? `${containerText} && ${r.conditionText}` : r.conditionText);
        } else if (r.type === CSSRule.STYLE_RULE) {
          const decls = [];
          for (const p of r.style) {
            if (p.startsWith('--') || p.startsWith('transition')) continue;
            decls.push({ prop: p, value: r.style.getPropertyValue(p) });
          }
          if (decls.length) out.push({ selector: r.selectorText, mediaText, containerText, decls });
        }
      }
    };
    for (const sheet of [...document.styleSheets]) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      walk(rules, '', '');
    }
    return out;
  });
  perTab.push({ tab, rules });
}

// ── pass 2: test every rule at every width where its condition holds ──────
const findings = new Map();

for (const { tab, rules } of perTab) {
  for (const width of PROBES) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(110);

    const res = await page.evaluate(({ rules, containerSelectors }) => {
      const out = [];
      const probe = document.createElement('style');
      document.head.appendChild(probe);

      const sizes = {};
      for (const [name, sel] of Object.entries(containerSelectors)) {
        const el = document.querySelector(sel);
        sizes[name] = el ? el.getBoundingClientRect().width : null;
      }

      const mediaHolds = (mediaText, w) => {
        if (!mediaText) return true;
        for (const part of mediaText.split('&&').map((s) => s.trim())) {
          const m = part.match(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/);
          if (!m) { try { if (!window.matchMedia(part).matches) return false; } catch { return false; } continue; }
          const v = Number(m[2]);
          if (m[1] === 'max' && !(w <= v)) return false;
          if (m[1] === 'min' && !(w >= v)) return false;
        }
        return true;
      };
      const containerHolds = (containerText) => {
        if (!containerText) return true;
        for (const part of containerText.split('&&').map((s) => s.trim())) {
          const m = part.match(/^(\w+)\s*\((min|max)-width:\s*(\d+(?:\.\d+)?)(px|rem)\)$/);
          if (!m) return false;
          const size = sizes[m[1]];
          if (size == null) return false;
          let v = Number(m[3]);
          if (m[4] === 'rem') v *= 16;
          if (m[2] === 'max' && !(size <= v)) return false;
          if (m[2] === 'min' && !(size >= v)) return false;
        }
        return true;
      };

      for (const rule of rules) {
        // Only a rule inside a media or container block can be a lie: a
        // top-level rule that loses to a later one is the cascade working
        // as designed, not a broken breakpoint.
        if (!rule.mediaText && !rule.containerText) continue;
        if (!mediaHolds(rule.mediaText, window.innerWidth)) continue;
        if (!containerHolds(rule.containerText)) continue;

        let els;
        try { els = [...document.querySelectorAll(rule.selector)]; } catch { continue; }
        els = els.filter((el) => !el.closest('.view') || el.closest('.view:not([hidden])'));
        if (!els.length) continue;

        const props = rule.decls.map((d) => d.prop);
        const baseline = els.map((el) => props.map((p) => getComputedStyle(el).getPropertyValue(p)));

        const body = `${rule.selector} { ${rule.decls.map((d) => `${d.prop}: ${d.value};`).join(' ')} }`;
        probe.textContent = rule.containerText
          ? `@container ${rule.containerText} { ${body} }`
          : `@media ${rule.mediaText} { ${body} }`;

        const changed = [];
        els.forEach((el, i) => {
          props.forEach((p, j) => {
            const now = getComputedStyle(el).getPropertyValue(p);
            if (now !== baseline[i][j]) changed.push({ prop: p, from: baseline[i][j], to: now });
          });
        });
        probe.textContent = '';
        const sig = new Map();
        for (const c of changed) sig.set(c.prop, `${c.prop}: ${c.from} -> ${c.to}`);
        out.push({
          selector: rule.selector,
          media: rule.mediaText || null,
          container: rule.containerText || null,
          overridden: changed.length > 0,
          props: [...sig.values()],
        });
      }
      probe.remove();
      return out;
    }, { rules, containerSelectors: CONTAINER_SELECTORS });

    for (const r of res) {
      const key = `${r.selector}::${r.media || ''}::${r.container || ''}`;
      if (!findings.has(key)) findings.set(key, { ...r, views: new Set(), alive: new Set(), deadAt: new Set(), props: new Set() });
      const f = findings.get(key);
      f.views.add(tab);
      if (r.overridden) f.deadAt.add(width);
      else f.alive.add(width);
      for (const p of r.props) f.props.add(p);
    }
  }
}

await browser.close();

// ── locate each dead rule in the source ────────────────────────────────────
const cssLines = css.split('\n');
function findLine(selector, mediaText, containerText) {
  const sel = selector.split(',')[0].trim().replace(/\s+/g, ' ');
  const cond = (mediaText || containerText || '').split('&&')[0].trim();
  let depth = 0, blockDepth = null, inTarget = false;
  for (let i = 0; i < cssLines.length; i++) {
    const l = cssLines[i], trimmed = l.trim();
    if (blockDepth === null && (trimmed.startsWith('@media') || trimmed.startsWith('@container'))) {
      if (cond && trimmed.includes(cond)) { blockDepth = depth; inTarget = true; }
    }
    if (inTarget && trimmed.includes(sel) && !trimmed.startsWith('@')) return i + 1;
    for (const ch of l) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (blockDepth !== null && depth <= blockDepth) { inTarget = false; blockDepth = null; } }
    }
  }
  for (let i = 0; i < cssLines.length; i++) if (cssLines[i].includes(sel)) return i + 1;
  return null;
}

const dead = [...findings.values()]
  .filter((f) => f.alive.size === 0 && f.deadAt.size > 0)
  .map((f) => ({
    selector: f.selector,
    media: f.media,
    container: f.container,
    views: [...f.views].sort(),
    props: [...f.props].slice(0, 5),
    widths: [...f.deadAt].sort((a, b) => a - b),
    line: findLine(f.selector, f.media, f.container),
  }))
  .sort((a, b) => b.views.length - a.views.length || (a.line || 0) - (b.line || 0));

const partial = [...findings.values()]
  .filter((f) => f.alive.size > 0 && f.deadAt.size > 0)
  .map((f) => ({ selector: f.selector, media: f.media, container: f.container, alive: [...f.alive].sort((a, b) => a - b), deadAt: [...f.deadAt].sort((a, b) => a - b) }))
  .sort((a, b) => b.deadAt.length - a.deadAt.length);

console.log(`DEAD RESPONSIVE RULES (${dead.length} distinct)\n`);
console.log(`probe widths: ${PROBES.join(', ')}\n`);
for (const o of dead) {
  console.log(`${o.selector}${o.line ? `   [styles.css:${o.line}]` : ''}`);
  console.log(`   media:    ${o.media || '(none)'}${o.container ? `   container: ${o.container}` : ''}`);
  console.log(`   views:    ${o.views.join(', ')}`);
  console.log(`   at:       ${o.widths.join(', ')}`);
  for (const p of o.props) console.log(`   ${p}`);
  console.log('');
}
if (!dead.length) console.log('none — every responsive rule takes effect in the band it was written for.\n');

if (partial.length) {
  console.log(`ALIVE IN ITS BAND, overridden elsewhere (${partial.length} — these are working ladders, not defects)\n`);
  for (const o of partial.slice(0, 12)) {
    console.log(`${o.selector}   ${o.media || o.container}`);
    console.log(`   alive at: ${o.alive.join(', ')}`);
    console.log(`   overridden at: ${o.deadAt.join(', ')}\n`);
  }
}
