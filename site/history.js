import {terminalEstimate} from './terminal.js?v=worksheet';
export const CALCULATION_VERSION='datcp-worksheet-v1';
export function historyPoint(report,{reconstructed=false,recordedAt=new Date().toISOString()}={}){
 const result=terminalEstimate(report);if(!result||!/^\d{4}-\d{2}-\d{2}$/.test(report.reportDate||'')||!Number.isFinite(Date.parse(report.retrievedAt)))throw Error('Cannot archive an invalid terminal report.');
 return {id:[report.terminal,report.product,report.reportDate,report.reportTime,report.wholesale,CALCULATION_VERSION].join('/'),reportDate:report.reportDate,reportTime:report.reportTime,wholesale:report.wholesale,estimatedMinimum:result.raw,displayMinimum:result.price,terminalBranch:result.terminal,retailerBranch:result.retailer,inputs:result.inputs,calculationVersion:CALCULATION_VERSION,source:report.source,retrievedAt:report.retrievedAt,recordedAt,reconstructed};
}
export function appendHistory(history,point){
 if(history?.schemaVersion!==1||!Array.isArray(history.records))throw Error('Invalid history: refusing to replace existing records.');
 if(history.records.some(p=>p.id===point.id))return history;
 return {...history,records:[...history.records,point].sort((a,b)=>a.reportDate.localeCompare(b.reportDate)||a.retrievedAt.localeCompare(b.retrievedAt))};
}
const timeMinutes=value=>{const m=value?.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);return m?(Number(m[1])%12)*60+Number(m[2])+(/pm/i.test(m[3])?720:0):0};
export function dailyHistory(history){
 const byDate=new Map();
 for(const p of history?.records||[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.reportDate||'')||!Number.isFinite(p.estimatedMinimum)||p.estimatedMinimum<=0)continue;
  const old=byDate.get(p.reportDate);
  if(!old||timeMinutes(p.reportTime)>timeMinutes(old.reportTime)||(timeMinutes(p.reportTime)===timeMinutes(old.reportTime)&&p.retrievedAt>old.retrievedAt))byDate.set(p.reportDate,p);
 }
 return [...byDate.values()].sort((a,b)=>a.reportDate.localeCompare(b.reportDate));
}
export function historyCSV(history){
 const columns=['reportDate','reportTime','wholesale','estimatedMinimum','displayMinimum','calculationVersion','retrievedAt','recordedAt','reconstructed'];
 const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 return [columns.join(','),...(history.records||[]).map(p=>columns.map(k=>cell(p[k])).join(','))].join('\r\n')+'\r\n';
}
