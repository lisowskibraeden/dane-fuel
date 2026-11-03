export const SOURCE = 'https://www.gasbuddy.com';
export const TOWNS = ['madison','dane-county','black-earth','blue-mounds','cottage-grove','cross-plains','dane','deforest','deerfield','fitchburg','marshall','mazomanie','mcfarland','middleton','monona','mount-horeb','oregon','rockdale','stoughton','sun-prairie','verona','waunakee','windsor','belleville','brooklyn','cambridge','maple-bluff','shorewood-hills','westport','token-creek'];
export const MAX_REPORT_AGE_HOURS = 24;
export function reportTime(text, now = Date.now()) {
  if (/just now|moments? ago/i.test(text)) return new Date(now).toISOString();
  const m = text.match(/(\d+)\s*(minute|hour|day|week)s?\s+ago/i);
  if (!m) return null;
  const unit = {minute:60e3,hour:3600e3,day:86400e3,week:604800e3}[m[2].toLowerCase()];
  return new Date(now - Number(m[1])*unit).toISOString();
}
export function parseCard(card, observedAt = new Date().toISOString()) {
  const match = card.href?.match(/^\/station\/(\d+)$/);
  if (!match || !card.name?.trim()) return null;
  const lines = card.text.split('\n').map(s=>s.trim()).filter(Boolean);
  const cityIndex = lines.findIndex(s=>/^.+,\s*WI(?:\s|$)/i.test(s));
  if (cityIndex < 1) return null;
  const city = lines[cityIndex].replace(/,\s*WI.*$/i,'').trim();
  // Read only the price-report section, never prices mentioned in reviews.
  const head = lines.slice(0, lines.findIndex(s=>/^Amenities$/i.test(s)) < 0 ? lines.length : lines.findIndex(s=>/^Amenities$/i.test(s))).join('\n');
  const price = head.match(/\$(\d{1,2}\.\d{2,3})(?!\d)/);
  const time = head.match(/(?:\d+\s+(?:minutes?|hours?|days?|weeks?)\s+ago|just now|moments? ago)/i)?.[0];
  if (!price || !time) return null;
  const amount=Number(price[1]);
  if(amount<.5||amount>20) return null;
  const reportedAt=reportTime(time,Date.parse(observedAt));
  if(!reportedAt) return null;
  const membership=/membership required|membership pricing/i.test(card.text);
  const payment=/\bcash\b/i.test(head)?'cash':/\bcredit\b/i.test(head)?'credit':'unspecified';
  return {id:match[1],name:card.name.trim(),address:lines[cityIndex-1],city,state:'WI',fuel:'regular',price:amount,reportedAt,reportAgeLabel:time,observedAt,membership,payment,url:SOURCE+card.href};
}
// Official quotes have retrieval times, not invented price-change/report times.
export const stationTime=s=>s.timeBasis==='retrieved'?s.observedAt:s.reportedAt;
export function mergeStations(oldStations, newStations) {
  const map=new Map(oldStations.map(s=>[s.id,s]));
  for(const s of newStations){const old=map.get(s.id);if(!old||Date.parse(stationTime(s))>=Date.parse(stationTime(old)))map.set(s.id,s)}
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export const brandPriority=name=>/costco/i.test(name)?0:/woodman/i.test(name)?1:/kwik trip/i.test(name)?2:3;
export function eligibleStations(stations,{now=Date.now(),maxAge=24,members=true,cash=false}={}) {
  const fresh=(price,time)=>Number.isFinite(price)&&price>0&&Date.parse(time)<=now+300000&&now-Date.parse(time)<=maxAge*3600e3;
  const selected=stations.map(s=>cash&&s.cashQuote&&fresh(s.cashQuote.price,s.cashQuote.reportedAt)&&(!fresh(s.price,stationTime(s))||s.cashQuote.price<s.price)?{...s,price:s.cashQuote.price,reportedAt:s.cashQuote.reportedAt,timeBasis:'reported',payment:'cash'}:s);
  return selected.filter(s=>s.countyFips==='55025' && s.fuel==='regular' && Number.isFinite(s.price) && s.price>0 && Date.parse(stationTime(s))<=now+300000 && now-Date.parse(stationTime(s))<=maxAge*3600e3 && (members||!s.membership) && (cash||s.payment!=='cash')).sort((a,b)=>a.price-b.price||brandPriority(a.name)-brandPriority(b.name)||Date.parse(stationTime(b))-Date.parse(stationTime(a))||a.name.localeCompare(b.name));
}
export function censusMatch(payload) {
  const matches=payload?.result?.addressMatches;
  if(!Array.isArray(matches)||matches.length!==1) return null;
  const counties=matches[0]?.geographies?.Counties;
  if(!Array.isArray(counties)||counties.length!==1) return null;
  return {countyFips:counties[0].GEOID,matchedAddress:matches[0].matchedAddress,coordinates:matches[0].coordinates};
}
