import { priceMode } from '../lib/mode';

const live = priceMode() === 'live';

export const site = {
  name: 'מלונזול',
  nameHe: 'מלונזול',
  domain: 'malonzol.com',
  slogan: live ? 'מחפשים מלון. בודקים מחירים. בוחרים איפה להזמין.' : 'מחפשים פעם אחת. בודקים בכמה אתרי הזמנות.',
  description: live
    ? 'מחירי מלונות מ-Agoda לתאריכים שלכם, ובלחיצה אותו חיפוש ב-Booking, Expedia ועוד. מלונות באילת, ים המלח, יוון ואירופה. ללא תשלום.'
    : 'מזינים יעד ותאריכים פעם אחת, ובודקים את אותו חיפוש ב-Booking, Agoda, Expedia ועוד. מלונות באילת, ים המלח, יוון ואירופה.',
  email: 'hello@malonzol.com',
};
