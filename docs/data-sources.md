# Price data sources for MalonZol (research of 25 Oct 2026)

Goal: one search that returns real prices from at least two booking sites, grouped per hotel, ranked by the
all-in price for the stay, with an affiliate click-out. "Documented" means the vendor's own docs say so;
"needs approval" means we have no access until a contract or approval; nothing here has been run live yet.

## Agoda
- **Right product:** Search API 2.0 in the "Online Affiliates / MSE" model (developer.agoda.com/demand/docs).
  - Account manager → feasibility study → contract and vendor form → sandbox → certification → live.
  - There are no demo keys.
- **Request:** up to 100 property IDs per search, so a destination needs its hotel IDs from the content feed.
  - One occupancy for the whole booking: rooms, adults, children, childrenAges.
- **Price:** `totalPayment.inclusive` per booking, which includes taxes, fees and "Mandatory" surcharges.
  "Excluded" surcharges are paid at the hotel and must be shown.
- **Room terms:** cancellation, meal plan and room name are returned.
- **Click-out:** `landingUrl` is returned only with the `metaSearch` feature.
- **Public Online Affiliate Agreement (2023)**, partners.agoda.com. The MSE contract we would sign may differ;
  only the terms approved for our account count:
  - 4.5.2: comparison sites need written approval.
  - 4.8.2: no Agoda photos or texts on a comparison site.
  - 4.8.4: Agoda must be ranked at least as favourably as the best-converting provider.
  - 4.3.2: no combining Agoda data with a competitor's content.
  - 4.4.1: limits on paid search and SEO.
  - 4.9.3: breaches can stop commission.
  - Ask Agoda, with screenshots:
    - how 4.3.2 and 4.8.4 apply to our offer rows and price sort (don't assume 4.8.4 means ranking Agoda
      above a cheaper offer);
    - whether we may use Agoda names, coordinates and IDs internally to build the cross-connector mapping.
- **Commission:** 4–5% by monthly departures (5.2).
- **Lite API:** per-night price before taxes, one room, no cancellation terms. Can't support a fair all-in comparison.

## Booking.com
- **Access:** Demand API 3.2 needs "Managed Affiliate Partner" status, given by an account manager after a contract.
  - The public affiliate programme (CJ/Awin) and Travelpayouts give links only.
  - The sandbox uses your production key, so no testing before the contract.
- **Search:** `/accommodations/search` takes coordinates or a city plus dates, and `guests.allocation` per room with child ages.
  - `extras=products` adds the room, meal plan and cancellation.
- **Price:** `total` = book price + excluded non-conditional charges. This is the field to rank on.
- **Usage rules:**
  - Prices must not be cached.
  - Rate limits are set per account.
  - Clickouts carry `label` as the sub-ID.
- **Separate product:** "Metasearch Connect API" exists for metasearch engines, through account managers.

## Multi-site metasearch APIs (several booking sites per hotel in one call)
- **Vio.com Partners API** (developers.vio.com):
  - Access: revenue-share agreement (affiliate@vio.com); the profile key goes in `X-Partner-Key`.
  - Endpoints: `POST /v1/search`, and `/v1/search/poll`, which returns `completed` and a `sessionId`.
  - Query: hotel names with city and country, hotel IDs (only after Vio maps our inventory), place or coordinates.
  - Request context: `rooms` such as `1:4,6|3` (child ages included), `userCountry`, `userDevice`, `currency`.
    `timeout` may return an incomplete list.
  - Price: `rate` = `base` (no taxes) + `taxes` (VAT) + `hotelFees` (mandatory, paid at the hotel).
    "All prices are specified per room".
    The price filter compares nightly bounds × nights with the whole-stay offer price, so we read rates as
    whole-stay per room.
  - Offer fields: `provider` is "the provider distributing this offer, not necessarily the same as the provider
    selling the offer". Offers also carry meals (`package.amenities`), `cancellationPenalties` and `roomName`.
  - Click-out: the URL is a Vio tracking link. Our sub-ID goes in `click_label`, which appears in partner
    reports. Revenue comes through Vio's agreement, not our own affiliate IDs.
  - To confirm with Vio: whole stay vs per night; how to show `provider` when it is not the seller; caching
    rules; multi-room totals.
