// Capture complete real scroll paths; first-screen images cannot clear lower-page geometry.
import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const output=process.env.ASCN_READING_SCREENSHOTS || 'artifacts/release/reading-sweep';await mkdir(output,{recursive:true});
const base=process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const routes=['overview','cities','record','archive','projects','innovation','news','news/archive','news/discovery','news/regional','ascn9','history','framework','partners','contacts','insights','data','research','essay'];
const frames=[];
await writeFile(`${output}/index.json`, '[]\n');
await writeFile(`${output}/status.json`, JSON.stringify({complete:false}));
let browser;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined});const page=await browser.newPage();
await page.route('**/api/{news,ascn-news}',r=>r.fulfill({status:503,json:{}}));
 // A visible route shell is not proof that its data has finished loading.
 await page.goto(`${base}/#overview`);
 await page.locator('#kpi-grid .kpi').first().waitFor({state:'attached'});
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:width===390?844:width===1024?768:900});
  for(const route of routes){
   await page.goto(`${base}/#${route}`,{waitUntil:'domcontentloaded'});
   await page.locator(`#view-${route.split('/')[0]}`).waitFor();
   await page.locator(`#view-${route.split('/')[0]} .path-band`).waitFor();
   if(route==='history') await page.locator('#ascap-panel .ascap-pillar').nth(7).waitFor({state:'attached'});
   if(route==='framework') await page.locator('#framework-ascap .ascap-pillar').nth(7).waitFor({state:'attached'});
   if(route.startsWith('news'))await page.locator(`#news-panel-${route.split('/')[1]||'review'}`).waitFor();
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(250);
   const size=await page.locator('#plate').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
   let max=size.scroll-size.height;let previous=-1;
   for(let i=0;;i++){
    const top=Math.min(previous<0?0:previous+Math.round(size.height*.85),max);
    if(top===previous)throw new Error(`Scroll capture stalled: ${route} at ${width}px`);
    await page.locator('#plate').evaluate((el,top)=>el.scrollTo({top,behavior:'instant'}),top);
    await page.waitForTimeout(50);
    const file=`${route.replaceAll('/','-')}-${width}-${String(i).padStart(2,'0')}.png`;
    await page.screenshot({path:`${output}/${file}`,animations:'disabled',timeout:60000});
    frames.push({route,width,top,file});previous=top;
    const current=await page.locator('#plate').evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));
    max=current.max;
    if(current.top>=max-1){
      await page.waitForTimeout(200);
      const settled=await page.locator('#plate').evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));
      if(settled.top>=settled.max-1)break;
      max=settled.max;
    }
   }
   await writeFile(`${output}/index.json`,JSON.stringify(frames,null,2));
   console.log(route,width,frames.filter(f=>f.route===route&&f.width===width).length);
  }
 }
}finally{await browser?.close();}
await writeFile(`${output}/status.json`,JSON.stringify({complete:true,frames:frames.length,viewports:3,routes:routes.length}));
console.log('Reading path frames:',frames.length);
