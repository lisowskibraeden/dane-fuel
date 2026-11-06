import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
// Separate UTC cron entries identify the intended slot even if GitHub starts late.
const localParts=date=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
export function catchupMode({now=new Date(),prices=null,terminal=null}={}){
 const local=localParts(now),today=`${local.year}-${local.month}-${local.day}`,minutes=Number(local.hour)*60+Number(local.minute);
 const stamp=Date.parse(prices?.lastSuccessAt),previous=Number.isFinite(stamp)?localParts(new Date(stamp)):null;
 const stationsFresh=previous&&`${previous.year}-${previous.month}-${previous.day}`===today&&Number(previous.hour)>=5&&stamp<=now.getTime()+300000;
 const stationsDue=minutes>=300&&!stationsFresh;
 const terminalDue=minutes>=635&&(terminal?.reportDate!==today||!!terminal?.lastError);
 return stationsDue&&terminalDue?'all':stationsDue?'stations':terminalDue?'terminal':'skip';
}
export function collectionMode({event,schedule,mode='all',now=new Date(),prices=null,terminal=null}){
 if(event!=='schedule'){if(!['all','stations','terminal'].includes(mode))throw Error('Invalid collection mode.');return mode;}
 if(schedule==='17 * * * *')return catchupMode({now,prices,terminal});
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'longOffset'}).formatToParts(now).find(p=>p.type==='timeZoneName')?.value;
 const match=offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
 if(!match)throw Error('Cannot determine Central time offset.');
 const hours=(Number(match[2])+Number(match[3])/60)*(match[1]==='-'?-1:1);
 if(schedule===`0 ${5-hours} * * *`)return 'stations';
 if(schedule===`35 ${10-hours} * * *`)return 'terminal';
 return 'skip';
}
export const shouldCollect=input=>collectionMode(input)!=='skip';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=name=>{try{return JSON.parse(readFileSync(new URL(`../site/data/${name}.json`,import.meta.url),'utf8'))}catch{return null}};
 const mode=collectionMode({event:process.env.EVENT_NAME,schedule:process.env.CRON_SCHEDULE,mode:process.env.MANUAL_MODE||'all',prices:read('prices'),terminal:read('terminal')});
 console.log(`run=${mode!=='skip'}`);console.log(`mode=${mode}`);
}
