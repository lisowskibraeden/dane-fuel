# Cross-brand station-price investigation

Checked November 2, 2026. The requested result (fresh prices across all Dane County brands, collected automatically with no ongoing charges) has **not been achieved**. The production JSON remains the verified Kwik Trip-only snapshot. No cross-brand source has been promoted into the production collector.

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

## Remaining dependency

A verified, provider-approved cross-brand feed with a zero-cost license and permission to publish its data would satisfy the missing data dependency. We have not found or obtained one. Asking a provider for noncommercial/community access is a possible next step, not a promise that access will be free or complete. No messages have been sent and no paid services have been enabled.

Freshness and coverage remain separate requirements: even a source listing all brands can have missing or old station reports. Missing prices must stay unknown; neither a recent fetch nor the legal-minimum calculator can establish a current pump price for an unreported station.
