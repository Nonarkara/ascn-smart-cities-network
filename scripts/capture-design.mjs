import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
const page=await browser.newPage();
await page.route('**/api/{news,ascn-news}', (route) => route.fulfill({status:503,json:{}}));
const base=process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const output=process.env.ASCN_SCREENSHOTS || '.tmp/audit-after';
await mkdir(output,{recursive:true});
const report=[];
try {
  for(const width of [1440,1024,390]) {
    await page.setViewportSize({width,height:950});
    await page.goto(`${base}/#overview`);
    await page.locator('#kpi-grid .kpi').first().waitFor({state:'attached'});
    for(const tab of ['overview','cities','record','archive','projects','innovation','news','news/archive','news/discovery','news/regional','ascn9','history','framework','partners','contacts','insights','data','research','essay']) {
      // On phones the index is hidden while a section is open.
      await page.goto(`${base}/#${tab}`, {waitUntil:'domcontentloaded'});
      await page.locator(`#view-${tab.split('/')[0]}`).waitFor();
      if(tab.split('/')[0]==='news') await page.locator(`#news-panel-${tab.split('/')[1] || 'review'}`).waitFor();
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
      await page.evaluate(()=>{document.querySelector('#plate').scrollTop=0;scrollTo({top:0,behavior:'instant'});});
      await page.screenshot({path:`${output}/${tab.replaceAll('/', '-')}-${width}.png`,animations:'disabled'});
      if(tab==='news/archive') {
        const details=page.locator('#review-archive details').first();
        await details.waitFor({state:'attached'});
        await details.evaluate(el=>{el.open=true;});
        await details.locator('..').screenshot({path:`${output}/news-archive-expanded-${width}.png`,animations:'disabled'});
        await details.evaluate(el=>{el.open=false;});
      }
      const metrics=await page.evaluate(()=>{
        const plate=document.querySelector('#plate');
        return {overflow:document.documentElement.scrollWidth>innerWidth || plate.scrollWidth>plate.clientWidth+1,headerHeight:document.querySelector('.plate-bar').getBoundingClientRect().height};
      });
      report.push({tab,width,...metrics});
    }
  }
} finally { await browser.close(); }
await writeFile(`${output}/layout.json`,JSON.stringify(report,null,2)+'\n');
if(report.some(row=>row.overflow)) throw new Error('Document overflow: '+JSON.stringify(report.filter(row=>row.overflow)));
console.log(`Saved ${report.length} view screenshots and 3 expanded evidence records at 1440/1024/390; no document overflow. Maps waited for visible loaded tiles and all 38 markers. Independent visual review remains required.`);
