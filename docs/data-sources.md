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
- **Online Affiliate Agreement (2023)**, partners.agoda.com:
  - 4.5.2: comparison sites need written approval.
  - 4.8.2: no Agoda photos or texts on a comparison site.
  - 4.8.4: Agoda must be ranked at least as favourably as the best-converting provider.
  - 4.3.2: no combining Agoda data with a competitor's content.
  - 4.4.1: limits on paid search and SEO.
  - 4.9.3: breaches can stop commission.
  - Ask Agoda how 4.3.2 fits a comparison display.
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
- **Vio.com Partners API:**
  - Access: revenue-share agreement (affiliate@vio.com).
  - Request: rooms with child ages.
  - Click-out: `click_label` sub-ID.
  - Matching: they map your hotel list during onboarding.
  - Not yet checked: tax inclusion and caching rules.
- **KAYAK / HotelsCombined Hotels API:**
  - Access: free sandbox through a form; production only on approval, based on traffic.
  - Request: hotel ID or coordinates, rooms with child ages, plus a static feed of 5M+ hotels with coordinates.
  - Response: per-provider `totalRate`, `taxes`, `localTaxes` and free-cancellation flags.
- **Skyscanner Stays Live Prices:**
  - Access: for "established" businesses, reviewed within two weeks.
  - Price: for Israel, `price` includes all taxes and fees.
  - Rules: "Powered by Skyscanner" required, live prices not to be cached, and 5–20% of searches should end in a click-out.
- **Tripadvisor Hotel Pricing API:** apply by email with traffic figures; terms not public.

## Not usable or avoid
- **Travelpayouts Hotellook:** closed 20 Oct 2025.
- **Amadeus Self-Service:** closed to new users; prices are for booking, not affiliate click-outs.
- **Expedia:** link-off API applications paused. Rapid is a B2B booking API.
- **Trip.com:** the standard affiliate agreement forbids comparison sites and showing its content beside others without written approval.
- **Hotelbeds, RateHawk, LiteAPI:** wholesale rates you resell, not "site X's price".
- **Makcorps, Xotelo and scrapers:** data source not licensed or not disclosed.
