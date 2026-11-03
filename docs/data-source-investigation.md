# Cross-brand station-price investigation

**Verified result:** [full run 41555853033](https://github.com/lisowskibraeden/dane-fuel/actions/runs/41555853033) completed successfully in eight minutes on November 2, 2026. It checked 180 unique listings through the county search and 29 community searches, and saved 152 regular-price reports. Subsequent verification using the county's official address records brought the county-confirmed total to 150 without changing any price or report timestamp. All 35 local tests pass.

The working adapter uses stock Chrome with an isolated anonymous profile, the website's own request templates and the required CSRF/Apollo preflight headers. It follows the provider's final-row cursor convention and checks the resolved state. Oregon, Wisconsin uses ZIP 53575 to avoid being interpreted as the state of Oregon. There are no paid proxies, imported user sessions or external API keys.

The [official county address layer](https://dcimapapps.danecounty.gov/arcgissrv/rest/services/Addressing/MapServer/0) resolves addresses missed by Census using exact house/street/postal or municipality fields and explicit state/county FIPS. Two addresses remain unverified and are excluded from the ranking.

The earlier results below describe the investigation, not the current production implementation.

## Actual GitHub runner tests

[Manual cross-brand probe, run 41548477034](https://github.com/lisowskibraeden/dane-fuel/actions/runs/41548477034) used normal Playwright Chromium requests without logins, publisher credentials, proxies or challenge-solving:

| Public source | Runner response | Usable prices |
| --- | --- | --- |
| iExit Madison regular-price list | HTTP 403, “Just a moment…” | 0 |
| Way Madison station listings | HTTP 403, “Just a moment…” | 0 |
| Autoblog legacy Madison gas-price page | HTTP 404 | 0 |

The diagnostic workflow is green because the diagnostic ran successfully; that does **not** mean any source returned usable prices. It is manual only, has read-only repository permissions and does not deploy or change production data.

The separate [GasBuddy verification](https://github.com/lisowskibraeden/dane-fuel/actions/runs/41506782583) also encountered an access challenge. The [official Kwik Trip fallback verification](https://github.com/lisowskibraeden/dane-fuel/actions/runs/41547799719) collected 57 regular-87 quotes successfully. That is limited brand coverage, not a countywide price census.

## Supported integration options checked

- [iExit API documentation](https://developer.iexitapp.com/reference/getting-started): API access requires purchasing a partner key. Its [fuel-price model](https://developer.iexitapp.com/reference/fuel-price) includes GasBuddy/OPIS prices and update timestamps. A trial is not an ongoing free solution.
- [TomTom Fuel Prices API](https://docs.tomtom.com/fuel-prices-api/documentation/product-information/introduction): explicitly excluded from free evaluation and pay-as-you-grow; sales access required.
- [Google Places fuel fields](https://developers.google.com/maps/documentation/places/web-service/reference/rpc/google.maps.places.v1#fueloptions): last-known per-grade prices with provider update times. [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) includes a limited free allowance, followed by metered charges; that is not inherently a $0 spending cap. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) restrict prefetching, caching and storing content. Do not implement it as a runner exporting prices into committed static JSON. This route has not been configured or tested for Dane County coverage.
- [AAA station-level finder](https://www.acg.aaa.com/drivers-safety/fuel-prices.html): a separate tool from the AAA averages website, covering stations across brands. Its published link goes to an OPIS-hosted service. This is a consumer finder, not a demonstrated free redistribution API for our site; no publisher token was repurposed.
- [OPIS PricePro](https://info.opisnet.com/opis-pricepro-improve-retail-fuel-pricing-strategies): a supported cross-brand real-time feed product with API integration, offered through sales/demo. No zero-cost license or public-display permission has been obtained.

## Current limitations

Collection depends on the public website continuing to serve its search operations. The scraper uses the same anonymous session that loaded the search page, spaces requests apart, honors a bounded rate-limit cooldown and records failures. It does not automate CAPTCHA interaction.

No provider can supply a current reported price where its source has none. Freshness and coverage remain separate: county-matched reports outside the selected age window are excluded, and a recent fetch never changes the original report timestamp. The site must describe its result as the lowest among available qualifying reports, not certify every pump in the county.
