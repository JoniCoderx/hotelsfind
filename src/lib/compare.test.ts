import { describe, expect, it } from 'vitest';
import { byPrice, thursdayFrom, tiedCheapest } from './compare';

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
  it('on a Thursday, the coming weekend is the next one', () => {
    expect(thursdayFrom(new Date('2026-11-05T09:00:00'), 1).getDate()).toBe(12);
  });
});
