import { readFile, readdir } from 'node:fs/promises';
const css=(await readFile(new URL('../styles.css',import.meta.url),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
const errors=[];
for(const match of css.matchAll(/(?:^|[;{])\s*(border-radius|box-shadow|background(?:-image)?|font-family|--font)\s*:\s*([^;}]+)/g)) {
  const [,property,value]=match;
  if(property==='border-radius' && !/^(?:0(?:px|rem)?|50%)\s*$/.test(value.trim())) errors.push('Nonfunctional corner radius: '+value);
  if(property==='box-shadow' && !/^(none|inset)\b/.test(value.trim())) errors.push('Decorative shadow: '+value);
  if(/gradient\(/.test(value)) errors.push('Decorative gradient: '+value);
  if(['font-family','--font'].includes(property) && /^\s*["']?(?:Inter|Poppins|Montserrat|Roboto|Open Sans|Lato|DM Sans|Space Grotesk|Geist|Plus Jakarta Sans|Manrope|Nunito|system-ui)\b/i.test(value)) errors.push('Banned primary typeface: '+value);
}
/* DESIGN-ANTI-SLOP.md rule 3 states the band as 45-75 characters with 60-70 as
   the ideal, under a heading that reads "Readable line length (A4/A5)". This
   gate pinned only the ideal — `--measure: 6[0-9]ch` — so it enforced a
   narrower window than the rule it claimed to implement and would have passed
   a 90ch regression on any other line of the stylesheet. It now checks the
   documented band at both ends. The owner moved the target to the A5 text
   block (~50ch); that is a decision inside the rule, not an exception to it. */
if(!/--measure\s*:\s*(?:4[5-9]|[56][0-9]|7[0-5])ch\b/.test(css)) errors.push('Prose measure must stay within the documented 45-75ch band (rule 3).');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
if(!/id="observatory-heading"/.test(html)||!/id="finder-open"/.test(html)) errors.push('The evidence opening and direct finder must remain available.');
if(!/prefers-reduced-motion/.test(css)) errors.push('Reduced-motion support missing.');
/* A vendored OFL licence belongs to a face the site actually sets. The build
   already refuses to publish them (site-assets.mjs allowlists only the exact
   name fonts/LICENSE), so this is repo hygiene, not a live-bytes leak — the
   three stale licences are inert in dist/ and only live in git history. They
   survived three typeface changes because nothing in the repo looks at fonts/
   except the copy loop, and the copy loop is the wrong place to notice. An OFL
   licence must be kept alongside the font it covers, so the rule is not "no
   stale licences" but "a licence for a current face and nothing else". Directories
   and dotfiles are exempt for the same reason site-assets.mjs exempts them:
   never published. */
{
  const vendored = await readdir(new URL('../fonts/', import.meta.url), { withFileTypes: true });
  const keep = new Set(['design-faces.css', 'jost-LICENSE', 'prompt-LICENSE']);
  const stale = vendored
    .filter((e) => e.isFile() && !e.name.startsWith('.') && !keep.has(e.name))
    .map((e) => e.name);
  if (stale.length) errors.push('Stale font files tracked beside the vendored faces: '+stale.join(', ')+'. Delete them from git — the build will not publish them, but they still misrepresent the typeface set.');
}
/* ── The palette is a CLOSED set ─────────────────────────────────────────────
   Every colour this site paints is either a credited Sanzo Wada colour or a
   documented value step of one, and scripts/wada-palette.json says which is
   which, by name and by plate number.

   The previous guard was a deny-list of six agent-default hexes (#0f172a,
   #38bdf8 and friends). A deny-list grows backwards: every new colour that
   arrives has to be recognised before it can be banned, and the palette of a
   site that had been designed in one hue for a year was a set of warm greys
   nobody could name. A CLOSED set is the other way round — the manifest is
   the whole palette, and anything not in it cannot reach the stylesheet.

   The manifest's credited entries are checked against the Palette project's
   own data file, plate numbers included, so a citation cannot drift. */
{
  const manifest = JSON.parse(await readFile(new URL('./wada-palette.json', import.meta.url), 'utf8'));
  const allowed = new Set([...Object.keys(manifest.credited), ...Object.keys(manifest.steps)]);
  const stray = [];
  for (const relative of ['../styles.css', '../app.js', '../archive.js', '../news.js']) {
    const raw = await readFile(new URL(relative, import.meta.url), 'utf8');
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const value = match[0].toLowerCase();
      const expanded = value.length === 4
        ? '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3]
        : value;
      if (expanded.length !== 7) continue;
      if (!allowed.has(expanded)) stray.push(expanded);
    }
  }
  if (stray.length) errors.push('Colour outside the Wada palette manifest: ' + [...new Set(stray)].join(', '));
  // Control: the guard has to actually reject a colour that is not credited.
  const control = '#0f172a';
  if (allowed.has(control)) errors.push('The palette control colour is inside the manifest — the guard cannot fail.');
  if (!manifest.credited['#f5ecc2'] || !manifest.credited['#f99d1b'] || !manifest.credited['#064f6e'])
    errors.push('Plate 151 must stay credited: Sulpher Yellow, Yellow Orange and Vandar Poel\'s Blue.');
}

/* ── Two typefaces, and the display register carries weight ─────────────────
   The rule is "at most two families per product", and the site had three:
   Julius Sans One for the display register, Archivo for prose and Prompt for
   Thai. Julius Sans One shipped a SINGLE weight (400) — every headline,
   label and figure on the site was set in a face with no weight range at
   all, which is what "too lean/slim" meant.

   Jost carries both registers now, so the family count is two. This guard
   reads the vendored facesheet rather than a list written here, so a face
   cannot be swapped in without the stylesheet being told about it. */
{
  const facesheet = await readFile(new URL('../fonts/design-faces.css', import.meta.url), 'utf8');
  const vendored = [...new Set([...facesheet.matchAll(/font-family:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  if (vendored.length > 2) errors.push('More than two design families are vendored: ' + vendored.join(', '));
  // A vendored face must be licensed, and a licence must not outlive its face.
  const dir = await readdir(new URL('../fonts/', import.meta.url), { withFileTypes: true });
  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const licences = dir.filter((e) => e.isFile() && e.name.endsWith('-LICENSE')).map((e) => e.name);
  for (const face of vendored) {
    const expected = slug(face) + '-LICENSE';
    if (!licences.includes(expected)) errors.push('No OFL licence beside the vendored face: ' + face + ' (expected ' + expected + ').');
  }
  for (const file of licences) {
    const face = vendored.find((f) => slug(f) + '-LICENSE' === file);
    if (!face) errors.push('A licence with no face: ' + file);
  }
  // The stylesheet may name no design family that is not vendored.
  const SYSTEM = new Set(['Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    'Source Han Sans SC', 'sans-serif', 'serif', 'ui-monospace', 'IBM Plex Mono', 'JetBrains Mono',
    'Menlo', 'monospace', 'inherit', 'initial', 'unset']);
  const stacks = [...css.matchAll(/--(?:font|font-display)\s*:\s*([^;]+);/g)].map((m) => m[1]);
  if (!stacks.length) errors.push('The font tokens are missing.');
  for (const stack of stacks) {
    for (const raw of stack.split(',')) {
      const name = raw.trim().replace(/^['"]|['"]$/g, '');
      if (!name || SYSTEM.has(name)) continue;
      if (!vendored.includes(name)) errors.push('The stylesheet names an unvendored typeface: ' + name);
    }
  }
  // The display register must have weight. A face with one weight cannot
  // state anything, however large it is set.
  const display = /font-family:\s*var\(--font-display\)/.test(css);
  if (!display) errors.push('The display register must use --font-display.');
  const weights = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]));
  if (!weights.some((w) => w >= 600)) errors.push('The display register carries no weight of its own (no 600 or above in the stylesheet).');
}

if(errors.length)throw new Error(errors.join('\n'));
console.log('Objective design checks passed. Composition still requires screenshots and independent review.');
