# Dane Fuel

A mobile-friendly, static gas-price finder for Dane County, Wisconsin. The largest number is the retailer’s **calculated standard Wisconsin minimum selling price**, including markup, using eligible cost inputs. It stays uncalculated until required inputs are provided. Below it, all recent, county-verified regular station reports are sorted cheapest first, with locally stored brand logos. Membership and cash-only prices are excluded by default and can be included with filters.

## Current state

The project is private and publication is disabled. **Cross-brand GasBuddy collection is working in the GitHub runner.** The [complete verification](https://github.com/lisowskibraeden/dane-fuel/actions/runs/41555853033) passed on November 2, 2026 in eight minutes: all 30 configured searches completed, 180 unique station listings were checked, and 152 regular-price reports were saved. Prices were retrieved at 6:59 PM CST. County verification now confirms 150 of those reports using Census and official county address data; two unmatched addresses remain excluded. These are recorded snapshots, not promises of the current pump price. All 35 local tests pass.

The collector starts stock Google Chrome with a temporary anonymous profile and attaches through its local debugging interface. It opens the normal search page and observes the website's own station and price requests. It replays those public operations in the same session, with the site's required CSRF and Apollo preflight headers. It does not import a user's browser profile, cookies or login, and uses no paid proxy, publisher key or third-party feed. The temporary profile is removed after collection; cleanup failures cannot discard collected prices.

The source's own numeric cursor convention determines the end of pagination. Duplicate station IDs are removed. Requests are separated by at least five seconds; an HTTP 429 receives one bounded retry after the requested cooldown. Access failures are recorded and stop collection rather than triggering an unbounded retry loop. No CAPTCHA interaction is automated.

Source report timestamps are preserved. Fetching an old price does not make it current. Missing prices and reports older than the selected freshness window never enter the ranking. A successful scrape is not proof that every physical station has a current GasBuddy report.

Kwik Trip's public first-party service remains an explicitly labeled limited-coverage fallback. The strict verification fails if that fallback is used or any configured search fails. Private recurring jobs and Pages deployment remain disabled.

## Run locally

Use Node.js 24 and Python 3:

```sh
npm ci
npm test
npm run serve
```

Open http://localhost:8080. The Linux runner uses a normal Chrome process under Xvfb:

```sh
npx playwright install --with-deps chrome
xvfb-run -a npm run collect -- --headed --chrome --standard-chrome --require-gasbuddy
```

Use `--smoke` for Madison only. A full run checks the county search and 29 community searches, following each response's available pagination. `--require-gasbuddy` makes fallback-only or incomplete source collection fail the run while still preserving the attempt status. Without it, an explicitly labeled Kwik Trip fallback can succeed.

## Standalone GasBuddy scraper

To test without replacing the site's data:

```sh
xvfb-run -a npm run scrape:gasbuddy -- --headed --chrome --standard-chrome --smoke
```

On a Linux desktop with a display, omit `xvfb-run -a`. Stock Chrome is expected at `/opt/google/chrome/chrome`; `CHROME_BIN` can point to another installed Chrome binary. Output goes to `work/gasbuddy/prices.json`, with a separate county cache. Omit `--smoke` for all configured searches.

## County accuracy and coverage

Community labels are not treated as county boundaries. For GasBuddy reports, each new address is checked with the free U.S. Census Geocoder. If it cannot match an address, the collector queries the [official Dane County address layer](https://dcimapapps.danecounty.gov/arcgissrv/rest/services/Addressing/MapServer/0). County records must match the house number, normalized street, postal code (or mailing/physical municipality when a postal code is absent), state FIPS 55 and county FIPS 025. Only a confirmed county match with GEOID **55025** enters the ranking. The official Kwik Trip fallback instead requires the state and county fields to match WI and DANE in both discovery and the store-detail response. It records that provider as the county authority; it is not independently Census-geocoded. Positive county matches are cached for 180 days; unknown matches are rechecked after seven days. Unmatched addresses and county-service outages can reduce coverage. Expired cache entries are not accepted on geocoding failure.

The collector follows the public search service's available pagination rather than taking only the first community-page cards. The official fallback covers only the selected Kwik Trip stores, not other brands or a guaranteed complete county inventory. “Lowest reported” means the lowest eligible price among retrieved, verified reports; it does not establish a countywide census of every pump. The default maximum report age is 24 hours; users may choose 6 or 12. Relative source ages become approximate timestamps at collection time. Reports are deduplicated across pages by station ID. Old retained reports still expire from the displayed ranking automatically.

The headline calculation requires a sale date, closest-terminal cost for the preceding day, and at least one eligible invoice or current replacement cost. Costs entered must already include taxes, delivery and other required charges, adjusted for applicable trade discounts. An eligible purchase-day terminal cost can optionally be used for a purchase 1–10 days earlier. The invoice branch requires a purchase within 10 days. It takes the lower eligible invoice/replacement cost, applies the applicable 6% or 9.18% markup, and compares that with the eligible terminal branch plus 9.18%. The higher amount is displayed, rounded upward to the next tenth of a cent. The calculation is conditional on valid retailer inputs; it is not a universal countywide legal price and does not model competition-matching exceptions. Cost inputs are stored only in the visitor’s browser.

## Free GitHub hosting, when you choose to publish

GitHub Free provides Pages for **public** repositories and standard Actions runners for public repositories. Private repositories can consume a limited monthly Actions allowance and may require a paid plan for Pages. This workflow skips **all recurring jobs while the repository is private**. A manually dispatched run with `private_test=true` may run one verification in a private repository, after the owner confirms an enforced $0 Actions budget. That test can use included private-repository Actions minutes but cannot deploy Pages. The default manual input is false. It cannot publish private source.

When you explicitly decide to make this repository public:

1. In Settings → Pages, select **GitHub Actions** as the source.
2. In Settings → Secrets and variables → Actions → Variables, create `ENABLE_FREE_UPDATES` with value `true`.
3. In Actions, run **Refresh prices and deploy Pages** manually once.
4. Confirm collection succeeds and prices have real report times. Open the deployment URL after success.

The job is scheduled at minute 17 of every hour (UTC). GitHub may delay schedules or disable them after 60 days without repository activity. Updater commits usually create activity, but check the Actions tab if updates stop. No paid runners, paid feeds, custom domains, third-party proxies or API keys are configured. No paid plan or service is required for the public-repository setup. Keep the repository private until you are ready; changing its visibility is a separate choice.

Pushes made using `GITHUB_TOKEN` do not trigger another push workflow. A single scheduled workflow updates JSON, commits it and deploys the static `site/` directory. The latest attempt status is deployed even when collection fails, then the job reports the failure. It never silently substitutes a city average.

## One-time private verification

Confirm an enforced $0 Actions budget with stop-usage enabled in GitHub billing settings first. In Actions → Refresh prices and deploy Pages → Run workflow, set `private_test` to true. This explicitly runs the collector once, preserves the attempt JSON and reports failure if no prices were retrieved. Pages deployment stays disabled while private. It does not enable the hourly schedule.

## Phone use

Once hosted over HTTPS, open in Safari or Chrome and choose Add to Home Screen / Install. The relative manifest, module and data URLs support a GitHub project path such as `/dane-fuel/`. The service worker caches the application shell only. Price data is never served from the service-worker cache. A connection is required to load prices. Visitors need no GitHub or ChatGPT account.

## Files

- `site/`: static website and same-origin JSON; no runtime backend or build step.
- `scripts/collect.mjs`: scheduled collection, county verification and atomic data writes.
- `scripts/gasbuddy.mjs`: public website request capture, throttled pagination and report normalization.
- `scripts/browser.mjs`: isolated stock-Chrome lifecycle.
- `scripts/county.mjs`: exact business-address matching against free official county records.
- `scripts/kwiktrip.mjs`: free first-party discovery, grade validation and quote collection.
- `scripts/core.mjs` / `site/model.js`: shared normalization and ranking rules.
- `.github/workflows/update-and-deploy.yml`: guarded, hourly collection and Pages deployment.
- `tests/`: price parsing, exclusions, ranking and failure-related data rules.

Sources: [Kwik Trip public locator](https://www.kwiktrip.com/locator), [official location service](https://api.kwiktrip.com/api/stores/nearby?latitude=43.0731&longitude=-89.4012&limit=100), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html), [Wisconsin calculation guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx).

## Source investigation

The earlier default-browser and alternative-source tests are documented in [the source investigation](docs/data-source-investigation.md). Cross-brand collection is now demonstrated; the site identifies GasBuddy as its source when that collection succeeds. Coverage and freshness are still reported explicitly.
