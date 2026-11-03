import {pathToFileURL} from 'node:url';
// Separate UTC cron entries identify the intended slot even if GitHub starts late.
export function shouldCollect({event,schedule,now=new Date()}){
 if(event!=='schedule')return true;
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'longOffset'}).formatToParts(now).find(p=>p.type==='timeZoneName')?.value;
 const match=offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
 if(!match)throw Error('Cannot determine Central time offset.');
 const hours=(Number(match[2])+Number(match[3])/60)*(match[1]==='-'?-1:1);
 return schedule===`0 ${5-hours} * * *`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(`run=${shouldCollect({event:process.env.EVENT_NAME,schedule:process.env.CRON_SCHEDULE})}`);
}
