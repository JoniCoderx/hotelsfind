import type { APIRoute } from 'astro';
import { agodaConfigured, searchHotels } from '../../lib/agoda';
import { parseGuests } from '../../lib/guests';
import { priceMode } from '../../lib/mode';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Live rate for one or more catalog hotels: /api/rates?ids=1,2&in=YYYY-MM-DD&out=YYYY-MM-DD&a=2&c=1&ages=7 */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const ids = (p.get('ids') || '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  const res = (body: unknown, status = 200, cache = 'no-store') =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
    });
  if (!ids.length || !DATE.test(checkin) || !DATE.test(checkout) || checkout <= checkin) return res({ error: 'bad_request' }, 400);
  const guests = parseGuests(p);
  if ('error' in guests) return res(guests, 400);
  // Agoda's Lite API prices one room; never price two rooms as one.
  if (guests.rooms > 1) return res({ mode: 'links', hotels: [], reason: 'rooms' });
  if (priceMode() !== 'live' || !agodaConfigured()) return res({ mode: 'links', hotels: [] });
  try {
    const hotels = await searchHotels(ids, {
      checkin,
      checkout,
      adults: guests.adults,
      children: guests.children,
      childrenAges: guests.childAges,
    });
    return res({ mode: 'live', hotels });
  } catch (e) {
    console.error('agoda rates failed', e);
    return res({ mode: 'links', hotels: [], error: 'upstream' }, 502);
  }
};
