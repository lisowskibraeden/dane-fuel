import {pathToFileURL} from 'node:url';
// Separate UTC cron entries identify the intended slot even if GitHub starts late.
export function collectionMode({event,schedule,mode='all',now=new Date()}){
 if(event!=='schedule'){if(!['all','stations','terminal'].includes(mode))throw Error('Invalid collection mode.');return mode;}
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
 const mode=collectionMode({event:process.env.EVENT_NAME,schedule:process.env.CRON_SCHEDULE,mode:process.env.MANUAL_MODE||'all'});
 console.log(`run=${mode!=='skip'}`);console.log(`mode=${mode}`);
}
