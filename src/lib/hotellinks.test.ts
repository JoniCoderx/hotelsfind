import { describe, expect, it } from 'vitest';
import { catalogMatch, nameMatch } from './hotellinks';
import { catalog } from './catalog';

describe('hotel name matching', () => {
  it('matches the same hotel under slightly different names', () => {
    expect(nameMatch('Hôtel Astra Opéra - Astotel', 'hotel astra opera')).toBeGreaterThanOrEqual(0.6);
    expect(nameMatch('Leonardo Plaza Hotel Dead Sea', 'leonardo plaza dead sea', 'Dead Sea, Israel')).toBe(1);
  });

  it('rejects a different hotel', () => {
    expect(nameMatch('Milos Dead Sea Hotel', 'royal hotel dead sea', 'Dead Sea, Israel')).toBe(0);
    expect(nameMatch('Hotel', 'Resort')).toBe(0);
    expect(nameMatch('Kayma by Isrotel Exclusive', 'isrotel dead sea', 'Dead Sea, Israel')).toBe(0);
  });

  it('rejects the neighbours Stay22 and a city check once let through', async () => {
    const { SAME_NAME } = await import('./hotellinks');
    const p = 'Eilat, Israel';
    // Clicked on the live site: each of these opened the second hotel.
    expect(nameMatch('Neve Eilat Hotel - An Atlas Hotel', 'Nova Like Hotel - an Atlas Hotel', p)).toBeLessThan(SAME_NAME);
    expect(nameMatch('Dan Panorama Eilat Hotel', 'Dan Eilat Hotel', p)).toBeLessThan(SAME_NAME);
    expect(nameMatch('Brown Eilat by Brown Hotels', 'Neptune Eilat by Dan Hotels', p)).toBeLessThan(SAME_NAME);
    expect(nameMatch('Royal Beach Hotel Tel Aviv by Isrotel Exclusive', 'royal garden by isrotel', 'Tel Aviv, Israel')).toBeLessThan(SAME_NAME);
    expect(nameMatch('Leonardo Plaza Hotel Haifa', 'Crowne Plaza Haifa By IHG', 'Haifa, Israel')).toBe(0);
    expect(nameMatch('The Tower Hotel', 'DoubleTree by Hilton London - Tower of London', 'London, UK')).toBe(0);
    expect(nameMatch('Hôtel Signature Saint Germain des Près', 'studio saint germain des pres paris', 'Paris, France')).toBe(0);
    expect(nameMatch('Westin Grand Central', 'Hyatt Grand Central New York', 'New York, USA')).toBe(0);
    expect(nameMatch('Courtyard by Marriott New York Manhattan/Central Park', 'Park Central Hotel New York', 'New York, USA')).toBe(0);
    expect(nameMatch('Le Méridien Abu Dhabi Resort', 'le royal meridien abu dhabi', 'Abu Dhabi, UAE')).toBeLessThan(SAME_NAME);
    expect(nameMatch('Shangri-la Qaryat Al Beri, Abu Dhabi', 'Shangri-La Hotel Apartments Qaryat Al Beri', 'Abu Dhabi, UAE')).toBe(0);
    expect(nameMatch('Alliance Palace Batumi', 'Sunshine Alliance Palace Apartments', 'Batumi, Georgia')).toBe(0);
    expect(nameMatch('Premier Inn Dubai International Airport', 'Dubai International Airport Hotel', 'Dubai, UAE')).toBe(0);
    expect(nameMatch('Hotel Old Town', 'Hotel Indigo Batumi Old Town By IHG', 'Batumi, Georgia')).toBe(0);
    // And still the same hotel under its other spellings.
    expect(nameMatch('FH55 Grand Hotel Palatino', 'FH Grand Hotel Palatino', 'Rome, Italy')).toBeGreaterThanOrEqual(SAME_NAME);
    expect(nameMatch('Kings Court Prague Deluxe Hotel', 'Hotel Kings Court', 'Prague, Czechia')).toBeGreaterThanOrEqual(SAME_NAME);

    expect(nameMatch('Crowne Plaza Tel Aviv City Center By IHG', 'crowne plaza tel aviv city center', 'Tel Aviv, Israel')).toBeGreaterThanOrEqual(SAME_NAME);
    expect(nameMatch('Sea Tower Hotel Tel Aviv By Isrotel Design', 'isrotel sea tower tel aviv', 'Tel Aviv, Israel')).toBeGreaterThanOrEqual(SAME_NAME);
    expect(nameMatch('Yam Suf By Isrotel Collection', 'isrotel yam suf', p)).toBeGreaterThanOrEqual(SAME_NAME);
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

describe('catalog destinations', async () => {
  const { catalog } = await import('./catalog');
  it('keeps the Dead Sea on the Israeli shore', () => {
    expect(catalog['dead-sea'].length).toBeGreaterThan(5);
    expect(catalog['dead-sea'].every((h) => h.lng == null || h.lng < 35.45)).toBe(true);
  });
  it('drops hotels far from Tel Aviv and Netanya', () => {
    expect(catalog['tel-aviv'].some((h) => /Mizra/.test(h.nameEn))).toBe(false);
    expect(catalog['netanya'].some((h) => /Nomads/.test(h.nameEn))).toBe(false);
  });
});

// QA (mapping run, 1 Nov): hotels in our Agoda catalog that the match missed, so their buttons only searched.
describe('catalog matches that were missed', () => {
  it('a name made only of chain words matches the same name', () => {
    expect(catalogMatch('eilat', 'Caesar Premier Eilat Hotel', 29.551966, 34.959938, 'Eilat, Israel')?.id).toBe(165802);
  });
  it('a chain on one side only, when the catalog hotel is right there', () => {
    expect(catalogMatch('eilat', 'Royal Beach Eilat Hotel', 29.5498, 34.9629, 'Eilat, Israel')?.id).toBe(198318);
    expect(catalogMatch('eilat', 'Lagoona by Isrotel Collection', 29.551382, 34.961643, 'Eilat, Israel')?.id).toBe(165898);
  });
  it('"All Inclusive" and "a member of" are not part of the name', () => {
    expect(catalogMatch('eilat', 'Astral Nirvana Club', 29.556353, 34.955097, 'Eilat, Israel')?.id).toBe(478832);
    expect(catalogMatch('athens', 'Brown Acropol', 37.983585, 23.727194, 'Athens, Greece')?.id).toBe(9790014);
  });
  it('still not by name alone when a chain is on one side only', () => {
    expect(nameMatch('Hotel Old Town', 'Hotel Indigo Old Town', 'Prague')).toBe(0);
    expect(nameMatch('Caesar Premier', 'Caesar Hotel', 'Eilat')).toBe(0);
  });
});
