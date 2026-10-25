# לילה זול · LaylaZol

**אותו חדר. לילה יותר זול.** · `laylazol.co.il`

A Hebrew (RTL) hotel price-comparison site for Israeli travellers. It doesn't sell rooms itself.
You search once, and LaylaZol opens the same search, already filled in, on **Booking.com, Agoda,
Expedia, Hotels.com and Trip.com**. Every outbound link carries your affiliate ID, so you earn a
commission on bookings and the traveller pays nothing extra.

## What's inside

| | |
|---|---|
| `/` | Landing page: hero search engine, how it works, destinations, partner tips, FAQ |
| `/search/` | Comparison page: the five partners ranked for the destination, each with a deep link |
| `/destinations/` + 22 destination pages | SEO landing pages (Eilat, Dead Sea, Tel Aviv, Athens, Dubai, Paris, …) |
| `/disclosure/`, `/terms/`, `/privacy/`, `/accessibility/` | Affiliate disclosure, legal pages, accessibility statement (IS 5568) |
| `/credits/` | Photo sources |

## Brand and domain

- **Name:** לילה זול / LaylaZol ("a cheap night"): the promise in two words, and close to what people actually type ("מלון זול ללילה").
- **Domains:** on 2026-10-25 `laylazol.co.il` had no DNS delegation and `laylazol.com` was unregistered in the Verisign RDAP registry, so both looked free. That's a signal, not a guarantee: register both at an ISOC-IL accredited registrar before anything else.
- **Design:** warm paper background, midnight ink, one sunset-orange accent (`--accent` in `src/styles/global.css`).
  Headlines use Karantina (condensed Hebrew display), body text uses Heebo. Full-bleed real photography.

## Photos

Hotlinked from the Unsplash and Pexels CDNs (both licenses allow free commercial use without attribution;
they're credited on `/credits/` anyway). Edit `src/data/photos.ts` to swap any image: Unsplash takes the
`photo-…` ID, Pexels the numeric ID. Netanya has no photo yet and falls back to a generic hotel shot.

Tech: [Astro](https://astro.build) static site with no backend and no database. Pages are pre-rendered HTML,
so they load fast and search engines can read them.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs static site to dist/
```

## Plug in your affiliate IDs (this is where the money comes from)

Copy `.env.example` to `.env` and fill in the IDs. They are all optional: a partner without an ID
still works, you just don't earn on it.

| Partner | Program | Variable |
|---|---|---|
| Booking.com | Booking.com Affiliate Partner Programme | `PUBLIC_BOOKING_AID` |
| Agoda | Agoda Partners | `PUBLIC_AGODA_CID` |
| Expedia / Hotels.com | Expedia Group Affiliate Program | `PUBLIC_EXPEDIA_AFFCID`, `PUBLIC_HOTELSCOM_AFFCID` |
| Trip.com | Trip.com Affiliate Program | `PUBLIC_TRIP_ALLIANCE_ID`, `PUBLIC_TRIP_SID` |

Links are built in `src/lib/partners.ts`. If a program gives you a different link format
(e.g. a tracking-domain redirect), change it there; it's one function per partner.
Before going live, check each partner's current deep-link documentation: parameter names change from time to time.

## Deploy

**GitHub Pages** (included): enable Pages → "GitHub Actions" in the repo settings, then add the
affiliate IDs and `SITE_URL` as *Actions variables*. Every push to `main` deploys.
For a project URL like `https://<user>.github.io/hotelsfind/`, also set `BASE_PATH=/hotelsfind/`.

**Custom domain** (`laylazol.co.il`): point the domain at the host, set `SITE_URL`, and (on Pages)
add a `public/CNAME` file with the domain. Netlify, Vercel or Cloudflare Pages also work: build command
`npm run build`, output folder `dist`.

## SEO: what's built in, and what's still up to you

Built in:
- Hebrew `lang="he" dir="rtl"`, unique `<title>`/description per page, canonical URLs
- `sitemap-index.xml` + `robots.txt` (search results page is `noindex`)
- JSON-LD: Organization, WebSite + SearchAction, BreadcrumbList, FAQPage, TouristDestination
- Open Graph / social share image (`public/og.png`)
- One landing page per destination targeting "מלונות ב{עיר}" searches, with internal linking from the footer
- Affiliate links marked `rel="sponsored"` (Google's requirement for paid links)

Ranking first for "מלונות באילת" against Booking and the big Israeli sites takes months of work that code
alone can't do. The plan:
1. Register the domain in **Google Search Console** and submit the sitemap.
2. **Content**: add more destinations and long-tail pages ("מלונות באילת למשפחות", "מלון ספא בים המלח לזוגות", "מלונות הכל כלול ברודוס"). Edit `src/data/destinations.ts`.
3. **Backlinks**: travel blogs, Facebook travel groups, Israeli deal sites.
4. Add analytics (GA4 or Plausible) to see which destinations convert.

## Legal note

The site states clearly that LaylaZol is a comparison/referral site, not a travel agency, that prices
are set by the partners and not guaranteed, and that it may earn commission. Keep it that way. It is
required by the affiliate programs and by Israeli consumer protection law. Don't use partners' logos
without permission from each program.
