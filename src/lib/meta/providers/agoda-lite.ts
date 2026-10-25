// Agoda Affiliate Lite (Long Tail Search) as a comparison provider.
//
// Limits of this API that the engine must respect (from Agoda's Lite guide):
// - one room per search; more rooms → `unsupported`
// - `dailyRate` is per night and "sell exclusive" (taxes and fees not included, amount not given),
//   so the stay total is marked inclusive:false without an excluded amount: shown, never ranked cheapest
// - no cancellation terms and no coordinates in the response
// A fair all-in comparison needs Agoda's fuller search API or their MSE feed (pending approval).

import { agodaConfigured, searchCity } from '../../agoda';
import { agodaCityId, findDestination } from '../../resolve';
import type { Offer, Provider } from '../types';

const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export const agodaLite: Provider = {
  id: 'agoda',
  name: 'Agoda',
  configured: agodaConfigured,
  async search(req) {
    if (req.rooms.length !== 1) return { offers: [], unsupported: 'ה-API של Agoda שמחובר אצלנו מתמחר חדר אחד בלבד' };
    const dest = findDestination({ slug: req.destination.slug });
    const cityId = dest && agodaCityId(dest);
    if (!cityId) return { offers: [], unsupported: 'אין מזהה עיר של Agoda ליעד הזה' };
    const [room] = req.rooms;
    const hotels = await searchCity({
      cityId,
      checkin: req.checkin,
      checkout: req.checkout,
      adults: room.adults,
      children: room.childAges.length,
      childrenAges: room.childAges,
    });
    const nights = nightsBetween(req.checkin, req.checkout);
    const checkedAt = new Date().toISOString();
    return {
      offers: hotels.map(
        (h): Offer => ({
          provider: 'agoda',
          hotel: { id: String(h.id), name: h.name, stars: h.stars, image: h.image },
          rooms: 1,
          board: h.breakfast ? 'breakfast' : 'unknown',
          cancellation: { kind: 'unknown' },
          price: { total: { amount: h.rate * nights, currency: h.currency }, inclusive: false },
          url: h.url,
          checkedAt,
        }),
      ),
    };
  },
};
