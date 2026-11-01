import { describe, expect, it } from 'vitest';
import { byPrice, foldListings, mergeOffers, SAME_HOTEL, thursdayFrom, tiedCheapest } from './compare';

describe('cheapest-first order', () => {
  it('sorts every hotel by price, also ones whose price came late', () => {
    // QA: Eilat showed 589, 894, then 333 (a late hotel appended after the first batch).
    const rows = [
      { order: 0, p: 589 },
      { order: 1, p: 894 },
      { order: 2, p: 333 },
      { order: 3, p: 0 },
    ];
    expect(byPrice(rows, (r) => r.p).map((r) => r.p)).toEqual([333, 589, 894, 0]);
  });
  it('keeps ties in their original order', () => {
    const rows = [
      { order: 1, p: 100, k: 'b' },
      { order: 0, p: 100, k: 'a' },
    ];
    expect(byPrice(rows, (r) => r.p).map((r) => r.k)).toEqual(['a', 'b']);
  });
});

describe('tied cheapest sites', () => {
  it('returns every site at the lowest price', () => {
    expect(tiedCheapest([{ site: 'agoda', price: 1514 }, { site: 'booking', price: 1514 }, { site: 'trip', price: 1600 }]).map((o) => o.site)).toEqual(['agoda', 'booking']);
  });
  it('returns one when one is cheapest, none for no offers', () => {
    expect(tiedCheapest([{ price: 1 }, { price: 2 }])).toHaveLength(1);
    expect(tiedCheapest([])).toEqual([]);
  });
});

describe('weekend dates', () => {
  it('"the coming weekend" on Friday 30 October 2026 starts Thursday 5 November, not 12 November', () => {
    const fri = new Date('2026-10-30T09:00:00');
    expect(thursdayFrom(fri, 1).getDate()).toBe(5);
    expect(thursdayFrom(fri, 10).getDate()).toBe(12);
  });
  // QA: on Sunday 1 November the home page's weekend deals showed 12-14 November.
  it('the home page shows the coming weekend', () => {
    const sun = new Date('2026-11-01T09:00:00+02:00');
    expect(thursdayFrom(sun, 2).getDate()).toBe(5);
    const wed = new Date('2026-11-04T09:00:00+02:00');
    expect(thursdayFrom(wed, 2).getDate()).toBe(12);
  });
  it('on a Thursday, the coming weekend is the next one', () => {
    expect(thursdayFrom(new Date('2026-11-05T09:00:00'), 1).getDate()).toBe(12);
  });
});

// QA: Neptune Eilat appeared twice (two TripAdvisor listings of one hotel). Dropping one lost a seller: the old
// listing had Booking and Agoda, the new one Trip.com.
describe('one hotel listed twice', () => {
  const OLD = 'g293980-d308942';
  const NEW = 'g293980-d23277058';
  it('is a checked mapping, not a guess from the name', () => {
    expect(SAME_HOTEL[NEW]).toBe(OLD);
  });
  it('keeps every site, and the cheapest price of each', () => {
    const a = [{ site: 'booking', price: 1195 }, { site: 'agoda', price: 1210 }];
    const b = [{ site: 'trip', price: 1150 }, { site: 'agoda', price: 1195 }];
    expect(mergeOffers(a, b)).toEqual([{ site: 'trip', price: 1150 }, { site: 'booking', price: 1195 }, { site: 'agoda', price: 1195 }]);
  });
  it('never loses the cheapest offer of either listing', () => {
    for (let i = 0; i < 200; i++) {
      const sites = ['booking', 'agoda', 'trip', 'expedia'];
      const rnd = () => sites.filter(() => Math.random() < 0.6).map((site) => ({ site, price: 100 + Math.floor(Math.random() * 900) }));
      const a = rnd();
      const b = rnd();
      const merged = mergeOffers(a, b);
      const cheapest = Math.min(...[...a, ...b].map((o) => o.price));
      if (a.length + b.length) expect(merged[0].price).toBe(cheapest);
      for (const o of [...a, ...b]) expect(merged.find((m) => m.site === o.site)!.price).toBeLessThanOrEqual(o.price);
    }
  });
  it("folds the listing into its hotel's card, whichever comes first, with the offers it already has", () => {
    const later = foldListings([{ key: OLD }], [{ key: NEW }, { key: 'x' }]);
    expect(later.fresh.map((r) => r.key)).toEqual(['x']);
    expect(later.have[0]).toMatchObject({ key: OLD, alts: [NEW] });
    const earlier = foldListings([{ key: NEW, prices: [{ site: 'trip', price: 1195 }] }], [{ key: OLD }]);
    expect(earlier.have).toEqual([]);
    expect(earlier.fresh[0]).toMatchObject({ key: OLD, alts: [NEW], prices: [{ site: 'trip', price: 1195 }] });
  });
  it('leaves hotels with the same name alone unless they are mapped', () => {
    const r = foldListings([], [{ key: 'g1-d1' }, { key: 'g1-d2' }]);
    expect(r.fresh).toHaveLength(2);
  });
});
