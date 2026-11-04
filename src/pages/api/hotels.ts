import type { APIRoute } from 'astro';
import { findDestination } from '../../lib/resolve';
import { googleConfigured, googleHotels } from '../../lib/googlehotels';
import { parseGuests } from '../../lib/guests';
import { LOCATIONS, PAGE, listHotels, nearby, reachKm, usdToIls, type ListHotel } from '../../lib/xotelo';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The hotels we last saw with prices at each destination, from TripAdvisor's list (key, name, coordinates, reviews),
// with the photo and score from our catalog where the same hotel is there. Used only when TripAdvisor's list
// fails (as it did for every destination but Eilat on 4 Nov 2026), so a search still shows hotels and prices.
const SAVED = import.meta.glob<{ default: ListHotel[] }>('../../data/lists/*.json', { eager: true });
const saved = (slug: string): ListHotel[] => SAVED[`../../data/lists/${slug}.json`]?.default ?? [];

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
      r.hotels = nearby(r.hotels, reachKm(dest.slug));
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
    if (!result.hotels.length && offset < saved(dest.slug).length) throw new Error('empty list');
    result.hotels = nearby(result.hotels, reachKm(dest.slug));
    // The list changes slowly; prices come separately from /api/prices.
    return json(result, 200, 'public, s-maxage=21600, stale-while-revalidate=86400');
  } catch (e) {
    console.error('hotels', (e as Error).message);
    const list = saved(dest.slug);
    if (list.length) {
      // Cached briefly, so the live list is back soon after TripAdvisor recovers.
      return json({ total: list.length, hotels: list.slice(offset, offset + PAGE), saved: true }, 200, 'public, s-maxage=600, stale-while-revalidate=600');
    }
    return json({ error: 'unavailable' }, 502);
  }
};
