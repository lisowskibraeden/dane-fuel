# Dane Fuel

Regular gas prices for Dane County, Wisconsin, in a simple view built for your phone. Compare nearby stations, see when each price was reported, and check an estimated Madison fuel price including markup and taxes.

No account, app store download, or paid data subscription is required.

## What it shows

- **An estimated minimum price** based on the Madison terminal report, taxes and markup.
- **Station prices, lowest first**, with addresses, brand logos, report ages, and links to the source listings.
- **Membership stations included**, with membership requirements clearly labeled. Cash-only prices are excluded by default.
- **Freshness filters** for reports from the last 6, 12, or 24 hours. The default is 24 hours.
- **Preferred brands when prices tie:** Costco, then Woodman’s, then Kwik Trip. A lower price always ranks ahead of a higher price.

## Use it on your phone

Open the hosted site and use your browser’s install option:

- **iPhone:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → menu → Add to Home screen / Install.

The app opens from your home screen. An internet connection is required to load price data; visitors do not need a GitHub or ChatGPT account.

## Understanding the headline price

The headline is a **terminal-based estimate**, not a verified legal minimum for every station. It uses the latest available AXXIS Madison terminal 967 report, treats ULC10 as regular E10, and assumes the reported wholesale price excludes taxes. Following the terminal branch described in [Wisconsin DATCP’s guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx), it adds taxes and assumed delivery before applying 9.18% markup. The tax components are $0.184 federal gasoline tax ([IRS Publication 510](https://www.irs.gov/publications/p510)), $0.309 Wisconsin fuel tax and $0.020 inspection fee ([Wisconsin DOR](https://www.revenue.wi.gov/pages/faqs/ise-mofuel.aspx)). Delivery is an illustrative $0.025 per gallon, not a state-prescribed rate. Wholesale precision is retained; the final display rounds upward to a tenth of a cent. Example: `($2.9580 + $0.184 + $0.309 + $0.020 + $0.025) × 1.0918 = $3.8169328`, displayed as **$3.817**. The source date and calculation are available in the app.

Actual statutory costs depend on the retailer’s eligible terminal, invoice or replacement costs, delivery charges, discounts, and applicable exceptions. The optional **Minimum-price inputs** calculator accepts retailer-specific costs and replaces the headline estimate when valid inputs are supplied. Those inputs stay in your browser.

See [Wisconsin’s cost calculation guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx) and the [AXXIS source report](https://old.axxispetro.com/download/wisconsin-cta.txt).

## Price sources and coverage

Station reports come from GasBuddy searches across Dane County and surrounding communities. Addresses are checked against U.S. Census and official Dane County records before entering the ranking. If GasBuddy is unavailable, the collector can use a clearly labeled Kwik Trip-only fallback.

Prices are saved snapshots. The app preserves source report times and excludes reports outside the selected freshness window. Missing prices, unmatched addresses, and source outages can reduce coverage. The lowest listed price is the lowest eligible report collected, and may change before you reach the pump.

Dane Fuel is an independent project and is not affiliated with GasBuddy or the station brands shown. Logos identify their respective brands.

## How it runs

The website is static HTML, CSS, and JavaScript. A GitHub Actions workflow collects station reports and the terminal report, saves JSON data, and publishes the `site/` directory to GitHub Pages. Visitors load those saved files directly; no application server or API key is required.

The workflow is scheduled daily at **5:00 AM Central time** (`America/Chicago`), adjusting automatically for daylight saving time, when enabled for a public repository. Actual update times depend on GitHub Actions and source availability. Recurring collection and deployment are disabled while the repository is private.

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
