import { describe, expect, it } from 'vitest';
import { byPrice, dropDuplicates, sameProperty, thursdayFrom, tiedCheapest } from './compare';

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

// QA: Neptune Eilat appeared twice, 5 reviews (Trip.com) and 1,340 reviews (Agoda, Booking): two listings of one hotel.
describe('the same hotel listed twice', () => {
  const old = { name: 'Neptune Eilat', reviews: 1340, lat: 29.550589, lng: 34.956993 };
  const fresh = { name: 'Neptune Eilat', reviews: 5, lat: 29.551088, lng: 34.95772 };
  it('is one hotel when the name is the same and they are next to each other', () => {
    expect(sameProperty(old, fresh)).toBe(true);
    expect(dropDuplicates([], [fresh, old])).toEqual([old]);
    expect(dropDuplicates([old], [fresh])).toEqual([]);
  });
  it('is not merged by name alone', () => {
    expect(sameProperty(old, { ...fresh, lat: 29.56 })).toBe(false);
    expect(sameProperty(old, { ...old, name: 'Neptune Eilat Suites' })).toBe(false);
    expect(sameProperty(old, { name: 'Neptune Eilat' })).toBe(false);
  });
});
