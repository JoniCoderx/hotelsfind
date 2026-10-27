// Price routes and the price-mode switch. Every provider call goes through fetch, so counting fetch calls
// proves whether a route reached a provider.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEYS = {
  AGODA_SITE_ID: '1',
  AGODA_API_KEY: 'k',
  AGODA_SEARCH_ENDPOINT: 'https://agoda.test/search',
  AGODA_CITY_IDS: '{"bangkok":9395}',
  BOOKING_API_BASE: 'https://booking.test/3.2',
  BOOKING_API_TOKEN: 't',
  BOOKING_AFFILIATE_ID: '123',
};

const agodaLite = {
  results: [
    {
      hotelId: 101,
      hotelName: 'Test',
      starRating: 4,
      reviewScore: 8,
      currency: 'ILS',
      dailyRate: 500,
      crossedOutRate: 0,
      imageURL: '',
      landingURL: 'https://www.agoda.com/x',
      includeBreakfast: false,
      freeWifi: true,
    },
  ],
};

let calls: string[] = [];
const in2weeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
const in2weeks2 = new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10);

const routes = {
  search: () => import('../src/pages/api/search'),
  rates: () => import('../src/pages/api/rates'),
  compare: () => import('../src/pages/api/compare'),
};

async function call(route: keyof typeof routes, qs: string) {
  const mod = await routes[route]();
  const url = new URL(`https://malonzol.test/api/${route}?${qs}`);
  const res: Response = await mod.GET({ url, request: new Request(url) } as never);
  return { res, body: res.status === 308 ? null : await res.json() };
}

const searchQs = () => `slug=bangkok&in=${in2weeks}&out=${in2weeks2}&a=2`;
const ratesQs = () => `ids=101&in=${in2weeks}&out=${in2weeks2}&a=2`;
const compareQs = () => `slug=bangkok&in=${in2weeks}&out=${in2weeks2}&rooms=2&src=search`;

beforeEach(() => {
  calls = [];
  vi.resetModules();
  for (const [k, v] of Object.entries(KEYS)) vi.stubEnv(k, v);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string) => {
      calls.push(String(u));
      return new Response(JSON.stringify(String(u).includes('agoda') ? agodaLite : { data: [] }));
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('links mode (default)', () => {
  it('no price route calls a provider, even with every key set', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', '');
    const s = await call('search', searchQs());
    const r = await call('rates', ratesQs());
    const c = await call('compare', compareQs());
    expect(calls).toEqual([]);
    expect(s.body.mode).toBe('links');
    expect(s.body.hotels).toBeUndefined();
    expect(r.body.hotels).toEqual([]);
    expect(c.body.hotels).toEqual([]);
  });

  it('ignores sample-data flags in a production build', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGODA_DEMO', '1');
    vi.stubEnv('META_FAKE', '1');
    vi.stubEnv('AGODA_SITE_ID', '');
    const s = await call('search', searchQs());
    const c = await call('compare', compareQs());
    expect(s.body.mode).toBe('links');
    expect(c.body.hotels).toEqual([]);
  });
});

describe('live mode', () => {
  it('calls providers and never lets a price be cached', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    const s = await call('search', searchQs());
    expect(s.body.mode).toBe('live');
    expect(s.body.hotels).toHaveLength(1);
    expect(s.res.headers.get('Cache-Control')).toBe('no-store');
    const c = await call('compare', compareQs());
    expect(c.res.headers.get('Cache-Control')).toBe('no-store');
    expect(c.body.connectors.map((p: { source: string }) => p.source)).toEqual(['agoda-search', 'booking-demand', 'vio']);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('refuses to price two rooms as one on the hotel page', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    const r = await call('rates', `${ratesQs()}&r=2`);
    expect(r.body).toMatchObject({ mode: 'links', reason: 'rooms' });
    expect(calls).toEqual([]);
  });

  it('refuses children without ages on every route', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    expect((await call('search', `${searchQs()}&c=1`)).res.status).toBe(400);
    expect((await call('rates', `${ratesQs()}&c=1`)).res.status).toBe(400);
    expect((await call('compare', compareQs().replace('rooms=2', 'rooms=2:18'))).res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('keeps both child ages through the canonical redirect', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    const { res } = await call('search', `a=2&c=2&ages=5,9&junk=1&slug=bangkok&in=${in2weeks}&out=${in2weeks2}`);
    expect(res.status).toBe(308);
    const loc = new URL(res.headers.get('Location')!, 'https://x');
    expect(loc.searchParams.get('ages')).toBe('5,9');
    expect(loc.searchParams.has('junk')).toBe(false);
  });

  it('compares one room only, for now', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    const c = await call('compare', compareQs().replace('rooms=2', 'rooms=2;2'));
    expect(c.res.status).toBe(400);
    expect(c.body.error).toBe('one_room_only');
  });

  it('gives each of two simultaneous searches its own click label', async () => {
    vi.stubEnv('PUBLIC_PRICE_MODE', 'live');
    vi.stubEnv('META_FAKE', '1');
    const [a, b] = await Promise.all([call('compare', compareQs().replace('src=search', 'src=campaign-a')), call('compare', compareQs().replace('src=search', 'src=campaign-b'))]);
    const urls = (r: { body: { hotels: { offers: { source: string; url: string }[] }[] } }) =>
      r.body.hotels.flatMap((h) => h.offers.filter((o) => o.source === 'booking-demand').map((o) => new URL(o.url).searchParams.get('label')));
    expect(new Set(urls(a))).toEqual(new Set(['malonzol-campaign-a']));
    expect(new Set(urls(b))).toEqual(new Set(['malonzol-campaign-b']));
  });
});
