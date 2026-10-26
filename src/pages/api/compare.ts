import type { APIRoute } from 'astro';
import { destinations } from '../../data/destinations';
import { compare, type CompareResult } from '../../lib/meta/compare';
import { fakeAllowed } from '../../lib/meta/providers/fake';
import { attribute, comparisonConnectors, mappedHotels } from '../../lib/meta/registry';
import { parseRooms } from '../../lib/meta/rooms';
import { priceMode } from '../../lib/mode';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

// Booking.com forbids caching prices, so nothing here is cached. Identical searches that arrive together
// share one round of connector calls; the key holds everything that can change a price.
const inFlight = new Map<string, Promise<CompareResult>>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

/** /api/compare?slug=eilat&in=2026-12-03&out=2026-12-05&rooms=2:5,9&dev=mobile&src=search */
export const GET: APIRoute = async ({ url, request }) => {
  const p = url.searchParams;
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  if (!DATE.test(checkin) || !DATE.test(checkout)) return json({ error: 'bad_dates' }, 400);
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30 || Date.parse(checkin) < Date.now() - 2 * DAY) return json({ error: 'bad_dates' }, 400);
  const rooms = parseRooms(p.get('rooms'));
  if (!rooms) return json({ error: 'bad_rooms' }, 400);
  // First experiment: one room. Multi-room offers can be product combinations that don't each fit the party.
  if (rooms.length !== 1) return json({ error: 'one_room_only' }, 400);
  const dest = destinations.find((d) => d.slug === p.get('slug'));
  if (!dest) return json({ error: 'unknown_destination' }, 400);
  if (priceMode() !== 'live' && !fakeAllowed()) return json({ hotels: [], connectors: [], candidates: [], off: true });

  const device = p.get('dev') === 'mobile' ? 'mobile' : 'desktop';
  const userCountry = (request.headers.get('x-vercel-ip-country') || 'IL').toUpperCase().slice(0, 2);
  // Our click label only; never part of the shared call, so each response carries its own.
  const src = (p.get('src') || 'search').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'search';
  const key = [dest.slug, checkin, checkout, p.get('rooms'), userCountry, device].join('|');

  let job = inFlight.get(key);
  if (!job) {
    const [city, country = ''] = dest.en.split(',').map((s) => s.trim());
    job = compare(
      { destination: { slug: dest.slug, name: city, country }, checkin, checkout, rooms, currency: 'ILS', userCountry, device },
      mappedHotels(dest.slug),
      comparisonConnectors(),
      { timeoutMs: 8000 },
    ).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  const result = await job;
  const hotels = result.hotels.map((h) => ({ ...h, offers: h.offers.map((o) => ({ ...o, url: attribute(o, src) })) }));
  return json({ destination: { slug: dest.slug, he: dest.he }, nights, ...result, hotels });
};
