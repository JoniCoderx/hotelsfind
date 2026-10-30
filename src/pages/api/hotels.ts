import type { APIRoute } from 'astro';
import { findDestination } from '../../lib/resolve';
import { googleConfigured, googleHotels } from '../../lib/googlehotels';
import { parseGuests } from '../../lib/guests';
import { LOCATIONS, PAGE, listHotels, usdToIls } from '../../lib/xotelo';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const prerender = false;

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

/** Hotels at one of our destinations, 30 at a time: /api/hotels?slug=eilat&offset=0&sort=best_value
 *  A typed destination works too: ?q=Eilat or ?d=אילת. */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const dest = findDestination({ slug: p.get('slug'), q: p.get('q'), d: p.get('d') });
  const location = dest && LOCATIONS[dest.slug];
  if (!location) return json({ error: 'unknown_destination' }, 404, 'public, s-maxage=86400');
  // With dates and a SerpApi key: Google Hotels, live prices included (one search per page of hotels).
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  if (googleConfigured() && DATE.test(checkin) && DATE.test(checkout) && checkout > checkin) {
    const g = parseGuests(p);
    const guests = 'error' in g ? { adults: Number(p.get('a')) || 2, children: 0, childAges: [] as number[] } : g;
    try {
      const r = await googleHotels({
        place: dest.en,
        checkin,
        checkout,
        adults: guests.adults,
        children: guests.children,
        childAges: guests.childAges,
        sort: p.get('sort') === 'popularity' ? 'popularity' : 'best_value',
        next: p.get('next') || undefined,
      });
      // Half an hour: the same search again is answered from the cache, without another paid search.
      return json({ source: 'google', ...r }, 200, 'public, s-maxage=1800, stale-while-revalidate=300');
    } catch (e) {
      console.error('google hotels', (e as Error).message); // fall back to the Xotelo list below
    }
  }
  const offset = Number(p.get('offset') || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 300 || offset % PAGE) return json({ error: 'bad_offset' }, 400);
  const sort = p.get('sort') === 'popularity' ? 'popularity' : 'best_value';
  try {
    const result = await listHotels(location, { offset, sort }, await usdToIls());
    // The list changes slowly; prices come separately from /api/prices.
    return json(result, 200, 'public, s-maxage=21600, stale-while-revalidate=86400');
  } catch (e) {
    console.error('hotels', (e as Error).message);
    return json({ error: 'unavailable' }, 502);
  }
};
