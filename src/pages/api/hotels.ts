import type { APIRoute } from 'astro';
import { findDestination } from '../../lib/resolve';
import { LOCATIONS, PAGE, listHotels, usdToIls } from '../../lib/xotelo';

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
