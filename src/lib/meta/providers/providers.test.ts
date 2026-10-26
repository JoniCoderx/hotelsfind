// Contract tests: connector responses shaped like the official documentation examples.
// They prove our mapping, not that the live APIs answer this way; re-check with real credentials.
import { describe, expect, it } from 'vitest';
import { comparable } from '../rank';
import type { MappedHotel, SearchRequest } from '../types';
import { agodaBody, agodaOccupancy, agodaOffers, excludedAmount, makeAgodaSearch, type AgodaSearchResponse } from './agoda-search';
import { bookingBody, bookingOffers, type BookingSearchResponse } from './booking-demand';
import { makeVio, vioBody, vioCancellation, vioOffers, vioRooms, type VioResponse } from './vio';

const req: SearchRequest = {
  destination: { slug: 'eilat', name: 'Eilat', country: 'Israel' },
  checkin: '2026-12-03',
  checkout: '2026-12-05',
  rooms: [{ adults: 2, childAges: [5, 9] }],
  currency: 'ILS',
  userCountry: 'IL',
  device: 'mobile',
};
const hotels: MappedHotel[] = [
  { id: 'mz-1', slug: 'eilat', name: 'Test Hotel', agoda: 12157, booking: 10004, vioName: 'Test Hotel Eilat', verified: { by: 't', at: '2026-10-26' } },
];
const noFx = () => undefined;

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

describe('Agoda Search API 2.0', () => {
  it('uses the inclusive total as is: no tax or mandatory surcharge is added twice', () => {
    const [o] = agodaOffers(agodaDoc, req, 1, 'now');
    expect(o.price).toEqual({ total: { amount: 107.14, currency: 'ILS' }, inclusive: true });
    expect(comparable(o, 'ILS', noFx, 1).amount).toBe(107);
    expect(o).toMatchObject({ source: 'agoda-search', site: { id: 'agoda' }, board: 'breakfast' });
  });

  it('adds excluded surcharges by their unit, and refuses units it cannot multiply', () => {
    const data = structuredClone(agodaDoc);
    data.properties![0].rooms[0].surcharges = [{ charge: 'Excluded', method: 'PRPN', name: 'City tax', rate: { currency: 'ILS', inclusive: 10 } }];
    const [o] = agodaOffers(data, req, 1, 'now');
    expect(comparable(o, 'ILS', noFx, 1).amount).toBe(127); // 107.14 + 10 × 2 nights × 1 room
    data.properties![0].rooms[0].surcharges![0].method = 'XYZ';
    const [u] = agodaOffers(data, req, 1, 'now');
    expect(u.price.unknownMandatory).toBe(true);
    expect(comparable(u, 'ILS', noFx, 1).amount).toBeNull();
    expect(excludedAmount({ charge: 'Excluded', method: 'PRPB', rate: { inclusive: 5 } }, 3, 2)).toBe(10);
  });

  it('skips rooms without a landing URL', () => {
    const data = structuredClone(agodaDoc);
    delete data.properties![0].rooms[0].landingUrl;
    expect(agodaOffers(data, req, 1, 'now')).toHaveLength(0);
  });

  it('refuses uneven rooms; sends booker country and child ages', () => {
    expect(typeof agodaOccupancy({ ...req, rooms: [{ adults: 2, childAges: [5] }, { adults: 1, childAges: [] }] })).toBe('string');
    const body = agodaBody(req, [12157], { rooms: 1, adults: 2, childAges: [5, 9] });
    expect(body.criteria).toMatchObject({ userCountry: 'IL', children: 2, childrenAges: [5, 9], currency: 'ILS' });
    expect(body.features.extra).toContain('metaSearch');
  });

  it('asks only for verified hotels', async () => {
    let sent: { criteria: { propertyIds: number[] } } | undefined;
    const p = makeAgodaSearch({
      endpoint: () => 'https://agoda.test/search',
      siteId: () => '1',
      apiKey: () => 'k',
      fetchImpl: (async (_u: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify(agodaDoc));
      }) as typeof fetch,
    });
    const r = await p.search(req, hotels, new AbortController().signal);
    expect(sent!.criteria.propertyIds).toEqual([12157]);
    expect(r.offers).toHaveLength(1);
  });
});

const bookingDoc: BookingSearchResponse = {
  data: [
    {
      id: 10004,
      currency: { accommodation: 'ILS', booker: 'ILS' },
      url: 'https://www.booking.com/hotel/il/test.html?checkin=2026-12-03',
      products: [
        {
          id: 'p1',
          price: {
            total: { accommodation_currency: 1236, booker_currency: 1236 },
            extra_charges: { excluded: [{ charge: 21, mode: 'percentage', total_amount: 12 }], conditional: [{ charge: 3, mode: 'incalculable', total_amount: null }] },
          },
          policies: { cancellation: { type: 'free_cancellation', free_cancellation_until: '2026-12-01T23:59:59+00:00' } },
        },
      ],
    },
  ],
};

