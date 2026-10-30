import type { APIRoute } from 'astro';
import { hotelIds } from '../../lib/hotellinks';
import { findDestination } from '../../lib/resolve';
import { HOTEL_KEY } from '../../lib/xotelo';

// Google Hotels rows are keyed by their property token.
const GOOGLE_KEY = /^gh-[\w-]{8,400}$/;

export const prerender = false;

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

/**
 * The hotel's own ID on each booking site, for links that open its page:
 * /api/ids?key=g293980-d308523&slug=eilat&name=…&lat=…&lng=…
 * A hotel's IDs don't change with the dates, so a complete answer is cached for a week.
 */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const key = p.get('key') || '';
  const name = (p.get('name') || '').slice(0, 120);
  const dest = findDestination({ slug: p.get('slug'), q: p.get('q'), d: p.get('d') });
  if (!(HOTEL_KEY.test(key) || GOOGLE_KEY.test(key)) || !name || !dest) return json({ error: 'bad_hotel' }, 400);
  const coord = (k: string) => {
    const n = Number(p.get(k));
    return p.has(k) && Number.isFinite(n) ? n : undefined;
  };
  const { ids, complete } = await hotelIds({
    slug: dest.slug,
    key,
    name,
    lat: coord('lat'),
    lng: coord('lng'),
    city: dest.en,
    stay: { adults: 2, children: 0, rooms: 1 },
  });
  return json({ ids }, 200, complete ? 'public, s-maxage=604800, stale-while-revalidate=86400' : 'public, s-maxage=300');
};
