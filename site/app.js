import {eligibleStations} from './model.js';
import {calculateMinimum} from './minimum.js';
const $=id=>document.getElementById(id);
let data=null,prompt=null;
const fmt=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
const age=t=>{const h=Math.max(0,(Date.now()-Date.parse(t))/3600e3);return h<1?`${Math.max(1,Math.round(h*60))} min ago`:`${Math.floor(h)}h ago`};
const terms=s=>[s.membership?'Membership required':null,s.payment==='cash'?'Cash price':s.payment==='credit'?'Credit price':null].filter(Boolean).join(' · ');
const notice=s=>{$('notice').hidden=!s;$('notice').textContent=s||''};
const brandLogo=name=>{const n=name.toLowerCase();return /kwik trip/.test(n)?'kwik-trip.svg':/woodman/.test(n)?'woodmans.png':/amoco/.test(n)?'amoco.png':/citgo/.test(n)?'citgo.png':/costco/.test(n)?'costco.svg':null};
function render(){
 if(!data)return;
 const eligible=eligibleStations(data.stations||[],{maxAge:Number($('age').value),members:$('members').checked,cash:$('cash').checked});
 $('update-time').textContent=data.lastSuccessAt?`Retrieved ${fmt(data.lastSuccessAt)}`:'No successful station update yet';
 $('update-detail').textContent=data.attemptedAt?`Attempted ${fmt(data.attemptedAt)}`:'';
 if(data.status==='failed')notice('Station update failed. Original report times are preserved.');
 else if(data.lastSuccessAt&&Date.now()-Date.parse(data.lastSuccessAt)>2*3600e3)notice('Station updates are behind. Check report times.');
 else if(data.status==='partial')notice('Partial coverage · some listings or county checks were unavailable.');
 else if(data.status==='not-run')notice('Waiting for the first station update.');else notice('');
 $('result-count').textContent=`${eligible.length} report${eligible.length===1?'':'s'}`;
 const list=$('station-list');list.replaceChildren();
 for(const [index,station] of eligible.entries()){
  const row=document.createElement('article');row.className='station';
  const mark=document.createElement('div');mark.className='station-logo';const logo=brandLogo(station.name);
  const fallback=document.createElement('span');fallback.textContent=station.name.charAt(0);fallback.setAttribute('aria-hidden','true');mark.append(fallback);
  if(logo){const image=document.createElement('img');image.src=`./assets/logos/${logo}`;image.alt='';image.loading='lazy';image.addEventListener('load',()=>fallback.hidden=true);image.addEventListener('error',()=>image.remove());mark.append(image)}
  const info=document.createElement('div');info.className='station-info';const title=document.createElement('a');title.textContent=station.name;title.href=safeSource(station.url);title.target='_blank';title.rel='noreferrer';info.append(title);
  const address=document.createElement('p');address.textContent=`${station.address}, ${station.city}`;info.append(address);
  const meta=document.createElement('small');meta.textContent=[age(station.reportedAt),terms(station)].filter(Boolean).join(' · ');info.append(meta);
  const price=document.createElement('strong');price.textContent=`$${station.price.toFixed(3)}`;if(index===0)price.className='lowest';row.append(mark,info,price);list.append(row);
 }
 $('empty').hidden=eligible.length>0;
 const pages=data.pages||[];$('coverage').textContent=`${pages.filter(p=>p.status==='ok').length} community lists returned prices; ${pages.filter(p=>p.status!=='ok').length} were empty, blocked or unavailable. ${(data.stations||[]).filter(s=>s.countyFips!=='55025').length} saved reports are outside the county or not county-verified.`;
 $('collector-message').textContent=data.message||'';
}
function safeSource(url){try{const u=new URL(url);if(u.origin==='https://www.gasbuddy.com'&&/^\/station\/\d+$/.test(u.pathname))return u.href}catch{}return 'https://www.gasbuddy.com/gasprices/wisconsin/madison'}
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
 $('minimum-price').replaceChildren(document.createTextNode(result.errors.length?'—':`$${result.price.toFixed(3)}`));const unit=document.createElement('small');unit.textContent=' / gal';$('minimum-price').append(unit);
 $('minimum-context').textContent=result.errors.length?'Enter retailer costs to calculate.':`For ${input.saleDate} · ${result.basis}`;
 $('edit-costs').textContent=result.errors.length?'Set cost inputs ↓':'Edit cost inputs ↓';
 $('minimum-error').hidden=!showErrors||!result.errors.length;$('minimum-error').textContent=result.errors.join(' ');
 $('minimum-breakdown').textContent=result.errors.length?'':`Terminal branch: $${result.terminal.toFixed(4)} · Invoice/replacement branch: $${result.retailer.toFixed(4)}. Higher amount used; rounded upward to the next tenth of a cent.`;
 return result;
}
$('saleDate').value=today();
try{const settings=JSON.parse(localStorage.getItem('dane-fuel-settings')||'{}');if(['6','12','24'].includes(settings.age))$('age').value=settings.age;$('members').checked=settings.members===true;$('cash').checked=settings.cash===true;const costs=JSON.parse(localStorage.getItem('dane-fuel-costs')||'null');if(costs)for(const f of fields)if(typeof costs[f]==='string')$(f).value=costs[f]}catch{}
for(const id of ['age','members','cash'])$(id).addEventListener('change',()=>{render();try{localStorage.setItem('dane-fuel-settings',JSON.stringify({age:$('age').value,members:$('members').checked,cash:$('cash').checked}))}catch{}});
$('refresh').addEventListener('click',refresh);
$('minimum-form').addEventListener('submit',e=>{e.preventDefault();const r=renderMinimum(true);if(!r.errors.length){try{localStorage.setItem('dane-fuel-costs',JSON.stringify(costInputs()))}catch{}$('cost-inputs').open=false;$('minimum-price').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}});
$('edit-costs').addEventListener('click',()=>$('cost-inputs').open=true);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e});
$('install').addEventListener('click',async()=>{if(prompt){await prompt.prompt();prompt=null}else $('install-help').hidden=!$('install-help').hidden});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderMinimum();refresh();setInterval(render,60000);setInterval(refresh,15*60000);