describe('Booking Demand API 3.2', () => {
  it('ranks on total; conditional charges are not mandatory', () => {
    const [o] = bookingOffers(bookingDoc, req, () => 'Test Hotel', 'now');
    expect(o.price).toEqual({ total: { amount: 1236, currency: 'ILS' }, inclusive: true });
    expect(o.cancellation.kind).toBe('free');
    expect(o.board).toBe('unknown');
  });

  it('gives no all-in price when an excluded charge is incalculable', () => {
    const data = structuredClone(bookingDoc);
    data.data![0].products![0].price!.extra_charges!.excluded!.push({ charge: 22, mode: 'incalculable', total_amount: null });
    const [o] = bookingOffers(data, req, () => 'Test Hotel', 'now');
    expect(o.price.unknownMandatory).toBe(true);
    expect(comparable(o, 'ILS', noFx, 1).amount).toBeNull();
  });

  it('treats a price without the charge breakdown as unknown', () => {
    const data = structuredClone(bookingDoc);
    delete data.data![0].products![0].price!.extra_charges;
    const [o] = bookingOffers(data, req, () => 'Test Hotel', 'now');
    expect(o.price.inclusive).toBeNull();
  });

  it('asks for the verified IDs with guests per room and the booker context', () => {
    const body = bookingBody({ ...req, rooms: [{ adults: 2, childAges: [5, 9] }, { adults: 1, childAges: [] }] }, [10004]);
    expect(body.accommodations).toEqual([10004]);
    expect(body.booker).toEqual({ country: 'il', platform: 'mobile' });
    expect(body.guests.allocation).toEqual([
      { number_of_adults: 2, children: [5, 9] },
      { number_of_adults: 1, children: [] },
    ]);
  });
});

const vioDoc: VioResponse = {
  completed: true,
  hotels: [
    {
      requestedName: 'Test Hotel Eilat',
      offers: [
        {
          rate: { base: 1000, taxes: 170, hotelFees: 40 },
          currency: 'ILS',
          provider: { name: 'Expedia' },
          package: { amenities: ['breakfast', 'internetIncluded'], canPayLater: false },
          cancellationPenalties: [{ start: '2026-12-01T23:59:00+02:00', percent: 100 }],
          roomName: 'Standard Double',
          url: 'https://deals.vio.com?lbl=x',
        },
        {
          rate: { base: 1050, taxes: 178, hotelFees: 0 },
          currency: 'ILS',
          provider: { name: 'Booking.com' },
          package: { amenities: [] },
          cancellationPenalties: [],
          roomName: 'Double',
          url: 'https://deals.vio.com?lbl=y',
        },
      ],
    },
  ],
};

describe('Vio Partners API', () => {
  it('turns each distributor into its own site, adds hotel fees, marks the aggregator', () => {
    const [a, b] = vioOffers(vioDoc, req, 'now');
    expect(a).toMatchObject({ source: 'vio', site: { id: 'expedia', name: 'Expedia' }, via: 'Vio', board: 'breakfast' });
    expect(comparable(a, 'ILS', noFx, 1).amount).toBe(1210); // 1000 + 170 VAT + 40 paid at the hotel
    expect(b.site.id).toBe('bookingcom');
    expect(b.price.inclusive).toBe(true);
    expect(b.board).toBe('unknown');
    expect(b.cancellation.kind).toBe('unknown');
  });

  it('reads cancellation penalties conservatively', () => {
    const now = Date.parse('2026-11-01T00:00:00Z');
    expect(vioCancellation([{ start: '2026-12-01T00:00:00Z', percent: 100 }], now)).toEqual({ kind: 'free', until: '2026-12-01T00:00:00Z' });
    expect(vioCancellation([{ start: '2026-10-01T00:00:00Z', percent: 100 }], now)).toEqual({ kind: 'non-refundable' });
    expect(vioCancellation([{ start: '2026-10-01T00:00:00Z', percent: 30 }], now)).toEqual({ kind: 'partial' });
  });

  it('builds the documented request', () => {
    expect(vioRooms({ ...req, rooms: [{ adults: 1, childAges: [4, 6] }, { adults: 3, childAges: [] }] })).toBe('1:4,6|3');
    expect(vioBody(req, ['Test Hotel Eilat'])).toMatchObject({
      query: { hotelNames: { names: ['Test Hotel Eilat'], city: 'Eilat', country: 'Israel' } },
      rooms: '2:5,9',
      userCountry: 'IL',
      userDevice: 'mobile',
    });
  });

  it('polls until completed, and reports partial when time runs out', async () => {
    const urls: string[] = [];
    const answers = [{ ...vioDoc, completed: false, sessionId: 's1' }, vioDoc];
    const full = makeVio({
      key: () => 'k',
      fetchImpl: (async (u: string) => {
        urls.push(u);
        return new Response(JSON.stringify(answers.shift()));
      }) as typeof fetch,
    });
    const r = await full.search(req, hotels, new AbortController().signal);
    expect(urls[1]).toContain('sessionId=s1');
    expect(r.complete).toBe(true);
    expect(r.offers).toHaveLength(2);

    const slow = makeVio({
      key: () => 'k',
      budgetMs: 30,
      fetchImpl: (async () => {
        await new Promise((res) => setTimeout(res, 20));
        return new Response(JSON.stringify({ ...vioDoc, completed: false, sessionId: 's' }));
      }) as typeof fetch,
    });
    const p = await slow.search(req, hotels, new AbortController().signal);
    expect(p.complete).toBe(false);
    expect(p.offers).toHaveLength(2);
  });
});
