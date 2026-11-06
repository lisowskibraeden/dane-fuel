import test from 'node:test';
import assert from 'node:assert/strict';
import {clockDelay,clockMode,checkAndDispatch} from '../scripts/recovery-clock.mjs';
const prices={lastSuccessAt:'2026-11-06T11:08:00Z'},terminal={reportDate:'2026-11-06',lastError:null};
test('clock approaches the morning and terminal target times without leaving a runner idle',()=>{
 assert.equal(clockDelay({now:new Date('2026-11-06T09:00:00Z')}),60);
 assert.equal(clockDelay({now:new Date('2026-11-06T10:30:00Z')}),15);
 assert.equal(clockDelay({now:new Date('2026-11-06T10:59:00Z')}),1);
 assert.equal(clockDelay({now:new Date('2026-11-06T16:34:00Z'),prices}),1);
 assert.equal(clockDelay({now:new Date('2026-11-06T17:00:00Z'),prices,terminal}),60);
 assert.equal(clockDelay({verificationCycles:2}),1);assert.throws(()=>clockDelay({verificationCycles:99}));
});
test('clock respects daylight time and backs off recent attempts',()=>{
 assert.equal(clockDelay({now:new Date('2027-07-01T09:59:00Z')}),1);
 const now=new Date('2026-11-06T17:00:00Z');
 assert.equal(clockMode({now,prices:{attemptedAt:'2026-11-06T16:59:00Z'},terminal:{attemptedAt:'2026-11-06T16:59:00Z'}}),'skip');
 assert.equal(clockDelay({now,prices:{attemptedAt:'2026-11-06T16:59:00Z'},terminal:{attemptedAt:'2026-11-06T16:59:00Z'}}),15);
});
test('clock only dispatches the missing terminal update and keeps token at GitHub',async()=>{
 const calls=[];const result=await checkAndDispatch({repository:'owner/repo',token:'test-token',now:new Date('2026-11-06T17:00:00Z'),prices,fetcher:async(url,init)=>{calls.push([url,init]);return calls.length===1?Response.json({workflow_runs:[]}):new Response(null,{status:204})}});
 assert.deepEqual(result,{mode:'terminal',dispatched:true});assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1][1].body).inputs.mode,'terminal');assert.ok(calls.every(([url])=>url.startsWith('https://api.github.com/repos/owner/repo/')));
});
test('clock skips current data, avoids overlapping updates, and surfaces dispatch failures',async()=>{
 const now=new Date('2026-11-06T17:00:00Z');
 assert.equal((await checkAndDispatch({now,prices,terminal,fetcher:()=>{throw Error('Must not fetch')}})).dispatched,false);
 assert.equal((await checkAndDispatch({now,prices,repository:'o/r',token:'test',fetcher:async()=>Response.json({workflow_runs:[{name:'Refresh prices and deploy Pages',status:'in_progress'}]})})).reason,'Updater already active');
 await assert.rejects(checkAndDispatch({now,prices,repository:'o/r',token:'test',fetcher:async()=>new Response(null,{status:403})}),/HTTP 403/);
});
