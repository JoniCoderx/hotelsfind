import type { APIRoute } from 'astro';
import { agodaConfigured, AgodaError, searchCity, type CitySearch, type Hotel } from '../../lib/agoda';
import { demoHotels } from '../../lib/demo';
import { parseGuests } from '../../lib/guests';
import { canonicalSearch } from '../../lib/searchkey';
import { agodaCityId, findDestination } from '../../lib/resolve';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

function json(body: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

function int(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= min && n <= max ? n : def;
}

// Identical searches arriving together (before the CDN has a copy) share one Agoda call.
const inFlight = new Map<string, Promise<Hotel[]>>();

export const GET: APIRoute = async ({ url }) => {
  const key = canonicalSearch(url.searchParams);
  if (url.search.slice(1) !== key) {
    return new Response(null, { status: 308, headers: { Location: `${url.pathname}?${key}`, 'Cache-Control': 'public, s-maxage=86400' } });
  }
  const p = url.searchParams;
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  if (!DATE.test(checkin) || !DATE.test(checkout)) return json({ error: 'bad_dates' }, 400);
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30) return json({ error: 'bad_dates' }, 400);
  if (Date.parse(checkin) < Date.now() - 2 * DAY) return json({ error: 'past_dates' }, 400);

  const dest = findDestination({ slug: p.get('slug'), q: p.get('q'), d: p.get('d') });
  const cityId = dest && agodaCityId(dest);
  const meta = { destination: dest ? { slug: dest.slug, he: dest.he } : null, nights };

  const demo = !agodaConfigured() && process.env.AGODA_DEMO === '1';
  // Off switch: LIVE_PRICES=off sends every search to the partner links (quota trouble, partner request).
  if (process.env.LIVE_PRICES === 'off') return json({ mode: 'links', ...meta, reason: 'off' });
  if (!cityId && !demo) return json({ mode: 'links', ...meta });
  if (!agodaConfigured() && !demo) return json({ mode: 'links', ...meta });

  const guests = parseGuests(p);
  if ('error' in guests) return json(guests, 400);
  // Agoda's Lite API prices one room; for more rooms we send people to the partner sites.
  if (guests.rooms > 1) return json({ mode: 'links', ...meta, reason: 'rooms' });

  const sort = p.get('sort');
  const search = {
    cityId: cityId ?? 0,
    checkin,
    checkout,
    adults: guests.adults,
    children: guests.children,
    childrenAges: guests.childAges,
    sortBy: (['PriceAsc', 'StarRatingDesc', 'AllGuestsReviewScore'] as const).find((s) => s === sort) ?? 'Recommended',
    minStars: int(p.get('stars'), 0, 0, 5),
    minScore: int(p.get('score'), 0, 0, 10),
    minRate: int(p.get('min'), 0, 0, 100_000),
    maxRate: int(p.get('max'), 100_000, 1, 100_000),
    discountOnly: p.get('deal') === '1',
  } satisfies CitySearch;

  try {
    let hotels: Hotel[];
    if (demo) hotels = demoHotels(search, dest?.slug ?? 'x');
    else {
      let job = inFlight.get(key);
      if (!job) {
        job = searchCity(search, p.get('deep') === '1').finally(() => inFlight.delete(key));
        inFlight.set(key, job);
      }
      hotels = await job;
    }
    // Prices move, but not by the second: the CDN shares a result for up to 10 minutes, so the
    // response carries when Agoda was actually asked and the page shows that time.
    const checkedAt = new Date().toISOString();
    return json({ mode: demo ? 'demo' : 'live', ...meta, checkedAt, hotels }, 200, 'public, s-maxage=600, stale-while-revalidate=1800');
  } catch (e) {
    const status = e instanceof AgodaError ? e.status : 502;
    console.error('agoda search failed', e);
    return json({ mode: 'links', ...meta, error: 'upstream' }, status);
  }
};
