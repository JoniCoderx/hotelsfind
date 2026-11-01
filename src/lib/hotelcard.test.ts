import { describe, expect, it } from 'vitest';
import { sizedImg } from './hotelcard';

describe('hotel photos at the size shown', () => {
  // Lighthouse: the home page's 288x192 cards downloaded TripAdvisor's 550px copy (77 KB; 27 KB at 300x200).
  it('asks TripAdvisor for the card size, with a 2x copy', () => {
    const im = sizedImg('https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2a/22/95/d1/dan-eilat-hotel.jpg', 320, 200);
    expect(im.src).toBe('https://dynamic-media-cdn.tripadvisor.com/media/photo-s/2a/22/95/d1/dan-eilat-hotel.jpg?w=320&h=200&s=1');
    expect(im.srcset).toContain('?w=640&h=400&s=1 2x');
  });
  it('leaves other images alone', () => {
    expect(sizedImg('https://pix2.agoda.net/x.jpg', 320, 200)).toEqual({ src: 'https://pix2.agoda.net/x.jpg', srcset: '' });
  });
});
