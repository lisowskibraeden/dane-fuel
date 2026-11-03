import {dailyHistory,historyCSV} from './history.js';
const NS='http://www.w3.org/2000/svg';
const svgNode=(name,attrs={},text)=>{const n=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n};
export function renderHistory(history){
 const points=dailyHistory(history),box=document.getElementById('trend-chart'),summary=document.getElementById('trend-summary');box.replaceChildren();
 if(!points.length){summary.textContent='History starts with the next successful terminal report.';return}
 const first=points[0],last=points.at(-1),delta=(last.estimatedMinimum-first.estimatedMinimum)*100;
 summary.textContent=points.length===1?`$${last.displayMinimum.toFixed(3)}/gal · first saved report ${last.reportDate}. More points will appear as reports arrive.`:`$${last.displayMinimum.toFixed(3)}/gal · ${Math.abs(delta).toFixed(1)}¢ ${delta<0?'lower':delta>0?'higher':'change'} since ${first.reportDate}`;
 const width=640,height=220,left=58,right=18,top=24,bottom=34;
 const times=points.map(p=>Date.parse(p.reportDate+'T12:00:00Z')),values=points.map(p=>p.estimatedMinimum);
 const min=Math.min(...values),max=Math.max(...values),pad=Math.max(.025,(max-min)*.18),lo=min-pad,hi=max+pad;
 const x=t=>times.at(-1)===times[0]?width/2:left+(t-times[0])/(times.at(-1)-times[0])*(width-left-right);
 const y=v=>top+(hi-v)/(hi-lo)*(height-top-bottom);
 const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`Estimated minimum price from ${first.reportDate} to ${last.reportDate}. ${summary.textContent}`});
 for(let i=0;i<3;i++){const v=lo+(hi-lo)*i/2,yy=y(v);svg.append(svgNode('line',{x1:left,x2:width-right,y1:yy,y2:yy,stroke:'#d9e0d0','stroke-dasharray':'3 5'}),svgNode('text',{x:left-10,y:yy+4,'text-anchor':'end',fill:'#6b7d63','font-size':12},'$'+v.toFixed(2)))}
 if(points.length>1)svg.append(svgNode('polyline',{points:points.map((p,i)=>`${x(times[i])},${y(p.estimatedMinimum)}`).join(' '),fill:'none',stroke:'#174b3e','stroke-width':2.5,'stroke-linejoin':'round'}));
 points.forEach((p,i)=>{const c=svgNode('circle',{cx:x(times[i]),cy:y(p.estimatedMinimum),r:points.length>180?2:4,fill:'#174b3e'});c.append(svgNode('title',{},`${p.reportDate}: $${p.displayMinimum.toFixed(3)}/gal${p.reconstructed?' · reconstructed from saved report':''}`));svg.append(c)});
 const date=p=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(first.reportDate.slice(0,4)!==last.reportDate.slice(0,4)?{year:'numeric'}:{})}).format(new Date(p.reportDate+'T12:00:00Z'));
 svg.append(svgNode('text',{x:left,y:height-9,fill:'#6b7d63','font-size':12},date(first)));if(points.length>1)svg.append(svgNode('text',{x:width-right,y:height-9,'text-anchor':'end',fill:'#6b7d63','font-size':12},date(last)));
 box.append(svg);
 document.getElementById('trend-note').textContent=`${points.length} daily report${points.length===1?'':'s'} · daily estimates use standard assumptions, not your private inputs. All ${history.records.length} saved report versions are retained without automatic expiry.${points.some(p=>p.reconstructed)?' Early history was reconstructed from saved terminal reports.':''} Missing days are not filled in.`;
 const download=document.getElementById('history-download');download.href=URL.createObjectURL(new Blob([historyCSV(history)],{type:'text/csv;charset=utf-8'}));download.download='dane-fuel-minimum-history.csv';download.textContent='Download CSV';
}
