import {chromium} from 'playwright';
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
 return {id,name:card.name.trim(),address:lines[i-1],city:lines[i].replace(/,\s*WI.*$/i,'').trim(),state:'WI',fuel:'regular',price:quote.price,reportedAt:new Date(quote.postedTime).toISOString(),observedAt,membership:/membership required|membership pricing|\bcostco\b|\bsam['’]?s club\b/i.test(card.text+' '+card.name),payment:quote===grade.credit?'credit':'cash',url:SOURCE+card.href,source:'GasBuddy'};
}
async function cardsOnPage(page){
 return page.locator('a[href^="/station/"]').evaluateAll(links=>{
  const out=[],seen=new Set();
  for(const link of links){
   const href=link.getAttribute('href');if(!/^\/station\/\d+$/.test(href||'')||seen.has(href))continue;
   let el=link.parentElement,best=null;
   while(el&&el!==document.body){
    const ids=new Set([...el.querySelectorAll('a[href^="/station/"]')].map(a=>a.getAttribute('href')));
    if(ids.size>1)break;
    if(/^.+,\s*WI(?:\s|$)/im.test(el.innerText))best=el;
    el=el.parentElement;
   }
   if(best){seen.add(href);out.push({href,name:link.innerText,text:best.innerText})}
  }
  return out;
 });
}
const priceResponse=page=>page.waitForResponse(r=>{
 if(new URL(r.url()).pathname!=='/graphql')return false;
 try{return r.request().postDataJSON()?.operationName==='SearchPrices'}catch{return false}
},{timeout:25000}).catch(()=>null);
export async function collectGasBuddy({towns=TOWNS,headless=true,channel,log=console.log}={}){
 const pages=[],stations=[],inventory=new Set();let browser,fatal=null;
 try{
  browser=await chromium.launch({headless,...(channel?{channel}:{})});
  const context=await browser.newContext({locale:'en-US'}),page=await context.newPage();
  for(const town of towns){
   const search=town.replaceAll('-',' ')+', WI';
   const url=`${SOURCE}/home?${new URLSearchParams({search,fuel:'1',method:'all',maxAge:'0'})}`;
   const row={town,url,status:'ok',count:0,listed:0,batches:0};pages.push(row);
   try{
    let waiting=priceResponse(page);
    const navigation=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    // Give a standard browser's normal page loading time to complete; no challenge interaction.
    let response=await waiting;
    if(!navigation?.ok()||!response){
     const title=await page.title();row.httpStatus=navigation?.status()??null;row.title=title;
     if([401,403,429].includes(navigation?.status())||/just a moment|access denied|captcha|attention required/i.test(title)){
      row.status='blocked';fatal=`GasBuddy access blocked: HTTP ${row.httpStatus}, ${title}.`;break;
     }
     throw Error(`No website price response (page HTTP ${row.httpStatus})`);
    }
    const cursors=new Set();let complete=false;
    for(let batch=0;batch<30;batch++){
     if(!response.ok())throw Error(`Price service HTTP ${response.status()}`);
     const json=await response.json();if(json.errors?.length)throw Error(json.errors.map(e=>e.message).join('; '));
     const connection=json.data?.locationBySearchTerm?.stations;
     if(!Array.isArray(connection?.results))throw Error('Price response has no station results');
     row.batches++;row.expected=connection.count;
     const results=connection.results;
     if(results.length){
      const href=`/station/${results[0].id}`;
      await page.locator(`a[href="${href}"]`).first().waitFor({state:'attached',timeout:15000});
     }
     const cards=new Map((await cardsOnPage(page)).map(c=>[c.href.split('/').at(-1),c]));
     const now=new Date().toISOString();
     for(const raw of results){
      inventory.add(String(raw.id));row.listed++;
      const station=parseSearchStation(cards.get(String(raw.id)),raw,now);
      if(station){stations.push(station);row.count++}
      else if(!cards.has(String(raw.id))){row.status='partial';row.error='Some price responses had no matching rendered station card'}
     }
     const next=connection.cursor?.next;
     if(!next||next==='0'||results.length===0){complete=true;break}
     if(cursors.has(next))throw Error('Repeated pagination cursor');cursors.add(next);
     const more=page.getByRole('button',{name:/^More .* Gas Prices$/i});
     if(!await more.count())throw Error('Pagination button missing before final cursor');
     await new Promise(r=>setTimeout(r,1500));
     waiting=priceResponse(page);await more.click();response=await waiting;
     if(!response)throw Error('Pagination returned no price response');
    }
    if(!complete)throw Error('Pagination exceeded 30 batches');
    if(!row.listed)row.status='empty';
    log(`${town}: ${row.count} regular reports, ${row.listed} listings in ${row.batches} batches`);
   }catch(e){row.status='error';row.error=String(e.message).slice(0,250);log(`${town}: ${row.error}`)}
   await new Promise(r=>setTimeout(r,1500));
  }
 }catch(e){fatal=`GasBuddy collector failed: ${e.message}`}
 finally{await browser?.close()}
 return {stations:mergeStations([],stations),pages,fatal,inventoryCount:inventory.size};
}
