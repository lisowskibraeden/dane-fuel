export const TERMINAL_SOURCE='https://old.axxispetro.com/download/wisconsin-cta.txt';
// Rates checked against Wisconsin DOR and IRS Publication 510 on 2026-11-02.
// Report tax treatment, ULC10 product mapping and delivery remain assumptions.
export function parseMadisonReport(text){
 const lines=text.replace(/\r/g,'').split('\n');
 const start=lines.findIndex(line=>/^967\s+MADISON, WI\s+Date:/i.test(line));
 if(start<0)throw Error('Madison terminal 967 missing from AXXIS report.');
 const section=[];for(const line of lines.slice(start)){if(section.length&&/^\d{3}\s+[A-Z]/.test(line))break;section.push(line)}
 const date=section[0].match(/Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
 const header=section.find(line=>/^Supplier\s+/.test(line))?.trim().split(/\s+/).slice(1);
 const values=section.find(line=>/^Contract Average\s+/.test(line))?.replace(/^Contract Average\s+/,'').trim().split(/\s+/);
 const index=header?.indexOf('ULC10');
 if(!date||!header||!values||header.length!==values.length||index<0||!/^\d+\.\d{4}$/.test(values[index]))throw Error('Invalid Madison ULC10 report.');
 const reportDate=`${date[3]}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`;
 const stamp=Date.parse(reportDate+'T00:00:00Z');
 if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==reportDate)throw Error('Invalid terminal report date.');
 const wholesale=Number(values[index]);if(wholesale<=0||wholesale>20)throw Error('Invalid terminal price.');
 return {schemaVersion:1,terminal:'967',city:'Madison, WI',product:'ULC10',reportDate,reportTime:date[4],wholesale,source:TERMINAL_SOURCE};
}
export function terminalEstimate(report){
 if(report?.schemaVersion!==1||report.terminal!=='967'||report.product!=='ULC10'||!Number.isFinite(report.wholesale)||report.wholesale<=0||report.wholesale>20)return null;
 const base=report.wholesale+0.184+0.309+0.020+0.025;
 return {wholesale:report.wholesale,base,price:Math.ceil((base*1.0918-1e-10)*1000)/1000};
}
