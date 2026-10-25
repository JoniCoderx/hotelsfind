import { priceMode } from '../lib/mode';

const live = priceMode() === 'live';

export const site = {
  name: 'מלונזול',
  nameHe: 'מלונזול',
  domain: 'malonzol.com',
  slogan: live ? 'מחפשים מלון. בודקים מחירים. בוחרים איפה להזמין.' : 'חיפוש מלון אחד. כל אתרי ההזמנות במרחק לחיצה.',
  description: live
    ? 'מלונזול מציג מחירי מלונות מ-Agoda לתאריכים שלכם, ופותח בלחיצה את אותו יעד ותאריכים ב-Booking, Expedia, Hotels.com ו-Trip.com. מלונות באילת, ים המלח, תל אביב, יוון, דובאי ואירופה. השימוש ללא תשלום.'
    : 'מלונזול פותח את חיפוש המלון שלכם, עם היעד והתאריכים, ב-Booking, Agoda, Expedia, Hotels.com ו-Trip.com, כדי שתבדקו מחירים בכמה אתרים בלי להקליד מחדש. מלונות באילת, ים המלח, תל אביב, יוון, דובאי ואירופה. השימוש ללא תשלום.',
  email: 'hello@malonzol.com',
};
