import { describe, expect, it } from 'vitest';
import { cardImg, goText, reachTag, reachText, sizedImg } from './hotelcard';

// QA: asking TripAdvisor for the shown size (?w=320&h=200) got 400 errors and broke every home-page photo.
// QA: asking TripAdvisor for the shown size (?w=320&h=200) got 400 errors and broke every home-page photo.
describe('hotel photos', () => {
  it('use the fixed 550px and 1000px TripAdvisor copies, with no size query', () => {
    const im = sizedImg('https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2a/22/95/d1/dan-eilat-hotel.jpg');
    expect(im.src).toBe('https://dynamic-media-cdn.tripadvisor.com/media/photo-s/2a/22/95/d1/dan-eilat-hotel.jpg');
    expect(im.srcset).toBe(
      'https://dynamic-media-cdn.tripadvisor.com/media/photo-s/2a/22/95/d1/dan-eilat-hotel.jpg 550w, https://dynamic-media-cdn.tripadvisor.com/media/photo-w/2a/22/95/d1/dan-eilat-hotel.jpg 1000w',
    );
  });
  it('ask Agoda for 400px and 800px copies', () => {
    const im = sizedImg('https://pix2.agoda.net/hotelimages/1/x.jpg?s=312x&ca=2&ce=1');
    expect(im.srcset).toBe('https://pix2.agoda.net/hotelimages/1/x.jpg?s=400x&ca=2&ce=1 400w, https://pix2.agoda.net/hotelimages/1/x.jpg?s=800x&ca=2&ce=1 800w');
  });
  it('leave other images alone', () => {
    expect(sizedImg('https://pix2.agoda.net/x.jpg')).toEqual({ src: 'https://pix2.agoda.net/x.jpg', srcset: '' });
  });
  it('escape the alt text in the tag', () => {
    expect(cardImg('https://x/a.jpg', 'A "B" & C', '100px')).toBe('<img src="https://x/a.jpg" alt="A &quot;B&quot; &amp; C" loading="lazy" decoding="async" />');
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
