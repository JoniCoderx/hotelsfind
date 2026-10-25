# HotelFindz · הוטל פיינדז

**כל המלונות. כל המחירים. חיפוש אחד.** · `hotelfindz.com`

A Hebrew (RTL) hotel price-comparison site for Israeli travellers. It doesn't sell rooms. It shows **live
hotel prices from Agoda** for the traveller's dates, and opens the same search on **Booking.com, Expedia,
Hotels.com and Trip.com** in one click. Every outbound link carries your affiliate ID.

## How it works

| Piece | What it does |
|---|---|
| `/` | Hero search, destination "stories", **live weekend deals** (shown when Agoda is connected), destinations, FAQ |
| `/search/` | **Live results**: real hotels, prices in ₪, photos, ratings, discounts. Sort and filters (price, stars, score, deals, breakfast), "show more" deep search. Without live prices it falls back to ranked partner links. |
| `/destinations/<slug>/` | 23 SEO landing pages with live hotels for the coming weekend, areas, tips, FAQ |
| `/hotel/<slug>/<id>/` | One SEO page **per hotel** from the imported catalog, with a live price check for any dates |
| `/api/search`, `/api/rates` | Server functions that call Agoda with the secret key |

Stack: [Astro](https://astro.build) with pre-rendered pages and two serverless API routes, deployed to **Vercel**.

## 1. Get the affiliate accounts

| Partner | Where | What you get |
|---|---|---|
| **Agoda** (start here) | partners.agoda.com | Site ID + API key → **live prices on the site**. Commission tiers of roughly 4–7% of the booking value |
| Booking.com | via the CJ affiliate network (Booking no longer signs up partners directly) | `aid` for links. Its API is only for large contracted partners |
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
and point `hotelfindz.com` (plus `hotelfindz.co.il` and `hotelfinds.co.il`) at it. CI (`.github/workflows/ci.yml`) builds every pull request.

## Brand

- **Name:** HotelFindz: says exactly what it does (finds hotels), with a playful Z that the logo highlights.
- **Domains:** on 2026-10-25 `hotelfindz.com`, `hotelfindz.co.il` and `hotelfinds.co.il` showed no registration. Register all three; `hotelfinds.co.il` catches people who type an S. (`hotelfinds.com` is taken.)
- **Look:** clean white product UI, Assistant type, a blue-to-teal gradient (`--fire-grad` in `src/styles/global.css`), a warm accent only for hot deals (`--hot-grad`). The logo's magnifier wiggles on hover, and searches show a "scanning the booking sites…" animation.
- **Photos:** Unsplash / Pexels CDNs (free commercial use), credited on `/credits/`; edit `src/data/photos.ts`.

## SEO

- Hebrew `lang="he" dir="rtl"`, unique titles and descriptions, canonical URLs, Open Graph image
- `sitemap-index.xml` + `robots.txt`; the search results page is `noindex`
- JSON-LD: Organization, WebSite + SearchAction, BreadcrumbList, FAQPage, TouristDestination, Hotel
- One page per destination and, after the import, **one page per hotel**: thousands of long-tail landing pages
- Affiliate links marked `rel="sponsored"`

Rankings still take months: submit the sitemap in Google Search Console, keep adding content, and earn links.

## Legal

The site says clearly that HotelFindz is a comparison site, not a travel agency, that prices come from partners
and aren't guaranteed, and that it may earn commission. The affiliate programs and Israeli consumer law require it.
Don't use partner logos without permission.
