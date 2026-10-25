import type { APIRoute } from 'astro';
import { geo } from '../../data/geo';
import { compare, type CompareResult } from '../../lib/meta/compare';
import { comparisonProviders, hotelMapping } from '../../lib/meta/registry';
import { parseRooms } from '../../lib/meta/rooms';
import { findDestination } from '../../lib/resolve';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const KEYS = ['slug', 'in', 'out', 'rooms', 'src'] as const;

// Booking.com forbids caching prices, so nothing here is cached; identical searches that arrive
// together still share one round of provider calls.
const inFlight = new Map<string, Promise<CompareResult>>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

/** /api/compare?slug=eilat&in=2026-12-03&out=2026-12-05&rooms=2:5,9&src=search */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const key = KEYS.map((k) => `${k}=${p.get(k) ?? ''}`).join('&');
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  if (!DATE.test(checkin) || !DATE.test(checkout)) return json({ error: 'bad_dates' }, 400);
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30 || Date.parse(checkin) < Date.now() - 2 * DAY) return json({ error: 'bad_dates' }, 400);
  const rooms = parseRooms(p.get('rooms'));
  if (!rooms) return json({ error: 'bad_rooms' }, 400);
  const dest = findDestination({ slug: p.get('slug') });
  if (!dest) return json({ error: 'unknown_destination' }, 400);
  if (process.env.LIVE_PRICES === 'off') return json({ hotels: [], providers: [], off: true });

  const g = geo[dest.slug];
  let job = inFlight.get(key);
  if (!job) {
    job = compare(
      {
        destination: { slug: dest.slug, name: dest.en, lat: g?.lat, lng: g?.lng, radiusKm: g?.radiusKm },
        checkin,
        checkout,
        rooms,
        currency: 'ILS',
        source: (p.get('src') || 'search').replace(/[^a-z0-9-]/gi, '').slice(0, 30),
      },
      comparisonProviders(),
      { timeoutMs: 8000, mapping: hotelMapping },
    ).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  const result = await job;
  return json({ destination: { slug: dest.slug, he: dest.he }, nights, ...result });
};
