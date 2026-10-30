import { describe, expect, it } from 'vitest';
import { attributed, kidsHandoff, partners } from './partners';

/** The partner URL inside a Stay22 Allez link (links go out through Stay22 by default). */
const inner = (u: string) => {
  const x = new URL(u);
  return x.hostname === 'www.stay22.com' ? x.searchParams.get('link')! : u;
};

const p = (id: string) => partners.find((x) => x.id === id)!;
const s = { q: 'Athens, Greece', checkin: '2026-12-10', checkout: '2026-12-13', adults: 2, children: 2, childAges: [5, 9], rooms: 1 };

describe('child hand-off', () => {
  it('says what each link carries, and only what it carries', () => {
    expect(kidsHandoff(p('booking'), s)).toEqual({ sent: '2 ילדים כולל הגילים', todo: '' });
    expect(kidsHandoff(p('agoda'), s).sent).toBe('2 ילדים');
    expect(kidsHandoff(p('agoda'), s).todo).toContain('גילי הילדים לא עוברים');
    expect(kidsHandoff(p('expedia'), s)).toEqual({ sent: '', todo: 'הילדים לא עוברים לאתר הזה: הוסיפו אותם שם.' });
    expect(kidsHandoff(p('booking'), { children: 0 })).toEqual({ sent: '', todo: '' });
  });

  it('matches the links: Expedia and Hotels.com send no children, Booking sends ages', () => {
    for (const id of ['expedia', 'hotelscom']) expect(p(id).build(s)).not.toMatch(/child/i);
    expect(new URL(p('booking').build(s)).searchParams.get('childrenAges')).toBe('5,9');
    expect(inner(p('agoda').build(s))).toContain('children=2');
  });

  it('does not claim ages went to Booking when one is missing', () => {
    const partial = { ...s, childAges: [5] };
    expect(new URL(p('booking').build(partial)).searchParams.get('childrenAges')).toBeNull();
    expect(kidsHandoff(p('booking'), partial).todo).toContain('גילי הילדים לא עוברים');
  });
});

describe('attribution', () => {
  it('every partner link goes out through Stay22 with our affiliate ID', () => {
    for (const x of partners) {
      const u = new URL(x.build(s));
      expect(u.origin + u.pathname).toBe(`https://www.stay22.com/allez/${x.id}`);
      expect(u.searchParams.get('aid')).toBe('malonzol');
      expect(attributed(x.id)).toBe(true);
    }
    expect(new URL(p('booking').build({ ...s, source: 'search' })).searchParams.get('campaign')).toBe('search');
  });

  it('Agoda links carry our partner ID', () => {
    expect(inner(p('agoda').build(s))).toContain('cid=1979232');
  });
});

describe('Agoda hotel link', () => {
  it('opens the hotel with our ID, dates and party', async () => {
    const { agodaHotel } = await import('./partners');
    const out = agodaHotel(89029, { checkin: '2026-12-10', checkout: '2026-12-13', adults: 2, children: 1, childAges: [7] });
    expect(new URL(out).searchParams.get('checkin')).toBe('2026-12-10');
    const u = inner(out);
    expect(u).toContain('cid=1979232');
    expect(u).toContain('hid=89029');
    expect(u).toContain('checkin=2026-12-10');
    expect(u).toContain('NumberofChildren=1');
  });
});

describe('searches through Stay22', () => {
  const base = { q: 'G Hotel, Eilat, Israel', checkin: '2026-12-08', checkout: '2026-12-12', adults: 2, children: 0, rooms: 1 };
  it('go by coordinates when we have them, never by a free-text name (Agoda and Trip.com keep their own search)', () => {
    for (const x of partners.filter((y) => y.id !== 'agoda' && y.id !== 'trip')) {
      const u = new URL(x.build({ ...base, lat: 29.5545, lng: 34.9553 }));
      expect(u.searchParams.get('lat')).toBe('29.5545');
      expect(u.searchParams.get('lng')).toBe('34.9553');
      expect(u.searchParams.get('link')).toBeNull();
      expect(u.searchParams.get('checkin')).toBe('2026-12-08');
    }
  });
  it('without coordinates, keep Agoda and Trip.com text searches and give the others an address', () => {
    for (const x of partners) {
      const u = new URL(x.build(base));
      if (x.id === 'agoda' || x.id === 'trip') expect(u.searchParams.get('link')).toContain(x.id === 'agoda' ? 'agoda.com' : 'trip.com');
      else expect(u.searchParams.get('address')).toBe('G Hotel, Eilat, Israel');
    }
  });
});

describe('Agoda searches', () => {
  it('carry the city ID (with text alone Agoda opens its home page)', async () => {
    const { agodaCity, partners } = await import('./partners');
    expect(agodaCity('Brown Eilat by Brown Hotels, Eilat, Israel')).toBe(9752);
    expect(agodaCity('Dead Sea, Ein Bokek, Israel')).toBe(18362);
    expect(agodaCity('Hotel X, Tel-Aviv, Israel')).toBe(1692);
    expect(agodaCity('Somewhere Unknown')).toBeUndefined();
    const link = partners.find((p) => p.id === 'agoda')!.build({ q: 'Brown Eilat, Eilat, Israel', adults: 2, children: 0, rooms: 1 });
    expect(decodeURIComponent(link)).toContain('city=9752');
  });
});
