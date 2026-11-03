# Dane Fuel

Regular gas prices for Dane County, Wisconsin, in a simple view built for your phone. Compare nearby stations, see when each price was reported, and check an estimated Madison fuel price including markup and taxes.

No account, app store download, or paid data subscription is required.

## What it shows

- **An estimated minimum price** based on the Madison terminal report, taxes and markup.
- **Station prices, lowest first**, with addresses, brand logos, report ages, and links to the source listings.
- **Membership stations included**, with membership requirements clearly labeled. Cash-only prices are excluded by default.
- **Daily snapshots** with collection time and individual report ages. Reports older than 24 hours are excluded.
- **Preferred brands when prices tie:** Costco, then Woodman’s, then Kwik Trip. A lower price always ranks ahead of a higher price.

## Use it on your phone

Open the hosted site and use your browser’s install option:

- **iPhone:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → menu → Add to Home screen / Install.

The app opens from your home screen. An internet connection is required to load price data; visitors do not need a GitHub or ChatGPT account.

## Understanding the headline price

The headline is a **terminal-based estimate**, not a verified legal minimum for every station. It uses the latest available AXXIS Madison terminal 967 report, treats ULC10 as regular E10, and assumes the reported wholesale price excludes taxes. Following the terminal branch described in [Wisconsin DATCP’s guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx), it adds taxes and assumed delivery before applying 9.18% markup. The tax components are $0.184 federal gasoline tax ([IRS Publication 510](https://www.irs.gov/publications/p510)), $0.309 Wisconsin fuel tax and $0.020 inspection fee ([Wisconsin DOR](https://www.revenue.wi.gov/pages/faqs/ise-mofuel.aspx)). Delivery is an illustrative $0.025 per gallon, not a state-prescribed rate. Wholesale precision is retained; the final display rounds upward to a tenth of a cent. Example: `($2.9580 + $0.184 + $0.309 + $0.020 + $0.025) × 1.0918 = $3.8169328`, displayed as **$3.817**. The source date and calculation are available in the app.

The app also runs the full worksheet comparison: the lesser eligible terminal cost plus 9.18%, compared with the lesser invoice/replacement cost plus 6% (9.18% for a refiner or fuel wholesaler), then the higher branch is selected. Taxes and transportation are added separately to each cost before markup. The automatic estimate uses the latest terminal quote as a proxy for prior-day terminal, invoice and replacement costs, assumes a purchase one day before the sale, and uses 2.5¢ delivery. These are provisional inputs, not verified history or retailer costs.

The **Full worksheet calculation** form accepts pre-tax costs, seller type, eligible dates, taxes and separate delivery charges. It displays Steps 1–7 and the final result. **Use assumed costs** loads the automatic scenario for review and editing. Inputs stay in your browser. The [calculation notes](docs/minimum-calculation.md) map the formulas to the state worksheet and explain a broken reference in the supplied workbook. Actual statutory costs and applicable exceptions vary by retailer.

See [Wisconsin’s cost calculation guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx) and the [AXXIS source report](https://old.axxispetro.com/download/wisconsin-cta.txt).

## Price sources and coverage

Station reports come from GasBuddy searches across Dane County and surrounding communities. Addresses are checked against U.S. Census and official Dane County records before entering the ranking. If GasBuddy is unavailable, the collector can use a clearly labeled Kwik Trip-only fallback.

Prices are saved snapshots. The app preserves source report times and excludes reports older than 24 hours. Missing prices, unmatched addresses, and source outages can reduce coverage. The lowest listed price is the lowest eligible report collected, and may change before you reach the pump.

Dane Fuel is an independent project and is not affiliated with GasBuddy or the station brands shown. Logos identify their respective brands.

## How it runs

The website is static HTML, CSS, and JavaScript. A GitHub Actions workflow collects station reports and the terminal report, saves JSON data, and publishes the `site/` directory to GitHub Pages. Visitors load those saved files directly; no application server or API key is required.

The scheduled updates run in **Central time** (`America/Chicago`):

- **5:00 AM:** collect station prices and publish the morning snapshot.
- **10:35 AM:** fetch the terminal report and publish the revised estimate, without collecting station prices again. This allows five minutes after the report's usual 10:30 AM timestamp.

UTC schedule checks select the appropriate slots for daylight saving time. GitHub may delay or drop scheduled events, so these are target start times. The terminal job reports a failure if today's report is not available and retains the previous report's date. Recurring collection and deployment are disabled while the repository is private. Manual runs can select station data, terminal data, or both. Pushes update both.

## Run locally

Use Node.js 24 and Python 3:

```sh
npm ci
npm test
npm run serve
```

Open [localhost:8080](http://localhost:8080/). The preview uses the saved data in `site/data/`.

To refresh the data on Linux:

```sh
npx playwright install --with-deps chrome
xvfb-run -a npm run collect -- --headed --chrome --standard-chrome --require-gasbuddy
```

On a desktop with a display, omit `xvfb-run -a`. Add `--smoke` to check Madison only. Collection failures preserve saved report timestamps and record the failed attempt.

## Deploy with GitHub Pages

The free hosting setup uses a **public repository** and standard GitHub Actions runners.

1. In repository **Settings → Pages**, select **GitHub Actions** as the publishing source.
2. Under **Settings → Secrets and variables → Actions → Variables**, create `ENABLE_FREE_UPDATES` with the value `true`.
3. In **Actions**, select **Refresh prices and deploy Pages** and run it with the default inputs.
4. Open the deployment URL shown after the workflow completes.

Later pushes to `main` and scheduled runs update the deployed site. No paid services are configured.

## Project layout

- `site/` — installable website, logos, and saved price data.
- `scripts/` — station collection, county verification, and terminal-report updates.
- `tests/` — source parsing, price calculations, filtering, and ranking checks.
- `.github/workflows/` — collection and deployment workflows.
