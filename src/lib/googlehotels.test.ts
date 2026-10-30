import { describe, expect, it } from 'vitest';
import { siteOf, toGoogleHotel } from './googlehotels';

describe('google hotels', () => {
  it('knows the booking sites we link to by the name Google gives them', () => {
    expect(siteOf('Booking.com')).toBe('booking');
    expect(siteOf('Agoda')).toBe('agoda');
    expect(siteOf('Trip.com')).toBe('trip');
    expect(siteOf('Hotels.com')).toBe('hotelscom');
    expect(siteOf('Expedia')).toBe('expedia');
    expect(siteOf('Bluepillow.com')).toBeNull();
  });

  it('turns a property into a row with the cheapest price per site', () => {
    const h = toGoogleHotel({
      name: 'Isrotel Yam Suf',
      property_token: 'ChcIabc123',
      type: 'hotel',
      overall_rating: 4.4,
      reviews: 3085,
      gps_coordinates: { latitude: 29.53, longitude: 34.95 },
      rate_per_night: { extracted_lowest: 812 },
      images: [{ thumbnail: 'https://lh5.googleusercontent.com/x' }],
      amenities: ['Free breakfast', 'Pool'],
      prices: [
        { source: 'Booking.com', rate_per_night: { extracted_lowest: 901 } },
        { source: 'Agoda', rate_per_night: { extracted_lowest: 812 } },
        { source: 'Agoda', rate_per_night: { extracted_lowest: 850 } },
        { source: 'Bluepillow.com', rate_per_night: { extracted_lowest: 700 } },
      ],
    })!;
    expect(h.key).toBe('gh-ChcIabc123');
    expect(h.prices).toEqual([
      { site: 'agoda', price: 812 },
      { site: 'booking', price: 901 },
    ]);
    expect(h.tags).toEqual(['ארוחת בוקר כלולה']);
    expect(h.hotel).toBe(true);
    expect(toGoogleHotel({ name: 'x' })).toBeNull();
  });
});
