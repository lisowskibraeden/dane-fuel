import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
// Start stock Chrome, then attach through its supported local debugging protocol.
// The profile is temporary and anonymous; no user profile or cookies are imported.
export async function openBrowser({headless=true,channel,standardChrome=false}={}){
 if(!standardChrome){const browser=await chromium.launch({headless,...(channel?{channel}:{})});return {browser,context:await browser.newContext({locale:'en-US'}),close:()=>browser.close()}}
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'dane-fuel-chrome-'));
 const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p))})});
 const child=spawn(process.env.CHROME_BIN||'/opt/google/chrome/chrome',[`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
 let startupError;child.on('error',e=>startupError=e);
 let browser;
 const close=async()=>{try{await browser?.close()}finally{child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);setTimeout(r,3000)});await fs.rm(profile,{recursive:true,force:true})}};
 try{
  let ready=false;
  for(let i=0;i<60;i++){
   if(startupError)throw startupError;
   if(child.exitCode!==null)throw Error(`Standard Chrome exited with code ${child.exitCode}`);
   try{const r=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break}}catch{}
   await new Promise(r=>setTimeout(r,250));
  }
  if(!ready)throw Error('Standard Chrome did not start its local debugging interface');
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return {browser,context:browser.contexts()[0],close};
 }catch(e){await close();throw e}
}
