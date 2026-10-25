import type { APIRoute } from 'astro';
import { agodaConfigured, AgodaError, searchCity, type Hotel } from '../../lib/agoda';
import { demoHotels } from '../../lib/demo';
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

export const GET: APIRoute = async ({ url }) => {
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
  if (!cityId && !demo) return json({ mode: 'links', ...meta });
  if (!agodaConfigured() && !demo) return json({ mode: 'links', ...meta });

  const sort = p.get('sort');
  const search = {
    cityId: cityId ?? 0,
    checkin,
    checkout,
    adults: int(p.get('a'), 2, 1, 16),
    children: int(p.get('c'), 0, 0, 10),
    sortBy: (['PriceAsc', 'StarRatingDesc', 'AllGuestsReviewScore'] as const).find((s) => s === sort) ?? 'Recommended',
    minStars: int(p.get('stars'), 0, 0, 5),
    minScore: int(p.get('score'), 0, 0, 10),
    minRate: int(p.get('min'), 0, 0, 100_000),
    maxRate: int(p.get('max'), 100_000, 1, 100_000),
    discountOnly: p.get('deal') === '1',
  } as const;

  try {
    const hotels: Hotel[] = demo ? demoHotels(search, dest?.slug ?? 'x') : await searchCity(search, p.get('deep') === '1');
    // Prices move, but not by the second: let the CDN share a result for 10 minutes.
    return json({ mode: demo ? 'demo' : 'live', ...meta, hotels }, 200, 'public, s-maxage=600, stale-while-revalidate=1800');
  } catch (e) {
    const status = e instanceof AgodaError ? e.status : 502;
    console.error('agoda search failed', e);
    return json({ mode: 'links', ...meta, error: 'upstream' }, status);
  }
};
