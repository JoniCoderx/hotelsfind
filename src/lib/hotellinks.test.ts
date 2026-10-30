import { describe, expect, it } from 'vitest';
import { catalogMatch, nameMatch } from './hotellinks';
import { catalog } from './catalog';

describe('hotel name matching', () => {
  it('matches the same hotel under slightly different names', () => {
    expect(nameMatch('Hôtel Astra Opéra - Astotel', 'hotel astra opera')).toBe(1);
    expect(nameMatch('Leonardo Plaza Hotel Dead Sea', 'leonardo plaza dead sea', 'Dead Sea, Israel')).toBe(1);
  });

  it('rejects a different hotel', () => {
    expect(nameMatch('Milos Dead Sea Hotel', 'royal hotel dead sea', 'Dead Sea, Israel')).toBe(0);
    expect(nameMatch('Hotel', 'Resort')).toBe(0);
    expect(nameMatch('Kayma by Isrotel Exclusive', 'isrotel dead sea', 'Dead Sea, Israel')).toBe(0);
  });

  it('finds a catalog hotel by name and place, and nothing for an unknown one', () => {
    const h = catalog['rome']?.[0];
    if (h?.lat != null && h.lng != null) expect(catalogMatch('rome', h.nameEn || h.name, h.lat, h.lng)?.id).toBe(h.id);
    expect(catalogMatch('rome', 'Totally Unknown Palace', 41.9, 12.49)).toBeUndefined();
  });
});

describe('Booking.com hotel pages', () => {
  it('knows the country of every destination', async () => {
    const { COUNTRY } = await import('./hotellinks');
    const { destinations } = await import('../data/destinations');
    for (const d of destinations) expect(COUNTRY[d.slug], d.slug).toMatch(/^[a-z]{2}$/);
  });

  it('keeps a page only in the destination country and with a matching name', async () => {
    const { bookingPage } = await import('./hotellinks');
    const c = { name: 'Isrotel Yam Suf', city: 'Eilat, Israel', slug: 'eilat' };
    expect(bookingPage('https://www.booking.com/hotel/il/isrotel-yam-suf.html?aid=1', c)).toBe('il/isrotel-yam-suf');
    // Same name, wrong country (Stay22's lookup once sent an Eilat hotel to Mexico).
    expect(bookingPage('https://www.booking.com/hotel/mx/isrotel-yam-suf.html', c)).toBeNull();
    expect(bookingPage('https://www.booking.com/hotel/il/royal-garden.html', c)).toBeNull();
    expect(bookingPage('https://www.booking.com/searchresults.html?dest_id=1&dest_type=hotel', c)).toBeNull();
  });
});
