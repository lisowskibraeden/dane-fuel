import {openBrowser} from './browser.mjs';
import {SOURCE,TOWNS,mergeStations} from './core.mjs';
export function parseSearchStation(card,raw,observedAt){
 const id=card?.href?.match(/^\/station\/(\d+)$/)?.[1];
 if(!id||String(raw?.id)!==id||!card.name?.trim())return null;
 const lines=card.text.split('\n').map(x=>x.trim()).filter(Boolean);
 const i=lines.findIndex(x=>/^.+,\s*WI(?:\s|$)/i.test(x));
 if(i<1)return null;
 const grades=(raw.prices||[]).filter(x=>x.fuelProduct==='regular_gas');
 if(grades.length!==1)return null;
 const valid=p=>typeof p?.price==='number'&&Number.isFinite(p.price)&&p.price>=.5&&p.price<=20&&Number.isFinite(Date.parse(p.postedTime));
 const grade=grades[0],quote=valid(grade.credit)?grade.credit:valid(grade.cash)?grade.cash:null;
 if(!quote)return null;
 return {id,name:card.name.trim(),address:lines[i-1],city:lines[i].replace(/,\s*WI.*$/i,'').trim(),state:'WI',fuel:'regular',price:quote.price,reportedAt:new Date(quote.postedTime).toISOString(),observedAt,membership:/membership required|membership pricing/i.test(card.text)||/\bcostco\b|\bsam['’]?s club\b/i.test(card.name),payment:quote===grade.credit?'credit':'cash',cashQuote:valid(grade.cash)?{price:grade.cash.price,reportedAt:new Date(grade.cash.postedTime).toISOString()}:null,url:SOURCE+card.href,source:'GasBuddy'};
}
export function parseGraphqlStation(raw,observedAt){
 const a=raw?.address;
 if(!/^\d+$/.test(String(raw?.id))||typeof raw.name!=='string'||a?.region!=='WI'||!a.line1||!a.locality)return null;
 const station=parseSearchStation({href:`/station/${raw.id}`,name:raw.name,text:`${a.line1}\n${a.locality}, WI`},raw,observedAt);
 if(station&&/^\d{5}$/.test(a.postalCode||''))station.postalCode=a.postalCode;
 if(station&&raw.brands?.some(b=>/\bcostco\b|\bsam['’]?s club\b/i.test(b.name)))station.membership=true;
 return station;
}
export function moreCursor(connection,seenCount){
 const next=connection.cursor?.next;
 if(!next||next==='0'||!connection.results.length)return null;
 if(Number.isFinite(connection.count)&&seenCount>=connection.count)return null;
 // Follow the website's own numeric cursor/count convention.
 if(/^\d+$/.test(next)&&Number.isFinite(connection.count)&&Number(next)>=connection.count-1)return null;
 return next;
}
export function searchVariables(previous,{search,cursor}){
 const values={...previous,search,fuel:1};
 // An explicitly named area must not inherit a prior search's GPS or filters.
 for(const key of ['lat','lng','brandId','maxAge'])delete values[key];
 if(cursor===null||cursor===undefined)delete values.cursor;else values.cursor=cursor;
 return values;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function collectGasBuddy({towns=TOWNS,headless=true,channel,standardChrome=false,log=console.log}={}){
 const pages=[],stations=[],inventory=new Set();let session,fatal=null;
 try{
  session=await openBrowser({headless,channel,standardChrome});
  const {context}=session,page=await context.newPage();
  let csrf=null;const templates=new Map();
  page.on('request',r=>{
   if(new URL(r.url()).pathname!=='/graphql')return;
   if(r.headers().gbcsrf)csrf=r.headers().gbcsrf;
   try{const payload=r.postDataJSON();if(['SearchPrices','LocationBySearchTerm'].includes(payload?.operationName))templates.set(payload.operationName,payload)}catch{}
  });
  const ready=page.waitForResponse(r=>{
   try{return new URL(r.url()).pathname==='/graphql'&&r.request().postDataJSON()?.operationName==='SearchPrices'}catch{return false}
  },{timeout:25000}).catch(()=>null);
  const landing=`${SOURCE}/home?search=53703&fuel=1`;
  const entry=await page.goto(landing,{waitUntil:'domcontentloaded',timeout:30000});
  const initialPrices=await ready;
  if(!entry?.ok()||!initialPrices?.ok()||!csrf){
   const title=await page.title();pages.push({town:'GasBuddy search landing',url:landing,status:'blocked',httpStatus:entry?.status()??null,priceStatus:initialPrices?.status()??null,title,count:0});
   throw Error(`Search landing unavailable: page HTTP ${entry?.status()}, prices HTTP ${initialPrices?.status()??'none'}, ${title}`);
  }
  await initialPrices.finished();
  const warmup='Madison, WI';
  const metadataReady=page.waitForResponse(r=>{
   try{const p=r.request().postDataJSON();return new URL(r.url()).pathname==='/graphql'&&p?.operationName==='LocationBySearchTerm'&&p.variables?.search?.toLowerCase()===warmup.toLowerCase()}catch{return false}
  },{timeout:25000}).catch(()=>null);
  const reject=page.getByRole('button',{name:/^Reject All$/i});if(await reject.isVisible())await reject.click();
  await page.getByRole('searchbox',{name:'Search gas prices by city or zip code...'}).fill(warmup);
  await page.getByRole('button',{name:/^Find Gas$/i,exact:true}).click();
  const metadataResponse=await metadataReady;
  if(!metadataResponse?.ok()||!templates.has('LocationBySearchTerm')||!templates.has('SearchPrices'))throw Error('The normal website did not provide usable search request templates');
  await metadataResponse.finished();
  const request=async (operation,variables)=>{
   await pause(5000);
   const template=templates.get(operation),values=searchVariables(template.variables,variables);
   const payload={...template,variables:values};
   const call=()=>page.evaluate(async ({payload,csrf})=>{
    const r=await fetch('/graphql',{method:'POST',headers:{'Content-Type':'application/json','gbcsrf':csrf,'apollo-require-preflight':'true'},body:JSON.stringify(payload)});
    return {status:r.status,retryAfter:r.headers.get('retry-after'),json:await r.json().catch(()=>null)};
   },{payload,csrf});
   let result=await call();
   if(result.status===429){
    const header=result.retryAfter,seconds=header&&/^\d+$/.test(header)?Number(header):header?Math.max(0,(Date.parse(header)-Date.now())/1000):60;
    const wait=Math.max(60,Number.isFinite(seconds)?seconds:60);
    if(wait>120)throw Error(`Price service HTTP 429; requested cooldown ${wait}s exceeds this run's retry budget`);
    log(`Rate limited: honoring ${wait}s cooldown before one retry.`);
    await pause(wait*1000);result=await call();
   }
   if(result.status!==200){
    const detail=(result.json?.errors||[]).map(e=>e.message).join('; ').replaceAll(csrf,'[redacted]').slice(0,500);
    throw Error(`Price service HTTP ${result.status}${detail?': '+detail:''}`);
   }
   if(result.json?.errors?.length)throw Error(result.json.errors.map(e=>e.message).join('; '));
   if(result.json?.data?.locationBySearchTerm===null)return {count:0,cursor:{next:'0'},results:[]};
   const connection=result.json?.data?.locationBySearchTerm?.stations;
   if(!Array.isArray(connection?.results))throw Error('Price response has no station results');
   return {...connection,location:result.json.data.locationBySearchTerm.displayName,region:result.json.data.locationBySearchTerm.regionCode};
  };
  for(const town of towns){
   // GasBuddy resolves the state name before the Wisconsin village name.
   // Village ZIP: https://oregonwi.gov/31/Residents
   const search=town==='oregon'?'53575':town.replaceAll('-',' ')+', WI';
   const row={town,url:`${SOURCE}/home?${new URLSearchParams({search,fuel:'1'})}`,status:'ok',count:0,listed:0,rows:0,batches:0};pages.push(row);
   const seen=new Set(),cursors=new Set();let cursor=null;
   try{
    for(let batch=0;batch<30;batch++){
     const connection=await request('LocationBySearchTerm',{search,cursor});
     const prices=await request('SearchPrices',{search,cursor});
     const priceMap=new Map(prices.results.map(s=>[String(s.id),s.prices]));
     row.batches++;row.rows+=connection.results.length;row.expected=connection.count;row.sourceLocation=connection.location;row.sourceRegion=connection.region;
     if(connection.results.length&&connection.results.every(s=>s.address?.region&&s.address.region!=='WI'))throw Error('Named-area search resolved outside Wisconsin');
     const now=new Date().toISOString();
     for(const raw of connection.results){
      const id=String(raw.id);inventory.add(id);if(seen.has(id))continue;seen.add(id);row.listed++;
      const station=parseGraphqlStation({...raw,prices:priceMap.get(id)||[]},now);if(station){stations.push(station);row.count++}
     }
     const next=moreCursor(connection,seen.size);
     log(`${town} batch ${row.batches}: ${seen.size}/${connection.count} listings; ${row.count} regular reports; next ${next??'end'}`);
     if(!next){cursor=null;break}
     if(cursors.has(next)||next===cursor)throw Error('Repeated pagination cursor');cursors.add(next);cursor=next;
    }
    if(cursor)throw Error('Pagination exceeded 30 batches');
    if(!row.listed)row.status='empty';
   }catch(e){row.error=String(e.message).slice(0,250);log(`${town}: ${row.error}`);if(/Price service HTTP (400|401|403|429)/.test(row.error)){row.status='blocked';fatal=row.error;break}row.status='error'}
  }
 }catch(e){fatal=`GasBuddy collector failed: ${e.message}`}
 finally{try{await session?.close()}catch(e){log(`Browser cleanup warning: ${e.code||e.message}`)}}
 return {stations:mergeStations([],stations),pages,fatal,inventoryCount:inventory.size};
}
