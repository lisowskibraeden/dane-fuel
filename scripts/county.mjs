export const DANE_ADDRESSES='https://dcimapapps.danecounty.gov/arcgissrv/rest/services/Addressing/MapServer/0';
const words={N:'NORTH',S:'SOUTH',E:'EAST',W:'WEST',NE:'NORTHEAST',NW:'NORTHWEST',SE:'SOUTHEAST',SW:'SOUTHWEST',ST:'STREET',RD:'ROAD',AVE:'AVENUE',AV:'AVENUE',DR:'DRIVE',LN:'LANE',CT:'COURT',BLVD:'BOULEVARD',PKWY:'PARKWAY',PL:'PLACE',HWY:'HIGHWAY',CR:'COUNTYTRUNK',CTH:'COUNTYTRUNK'};
export function normalizedStreet(value){
 return String(value||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).map(w=>words[w]||w).join(' ').replace(/COUNTY (?:ROAD|HIGHWAY)/g,'COUNTYTRUNK').replace(/\s/g,'');
}
const city=value=>String(value||'').toUpperCase().replace(/^(?:CITY|VILLAGE|TOWN) OF /,'').replace(/[^A-Z0-9]/g,'');
export function matchDaneAddress(station,payload){
 const m=station.address?.match(/^(\d+)\s+(.+)$/);if(!m||station.state!=='WI'||payload?.error||!Array.isArray(payload?.features)||payload.exceededTransferLimit)return null;
 const postal=/^\d{5}$/.test(station.postalCode||'')?station.postalCode:null;
 const candidates=payload.features.map(f=>f.attributes).filter(a=>a&&Number(a.HouseNum)===Number(m[1])&&a.FIPsStateCode==='55'&&a.FIPsCountyCode==='025'&&normalizedStreet(a.fullStreetName)===normalizedStreet(m[2])&&(postal?a.ZIPCode===postal:(city(a.ZipMunicipality)===city(station.city)||city(a.FIPsMunicipality)===city(station.city))));
 if(!candidates.length)return null;
 const a=candidates[0];
 return {countyFips:'55025',countyAuthority:'Dane County public address data',countySource:DANE_ADDRESSES,matchedAddress:`${a.HouseNum} ${a.fullStreetName}, ${a.ZipMunicipality}, WI ${a.ZIPCode}`};
}
export async function countyAddressMatch(station,getJSON){
 const m=station.address?.match(/^(\d+)\s+(.+)$/);if(!m||station.state!=='WI')return null;
 const u=new URL(DANE_ADDRESSES+'/query');
 // Only public address/county fields are requested, never property-owner fields.
 const where=`HouseNum=${Number(m[1])}`+(/^\d{5}$/.test(station.postalCode||'')?` AND ZIPCode='${station.postalCode}'`:'');
 u.search=new URLSearchParams({where,outFields:'HouseNum,fullStreetName,ZIPCode,ZipMunicipality,FIPsMunicipality,FIPsCountyCode,FIPsStateCode',returnGeometry:'false',f:'json',resultRecordCount:'2000'});
 return matchDaneAddress(station,await getJSON(u));
}
