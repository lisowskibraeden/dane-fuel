import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseMadisonReport,TERMINAL_SOURCE} from '../site/terminal.js';
const file=fileURLToPath(new URL('../site/data/terminal.json',import.meta.url));
const attemptedAt=new Date().toISOString();
try{
 const response=await fetch(TERMINAL_SOURCE,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`AXXIS HTTP ${response.status}`);
 const report={...parseMadisonReport(await response.text()),attemptedAt,retrievedAt:new Date().toISOString(),lastError:null};
 let previous=null;try{previous=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous?.reportDate>report.reportDate)throw Error('AXXIS returned an older report; retaining saved report.');
 await fs.writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await fs.rename(file+'.tmp',file);
 console.log(`Madison terminal ULC10: $${report.wholesale.toFixed(4)}; report ${report.reportDate} ${report.reportTime}`);
}catch(error){
 console.error(`Terminal update failed: ${error.message}`);
 let previous={schemaVersion:1};try{previous=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
 await fs.writeFile(file+'.tmp',JSON.stringify({...previous,attemptedAt,lastError:error.message},null,2)+'\n');await fs.rename(file+'.tmp',file);
}
