import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldCollect,collectionMode} from '../scripts/schedule.mjs';
const due=(date,schedule)=>shouldCollect({event:'schedule',schedule,now:new Date(date)});
test('standard time selects only 11 UTC and daylight time selects only 10 UTC',()=>{for(const [date,cron] of [['2026-11-03T11:00:00Z','0 11 * * *'],['2027-07-01T10:00:00Z','0 10 * * *']]){assert.equal(due(date,cron),true);assert.equal(due(date,cron==='0 11 * * *'?'0 10 * * *':'0 11 * * *'),false)}});
test('DST transition mornings select one 5 AM slot',()=>{assert.equal(due('2027-03-14T10:00:00Z','0 10 * * *'),true);assert.equal(due('2027-03-14T11:00:00Z','0 11 * * *'),false);assert.equal(due('2027-11-07T10:00:00Z','0 10 * * *'),false);assert.equal(due('2027-11-07T11:00:00Z','0 11 * * *'),true)});
test('a delayed dispatch still uses its intended cron slot, not current local hour',()=>{assert.equal(due('2026-11-03T15:30:00Z','0 11 * * *'),true);assert.equal(due('2026-11-03T15:30:00Z','0 10 * * *'),false)});
test('manual and push runs remain enabled',()=>{for(const event of ['workflow_dispatch','push'])assert.equal(shouldCollect({event}),true)});

test('morning slot collects stations only; 10:35 Central slot collects terminal only',()=>{
 for(const [date,station,terminal,wrong] of [['2026-11-03T16:35:00Z','0 11 * * *','35 16 * * *','35 15 * * *'],['2027-07-01T15:35:00Z','0 10 * * *','35 15 * * *','35 16 * * *']]){
  const mode=schedule=>collectionMode({event:'schedule',schedule,now:new Date(date)});
  assert.equal(mode(station),'stations');assert.equal(mode(terminal),'terminal');assert.equal(mode(wrong),'skip');
 }
});
test('manual runs can select terminal only without GasBuddy',()=>{assert.equal(collectionMode({event:'workflow_dispatch',mode:'terminal'}),'terminal');assert.equal(collectionMode({event:'push'}),'all');assert.throws(()=>collectionMode({event:'workflow_dispatch',mode:'invalid'}))});
