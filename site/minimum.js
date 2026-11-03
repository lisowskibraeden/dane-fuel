// Ordinary retail statutory-cost comparison. Input costs already include required
// taxes, transport, other charges and applicable trade-discount adjustments.
const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n:NaN;};
const amount=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=30?Number(value):null;
export function calculateMinimum(input){
 const errors=[];const sale=day(input.saleDate);const purchase=day(input.purchaseDate);const prior=amount(input.terminalPrior);const onPurchase=amount(input.terminalPurchase);const invoice=amount(input.invoice);const replacement=amount(input.replacement);
 const age=(sale-purchase)/86400e3;
 if(!Number.isFinite(sale))errors.push('Enter the retail sale date.');
 if(prior===null&&onPurchase===null)errors.push('Enter an eligible prior-day or purchase-day closest-terminal cost.');
 if(invoice===null&&replacement===null)errors.push('Enter an eligible invoice cost or a current replacement cost.');
 if(invoice!==null&&(!Number.isInteger(age)||age<0||age>10))errors.push('Invoice cost needs a last-purchase date within 10 days of the sale.');
 if(onPurchase!==null&&(!Number.isInteger(age)||age<1||age>10))errors.push('The purchase-day terminal option requires a purchase 1–10 days before the sale.');
 for(const key of ['terminalPrior','terminalPurchase','invoice','replacement'])if(input[key]!==''&&input[key]!==null&&input[key]!==undefined&&amount(input[key])===null)errors.push('Cost inputs must be between $0 and $30 per gallon.');
 if(errors.length)return {errors};
 const terminalBase=Math.min(...[prior,onPurchase].filter(v=>v!==null));
 const retailerBase=Math.min(...[invoice,replacement].filter(v=>v!==null));
 const retailerRate=input.sellerType==='wholesaler'?0.0918:0.06;
 const terminal=terminalBase*1.0918,retailer=retailerBase*(1+retailerRate);
 const raw=Math.max(terminal,retailer);
 return {errors:[],raw,price:Math.ceil((raw-1e-10)*1000)/1000,terminal,retailer,terminalBase,retailerBase,retailerRate,saleDate:input.saleDate,basis:terminal>=retailer?'Terminal-based cost':'Invoice/replacement cost'};
}

// DATCP worksheet Steps 1–7. Inputs are BEFORE taxes and transportation.
// Its printed Step 5 is followed; the supplied file has broken C19/C26 references.
export function calculateWorksheet(input){
 const charges=['federalTax','stateTax','inspectionFee'];
 const costKeys=['terminalPrior','terminalPurchase','invoice','replacement'];
 const deliveryKeys=['terminalDelivery','purchaseDelivery','invoiceDelivery','replacementDelivery'];
 const errors=[];
 for(const key of [...charges,...deliveryKeys])if(input[key]===''||input[key]===null||input[key]===undefined||!Number.isFinite(Number(input[key]))||Number(input[key])<0||Number(input[key])>5)errors.push('Enter tax, fee and delivery amounts between $0 and $5 per gallon (zero is allowed).');
 if(errors.length)return {errors:[...new Set(errors)]};
 const tax=charges.reduce((sum,key)=>sum+Number(input[key]),0);
 const adjusted={...input};
 for(const [i,key] of costKeys.entries()){
  if(input[key]===''||input[key]===null||input[key]===undefined)adjusted[key]='';
  else if(amount(input[key])===null)return {errors:['Fuel costs must be greater than $0 and no more than $30 per gallon.']};
  else adjusted[key]=Number(input[key])+tax+Number(input[deliveryKeys[i]]);
 }
 const result=calculateMinimum(adjusted);
 if(result.errors.length)return result;
 const rate=result.retailerRate;
 const steps=costKeys.map((key,i)=>adjusted[key]===''?null:{label:['Prior-day terminal','Purchase-day terminal','Invoice','Replacement'][i],base:adjusted[key],rate:i<2?0.0918:rate,total:adjusted[key]*(1+(i<2?0.0918:rate))});
 return {...result,steps,tax};
}
