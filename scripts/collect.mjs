import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectGasBuddy} from './gasbuddy.mjs';
import {countyAddressMatch} from './county.mjs';
import {collectKwikTrip} from './kwiktrip.mjs';
import {TOWNS,mergeStations,censusMatch,stationTime} from './core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Standalone GasBuddy attempts never replace the site's working fallback data.
const gasbuddyOnly=process.argv.includes('--gasbuddy-only');
const DATA=path.join(ROOT,gasbuddyOnly?'work/gasbuddy/prices.json':'site/data/prices.json');
const CACHE=path.join(ROOT,gasbuddyOnly?'work/gasbuddy/county-cache.json':'site/data/county-cache.json');
const attemptedAt=new Date().toISOString();
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const previous=await read(DATA,{schemaVersion:1,stations:[],lastSuccessAt:null});
const cache=await read(CACHE,{});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const limited=process.argv.includes('--smoke')?TOWNS.slice(0,1):TOWNS;
const gasbuddy=await collectGasBuddy({towns:limited,standardChrome:process.argv.includes('--standard-chrome'),headless:!process.argv.includes('--headed'),channel:process.argv.includes('--chrome')?'chrome':undefined});
const pages=gasbuddy.pages,fresh=gasbuddy.stations;
let fatal=gasbuddy.fatal;
if(fatal)console.error(fatal);
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
async function verifyCounty(station){
 if(station.countyAuthority==='Kwik Trip county field'&&station.countyFips==='55025')return;
 const key=`${station.address}, ${station.city}, WI`.toUpperCase();
 let entry=cache[key];
 if(!entry || Date.now()-Date.parse(entry.checkedAt)>(entry.countyFips?180:7)*86400e3 || (!entry.countyFips&&station.postalCode&&entry.checkedWithPostalCode!==station.postalCode)){
  try{
   const u=new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
   u.search=new URLSearchParams({address:key+(station.postalCode?' '+station.postalCode:''),benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'}).toString();
   const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Geocoder HTTP ${r.status}`);
   const match=censusMatch(await r.json());
   entry={...(match||{countyFips:null}),checkedAt:new Date().toISOString(),checkedWithPostalCode:station.postalCode||null};
   cache[key]=entry;
  }catch{geocodeErrors++;entry=null}
  await pause(300);
 }
 // County address points can confirm new or differently formatted addresses.
 if(!entry?.countyFips&&entry?.countyFallbackVersion!==1){
  try{
   const match=await countyAddressMatch(station,async u=>{
    const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`County data HTTP ${r.status}`);return r.json();
   });
   entry={...(entry||{countyFips:null}),...(match||{}),countyFallbackVersion:1,checkedAt:new Date().toISOString()};cache[key]=entry;
  }catch{geocodeErrors++}
 }
 station.countyAuthority=entry?.countyFips?(entry.countyAuthority||'US Census Geocoder'):null;
 station.countySource=entry?.countySource||null;
 station.countyFips=entry?.countyFips||null;
 station.countyVerifiedAt=entry?.countyFips?entry.checkedAt:null;
}
// Three independent address checks at a time keep the free runner bounded.
for(let i=0;i<unique.length;i+=3){
 await Promise.all(unique.slice(i,i+3).map(verifyCounty));
 if(i%24===0)console.log(`County checks: ${Math.min(i+3,unique.length)}/${unique.length}`);
}
const success=unique.some(s=>s.countyFips==='55025');
const merged=mergeStations((previous.stations||[]).filter(s=>fallback?s.source==='Kwik Trip':s.source!=='Kwik Trip'),unique).filter(s=>Date.now()-Date.parse(stationTime(s))<7*86400e3);
const result={schemaVersion:1,gasbuddyError:gasbuddy.fatal,inventoryCount:gasbuddy.inventoryCount,source:fallback?'Kwik Trip':'GasBuddy',fuel:'regular',scope:'Dane County, Wisconsin',attemptedAt,lastSuccessAt:success?new Date().toISOString():previous.lastSuccessAt,status:success?(pages.some(p=>!['ok','empty'].includes(p.status))||geocodeErrors?'partial':'ok'):'failed',message:fallback&&success?'Kwik Trip only: limited brand coverage, not the countywide lowest. Regular-87 quotes from the 100 nearest Madison stores, filtered to Dane County using the provider county field. Times indicate retrieval; the provider does not supply price-change times. GasBuddy was unavailable.':fatal||(success?`GasBuddy: ${gasbuddy.inventoryCount} unique station listings checked across configured Dane-area communities, including all available pagination. ${unique.length} regular-price reports retrieved. Only recent Dane County matches are ranked; missing or outdated reports do not establish a current price.`:'No usable station prices were retrieved. Saved prices have not been marked fresh.'),geocodeErrors,pages,stations:merged};
await fs.mkdir(path.dirname(DATA),{recursive:true});
await fs.writeFile(DATA+'.tmp',JSON.stringify(result,null,2)+'\n');await fs.rename(DATA+'.tmp',DATA);
await fs.writeFile(CACHE,JSON.stringify(cache,null,2)+'\n');
console.log(result.message);
console.log(`Saved attempt: ${DATA}`);
for(const p of pages.filter(p=>p.status==='error'||p.status==='blocked'))console.error(`${p.town}: ${p.status}${p.error?': '+p.error:''}`);
console.log(`${result.status}: ${unique.length} new reports; ${unique.filter(s=>s.countyFips==='55025').length} county-verified.`);
if(!success||(process.argv.includes('--require-gasbuddy')&&(result.source!=='GasBuddy'||gasbuddy.pages.some(p=>!['ok','empty'].includes(p.status)))))process.exitCode=1;
