import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
const page=await browser.newPage();
const base=process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const output=process.env.ASCN_SCREENSHOTS || '.tmp/audit-after';
await mkdir(output,{recursive:true});
const report=[];
try {
  for(const width of [1440,1024,390]) {
    await page.setViewportSize({width,height:950});
    await page.goto(`${base}/#overview`);
    await page.locator('#kpi-grid .kpi').first().waitFor({state:'attached'});
    for(const tab of ['overview','cities','record','archive','projects','innovation','news','history','framework','partners','contacts','insights','data','research','essay']) {
      await page.locator(`#tab-nav [data-tab="${tab}"]`).click();
      await page.locator(`#view-${tab}`).waitFor();
      await page.evaluate(()=>document.fonts.ready);
      if(['cities','contacts'].includes(tab)) {
        const map=tab==='cities'?'#sea-map':'#contacts-map';
        await page.locator(`${map} .leaflet-interactive`).nth(37).waitFor({state:'attached'});
        await page.waitForFunction((selector)=>{
          const el=document.querySelector(selector),box=el.getBoundingClientRect();
          const tiles=[...el.querySelectorAll('.leaflet-tile')].filter(img=>{const r=img.getBoundingClientRect();return r.right>box.left&&r.left<box.right&&r.bottom>box.top&&r.top<box.bottom;});
          return tiles.length>0&&tiles.every(img=>img.complete&&img.naturalWidth===256);
        },map,{timeout:20000});
      }
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:`${output}/${tab}-${width}.png`,animations:'disabled'});
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,headerHeight:document.querySelector('.site-nav').getBoundingClientRect().height}));
      report.push({tab,width,...metrics});
    }
  }
} finally { await browser.close(); }
await writeFile(`${output}/layout.json`,JSON.stringify(report,null,2)+'\n');
if(report.some(row=>row.overflow)) throw new Error('Document overflow: '+JSON.stringify(report.filter(row=>row.overflow)));
console.log(`Saved ${report.length} screenshots at 1440/1024/390; no document overflow. Maps waited for visible loaded tiles and all 38 markers. Independent visual review remains required.`);
