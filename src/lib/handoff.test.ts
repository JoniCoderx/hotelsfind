import { describe, expect, it } from 'vitest';
import { allowedTarget, cleanAllez, siteOf, stayOf } from './handoff';

describe('handoff', () => {
  it('follows only booking-site addresses', () => {
    expect(allowedTarget('https://www.stay22.com/allez/booking?aid=malonzol')).not.toBeNull();
    expect(allowedTarget('https://www.agoda.com/partners/partnersearch.aspx?hid=1')).not.toBeNull();
    expect(allowedTarget('https://evil.com/?u=booking.com')).toBeNull();
    expect(allowedTarget('https://booking.com.evil.com/')).toBeNull();
    expect(allowedTarget('javascript:alert(1)')).toBeNull();
    expect(allowedTarget('http://www.booking.com/')).toBeNull();
  });
  it('names the site behind a Stay22 link', () => {
    expect(siteOf('https://www.stay22.com/allez/agoda?aid=malonzol')).toBe('agoda');
    expect(siteOf(`https://www.stay22.com/allez/roam?link=${encodeURIComponent('https://www.booking.com/hotel/il/x.html')}`)).toBe('booking');
    expect(siteOf('https://www.hotels.com/ho123')).toBe('hotelscom');
    expect(siteOf('https://us.trip.com/hotels/detail/?hotelId=1')).toBe('trip');
  });
  it('reads the stay from the link', () => {
    expect(stayOf('https://www.agoda.com/partners/partnersearch.aspx?checkin=2026-12-08&checkout=2026-12-12&adults=2')).toEqual({ checkin: '2026-12-08', checkout: '2026-12-12', adults: 2 });
    expect(stayOf(`https://www.stay22.com/allez/roam?link=${encodeURIComponent('https://www.booking.com/x?checkin=2026-12-08&checkout=2026-12-10&group_adults=3')}`)).toEqual({ checkin: '2026-12-08', checkout: '2026-12-10', adults: 3 });
  });
});

describe('Stay22 links as we built them', () => {
  // QA: links reached Stay22 with two campaign values (ours and the one Stay22's page script adds).
  const decorated =
    'https://www.stay22.com/allez/booking?aid=malonzol&campaign=malonzol.com-165899&product=allez&habl=false&isinc=true&sid22=abc&hasCTZ=false&lmaID=6ae3&campaign=hotel&lat=29.51&lng=34.92&adults=2&currency=ILS&source=direct&medium=manuallink&ref22=https%3A%2F%2Fmalonzol.com%2F';
  it('keep one campaign, ours, and drop what the page script added', () => {
    const u = new URL(cleanAllez(decorated));
    expect(u.searchParams.getAll('campaign')).toEqual(['hotel']);
    for (const k of ['sid22', 'lmaID', 'ref22', 'product', 'medium', 'source', 'habl']) expect(u.searchParams.has(k), k).toBe(false);
    expect(u.searchParams.get('aid')).toBe('malonzol');
    expect(u.searchParams.get('lat')).toBe('29.51');
  });
  it('leave other links alone', () => {
    expect(cleanAllez('https://www.booking.com/hotel/il/x.html?aid=1')).toBe('https://www.booking.com/hotel/il/x.html?aid=1');
  });
});
