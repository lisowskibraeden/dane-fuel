import {eligibleStations,stationTime} from './model.js';
import {calculateMinimum} from './minimum.js';
import {terminalEstimate} from './terminal.js';
const $=id=>document.getElementById(id);
let data=null,terminalReport=null;
const fmt=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
const age=t=>{const h=Math.max(0,(Date.now()-Date.parse(t))/3600e3);return h<1?`${Math.max(1,Math.round(h*60))} min ago`:`${Math.floor(h)}h ago`};
const terms=s=>[s.membership?'Membership required':null,s.payment==='cash'?'Cash price':s.payment==='credit'?'Credit price':null].filter(Boolean).join(' · ');
const notice=s=>{$('notice').hidden=!s;$('notice').textContent=s||''};
const brandLogo=name=>{const n=name.toLowerCase();return /kwik trip/.test(n)?'kwik-trip.svg':/\bshell\b/.test(n)?'shell.png':/\bbp\b/.test(n)?'bp.png':/\bmobil\b/.test(n)?'mobil.png':/casey/.test(n)?'caseys.png':/woodman/.test(n)?'woodmans.png':/amoco/.test(n)?'amoco.png':/citgo/.test(n)?'citgo.png':/costco/.test(n)?'costco.svg':null};
function render(){
 if(!data)return;
 const eligible=eligibleStations(data.stations||[],{maxAge:Number($('age').value),members:$('members').checked,cash:$('cash').checked});
 $('update-time').textContent=data.lastSuccessAt?`${data.source==='Kwik Trip'?'Kwik Trip only · ':''}Retrieved ${fmt(data.lastSuccessAt)}`:'No successful station update yet';
 $('update-detail').textContent=data.attemptedAt?`Attempted ${fmt(data.attemptedAt)}`:'';
 if(data.status==='failed')notice('Station update failed. Saved price timestamps are preserved.');
 else if(data.lastSuccessAt&&Date.now()-Date.parse(data.lastSuccessAt)>26*3600e3)notice('Station updates are behind. Check report times.');
 else if(data.status==='partial')notice(data.source==='Kwik Trip'?'Kwik Trip only · limited coverage. Lowest among listed stations.':'Partial coverage · some listings or county checks were unavailable.');
 else if(data.status==='not-run')notice('Waiting for the first station update.');else notice('');
 $('result-count').textContent=`${eligible.length} price${eligible.length===1?'':'s'}`;
 const list=$('station-list');list.replaceChildren();
 for(const [index,station] of eligible.entries()){
  const row=document.createElement('article');row.className='station';
  const mark=document.createElement('div');mark.className='station-logo';const logo=brandLogo(station.name);
  const fallback=document.createElement('span');fallback.textContent=station.name.charAt(0);fallback.setAttribute('aria-hidden','true');mark.append(fallback);
  if(logo){const image=document.createElement('img');image.src=`./assets/logos/${logo}`;image.alt='';image.loading='lazy';image.addEventListener('load',()=>fallback.hidden=true);image.addEventListener('error',()=>image.remove());mark.append(image)}
  const info=document.createElement('div');info.className='station-info';const title=document.createElement('a');title.textContent=station.name;title.href=safeSource(station.url);title.target='_blank';title.rel='noreferrer';info.append(title);
  const address=document.createElement('p');address.textContent=`${station.address}, ${station.city}`;info.append(address);
  const meta=document.createElement('small');meta.textContent=[`${station.timeBasis==='retrieved'?'Fetched ':''}${age(stationTime(station))}`,terms(station),station.source].filter(Boolean).join(' · ');info.append(meta);
  const price=document.createElement('strong');price.textContent=`$${station.price.toFixed(3)}`;if(index===0)price.className='lowest';row.append(mark,info,price);list.append(row);
 }
 $('empty').hidden=eligible.length>0;
 $('source-label').textContent=`Station prices: ${data.source||'GasBuddy'}. Logos identify their respective brands; no affiliation.`;
 const pages=data.pages||[];$('coverage').textContent=data.source==='GasBuddy'&&Number.isInteger(data.inventoryCount)?`${data.inventoryCount} unique station listings checked across ${pages.length} Dane-area searches, with pagination. ${(data.stations||[]).filter(s=>s.countyFips==='55025').length} saved regular-price reports match Dane County. Missing and outdated reports are excluded from the ranking.`:data.source==='Kwik Trip'?'Kwik Trip only. Discovery checks the 100 nearest stores to Madison and selects fuel stores whose official county field is Dane, Wisconsin. Other brands are not included. Retrieval time is shown; the provider does not supply the price-change time.':`${pages.filter(p=>p.status==='ok').length} community lists returned prices; ${pages.filter(p=>p.status!=='ok').length} were empty, blocked or unavailable. ${(data.stations||[]).filter(s=>s.countyFips!=='55025').length} saved reports are outside the county or not county-verified.`;
 $('collector-message').textContent=data.message||'';
}
function safeSource(url){try{const u=new URL(url);if(u.origin==='https://api.kwiktrip.com'&&/^\/api\/location\/store\/information\/\d+$/.test(u.pathname))return u.href;if(u.origin==='https://www.gasbuddy.com'&&/^\/station\/\d+$/.test(u.pathname))return u.href}catch{}return 'https://www.gasbuddy.com/gasprices/wisconsin/madison'}
async function refresh(){
 $('refresh').disabled=true;
 try{const r=await fetch(`./data/prices.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error();const next=await r.json();if(next.schemaVersion!==1||!Array.isArray(next.stations))throw Error();data=next;render()}
 catch{notice('Could not load station data. Try refreshing.')}
 finally{$('refresh').disabled=false}
}
const fields=['saleDate','purchaseDate','terminalPrior','terminalPurchase','invoice','replacement','sellerType'];
const costInputs=()=>Object.fromEntries(fields.map(id=>[id,$(id).value]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function renderMinimum(showErrors=false){
 const input=costInputs(),result=calculateMinimum(input);
 const estimate=terminalEstimate(terminalReport);
 const manual=!result.errors.length;
 const value=manual?result.price:estimate?.price;
 $('minimum-title').textContent=manual?'Calculated minimum price':'Estimated minimum price';
 $('minimum-price').replaceChildren(document.createTextNode(value===undefined?'—':`$${value.toFixed(3)}`));const unit=document.createElement('small');unit.textContent=' / gal';$('minimum-price').append(unit);
 $('minimum-context').textContent=manual?`For ${input.saleDate} · ${result.basis}`:estimate?`Madison · ULC10 · Report ${terminalReport.reportDate} ${terminalReport.reportTime}`:'Terminal report unavailable. Enter costs below.';
 $('minimum-basis').textContent=manual?'Standard Wisconsin calculation':'Terminal estimate · includes 9.18% markup';
 $('minimum-note').textContent=manual?'Calculated from your inputs. Costs vary by retailer; exceptions can permit lower prices.':'Includes taxes and assumed 2.5¢ delivery before markup. Actual legal minimum varies by retailer.';
 $('estimate-breakdown').textContent=estimate?`AXXIS Madison ULC10 $${estimate.wholesale.toFixed(4)} + federal tax $0.184 + Wisconsin fuel tax $0.309 + inspection fee $0.020 + assumed delivery $${estimate.delivery.toFixed(3)} = $${estimate.base.toFixed(4)}. Multiply by 1.0918 = $${estimate.raw.toFixed(7)}; displayed upward to the next tenth of a cent: $${estimate.price.toFixed(3)}/gal. Report ${terminalReport.reportDate} ${terminalReport.reportTime}; retrieved ${fmt(terminalReport.retrievedAt)}.${terminalReport.lastError?' Last update failed; showing saved report.':''}`:'No terminal report is available.';
 $('edit-costs').textContent=result.errors.length?'Set cost inputs ↓':'Edit cost inputs ↓';
 $('minimum-error').hidden=!showErrors||!result.errors.length;$('minimum-error').textContent=result.errors.join(' ');
 $('minimum-breakdown').textContent=result.errors.length?'':`Terminal branch: $${result.terminal.toFixed(4)} · Invoice/replacement branch: $${result.retailer.toFixed(4)}. Higher amount used; rounded upward to the next tenth of a cent.`;
 return result;
}
$('saleDate').value=today();
try{const settings=JSON.parse(localStorage.getItem('dane-fuel-settings')||'{}');if(['6','12','24'].includes(settings.age))$('age').value=settings.age;$('members').checked=settings.version===2?settings.members!==false:true;$('cash').checked=settings.cash===true;const costs=JSON.parse(localStorage.getItem('dane-fuel-costs')||'null');if(costs)for(const f of fields)if(typeof costs[f]==='string')$(f).value=costs[f]}catch{}
for(const id of ['age','members','cash'])$(id).addEventListener('change',()=>{render();try{localStorage.setItem('dane-fuel-settings',JSON.stringify({version:2,age:$('age').value,members:$('members').checked,cash:$('cash').checked}))}catch{}});
$('refresh').addEventListener('click',()=>{refresh();refreshMinimum()});
$('minimum-form').addEventListener('submit',e=>{e.preventDefault();const r=renderMinimum(true);if(!r.errors.length){try{localStorage.setItem('dane-fuel-costs',JSON.stringify(costInputs()))}catch{}$('cost-inputs').open=false;$('minimum-price').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}});
$('edit-costs').addEventListener('click',()=>$('cost-inputs').open=true);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
async function refreshMinimum(){try{const r=await fetch(`./data/terminal.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error();terminalReport=await r.json()}catch{}renderMinimum()}
renderMinimum();refresh();refreshMinimum();setInterval(render,60000);setInterval(()=>{refresh();refreshMinimum()},15*60000);
