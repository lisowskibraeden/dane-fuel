// Recover only reports already present in Git; never invent missing dates/prices.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {appendHistory,historyPoint} from '../site/history.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=fileURLToPath(new URL('../site/data/minimum-history.json',import.meta.url));
let history={schemaVersion:1,records:[]};try{history=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const commits=execFileSync('git',['log','--reverse','--format=%H','--','site/data/terminal.json'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const sha of commits){
 const report=JSON.parse(execFileSync('git',['show',`${sha}:site/data/terminal.json`],{cwd:root,encoding:'utf8'}));
 if(report.lastError||!report.retrievedAt)continue;
 history=appendHistory(history,historyPoint(report,{reconstructed:true}));
}
await fs.writeFile(file+'.tmp',JSON.stringify(history,null,2)+'\n');await fs.rename(file+'.tmp',file);
console.log(`Retained ${history.records.length} terminal report versions from repository history.`);
