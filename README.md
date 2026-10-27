# מלונזול · MalonZol

**משווים את כל האתרים. משלמים הכי פחות.** · `malonzol.com`

A Hebrew (RTL) hotel price-comparison site for Israeli travellers. It doesn't sell rooms. It shows **live
hotel prices from Agoda** for the traveller's dates, and opens the same search on **Booking.com, Expedia,
Hotels.com and Trip.com** in one click. Every outbound link carries your affiliate ID.

## How it works

| Piece | What it does |
|---|---|
| `/` | Hero search, destination "stories", **live weekend deals** (shown when Agoda is connected), destinations, FAQ |
| `/search/` | **Live results**: real hotels, prices in ₪, photos, ratings, discounts. Sort and filters (price, stars, score, deals, breakfast), "show more" deep search. Without live prices it falls back to ranked partner links. |
| `/how-it-works/` | Plain-language guide: why the same room costs different amounts on each site, how the comparison works, why it's free |
| `/destinations/<slug>/` | 23 SEO landing pages with live hotels for the coming weekend, areas, tips, FAQ |
| `/hotel/<slug>/<id>/` | One SEO page **per hotel** from the imported catalog, with a live price check for any dates |
| `/api/search`, `/api/rates` | Server functions that call Agoda with the secret key |

Stack: [Astro](https://astro.build) with pre-rendered pages and two serverless API routes, deployed to **Vercel**.

## 1. Get the affiliate accounts

| Partner | Where | What you get |
|---|---|---|
| **Agoda** (start here) | partners.agoda.com | Site ID + API key → **live prices on the site**. Commission tiers of roughly 4–7% of the booking value |
| **Travelpayouts** (easiest) | travelpayouts.com | One account for Booking.com, Agoda and more. Generate one link in the dashboard and copy `marker`, `trs` and `p` into `PUBLIC_TP_*` (see `.env.example`) |
| Booking.com | Travelpayouts (above), or the CJ affiliate network | Links only. Its price API is only for large contracted partners |
| Expedia / Hotels.com | Expedia Group affiliate program | IDs for links |
| Trip.com | Trip.com affiliate program | Allianceid + SID for links |

Don't scrape Booking.com or any other partner. Their affiliate agreements forbid automated extraction, and
breaking that gets the account closed and the commissions cancelled. Everything here uses official APIs and links.

## 2. Connect Agoda (live prices)

1. In the Agoda partner portal get your **Site ID** and **API key**.
2. Set `AGODA_SITE_ID` and `AGODA_API_KEY` (Vercel → Project → Settings → Environment Variables).
3. Download the **Hotel Data File** (Tools → Hotel Data file, CSV) and import it:

   ```bash
   npm run agoda:import -- ~/Downloads/agoda-hotels.csv --per-city 300
   ```

   This writes the Agoda **city IDs** for every destination (`src/data/agoda-cities.json`) and a **hotel catalog**
   (`src/data/catalog/<slug>.json`), which becomes one page per hotel. Commit both files and redeploy.
   No file yet? You can set city IDs directly with `AGODA_CITY_IDS={"eilat":12345,...}`.

Destinations without a city ID, and searches when Agoda is down or the quota is hit, automatically fall back to the
partner links, so search never breaks.

## 3. Run and deploy

```bash
npm install
cp .env.example .env      # fill in what you have
npm run dev               # http://localhost:4321
AGODA_DEMO=1 npm run dev  # preview the results UI with clearly-labelled sample data, no keys needed
npm run build
```

**Deploy:** import the GitHub repo in Vercel (framework: Astro, no config needed), add the environment variables,
and point `malonzol.com` (plus `malonzol.co.il`) at it. CI (`.github/workflows/ci.yml`) builds every pull request.
Vercel's free Hobby plan is for non-commercial use only; an affiliate site needs the Pro plan (or another host).

## Brand

- **Name:** מלונזול (MalonZol), literally "cheap hotel": what Israelis type into Google, understood instantly.
- **Domains:** on 2026-10-25 `malonzol.com` and `malonzol.co.il` showed no registration, and no existing business used the name. Register both; a descriptive name is easier to protect as a registered logo mark than as a word mark.
- **Look:** a deep-blue brand band (header and hero) with a sunny yellow search frame, white product UI and Assistant type (`--brand`, `--sun`, `--fire-grad` in `src/styles/global.css`). On phones, sections become swipeable rows, results are compact photo-on-the-side cards, and filters open as a bottom sheet. The logo is a price tag whose down arrow drops on hover, and searches show a "scanning the booking sites…" animation.
- **Photos:** Unsplash / Pexels CDNs (free commercial use), credited on `/credits/`; edit `src/data/photos.ts`.

## SEO

- Hebrew `lang="he" dir="rtl"`, unique titles and descriptions, canonical URLs, Open Graph image
- `sitemap-index.xml` + `robots.txt`; the search results page is `noindex`
- JSON-LD: Organization, WebSite + SearchAction, BreadcrumbList, FAQPage, TouristDestination, Hotel
- One page per destination and, after the import, **one page per hotel**: thousands of long-tail landing pages
- Affiliate links marked `rel="sponsored"`

Rankings still take months: submit the sitemap in Google Search Console, keep adding content, and earn links.

## What the site claims

Live prices come from Agoda only. Booking.com, Expedia, Hotels.com and Trip.com are links that open the same
destination and dates; the site never shows or ranks their prices. Prices are per night before taxes; there is no
computed total. More than one room, or children without ages, falls back to the partner links with the reason shown.

## Price mode

`PUBLIC_PRICE_MODE` decides what the deployment does with prices:

- `links` (default): no prices anywhere. Price routes never call a provider, whatever keys are set, and the
  copy, FAQ, meta tags and share image don't promise prices.
- `live`: price routes call the configured providers. Turn on only once a provider has approved the use.

Changing it needs a redeploy (page copy is built with it).

## Limits and measurement

- `/api/search` redirects to one canonical query string, so junk params can't mint new CDN entries; identical
  searches in flight share one Agoda call; "show more" makes at most 6 calls. Prices are never cached.
  Before opening the site to the public, add a rate-limit rule for `/api/*` in Vercel's Firewall.
- Outbound clicks are sent to Vercel Web Analytics as `outbound` events (partner, place on page, link route).
  Pages are reported without their query string. Enable Web Analytics in the Vercel project. Clicks are not bookings:
  compare with the partners' reports.
- `npm run check` type-checks the project; CI runs it before the build.

## Legal

The site says clearly that MalonZol is a comparison site, not a travel agency, that prices come from partners
and aren't guaranteed, and that it may earn commission. The affiliate programs and Israeli consumer law require it.
Don't use partner logos without permission.

Before launch, confirm with each program that this kind of site is allowed: Agoda's affiliate agreement treats
comparison sites and the use of its content separately, and Travelpayouts brands approve traffic sources one by one.
Hotel pages built from the Agoda catalog stay `noindex` until `INDEX_HOTEL_PAGES=1`.
