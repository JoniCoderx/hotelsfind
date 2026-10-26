import { describe, expect, it } from 'vitest';
import { compare } from './compare';
import { distanceM, nameSimilarity, normalizeName } from './match';
import { comparable, offerClass, rankOffers } from './rank';
import { formatRooms, parseRooms } from './rooms';
import type { Connector, MappedHotel, Offer, SearchRequest } from './types';

const req: SearchRequest = {
  destination: { slug: 'eilat', name: 'Eilat', country: 'Israel' },
  checkin: '2026-12-03',
  checkout: '2026-12-05',
  rooms: [{ adults: 2, childAges: [5, 9] }],
  currency: 'ILS',
  userCountry: 'IL',
  device: 'desktop',
};

const hotels: MappedHotel[] = [
  { id: 'mz-1', slug: 'eilat', name: 'Herods Palace', agoda: 1, booking: 77, vioName: 'Herods Palace Eilat', verified: { by: 'test', at: '2026-10-26' } },
  { id: 'mz-2', slug: 'eilat', name: 'Herods Vitalis', agoda: 2, booking: 78, verified: { by: 'test', at: '2026-10-26' } },
];

function offer(p: Omit<Partial<Offer>, 'site'> & { site: string; id: string; amount?: number }): Offer {
  const source = p.source ?? (p.site === 'agoda' ? 'agoda-search' : p.site === 'booking' ? 'booking-demand' : 'vio');
  return {
    source,
    site: { id: p.site, name: p.site },
    hotel: { id: p.id, name: p.hotel?.name ?? 'x', ...p.hotel },
    rooms: p.rooms ?? 1,
    board: p.board ?? 'breakfast',
    cancellation: p.cancellation ?? { kind: 'free' },
    price: p.price ?? { total: { amount: p.amount ?? 0, currency: 'ILS' }, inclusive: true },
    url: `https://${p.site}.example/${p.id}`,
    checkedAt: '2026-10-25T20:00:00Z',
    ...(p.via ? { via: p.via } : {}),
  };
}

const noFx = () => undefined;

describe('all-in price', () => {
  it('ranks 1,000 + 150 paid at the hotel after 1,100 that includes everything', () => {
    const plusFees = offer({ site: 'agoda', id: '1', price: { total: { amount: 1000, currency: 'ILS' }, inclusive: false, excluded: { amount: 150, currency: 'ILS' } } });
    const allIn = offer({ site: 'booking', id: '77', amount: 1100 });
    const r = rankOffers([plusFees, allIn], 'ILS', noFx, 1);
    expect(r.offers.map((o) => [o.site.id, o.all.amount])).toEqual([
      ['booking', 1100],
      ['agoda', 1150],
    ]);
    expect(r.offers[0].cheapest).toBe(true);
  });

  it('never ranks an offer with a mandatory charge of unknown amount', () => {
    const o = offer({ site: 'booking', id: '77', price: { total: { amount: 900, currency: 'ILS' }, inclusive: true, unknownMandatory: true } });
    expect(comparable(o, 'ILS', noFx, 1).amount).toBeNull();
  });

  it('never ranks an offer that covers a different number of rooms', () => {
    expect(comparable(offer({ site: 'agoda', id: '1', amount: 500, rooms: 1 }), 'ILS', noFx, 2).amount).toBeNull();
  });

  it('converts only with a dated rate and keeps the original currency', () => {
    const usd = offer({ site: 'booking', id: '77', price: { total: { amount: 300, currency: 'USD' }, inclusive: true } });
    expect(comparable(usd, 'ILS', noFx, 1).amount).toBeNull();
    const c = comparable(usd, 'ILS', () => ({ rate: 3.7, at: '2026-10-25' }), 1);
    expect(c).toEqual({ amount: 1110, fx: { from: 'USD', rate: 3.7, at: '2026-10-25' } });
  });
});

