import { beforeEach, describe, expect, it } from 'vitest';

// A small in-memory localStorage for the browser-only helpers.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
const { markFull, withoutFull } = await import('./soldout');
const { currency, fromIls } = await import('./currency');

describe('sites a visitor found full', () => {
  beforeEach(() => store.clear());
  const prices = [
    { site: 'agoda', price: 500 },
    { site: 'booking', price: 520 },
  ];

  it('drops that site for the same hotel and dates only', () => {
    markFull('h1', 'agoda', '2026-12-03', '2026-12-05');
    expect(withoutFull(prices, 'h1', '2026-12-03', '2026-12-05').map((o) => o.site)).toEqual(['booking']);
    expect(withoutFull(prices, 'h1', '2026-12-10', '2026-12-12')).toHaveLength(2);
    expect(withoutFull(prices, 'h2', '2026-12-03', '2026-12-05')).toHaveLength(2);
  });

  it('forgets a mark after three days', () => {
    store.set('mz-full', JSON.stringify({ 'h1|agoda|2026-12-03|2026-12-05': Date.now() - 4 * 86_400_000 }));
    expect(withoutFull(prices, 'h1', '2026-12-03', '2026-12-05')).toHaveLength(2);
  });
});

describe('currency', () => {
  it('stays in shekels until another currency and its rate are in', () => {
    store.set('mz-cur', 'USD');
    expect(currency()).toBe('ILS');
    expect(fromIls(100)).toEqual({ amount: 100, currency: 'ILS' });
  });
});
