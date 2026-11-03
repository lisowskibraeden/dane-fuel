# Wisconsin motor-fuel cost calculation

Source: [DATCP Motor Vehicle Fuel Cost Calculation Tool](https://datcp.wi.gov/Documents/MotorVehicleFuelCostCalculationTool.xlsx), as supplied by the user, and [DATCP guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx).

The app implements the worksheet's printed Steps 1–7. Each cost below first adds applicable taxes, inspection, transportation and other required cost adjustments. Do not add charges twice when entering amounts that already include them; this form expects fuel costs before tax and delivery, adjusted for applicable discounts and other charges.

| Step | Worksheet cells | App calculation |
| --- | --- | --- |
| 1 | C9:C16 | Eligible prior-day terminal cost, plus taxes and delivery, multiplied by 1.0918 |
| 2 | F9:F16 | Eligible last-purchase-day terminal cost, plus taxes and delivery, multiplied by 1.0918 |
| 3 | I9:I16 | Eligible invoice cost, plus taxes and delivery, multiplied by 1.06 |
| 4 | L9:L16 | Current replacement cost, plus taxes and delivery, multiplied by 1.06 |
| 5 | E23 (printed rule) | Lesser available result from Steps 1 and 2 |
| 6 | H23 | Lesser available result from Steps 3 and 4 |
| 7 | F30 | Greater of Steps 5 and 6 |

Worksheet Note 8 changes Steps 3 and 4 to 9.18% for a refiner or wholesaler of motor vehicle fuel. It does not change the terminal branch. Invoice costs require a purchase within 10 days; the purchase-day terminal option requires a purchase 1–10 days before sale. The terminal must be the closest qualifying terminal for the exact fuel product.

## Supplied workbook reference error

E23's saved formula refers to C19 and C26, both blank, instead of the purchase-day input and total in F9 and F16. With the supplied example it returns C16 and happens to match the intended answer. It would ignore a lower purchase-day terminal cost. The app follows the printed “LESSER of 1 and 2” instruction and tests that case explicitly. The original workbook is not modified.

## Example validation

The supplied workbook has fuel inputs 1.5530, 1.5806, 1.5300 and 1.5300; each adds 0.184 federal tax, 0.309 state tax, 0.020 inspection and 0.025 estimated delivery. Its cached results are:

- Step 1: 2.2829538
- Step 2: 2.31308748
- Steps 3 and 4: 2.19208
- Step 7: **2.2829538**

The app matches those values without intermediate rounding. Its pump-price display rounds the final result upward to the next $0.001; this is a display policy, not a rounding formula in the workbook.

## Automatic estimate

Public terminal reports do not include eligible historical quotes or private retailer invoice/replacement costs. The automatic scenario assumes the latest Madison ULC10 quote for those costs, a purchase one day before sale, ordinary retailer status, and the worksheet's illustrative $0.025 transportation per gallon. The purchase-day terminal option is left unused. This is an estimate, not a verified statutory minimum. Actual costs, dates, product specifications, discounts and competition exceptions can change the result.

For the saved $2.9580 report, the terminal branch is $3.8169328; the assumed invoice/replacement branch is $3.70576. The higher result displays as **$3.817/gal**. Enter actual inputs to obtain the retailer-specific conditional result.
