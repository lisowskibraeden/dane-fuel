# Dane Fuel

A mobile-friendly, static gas-price finder for Dane County, Wisconsin. The largest number is the retailer’s **calculated standard Wisconsin minimum selling price**, including markup, using eligible cost inputs. It stays uncalculated until required inputs are provided. Below it, all recent, county-verified regular station reports are sorted cheapest first, with locally stored brand logos. Membership and cash-only prices are excluded by default and can be included with filters.

## Current state

The project is private and publication is disabled. The normal GasBuddy browser request is blocked in the GitHub runner. The collector now falls back to **Kwik Trip’s public first-party location service**, which requires no login, API key or paid service. The site clearly labels this as **Kwik Trip only**, rather than claiming the cheapest price across all brands in Dane County.

The fallback discovers the 100 stores nearest Madison, selects fuel stores marked Dane County, Wisconsin, then fetches each store’s regular-87 quote. Premium, E15/88 and diesel are excluded. The service provides currentPrice but no price-change timestamp: the site shows **Fetched** times, never invented report times. Store-profile modification dates are not used as price dates. Old snapshots expire normally and failed requests never refresh their timestamps.

GasBuddy collection uses a normal Playwright Chromium session and stops on a challenge. The original failed verification is recorded at https://github.com/lisowskibraeden/dane-fuel/actions/runs/41506782583. No publisher keys, paid feeds, proxies, stealth tools or challenge bypasses are used.

## Run locally

Use Node.js 24 and Python 3:

```sh
npm ci
npm test
npm run serve
```

Open http://localhost:8080. To test a single collection page:

```sh
npx playwright install chromium
npm run collect -- --smoke
```

To collect all configured community lists and use the official fallback if none return prices, run `npm run collect`. Up to 29 community pages are checked sequentially, with pauses. Prices hydrate before extraction. Only visible regular-price reports are read. Reports with no recognizable price/time are ignored. No site login is required or attempted.

## County accuracy and coverage

Community labels are not treated as county boundaries. For GasBuddy reports, every new address is looked up through the free U.S. Census Geocoder. Only an unambiguous county match with GEOID **55025** enters the ranking. The official Kwik Trip fallback instead requires the state and county fields to match WI and DANE in both discovery and the store-detail response. It records that provider as the county authority; it is not independently Census-geocoded. Census matches are cached for 180 days. Unmatched addresses and county-service outages can reduce coverage. Expired cache entries are not accepted on geocoding failure.

GasBuddy's local pages may list only their top stations. The official fallback covers only the selected Kwik Trip stores, not other brands or a guaranteed complete county inventory. “Lowest reported” means the lowest eligible price among retrieved, verified reports; it does not establish a countywide census of every pump. The default maximum report age is 24 hours; users may choose 6 or 12. Relative source ages become approximate timestamps at collection time. Reports are deduplicated across pages by station ID. Old retained reports still expire from the displayed ranking automatically.

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
- `scripts/collect.mjs`: scheduled collector and county verification.
- `scripts/kwiktrip.mjs`: free first-party discovery, grade validation and quote collection.
- `scripts/core.mjs` / `site/model.js`: shared normalization and ranking rules.
- `.github/workflows/update-and-deploy.yml`: guarded, hourly collection and Pages deployment.
- `tests/`: price parsing, exclusions, ranking and failure-related data rules.

Sources: [Kwik Trip public locator](https://www.kwiktrip.com/locator), [official location service](https://api.kwiktrip.com/api/stores/nearby?latitude=43.0731&longitude=-89.4012&limit=100), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html), [Wisconsin calculation guidance](https://datcp.wi.gov/Pages/Programs_Services/UnfairSalesAct.aspx).
