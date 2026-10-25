import { describe, expect, it } from 'vitest';
import { compare, groupOffers } from './compare';
import { distanceM, nameSimilarity, normalizeName, sameHotel } from './match';
import { comparable, rankOffers } from './rank';
import type { Offer, Provider, SearchRequest } from './types';

const req: SearchRequest = {
  destination: { slug: 'eilat', name: 'Eilat' },
  checkin: '2026-12-03',
  checkout: '2026-12-05',
  rooms: [{ adults: 2, childAges: [5, 9] }],
  currency: 'ILS',
  source: 'test',
};

function offer(p: Partial<Offer> & { provider: string; id: string; amount: number }): Offer {
  return {
    provider: p.provider,
    hotel: { id: p.id, name: p.hotel?.name ?? 'Herods Palace Eilat', lat: 29.5536, lng: 34.9605, ...p.hotel },
    rooms: 1,
    board: p.board ?? 'breakfast',
    cancellation: p.cancellation ?? { kind: 'free' },
    price: p.price ?? { total: { amount: p.amount, currency: 'ILS' }, inclusive: true },
    url: `https://${p.provider}.example/${p.id}`,
    checkedAt: '2026-10-25T20:00:00Z',
  };
}

describe('hotel matching', () => {
  it('ignores generic words and punctuation in names', () => {
    expect(normalizeName('Herods Palace Hotel & Spa – Eilat')).toBe('herods palace eilat');
  });

  it('scores the same hotel high and different hotels low', () => {
    expect(nameSimilarity('Herods Palace Eilat', "Herod's Palace Hotel Eilat")).toBeGreaterThan(0.9);
    expect(nameSimilarity('Herods Palace Eilat', 'Herods Vitalis Eilat')).toBeLessThan(0.82);
  });

  it('measures distance in metres', () => {
    const d = distanceM({ lat: 29.5536, lng: 34.9605 }, { lat: 29.5545, lng: 34.9605 });
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  it('trusts a curated mapping over names', () => {
    const mapping = new Map([
      ['agoda:1', 'mz-1'],
      ['booking:99', 'mz-1'],
    ]);
    const a = { provider: 'agoda', id: '1', name: 'Totally different name' };
    const b = { provider: 'booking', id: '99', name: 'Herods' };
    expect(sameHotel(a, b, mapping)).toBe('mapped');
  });

  it('keeps neighbouring hotels with similar names apart', () => {
    // Herods Palace and Herods Vitalis share a complex in Eilat.
    const a = { provider: 'agoda', id: '1', name: 'Herods Palace Eilat', lat: 29.5536, lng: 34.9605 };
    const b = { provider: 'booking', id: '2', name: 'Herods Vitalis Eilat', lat: 29.5538, lng: 34.9606 };
    expect(sameHotel(a, b, new Map())).toBeNull();
  });

  it('does not match on name alone without coordinates', () => {
    const a = { provider: 'agoda', id: '1', name: 'Herods Palace Eilat' };
    const b = { provider: 'booking', id: '2', name: 'Herods Palace Eilat' };
    expect(sameHotel(a, b, new Map())).toBeNull();
  });

  it('never merges two different hotels from one provider', () => {
    const groups = groupOffers(
      [offer({ provider: 'agoda', id: '1', amount: 1000 }), offer({ provider: 'agoda', id: '2', amount: 900 })],
      new Map(),
    );
    expect(groups).toHaveLength(2);
  });
});

describe('fair price', () => {
  const noFx = () => undefined;

  it('adds known excluded mandatory charges to the total', () => {
    const o = offer({
      provider: 'agoda',
      id: '1',
      amount: 0,
      price: { total: { amount: 1000, currency: 'ILS' }, inclusive: false, excluded: { amount: 120, currency: 'ILS' } },
    });
    expect(comparable(o, 'ILS', noFx).amount).toBe(1120);
  });

  it('refuses to rank a price whose taxes are unknown', () => {
    const unknown = offer({ provider: 'agoda', id: '1', amount: 0, price: { total: { amount: 800, currency: 'ILS' }, inclusive: null } });
    const known = offer({ provider: 'booking', id: '9', amount: 950 });
    const ranked = rankOffers([unknown, known], 'ILS', noFx);
    expect(ranked[0].provider).toBe('booking');
    expect(ranked[0].cheapest).toBe(true);
    expect(ranked[1].all.amount).toBeNull();
    expect(ranked[1].cheapest).toBe(false);
  });

  it('converts currency only with a known rate', () => {
    const usd = offer({ provider: 'booking', id: '9', amount: 0, price: { total: { amount: 300, currency: 'USD' }, inclusive: true } });
    expect(comparable(usd, 'ILS', noFx).amount).toBeNull();
    const c = comparable(usd, 'ILS', (f, t) => (f === 'USD' && t === 'ILS' ? 3.7 : undefined));
    expect(c).toEqual({ amount: 1110, converted: true });
  });
});

describe('compare', () => {
  const provider = (id: string, offers: Offer[] | Error, delayMs = 0): Provider => ({
    id,
    name: id,
    configured: () => true,
    search: (_r, signal) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => (offers instanceof Error ? reject(offers) : resolve({ offers })), delayMs);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(signal.reason);
        });
      }),
  });

  it('puts both providers’ offers for one hotel together and ranks by all-in price', async () => {
    const r = await compare(req, [
      provider('agoda', [offer({ provider: 'agoda', id: '1', amount: 1104 })]),
      provider('booking', [offer({ provider: 'booking', id: '77', amount: 1236, hotel: { id: '77', name: "Herod's Palace Hotel Eilat", lat: 29.5537, lng: 34.9604 } })]),
    ]);
    expect(r.hotels).toHaveLength(1);
    expect(r.hotels[0].providers.sort()).toEqual(['agoda', 'booking']);
    expect(r.hotels[0].match).toBe('strong');
    expect(r.hotels[0].offers.map((o) => o.provider)).toEqual(['agoda', 'booking']);
    expect(r.providers.every((p) => p.status === 'ok')).toBe(true);
  });

  it('reports a failing or slow provider instead of hiding it', async () => {
    const r = await compare(
      req,
      [
        provider('agoda', [offer({ provider: 'agoda', id: '1', amount: 1104 })]),
        provider('booking', new Error('500')),
        provider('slow', [], 200),
        { id: 'off', name: 'off', configured: () => false, search: async () => ({ offers: [] }) },
      ],
      { timeoutMs: 50 },
    );
    expect(r.hotels).toHaveLength(1);
    expect(r.providers.map((p) => [p.provider, p.status])).toEqual([
      ['agoda', 'ok'],
      ['booking', 'error'],
      ['slow', 'timeout'],
      ['off', 'not-configured'],
    ]);
  });
});
