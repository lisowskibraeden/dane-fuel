// One-off diagnostic: ordinary public browser requests; stop on access challenges.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const sources=[
 ['iexit','https://www.iexitapp.com/gasprices/Wisconsin/46/Madison/44092/Unleaded/3?r=25'],
 ['way','https://www.way.com/gas/stations/madison-wi/'],
 ['autoblog','https://www.autoblog.com/best-gas-prices/madison-wi/']
];
await fs.mkdir('probe-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [name,url] of sources){
  const context=await browser.newContext({locale:'en-US'}),page=await context.newPage();
  try{
   const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   const title=await page.title();
   if(r?.status()===403||/just a moment|access denied|captcha/i.test(title)){console.log(JSON.stringify({name,url,status:r?.status(),title,blocked:true}));continue}
   const text=await page.locator('body').innerText();
   console.log(JSON.stringify({name,url,status:r?.status(),title,prices:(text.match(/\$\d{1,2}\.\d{2,3}/g)||[]).length,excerpt:text.slice(0,6000)}));
   await fs.writeFile(`probe-results/${name}.html`,await page.content());
  }catch(e){console.log(JSON.stringify({name,error:e.message}))}
  finally{await context.close()}
 }
}finally{await browser.close()}
