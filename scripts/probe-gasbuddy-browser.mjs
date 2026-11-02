// Diagnostic using normal installed Chrome and a fresh anonymous session.
// No stealth patches, imported cookies, proxies or CAPTCHA interactions.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url='https://www.gasbuddy.com/home?search=53703&fuel=1';
await fs.mkdir('probe-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({locale:'en-US'});
const page=await context.newPage();
const network=[];const pending=[];
page.on('response',r=>{
 if(new URL(r.url()).pathname!=='/graphql')return;
 pending.push((async()=>{
  const request=r.request();let op;try{op=request.postDataJSON()?.operationName}catch{}
  const row={operation:op,status:r.status()};
  try{
   const j=await r.json();row.errors=j.errors?.map(e=>e.message);
   const location=j.data?.locationBySearchTerm;
   if(location){row.location=location.displayName;row.count=location.stations?.count;row.next=location.stations?.cursor?.next;row.stations=location.stations?.results?.map(s=>({id:s.id,name:s.name,address:s.address,prices:s.prices?.map(p=>({fuelProduct:p.fuelProduct,credit:p.credit&&{price:p.credit.price,postedTime:p.credit.postedTime},cash:p.cash&&{price:p.cash.price,postedTime:p.cash.postedTime}}))}))}
  }catch{}
  network.push(row);
 })());
});
try{
 const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 // Let normal site JavaScript finish loading, including automatic page transitions.
 // This does not click or solve an interactive challenge.
 try{await page.waitForFunction(()=>document.querySelector('a[href^="/station/"]'),{},{timeout:20000})}catch{}
 await Promise.allSettled(pending);
 const body=await page.locator('body').innerText();
 const result={url,initialStatus:r?.status(),finalUrl:page.url(),title:await page.title(),stationLinks:await page.locator('a[href^="/station/"]').count(),visiblePrices:body.match(/\$\d{1,2}\.\d{2,3}/g)||[],excerpt:body.slice(0,3000),network};
 await fs.writeFile('probe-results/gasbuddy-chrome.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close()}
