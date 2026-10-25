// Sample results for previewing the results UI locally without Agoda keys.
// Only used when AGODA_DEMO=1 and no keys are set; the UI labels them as sample data.
import type { CitySearch, Hotel } from './agoda';

const IMAGES = [
  '1566073771259-6a8506099945',
  '1582719478250-c89cae4dc85b',
  '1611892440504-42a792e24d32',
  '1590490360182-c33d57733427',
  '1578683010236-d716f9a3f461',
  '1631049307264-da0ec9d70304',
  '1618773928121-c32242e63f39',
  '1540541338287-41700207dee6',
  '1520250497591-112f2f40a3f4',
  '1551882547-ff40c63fe5fa',
  '1564501049412-61c2a3083791',
  '1571896349842-33c89424de2d',
];

const NAMES = ['חוף', 'מרינה', 'בוטיק', 'פלאזה', 'גרנד', 'סוויטות', 'ספא', 'נוף', 'אורבן', 'פארק', 'לגונה', 'רויאל'];

export function demoHotels(s: CitySearch, seed: string): Hotel[] {
  let x = [...seed].reduce((a, c) => a + c.charCodeAt(0), 7);
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const hotels: Hotel[] = Array.from({ length: 24 }, (_, i) => {
    const stars = [3, 3.5, 4, 4, 4.5, 5][Math.floor(rnd() * 6)];
    const rate = Math.round(220 + stars * 90 + rnd() * 600);
    const discount = rnd() > 0.55 ? Math.round(10 + rnd() * 35) : 0;
    return {
      id: 1000 + i,
      name: `מלון ${NAMES[i % NAMES.length]} ${i + 1} (דוגמה)`,
      stars,
      score: Math.round((6.8 + rnd() * 3) * 10) / 10,
      reviews: Math.round(80 + rnd() * 3000),
      currency: 'ILS',
      rate,
      was: discount ? Math.round(rate / (1 - discount / 100)) : rate,
      discount,
      image: `https://images.unsplash.com/photo-${IMAGES[i % IMAGES.length]}?auto=format&q=70&w=800`,
      url: 'https://www.agoda.com/',
      breakfast: rnd() > 0.5,
      wifi: rnd() > 0.15,
    };
  });
  const out = hotels.filter(
    (h) =>
      h.stars >= (s.minStars ?? 0) &&
      h.score >= (s.minScore ?? 0) &&
      h.rate >= (s.minRate ?? 0) &&
      h.rate <= (s.maxRate ?? Infinity) &&
      (!s.discountOnly || h.discount > 0),
  );
  if (s.sortBy === 'PriceAsc') out.sort((a, b) => a.rate - b.rate);
  if (s.sortBy === 'StarRatingDesc') out.sort((a, b) => b.stars - a.stars);
  if (s.sortBy === 'AllGuestsReviewScore') out.sort((a, b) => b.score - a.score);
  return out;
}
