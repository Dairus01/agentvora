import {chromium} from '../apps/web/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=new URL('../artifacts/reconstruction/implemented/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const visit=route=>page.goto('http://127.0.0.1:3000/'+route);
const save=(name,fullPage=false)=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage});
for(const route of ['','terminal','council','portfolio','decisions','source']){
  await visit(route);
  if(route==='')await page.waitForFunction(()=>document.querySelector('.market-card .quote')?.textContent.includes('$'),{},{timeout:60000}).catch(()=>errors.push('Landing data not ready within 60 seconds'));
  if(route==='terminal')await page.waitForSelector('[data-testid="chart"]',{timeout:60000});
  await page.waitForTimeout(800);
  await save((route||'landing')+'-1920',route==='');
}
await visit('terminal');
await page.getByRole('button',{name:/Market Desk/}).click();
await save('terminal-expanded-1920');
for(const width of [1440,1280,1024,768,390]){
  await page.setViewportSize({width,height:900});
  for(const route of ['','terminal','portfolio','council']){
    await visit(route);await page.waitForTimeout(600);
    await save((route||'landing')+'-'+width,true);
    if(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth))errors.push('Overflow: '+route+' '+width);
  }
}
await page.setViewportSize({width:1920,height:1080});
for(const [stamp,section] of [[0,'.hero'],[5,'#intelligence'],[10,'#commentary'],[15,'#sentiment'],[20,'#watchlists'],[25,'.closing']]){
  await visit('');await page.locator(section).scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  await save('checkpoint-'+String(stamp).padStart(3,'0'));
}
for(const [stamp,symbol] of [[36,'MSFT'],[60,'MSFT'],[75,'AAPL'],[100,'NVDA'],[130,'MSFT'],[140,'MSFT']]){
  await visit('terminal');
  await page.getByRole('button',{name:new RegExp(symbol+'.*'+(symbol==='MSFT'?'Microsoft':symbol==='AAPL'?'Apple':'NVIDIA'))}).click();
  if(stamp===130)await page.getByRole('button',{name:/Market Desk/}).click();
  if(stamp===140)await page.getByRole('button',{name:'Toggle color theme'}).click();
  await page.waitForTimeout(600);await save('checkpoint-'+String(stamp).padStart(3,'0'));
}
await fs.writeFile(new URL('../artifacts/browser-errors.json',import.meta.url),JSON.stringify(errors,null,2));
console.log(JSON.stringify({errors}));await browser.close();
