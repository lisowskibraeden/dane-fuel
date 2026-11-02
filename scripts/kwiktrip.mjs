// Public, unauthenticated first-party location service. No publisher keys or cookies.
export const KWIK_API='https://api.kwiktrip.com/api';
export const KWIK_NEARBY=`${KWIK_API}/stores/nearby?latitude=43.0731&longitude=-89.4012&limit=100`;
export function fuelStores(payload){
 if(!Array.isArray(payload?.stores))throw Error('Kwik Trip discovery response has no stores array');
 return [...new Map(payload.stores.filter(s=>Number.isInteger(s.id)&&s.address?.state==='WI'&&s.address?.county?.trim().toUpperCase()==='DANE'&&s.properties?.some(p=>p.name==='GAS'&&p.hasProperty===true)).map(s=>[s.id,s])).values()];
}
export function parseKwikTrip(payload,id,observedAt){
 const a=payload?.address;
 if(payload?.storeNumber!==id||a?.state!=='WI'||a?.county?.trim().toUpperCase()!=='DANE'||!a.address1||!a.city||!Number.isFinite(Date.parse(observedAt)))return null;
 // E15/88, premium, diesel and unspecified unleaded must not become regular 87.
 const matches=(Array.isArray(payload.fuel)?payload.fuel:[]).filter(f=>/^UNLEADED 87(?:\s|$)/i.test(f.type||''));
 if(matches.length!==1)return null;
 const price=matches[0].currentPrice;
 if(typeof price!=='number'||!Number.isFinite(price)||price<.5||price>20)return null;
 return {id:`kwiktrip:${id}`,name:`Kwik Trip #${id}`,address:a.address1,city:a.city,state:'WI',fuel:'regular',price,reportedAt:null,observedAt,timeBasis:'retrieved',source:'Kwik Trip',membership:false,payment:'unspecified',url:`${KWIK_API}/location/store/information/${id}`,countyFips:'55025',countyVerifiedAt:observedAt,countyAuthority:'Kwik Trip county field'};
}
export async function collectKwikTrip({getJSON,log=console.log,pause=()=>new Promise(r=>setTimeout(r,300))}={}){
 const pages=[],stations=[];
 try{
  const stores=fuelStores(await getJSON(KWIK_NEARBY));
  pages.push({town:'Kwik Trip discovery (100 nearest Madison stores)',url:KWIK_NEARBY,status:stores.length?'ok':'no-reports',count:stores.length});
  for(const store of stores){
   const url=`${KWIK_API}/location/store/information/${store.id}`;
   try{
    const station=parseKwikTrip(await getJSON(url),store.id,new Date().toISOString());
    if(station)stations.push(station);
    pages.push({town:`Kwik Trip #${store.id}`,url,status:station?'ok':'no-reports',count:station?1:0});
   }catch(e){pages.push({town:`Kwik Trip #${store.id}`,url,status:'error',count:0,error:e.message.slice(0,250)})}
   await pause();
  }
 }catch(e){pages.push({town:'Kwik Trip discovery',url:KWIK_NEARBY,status:'error',count:0,error:e.message.slice(0,250)})}
 log(`Kwik Trip: ${stations.length} regular-87 quotes from Dane County stores.`);
 return {stations,pages};
}
