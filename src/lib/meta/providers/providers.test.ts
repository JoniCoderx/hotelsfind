// Contract tests: provider responses shaped like the official documentation examples.
// They prove our mapping, not that the live APIs answer this way; re-check with real credentials.
import { describe, expect, it } from 'vitest';
import { comparable } from '../rank';
import type { SearchRequest } from '../types';
import { agodaOccupancy, agodaOffers, makeAgodaSearch, type AgodaSearchResponse } from './agoda-search';
import { bookingBody, bookingOffers, type BookingSearchResponse } from './booking-demand';

const req: SearchRequest = {
  destination: { slug: 'eilat', name: 'Eilat', lat: 29.5577, lng: 34.9519 },
  checkin: '2026-12-03',
  checkout: '2026-12-05',
  rooms: [{ adults: 2, childAges: [5, 9] }],
  currency: 'ILS',
  source: 'search',
};

// Agoda's documented room, with landingUrl (returned when metaSearch is enabled).
const agodaDoc: AgodaSearchResponse = {
  properties: [
    {
      propertyId: 12157,
      propertyName: 'Test Hotel',
      rooms: [
        {
          roomId: 3134583,
          roomName: 'Deluxe Double',
          freeBreakfast: true,
          freeCancellation: true,
          totalPayment: { exclusive: 83.96, inclusive: 107.14, tax: 15.46, fees: 7.72 },
          rate: { currency: 'ILS' },
          surcharges: [{ charge: 'Mandatory', method: 'PB', name: 'Green Tax', rate: { currency: 'ILS', inclusive: 12 } }],
          cancellationPolicy: { date: [{ before: '2026-12-02T00:00:00', rate: { inclusive: 0 } }] },
          benefits: [{ benefitName: 'Breakfast' }],
          landingUrl: 'https://www.agoda.com/partners/partnersearch.aspx?hid=12157',
        },
      ],
    },
  ],
};

describe('Agoda Search API 2.0 mapping', () => {
  it('uses the inclusive booking total; mandatory surcharges are already inside it', () => {
    const [o] = agodaOffers(agodaDoc, req, 1, 'now');
    expect(o.price).toEqual({ total: { amount: 107.14, currency: 'ILS' }, inclusive: true });
    expect(o.board).toBe('breakfast');
    expect(o.cancellation).toEqual({ kind: 'free', until: '2026-12-02T00:00:00' });
    expect(comparable(o, 'ILS', () => undefined).amount).toBe(107);
  });

  it('adds surcharges paid at the hotel to the all-in price', () => {
    const data = structuredClone(agodaDoc);
    data.properties![0].rooms[0].surcharges = [{ charge: 'Excluded', name: 'City tax', rate: { currency: 'ILS', inclusive: 40 } }];
    const [o] = agodaOffers(data, req, 1, 'now');
    expect(o.price.inclusive).toBe(false);
    expect(comparable(o, 'ILS', () => undefined).amount).toBe(147);
  });

  it('skips rooms without a landing URL', () => {
    const data = structuredClone(agodaDoc);
    delete data.properties![0].rooms[0].landingUrl;
    expect(agodaOffers(data, req, 1, 'now')).toHaveLength(0);
  });

  it('sends one occupancy for identical rooms and refuses uneven ones', () => {
    expect(agodaOccupancy({ ...req, rooms: [{ adults: 2, childAges: [5] }, { adults: 2, childAges: [5] }] })).toEqual({
      rooms: 2,
      adults: 4,
      childAges: [5, 5],
    });
    expect(typeof agodaOccupancy({ ...req, rooms: [{ adults: 2, childAges: [5] }, { adults: 1, childAges: [] }] })).toBe('string');
  });

  it('sends the documented request and is not configured without an endpoint', async () => {
    let sent: { criteria: Record<string, unknown>; features: { extra: string[] } } | undefined;
    const p = makeAgodaSearch({
      endpoint: () => 'https://agoda.test/search',
      siteId: () => '1',
      apiKey: () => 'k',
      hotelIds: () => [12157],
      fetchImpl: (async (_u: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify(agodaDoc));
      }) as typeof fetch,
    });
    const r = await p.search(req, new AbortController().signal);
    expect(r.offers).toHaveLength(1);
    expect(sent!.criteria).toMatchObject({ propertyIds: [12157], rooms: 1, adults: 2, children: 2, childrenAges: [5, 9], currency: 'ILS' });
    expect(sent!.features.extra).toContain('metaSearch');
    const off = makeAgodaSearch({ endpoint: () => undefined, siteId: () => '1', apiKey: () => 'k', hotelIds: () => [] });
    expect(off.configured()).toBe(false);
  });
});

const bookingDoc: BookingSearchResponse = {
  data: [
    {
      id: 10004,
      currency: { accommodation: 'ILS', booker: 'ILS' },
      price: { total: { accommodation_currency: 1236, booker_currency: 1236 } },
      url: 'https://www.booking.com/hotel/il/test.html?checkin=2026-12-03',
      products: [{ id: 'p1', policies: { cancellation: { type: 'free_cancellation', free_cancellation_until: '2026-12-01T23:59:59+00:00' } } }],
    },
  ],
};

describe('Booking Demand API 3.2 mapping', () => {
  it('ranks on total and tags the clickout with our label and affiliate ID', () => {
    const [o] = bookingOffers(
      bookingDoc,
      req,
      () => ({ name: 'Test Hotel', lat: 29.55, lng: 34.95 }),
      (url) => `${url}&label=malonzol-search&aid=123`,
      'now',
    );
    expect(o.price).toEqual({ total: { amount: 1236, currency: 'ILS' }, inclusive: true });
    expect(o.cancellation.kind).toBe('free');
    expect(o.board).toBe('unknown');
    expect(o.url).toContain('label=malonzol-search');
  });

  it('sends guests per room, with child ages', () => {
    const body = bookingBody({ ...req, rooms: [{ adults: 2, childAges: [5, 9] }, { adults: 1, childAges: [] }] });
    expect(body.guests).toEqual({
      number_of_rooms: 2,
      number_of_adults: 3,
      children: [5, 9],
      allocation: [
        { number_of_adults: 2, children: [5, 9] },
        { number_of_adults: 1, children: [] },
      ],
    });
  });
});
