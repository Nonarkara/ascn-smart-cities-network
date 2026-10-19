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
  const keep = new Set(['design-faces.css', 'archivo-LICENSE', 'julius-sans-one-LICENSE', 'prompt-LICENSE']);
  const stale = vendored
    .filter((e) => e.isFile() && !e.name.startsWith('.') && !keep.has(e.name))
    .map((e) => e.name);
  if (stale.length) errors.push('Stale font files tracked beside the vendored faces: '+stale.join(', ')+'. Delete them from git — the build will not publish them, but they still misrepresent the typeface set.');
}
if(errors.length)throw new Error(errors.join('\n'));
console.log('Objective design checks passed. Composition still requires screenshots and independent review.');
