import { describe, expect, it } from 'vitest';
import { allowedTarget, siteOf, stayOf } from './handoff';

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
