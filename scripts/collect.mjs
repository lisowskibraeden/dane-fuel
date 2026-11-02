import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {collectKwikTrip} from './kwiktrip.mjs';
import {SOURCE,TOWNS,parseCard,mergeStations,censusMatch,stationTime} from './core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Standalone GasBuddy attempts never replace the site's working fallback data.
const gasbuddyOnly=process.argv.includes('--gasbuddy-only');
const DATA=path.join(ROOT,gasbuddyOnly?'work/gasbuddy/prices.json':'site/data/prices.json');
const CACHE=path.join(ROOT,gasbuddyOnly?'work/gasbuddy/county-cache.json':'site/data/county-cache.json');
const attemptedAt=new Date().toISOString();
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const previous=await read(DATA,{schemaVersion:1,stations:[],lastSuccessAt:null});
const cache=await read(CACHE,{});
const pages=[];const fresh=[];let browser;let fatal=null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const limited=process.argv.includes('--smoke')?TOWNS.slice(0,1):TOWNS;
try{
 browser=await chromium.launch({headless:!process.argv.includes('--headed')});
 const context=await browser.newContext({locale:'en-US'});
 const page=await context.newPage();
 for(const town of limited){
  const url=`${SOURCE}/gasprices/wisconsin/${town}`;
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   const title=await page.title();
   if([401,403,429].includes(response?.status())||/just a moment|access denied|captcha/i.test(title)){
    pages.push({town,url,status:'blocked',httpStatus:response?.status()??null,title,count:0});
    fatal=`GasBuddy did not return listings: HTTP ${response?.status()??'unknown'}, title ${JSON.stringify(title)}. Stopped without retrying the challenge.`;
    break;
   }
   if(response?.status()===404){pages.push({town,url,status:'not-found',count:0});continue}
   if(!response?.ok())throw Error(`HTTP ${response?.status()}`);
   await page.getByRole('button',{name:'Regular Fuel Prices',exact:true}).waitFor({state:'visible',timeout:15000});
   // Prices hydrate after the station list. Wait for actual price/report text.
   try{await page.waitForFunction(()=>/\$\d{1,2}\.\d{2,3}[\s\S]{0,1000}(?:minutes?|hours?|days?) ago/i.test(document.body.innerText),{},{timeout:18000})}catch{}
   const cards=await page.locator('a[href^="/station/"]').evaluateAll(links=>{
    const records=[];const seen=new Set();
    for(const link of links){
     const href=link.getAttribute('href');if(!/^\/station\/\d+$/.test(href||'')||seen.has(href))continue;
     let card=link.parentElement,best=null;
     while(card&&card!==document.body){
      const hrefs=new Set([...card.querySelectorAll('a[href^="/station/"]')].map(a=>a.getAttribute('href')));
      if(hrefs.size>1)break;
      if(/\bWI\b/.test(card.innerText)&&/Amenities|Reviews|Details/.test(card.innerText))best=card;
      card=card.parentElement;
     }
     if(best){seen.add(href);records.push({href,name:link.innerText,text:best.innerText})}
    }
    return records;
   });
   const now=new Date().toISOString();
   const parsed=cards.map(c=>parseCard(c,now)).filter(Boolean);
   fresh.push(...parsed);
   pages.push({town,url,status:parsed.length?'ok':'no-reports',count:parsed.length});
   console.log(`${town}: ${parsed.length} reported regular prices`);
  }catch(e){pages.push({town,url,status:'error',count:0,error:String(e.message).slice(0,250)})}
  await pause(1500);
 }
}catch(e){fatal=`Collector failed: ${e.message}`}
finally{await browser?.close()}
// A blocked GasBuddy request is not retried or bypassed. Use a first-party feed.
let fallback=false;
if(!fresh.length&&!gasbuddyOnly){
 fallback=true;
 const official=await collectKwikTrip({getJSON:async url=>{
  const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'DaneFuel/1.0'}});
  if(!r.ok)throw Error(`Kwik Trip HTTP ${r.status}`);
  return r.json();
 }});
 fresh.push(...official.stations);pages.push(...official.pages);
}
// Confirm county from full street address using the free Census Geocoder.
// Unmatched/ambiguous addresses never enter the Dane County ranking.
const unique=mergeStations([],fresh);let geocodeErrors=0;
for(const station of unique){
 if(station.countyAuthority==='Kwik Trip county field'&&station.countyFips==='55025')continue;
 const key=`${station.address}, ${station.city}, WI`.toUpperCase();
 let entry=cache[key];
 if(!entry || Date.now()-Date.parse(entry.checkedAt)>180*86400e3){
  try{
   const u=new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
   u.search=new URLSearchParams({address:key,benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'}).toString();
   const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Geocoder HTTP ${r.status}`);
   const match=censusMatch(await r.json());
   entry={...(match||{countyFips:null}),checkedAt:new Date().toISOString()};
   cache[key]=entry;
  }catch{geocodeErrors++;entry=null}
  await pause(300);
 }
 station.countyFips=entry?.countyFips||null;
 station.countyVerifiedAt=entry?.countyFips?entry.checkedAt:null;
}
const success=unique.some(s=>s.countyFips==='55025');
const merged=mergeStations((previous.stations||[]).filter(s=>fallback?s.source==='Kwik Trip':s.source!=='Kwik Trip'),unique).filter(s=>Date.now()-Date.parse(stationTime(s))<7*86400e3);
const result={schemaVersion:1,source:fallback?'Kwik Trip':'GasBuddy',fuel:'regular',scope:'Dane County, Wisconsin',attemptedAt,lastSuccessAt:success?new Date().toISOString():previous.lastSuccessAt,status:success?(pages.some(p=>p.status!=='ok')||geocodeErrors?'partial':'ok'):'failed',message:fallback&&success?'Kwik Trip only: limited brand coverage, not the countywide lowest. Regular-87 quotes from the 100 nearest Madison stores, filtered to Dane County using the provider county field. Times indicate retrieval; the provider does not supply price-change times. GasBuddy was unavailable.':fatal||(success?'Latest available reports retrieved. Only county-verified, recent reports are ranked.':'No usable station prices were retrieved. Saved prices have not been marked fresh.'),geocodeErrors,pages,stations:merged};
await fs.mkdir(path.dirname(DATA),{recursive:true});
await fs.writeFile(DATA+'.tmp',JSON.stringify(result,null,2)+'\n');await fs.rename(DATA+'.tmp',DATA);
await fs.writeFile(CACHE,JSON.stringify(cache,null,2)+'\n');
console.log(result.message);
console.log(`Saved attempt: ${DATA}`);
for(const p of pages.filter(p=>p.status==='error'||p.status==='blocked'))console.error(`${p.town}: ${p.status}${p.error?': '+p.error:''}`);
console.log(`${result.status}: ${unique.length} new reports; ${unique.filter(s=>s.countyFips==='55025').length} county-verified.`);
if(!success)process.exitCode=1;
