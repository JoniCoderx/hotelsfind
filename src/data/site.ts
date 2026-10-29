import { priceMode } from '../lib/mode';

const live = priceMode() === 'live';

export const site = {
  name: 'מלונזול',
  nameHe: 'מלונזול',
  domain: 'malonzol.com',
  slogan: live ? 'מחפשים מלון. בודקים מחירים. בוחרים איפה להזמין.' : 'מחפשים פעם אחת. משווים מחירים מכמה אתרי הזמנות.',
  description: live
    ? 'מחירי מלונות מ-Agoda לתאריכים שלכם, ובלחיצה אותו חיפוש ב-Booking, Expedia ועוד. מלונות באילת, ים המלח, יוון ואירופה. ללא תשלום.'
    : 'השוואת מחירי מלונות מכמה אתרי הזמנות לתאריכים שלכם, ובלחיצה אותו חיפוש ב-Booking, Agoda, Expedia ועוד. מלונות באילת, ים המלח, יוון ואירופה.',
  email: 'hello@malonzol.com',
  instagram: 'https://www.instagram.com/malonzoll/',
  telegram: 'https://t.me/malonzol',
  tiktok: 'https://www.tiktok.com/@malonzol',
};
