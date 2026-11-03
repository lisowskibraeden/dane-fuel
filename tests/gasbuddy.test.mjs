import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSearchStation,parseGraphqlStation,moreCursor} from '../scripts/gasbuddy.mjs';
const time='2026-11-03T00:10:00Z';
const card={href:'/station/9075',name:"Woodman's",text:"Woodman's\n225\n725 S Gammon Rd\nMadison, WI\n$3.89\n5 Minutes Ago"};
const raw={id:'9075',prices:[{fuelProduct:'regular_gas',credit:{price:3.89,postedTime:'2026-11-03T00:05:13Z'},cash:{price:3.79,postedTime:'2026-11-03T00:06:00Z'}},{fuelProduct:'premium_gas',credit:{price:5.29,postedTime:time}}]};
test('joins rendered address with exact regular credit report time',()=>{const s=parseSearchStation(card,raw,time);assert.equal(s.price,3.89);assert.equal(s.reportedAt,'2026-11-03T00:05:13.000Z');assert.equal(s.address,'725 S Gammon Rd');assert.equal(s.city,'Madison');assert.equal(s.payment,'credit');assert.equal(s.membership,false)});
test('uses cash only when no valid credit quote exists and identifies membership',()=>{const s=parseSearchStation({...card,name:'Costco'}, {...raw,prices:[{...raw.prices[0],credit:{price:0,postedTime:null}}]},time);assert.equal(s.price,3.79);assert.equal(s.payment,'cash');assert.equal(s.membership,true)});
test('rejects mismatched station metadata, placeholders and absent timestamps',()=>{assert.equal(parseSearchStation(card,{...raw,id:'123'},time),null);assert.equal(parseSearchStation(null,raw,time),null);for(const credit of [{price:0,postedTime:time},{price:3.89,postedTime:null},{price:'3.89',postedTime:time}])assert.equal(parseSearchStation(card,{id:'9075',prices:[{fuelProduct:'regular_gas',credit}]},time),null)});
test('never substitutes premium or missing grade for regular',()=>{assert.equal(parseSearchStation(card,{...raw,prices:raw.prices.slice(1)},time),null);assert.equal(parseSearchStation(card,{...raw,prices:[]},time),null)});

test('other brand names in surrounding page text do not imply membership',()=>{assert.equal(parseSearchStation({...card,text:card.text+'\nFind Gas by Brand\nCostco'},raw,time).membership,false)});

test('normalizes complete public response metadata and rejects out-of-state stations',()=>{const r={...raw,name:"Woodman's",address:{line1:'725 S Gammon Rd',locality:'Madison',region:'WI'}};assert.equal(parseGraphqlStation(r,time).address,'725 S Gammon Rd');assert.equal(parseGraphqlStation({...r,address:{...r.address,region:'MN'}},time),null)});
test('pagination stops at actual result count even if cursor is nonzero',()=>{assert.equal(moreCursor({count:2,cursor:{next:'20'},results:[{},{}]},2),null);assert.equal(moreCursor({count:65,cursor:{next:'20'},results:[{}]},20),'20');assert.equal(moreCursor({count:65,cursor:{next:'0'},results:[{}]},65),null)});

test('provider final cursor denotes the last row even when listings contain duplicate IDs',()=>{assert.equal(moreCursor({count:68,cursor:{next:'67'},results:Array(8).fill({})},61),null);assert.equal(moreCursor({count:68,cursor:{next:'60'},results:Array(20).fill({})},57),'60')});
