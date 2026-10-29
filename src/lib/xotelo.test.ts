import { describe, expect, it } from 'vitest';
import { LOCATIONS, thumb, toListHotel, toOffers } from './xotelo';
import { destinations } from '../data/destinations';

describe('xotelo', () => {
  it('has a location for every destination', () => {
    for (const d of destinations) expect(LOCATIONS[d.slug], d.slug).toMatch(/^g\d+$/);
  });

  it('keeps the cheapest rate per site we link to, in shekels, cheapest first', () => {
    const offers = toOffers(
      [
        { code: 'BookingCom', rate: 320 },
        { code: 'Agoda', rate: 282 },
        { code: 'CtripTA', rate: 237 },
        { code: 'Vio', rate: 200 },
        { code: 'Agoda', rate: 290 },
        { code: 'BookingCom', rate: null },
      ],
      3.5,
    );
    expect(offers).toEqual([
      { site: 'trip', price: 830 },
      { site: 'agoda', price: 987 },
      { site: 'booking', price: 1120 },
    ]);
  });

  it('turns a list entry into a hotel row', () => {
    const h = toListHotel(
      {
        key: 'g293984-d304486',
        name: 'Herods Tel Aviv',
        review_summary: { rating: 4, count: 3201 },
        price_ranges: { minimum: 196, maximum: 406 },
        image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/10/8f/f9/08/herods-tel-aviv.jpg',
        merchandising_labels: ['All inclusive', 'Breakfast included', 'Something new'],
      },
      3.5,
    )!;
    expect(h).toMatchObject({ key: 'g293984-d304486', rating: 4, reviews: 3201, from: 686, to: 1421, tags: ['הכל כלול', 'ארוחת בוקר כלולה'] });
    expect(h.image).toBe('https://dynamic-media-cdn.tripadvisor.com/media/photo-s/10/8f/f9/08/herods-tel-aviv.jpg');
    expect(toListHotel({ key: 'bad', name: 'x' }, 3.5)).toBeNull();
  });

  it('only swaps TripAdvisor photos', () => {
    expect(thumb('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
});