- **KAYAK / HotelsCombined Hotels API (checked 2026-10-26 on affiliates.kayak.com and developers.kayak.com):**
  - Access: apply on affiliates.kayak.com or partnerships@kayak.com; the form offers free Sandbox API access.
    Production keys only once the use case is approved. Whitelabel is offered on application too.
  - Israel: KAYAK runs a Hebrew right-to-left site in shekels (he.kayak.com, locale he-IL, ILS), and the
    whitelabel uses "dedicated subdomains per locale" for language and currency. Not confirmed: whether
    Israeli traffic earns revenue share; third-party pages disagree. Ask KAYAK in writing.
  - Hotels Search API v3: `apiKey` and `userTrackId` per session, `currencyCode`, rooms as `2:5,9|2`,
    per-provider rates with a booking link, free-cancellation, pay-later and "excluded charges" flags, and an
    optional `rateBreakdown`.
  - Request: hotel ID or coordinates, rooms with child ages, plus a static feed of 5M+ hotels with coordinates.
  - Response: per-provider `totalRate`, `taxes`, `localTaxes` and free-cancellation flags.
- **Skyscanner Stays Live Prices:**
  - Access: for "established" businesses, reviewed within two weeks.
  - Price: for Israel, `price` includes all taxes and fees.
  - Rules: "Powered by Skyscanner" required, live prices not to be cached, and 5–20% of searches should end in a click-out.
- **Tripadvisor Hotel Pricing API:** apply by email with traffic figures; terms not public.

## Rules the engine enforces before any "cheapest" tag

- **Seller identity.** Only connectors that sell themselves (Agoda, Booking.com) count as booking sites. Offers through
  Vio are shown with "via Vio, seller not confirmed" and never count toward the two sites, because Vio's `provider` is
  the distributor, "not necessarily the same as the provider selling the offer".
- **Vio hotel identity.** A name query joins a hotel only when Vio returns the exact property page (`details.vioUrl`)
  that we verified for that name; `noMappingFallback` is on. A neighbour with a similar name is dropped.
- **Price meaning per connector.** `PRICE_VERIFIED` lists connectors whose price unit was confirmed with the provider
  and checked on real answers. Nothing else is ranked. Agoda surcharges are added only for `method: "PB"`, the one the
  docs define; any other value stops ranking. Booking conditional charges are flagged on the offer; a missing charge
  breakdown means unknown, an empty one means none.
- **Booker context.** Device comes from the browser's user agent, not window width. Booker location from Vercel's geo
  header, else `DEFAULT_BOOKER_COUNTRY`. Agoda's `userCountry` is nationality, from `GUEST_NATIONALITY` (an assumption).
- **Best per site.** The cheapest all-in offer from that site after the user's filters (e.g. free cancellation).
- **Time.** The badge says when prices were checked; after 15 minutes the page removes it and asks for a recheck.

## Not usable or avoid
- **Travelpayouts Hotellook:** closed 20 Oct 2025.
- **Amadeus Self-Service:** closed to new users; prices are for booking, not affiliate click-outs.
- **Expedia:**
  - The pause applies to the **Travel Redirect / XAP Lodging Listings** API: "paused all new API applications".
  - The Travel Creator Program gives links without an API.
  - Rapid is a B2B booking API.
  - We have not checked every Expedia product.
- **Trip.com:** the standard affiliate agreement forbids comparison sites and showing its content beside others without written approval.
- **Hotelbeds, RateHawk, LiteAPI:** wholesale rates you resell, not "site X's price".
- **Makcorps, Xotelo and scrapers:** data source not licensed or not disclosed.
