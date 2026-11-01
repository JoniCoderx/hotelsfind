import { describe, expect, it } from 'vitest';
import { goText, reachTag, reachText, sizedImg } from './hotelcard';

// QA: asking TripAdvisor for the shown size (?w=320&h=200) got 400 errors and broke every home-page photo.
describe('hotel photos', () => {
  it('use the 550px copy that always loads, with no size query', () => {
    const im = sizedImg('https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2a/22/95/d1/dan-eilat-hotel.jpg', 320, 200);
    expect(im).toEqual({ src: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-s/2a/22/95/d1/dan-eilat-hotel.jpg', srcset: '' });
  });
  it('leave other images alone', () => {
    expect(sizedImg('https://pix2.agoda.net/x.jpg', 320, 200)).toEqual({ src: 'https://pix2.agoda.net/x.jpg', srcset: '' });
  });
});

describe('booking button words', () => {
  it('promise the hotel only when we know its ID on that site', () => {
    expect(goText('Agoda', true)).toBe('לחיפוש המלון ב-<bdi>Agoda</bdi>');
    expect(goText('Booking.com', false)).toBe('לחיפוש ב-<bdi>Booking.com</bdi>');
  });
  it('mark Trip.com searches as not checked yet', () => {
    expect(goText('Trip.com', false, 'trip')).toContain('טרם אומת');
  });
});

describe('what a link opens, said beside it', () => {
  it('says nothing more when the link targets the hotel', () => {
    expect(reachText('Agoda', true, 'agoda')).toBe('');
    expect(reachTag(true, 'agoda')).toBe('המלון');
  });
  it('says a search around the hotel, in the city, or not checked', () => {
    expect(reachText('Booking.com', false, 'booking')).toContain('באזור המלון');
    expect(reachText('Agoda', false, 'agoda')).toContain('בעיר');
    expect(reachText('Trip.com', false, 'trip')).toContain('לא נבדק');
    expect(reachTag(false, 'booking')).toBe('חיפוש באזור');
  });
});
