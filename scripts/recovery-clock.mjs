import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {catchupMode} from './schedule.mjs';
const local=date=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
const recent=(stamp,now)=>Number.isFinite(Date.parse(stamp))&&now-Date.parse(stamp)>=0&&now-Date.parse(stamp)<15*60000;
export function clockMode({now=new Date(),prices=null,terminal=null}={}){
 const due=catchupMode({now,prices,terminal});
 const stations=['all','stations'].includes(due)&&!recent(prices?.attemptedAt,now);
 const terminalDue=['all','terminal'].includes(due)&&!recent(terminal?.attemptedAt,now);
 return stations&&terminalDue?'all':stations?'stations':terminalDue?'terminal':'skip';
}
export function clockDelay({now=new Date(),prices=null,terminal=null,verificationCycles=0}={}){
 if(![0,1,2].includes(verificationCycles))throw Error('Verification cycles must be 0, 1 or 2.');
 if(verificationCycles)return 1;
 const due=catchupMode({now,prices,terminal});
 if(due!=='skip')return clockMode({now,prices,terminal})==='skip'?15:1;
 const t=local(now),minute=t.hour*60+t.minute+t.second/60;
 const distance=[300,635,1740].find(target=>target>minute)-minute;
 return distance>=61?60:distance>=16?15:1;
}
const workers=new Set(['Refresh prices and deploy Pages','Daily fuel updates']);
export async function checkAndDispatch({repository,token,now=new Date(),prices=null,terminal=null,fetcher=fetch}){
 const mode=clockMode({now,prices,terminal});if(mode==='skip')return {mode,dispatched:false};
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository||'')||!token)throw Error('Missing clock repository or Actions token.');
 const base=`https://api.github.com/repos/${repository}`;
 const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'DaneFuel-RecoveryClock'};
 const response=await fetcher(`${base}/actions/runs?per_page=100`,{headers,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Cannot check active updates: HTTP ${response.status}`);
 const active=(await response.json()).workflow_runs?.some(run=>workers.has(run.name)&&run.status!=='completed');
 if(active)return {mode,dispatched:false,reason:'Updater already active'};
 const dispatched=await fetcher(`${base}/actions/workflows/update-and-deploy.yml/dispatches`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{mode,require_gasbuddy:true,private_test:false,smoke:false}}),signal:AbortSignal.timeout(20000)});
 if(!dispatched.ok)throw Error(`Cannot dispatch updater: HTTP ${dispatched.status}`);
 return {mode,dispatched:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=name=>{try{return JSON.parse(fs.readFileSync(new URL(`../site/data/${name}.json`,import.meta.url),'utf8'))}catch{return null}};
 const state={prices:read('prices'),terminal:read('terminal')};
 const cycles=Number(process.env.VERIFY_CYCLES||0);
 if(process.argv[2]==='plan'){
  const minutes=clockDelay({...state,verificationCycles:cycles});
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`environment=fuel-clock-${minutes}\n`);
  console.log(`Next check after a ${minutes}-minute GitHub environment wait.`);
 }else if(process.argv[2]==='arm'){
  if(![0,1,2].includes(cycles))throw Error('Invalid verification cycles.');
  const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/recovery-clock.yml/dispatches`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'DaneFuel-RecoveryClock'},body:JSON.stringify({ref:'main',inputs:{verification_cycles:String(Math.max(0,cycles-1))}}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Cannot queue next clock check: HTTP ${response.status}`);
  console.log('Next clock run queued before entering the wait.');
 }else if(process.argv[2]==='check'){
  console.log(JSON.stringify(await checkAndDispatch({...state,repository:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN})));
 }else throw Error('Use plan, arm, or check.');
}
