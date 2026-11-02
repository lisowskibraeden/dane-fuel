export const SOURCE = 'https://www.gasbuddy.com';
export const TOWNS = ['madison','black-earth','blue-mounds','cottage-grove','cross-plains','dane','deforest','deerfield','fitchburg','marshall','mazomanie','mcfarland','middleton','monona','mount-horeb','oregon','rockdale','stoughton','sun-prairie','verona','waunakee','windsor','belleville','brooklyn','cambridge','maple-bluff','shorewood-hills','westport','token-creek'];
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
export function mergeStations(oldStations, newStations) {
  const map=new Map(oldStations.map(s=>[s.id,s]));
  for(const s of newStations){const old=map.get(s.id);if(!old||Date.parse(s.reportedAt)>=Date.parse(old.reportedAt))map.set(s.id,s)}
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function eligibleStations(stations,{now=Date.now(),maxAge=24,members=false,cash=false}={}) {
  return stations.filter(s=>s.countyFips==='55025' && s.fuel==='regular' && Number.isFinite(s.price) && s.price>0 && Date.parse(s.reportedAt)<=now+300000 && now-Date.parse(s.reportedAt)<=maxAge*3600e3 && (members||!s.membership) && (cash||s.payment!=='cash')).sort((a,b)=>a.price-b.price||Date.parse(b.reportedAt)-Date.parse(a.reportedAt)||a.name.localeCompare(b.name));
}
export function censusMatch(payload) {
  const matches=payload?.result?.addressMatches;
  if(!Array.isArray(matches)||matches.length!==1) return null;
  const counties=matches[0]?.geographies?.Counties;
  if(!Array.isArray(counties)||counties.length!==1) return null;
  return {countyFips:counties[0].GEOID,matchedAddress:matches[0].matchedAddress,coordinates:matches[0].coordinates};
}
