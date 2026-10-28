import { describe, expect, it } from 'vitest';
import type { CatalogHotel } from './catalog';
import { listsFor, rankList, weighted } from './best';

const h = (id: number, o: Partial<CatalogHotel> = {}): CatalogHotel => ({
  id, name: `H${id}`, nameEn: `H${id}`, city: 'X', stars: 4, score: 8, reviews: 500, photo: 'https://x/a.jpg?s=312x',
  address: '', lat: 32 + id * 0.001, lng: 34.8, ratesFrom: null, ratesCurrency: null, overview: '', ...o,
});

describe('best lists', () => {
  it('weights the score by the number of reviews', () => {
    expect(weighted({ score: 9.0, reviews: 3000 })).toBeGreaterThan(weighted({ score: 9.6, reviews: 12 }));
  });

  it('ranks, filters by kind and skips thin lists', () => {
    const all = [
      ...Array.from({ length: 8 }, (_, i) => h(i + 1, { score: 8 + i * 0.1 })),
      h(20, { stars: 5, score: 9.5, reviews: 40 }),
      h(21, { score: 6.5 }),
      h(22, { photo: '' }),
    ];
    const top = rankList(all, 'top')!;
    expect(top.hotels.map((x) => x.id)).not.toContain(21);
    expect(top.hotels.map((x) => x.id)).not.toContain(22);
    expect(top.hotels[0].id).toBe(8);
    expect(top.hotels[0].photo).toContain('s=800x');
    expect(rankList(all, 'luxury')).toBeNull();
    expect(listsFor(all).map((l) => l.kind)).toEqual(['top']);
  });

  it('gives each badge once and distance only for compact places', () => {
    const all = Array.from({ length: 12 }, (_, i) => h(i + 1, { score: 8 + i * 0.05, reviews: 100 + i * 50 }));
    const top = rankList(all, 'top')!;
    const badges = top.hotels.map((x) => x.badge).filter(Boolean);
    expect(new Set(badges).size).toBe(badges.length);
    expect(top.hotels.every((x) => x.km !== null)).toBe(true);
    const spread = all.map((x, i) => ({ ...x, lat: 30 + i, lng: 30 + i }));
    expect(rankList(spread, 'top')!.hotels.every((x) => x.km === null)).toBe(true);
  });
});

describe('best lists: exclusions', () => {
  it('leaves out hostels and gives no distance for region destinations', async () => {
    const { rankList } = await import('./best');
    const all = Array.from({ length: 10 }, (_, i) => h(i + 1, { score: 8 + i * 0.05 }));
    all.push(h(30, { nameEn: 'The Post Hostel', score: 9.8, reviews: 5000 }));
    expect(rankList(all, 'top')!.hotels.map((x) => x.id)).not.toContain(30);
    expect(rankList(all, 'top', 'cyprus')!.hotels.every((x) => x.km === null)).toBe(true);
  });
});
