import {eligibleStations} from './model.js';
const $=id=>document.getElementById(id);
let data=null,prompt=null;
const fmt=t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
const age=t=>{const h=Math.max(0,(Date.now()-Date.parse(t))/3600e3);return h<1?`${Math.max(1,Math.round(h*60))} min ago`:`${Math.floor(h)}h ago`};
const terms=s=>[s.membership?'Membership required':'No membership indicated',s.payment==='cash'?'Cash price':s.payment==='credit'?'Credit price':'Cash/credit not specified'].join(' · ');
const notice=(s)=>{$('notice').hidden=!s;$('notice').textContent=s||''};
function render(){
 if(!data)return;
 const eligible=eligibleStations(data.stations||[],{maxAge:Number($('age').value),members:$('members').checked,cash:$('cash').checked});
 const best=eligible[0];
 $('best-price').replaceChildren(document.createTextNode(best?`$${best.price.toFixed(3)}`:'—'));
 const unit=document.createElement('small');unit.textContent=' / gal';$('best-price').append(unit);
 $('best-name').textContent=best?best.name:'No recent eligible reports';
 $('best-address').textContent=best?`${best.address}, ${best.city}`:'Try a wider age range or check the source listings.';
 $('report-age').textContent=best?age(best.reportedAt):'No report';
 $('best-terms').textContent=best?terms(best):'Prices will appear after a successful update';
 $('best-link').hidden=!best;if(best)$('best-link').href=safeSource(best.url);
 $('update-time').textContent=data.lastSuccessAt?`Last retrieval · ${fmt(data.lastSuccessAt)}`:'No successful retrieval yet';
 $('update-detail').textContent=data.attemptedAt?`Last attempt · ${fmt(data.attemptedAt)}`:'Hourly updater is ready to be enabled in GitHub.';
 if(data.status==='failed')notice('The last update failed. Any prices shown retain their original report times.');
 else if(data.lastSuccessAt&&Date.now()-Date.parse(data.lastSuccessAt)>2*3600e3)notice('Updates are behind. Check each report time before heading out.');
 else if(data.status==='partial')notice('Partial coverage · some community listings or county checks were unavailable.');
 else if(data.status==='not-run')notice('Waiting for the first update. No current prices are being claimed.');else notice('');
 $('result-count').textContent=`${eligible.length} recent report${eligible.length===1?'':'s'}`;
 const list=$('station-list');list.replaceChildren();
 for(const station of eligible.slice(1)){
  const row=document.createElement('article');row.className='station';
  const info=document.createElement('div');const title=document.createElement('a');title.textContent=station.name;title.href=safeSource(station.url);title.target='_blank';title.rel='noreferrer';info.append(title);
  const address=document.createElement('p');address.textContent=`${station.address}, ${station.city}`;info.append(address);
  const meta=document.createElement('small');meta.textContent=`${age(station.reportedAt)} · ${terms(station)}`;info.append(meta);
  const price=document.createElement('strong');price.textContent=`$${station.price.toFixed(3)}`;row.append(info,price);list.append(row);
 }
 $('empty').hidden=eligible.length>0;
 const pages=data.pages||[];$('coverage').textContent=`${pages.filter(p=>p.status==='ok').length} community lists returned prices; ${pages.filter(p=>p.status!=='ok').length} were empty, blocked or unavailable. ${data.stations.filter(s=>s.countyFips!=='55025').length} saved reports are outside the county or not county-verified.`;
 $('collector-message').textContent=data.message||'';
}
function safeSource(url){try{const u=new URL(url);if(u.origin==='https://www.gasbuddy.com'&&/^\/station\/\d+$/.test(u.pathname))return u.href}catch{}return 'https://www.gasbuddy.com/gasprices/wisconsin/madison'}
async function refresh(){
 $('refresh').disabled=true;
 try{const r=await fetch(`./data/prices.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error();const next=await r.json();if(next.schemaVersion!==1||!Array.isArray(next.stations))throw Error();data=next;render()}
 catch{notice('Could not load price data. Check your connection and try again. Saved report times have not changed.')}
 finally{$('refresh').disabled=false}
}
try{const settings=JSON.parse(localStorage.getItem('dane-fuel-settings')||'{}');if(['6','12','24'].includes(settings.age))$('age').value=settings.age;$('members').checked=settings.members===true;$('cash').checked=settings.cash===true}catch{}
for(const id of ['age','members','cash'])$(id).addEventListener('change',()=>{render();try{localStorage.setItem('dane-fuel-settings',JSON.stringify({age:$('age').value,members:$('members').checked,cash:$('cash').checked}))}catch{}});
$('refresh').addEventListener('click',refresh);
$('estimate-form').addEventListener('submit',e=>{e.preventDefault();const wholesale=Number($('wholesale').value),delivery=Number($('delivery').value);if(!Number.isFinite(wholesale)||wholesale<=0||wholesale>20||!Number.isFinite(delivery)||delivery<0||delivery>100)return;const base=wholesale+.184+.329+delivery/100;const total=base*1.0918;$('estimate-output').hidden=false;$('estimate-output').replaceChildren();const price=document.createElement('strong');price.textContent=`$${(Math.ceil((total-1e-10)*1000)/1000).toFixed(3)} / gal`;const sub=document.createElement('span');sub.textContent=`Price including markup · ${(base*.0918*100).toFixed(2)}¢ markup included`;$('estimate-output').append(price,sub)});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e});
$('install').addEventListener('click',async()=>{if(prompt){await prompt.prompt();prompt=null}else $('install-help').hidden=!$('install-help').hidden});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
refresh();setInterval(render,60000);setInterval(refresh,15*60000);
