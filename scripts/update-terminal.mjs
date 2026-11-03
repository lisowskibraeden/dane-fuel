import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {appendHistory,historyPoint} from '../site/history.js';
import {parseMadisonReport,TERMINAL_SOURCE} from '../site/terminal.js';
const file=fileURLToPath(new URL('../site/data/terminal.json',import.meta.url));
const historyFile=fileURLToPath(new URL('../site/data/minimum-history.json',import.meta.url));
const attemptedAt=new Date().toISOString();
try{
 const response=await fetch(TERMINAL_SOURCE,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`AXXIS HTTP ${response.status}`);
 const report={...parseMadisonReport(await response.text()),attemptedAt,retrievedAt:new Date().toISOString(),lastError:null};
 if(process.argv.includes('--require-current')){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(report.reportDate!==today)throw Error(`Today's terminal report is not available (received ${report.reportDate}).`);
 }
 let previous=null;try{previous=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous?.reportDate>report.reportDate)throw Error('AXXIS returned an older report; retaining saved report.');
 let history={schemaVersion:1,records:[]};try{history=JSON.parse(await fs.readFile(historyFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const archived=appendHistory(history,historyPoint(report));
 if(archived!==history){await fs.writeFile(historyFile+'.tmp',JSON.stringify(archived,null,2)+'\n');await fs.rename(historyFile+'.tmp',historyFile)}
 await fs.writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await fs.rename(file+'.tmp',file);
 console.log(`Madison terminal ULC10: $${report.wholesale.toFixed(4)}; report ${report.reportDate} ${report.reportTime}`);
}catch(error){
 console.error(`Terminal update failed: ${error.message}`);
 if(process.argv.includes('--require-current'))process.exitCode=1;
 let previous={schemaVersion:1};try{previous=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
 await fs.writeFile(file+'.tmp',JSON.stringify({...previous,attemptedAt,lastError:error.message},null,2)+'\n');await fs.rename(file+'.tmp',file);
}
