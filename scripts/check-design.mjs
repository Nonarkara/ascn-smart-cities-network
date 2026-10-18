import { readFile } from 'node:fs/promises';
const css=(await readFile(new URL('../styles.css',import.meta.url),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
const errors=[];
for(const match of css.matchAll(/(?:^|[;{])\s*(border-radius|box-shadow|background(?:-image)?|font-family|--font)\s*:\s*([^;}]+)/g)) {
  const [,property,value]=match;
  if(property==='border-radius' && !/^(?:0(?:px|rem)?|50%)\s*$/.test(value.trim())) errors.push('Nonfunctional corner radius: '+value);
  if(property==='box-shadow' && !/^(none|inset)\b/.test(value.trim())) errors.push('Decorative shadow: '+value);
  if(/gradient\(/.test(value)) errors.push('Decorative gradient: '+value);
  if(['font-family','--font'].includes(property) && /^\s*["']?(?:Inter|Poppins|Montserrat|Roboto|Open Sans|Lato|DM Sans|Space Grotesk|Geist|Plus Jakarta Sans|Manrope|Nunito|system-ui)\b/i.test(value)) errors.push('Banned primary typeface: '+value);
}
if(!/--measure\s*:\s*6[0-9]ch/.test(css)) errors.push('Prose measure must stay within the 60–69ch range.');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
if(!/id="observatory-heading"/.test(html)||!/id="finder-open"/.test(html)) errors.push('The evidence opening and direct finder must remain available.');
if(!/prefers-reduced-motion/.test(css)) errors.push('Reduced-motion support missing.');
if(errors.length)throw new Error(errors.join('\n'));
console.log('Objective design checks passed. Composition still requires screenshots and independent review.');
