// Ordinary retail statutory-cost comparison. Input costs already include required
// taxes, transport, other charges and applicable trade-discount adjustments.
const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n:NaN;};
const amount=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=30?Number(value):null;
export function calculateMinimum(input){
 const errors=[];const sale=day(input.saleDate);const purchase=day(input.purchaseDate);const prior=amount(input.terminalPrior);const onPurchase=amount(input.terminalPurchase);const invoice=amount(input.invoice);const replacement=amount(input.replacement);
 const age=(sale-purchase)/86400e3;
 if(!Number.isFinite(sale))errors.push('Enter the retail sale date.');
 if(prior===null)errors.push('Enter the closest-terminal cost for the day before the sale.');
 if(invoice===null&&replacement===null)errors.push('Enter an eligible invoice cost or a current replacement cost.');
 if(invoice!==null&&(!Number.isInteger(age)||age<0||age>10))errors.push('Invoice cost needs a last-purchase date within 10 days of the sale.');
 if(onPurchase!==null&&(!Number.isInteger(age)||age<1||age>10))errors.push('The purchase-day terminal option requires a purchase 1–10 days before the sale.');
 for(const key of ['terminalPurchase','invoice','replacement'])if(input[key]!==''&&input[key]!==null&&input[key]!==undefined&&amount(input[key])===null)errors.push('Cost inputs must be between $0 and $30 per gallon.');
 if(errors.length)return {errors};
 const terminalBase=onPurchase===null?prior:Math.min(prior,onPurchase);
 const retailerBase=Math.min(...[invoice,replacement].filter(v=>v!==null));
 const retailerRate=input.sellerType==='wholesaler'?0.0918:0.06;
 const terminal=terminalBase*1.0918,retailer=retailerBase*(1+retailerRate);
 const raw=Math.max(terminal,retailer);
 return {errors:[],raw,price:Math.ceil((raw-1e-10)*1000)/1000,terminal,retailer,terminalBase,retailerBase,retailerRate,saleDate:input.saleDate,basis:terminal>=retailer?'Terminal-based cost':'Invoice/replacement cost'};
}