describe('cheapest needs two booking sites', () => {
  it('does not crown one complete price against partial ones', () => {
    const r = rankOffers(
      [offer({ site: 'agoda', id: '1', amount: 1000 }), offer({ site: 'booking', id: '77', price: { total: { amount: 800, currency: 'ILS' }, inclusive: null } })],
      'ILS',
      noFx,
      1,
    );
    expect(r.sitesCompared).toBe(1);
    expect(r.offers.some((o) => o.cheapest)).toBe(false);
  });

  it('counts sites, not connectors or offers', () => {
    // Two connectors for the same site (Agoda direct and Agoda via Vio) and two rooms from one site.
    const r = rankOffers(
      [
        offer({ site: 'agoda', id: '1', amount: 1000 }),
        offer({ site: 'agoda', id: 'Herods Palace Eilat', source: 'vio', via: 'Vio', amount: 990 }),
        offer({ site: 'agoda', id: '1', amount: 1200 }),
      ],
      'ILS',
      noFx,
      1,
    );
    expect(r.sitesCompared).toBe(1);
    expect(r.offers.some((o) => o.cheapest)).toBe(false);
  });

  it('crowns the cheapest when two sites gave complete prices', () => {
    const r = rankOffers([offer({ site: 'agoda', id: '1', amount: 1000 }), offer({ site: 'expedia', id: 'x', source: 'vio', amount: 950 })], 'ILS', noFx, 1);
    expect(r.sitesCompared).toBe(2);
    expect(r.offers[0]).toMatchObject({ site: { id: 'expedia' }, cheapest: true });
  });

  it('treats unknown meals or cancellation as never like-for-like', () => {
    const a = offer({ site: 'agoda', id: '1', board: 'unknown', amount: 1 });
    const b = offer({ site: 'booking', id: '77', board: 'unknown', amount: 1 });
    expect(offerClass(a)).not.toBe(offerClass(b));
    expect(offerClass(offer({ site: 'agoda', id: '1', amount: 1 }))).toBe(offerClass(offer({ site: 'booking', id: '77', amount: 1 })));
  });
});

describe('matching', () => {
  it('normalizes and scores names', () => {
    expect(normalizeName('Herods Palace Hotel & Spa – Eilat')).toBe('herods palace eilat');
    expect(nameSimilarity('Herods Palace Eilat', "Herod's Palace Hotel Eilat")).toBeGreaterThan(0.9);
    expect(nameSimilarity('Herods Palace Eilat', 'Herods Vitalis Eilat')).toBeLessThan(0.82);
  });

  it('measures distance in metres', () => {
    const d = distanceM({ lat: 29.5536, lng: 34.9605 }, { lat: 29.5545, lng: 34.9605 });
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});

describe('compare', () => {
  const connector = (id: string, offers: Offer[] | Error, delayMs = 0, complete?: boolean): Connector => ({
    id,
    name: id,
    configured: () => true,
    search: (_r, _h, signal) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => (offers instanceof Error ? reject(offers) : resolve({ offers, complete })), delayMs);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(signal.reason);
        });
      }),
  });

  it('joins offers only through the verified mapping', async () => {
    const r = await compare(req, hotels, [
      connector('agoda-search', [offer({ site: 'agoda', id: '1', amount: 1104 })]),
      connector('booking-demand', [offer({ site: 'booking', id: '77', amount: 1236 }), offer({ site: 'booking', id: '78', amount: 900 })]),
    ]);
    expect(r.hotels.map((h) => [h.id, h.sitesCompared])).toEqual([
      ['mz-1', 2],
      ['mz-2', 1],
    ]);
    expect(r.hotels[0].offers[0]).toMatchObject({ site: { id: 'agoda' }, cheapest: true });
    expect(r.hotels[1].offers[0].cheapest).toBe(false);
  });

  it('proposes look-alikes for review instead of merging them', async () => {
    const lookalike = (site: string, id: string, name: string) =>
      offer({ site, id, amount: 1000, hotel: { id, name, lat: 29.5536, lng: 34.9605 } });
    const r = await compare(req, hotels, [
      connector('agoda-search', [lookalike('agoda', '999', 'Dan Eilat')]),
      connector('booking-demand', [lookalike('booking', '555', 'Dan Eilat Hotel')]),
    ]);
    expect(r.hotels).toEqual([]);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ a: { id: '999' }, b: { id: '555' } });
  });

  it('reports partial, failing, slow and unconfigured connectors', async () => {
    const r = await compare(
      req,
      hotels,
      [
        connector('vio', [offer({ site: 'expedia', id: 'Herods Palace Eilat', source: 'vio', amount: 1000 })], 0, false),
        connector('booking-demand', new Error('500')),
        connector('slow', [], 200),
        { id: 'off', name: 'off', configured: () => false, search: async () => ({ offers: [] }) },
      ],
      { timeoutMs: 50 },
    );
    expect(r.connectors.map((c) => [c.source, c.status])).toEqual([
      ['vio', 'partial'],
      ['booking-demand', 'error'],
      ['slow', 'timeout'],
      ['off', 'not-configured'],
    ]);
  });
});

describe('rooms in the URL', () => {
  it('round-trips rooms with child ages', () => {
    const rooms = parseRooms('2:5,9;2');
    expect(rooms).toEqual([
      { adults: 2, childAges: [5, 9] },
      { adults: 2, childAges: [] },
    ]);
    expect(formatRooms(rooms!)).toBe('2:5,9;2');
  });
  it('rejects nonsense', () => {
    for (const bad of ['', '0', '2:18', '2:a', 'x', '2;2;2;2;2;2;2;2;2']) expect(parseRooms(bad)).toBeNull();
  });
});
