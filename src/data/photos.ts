import type { Photo } from '../lib/photo';

/** Hotel mood shots used across the site. */
export const hotel = {
  hero: { unsplash: '1566073771259-6a8506099945', alt: 'בריכת מלון מול הים בשקיעה' },
  terrace: { unsplash: '1596394516093-501ba68a0ba6', alt: 'מיטה זוגית במרפסת פתוחה מול נוף הרים ואגם' },
  rooftop: { unsplash: '1445019980597-93fa8acb246c', alt: 'מיטות שיזוף על גג מלון מול הרים בשעת ערב' },
  infinity: { unsplash: '1540541338287-41700207dee6', alt: 'בריכת אינסוף של ריזורט מול הים' },
  sunset: { unsplash: '1561501900-3701fa6a0864', alt: 'מלון על חוף הים בשקיעה' },
  room: { unsplash: '1578683010236-d716f9a3f461', alt: 'חדר מלון מעוצב עם חלונות גדולים' },
  pool: { unsplash: '1520250497591-112f2f40a3f4', alt: 'בריכה בריזורט טרופי בין עצי דקל' },
  night: { unsplash: '1542314831-068cd1dbfeeb', alt: 'בריכת מלון מוארת בלילה' },
} satisfies Record<string, Photo>;

/** Topic photos for guides that are not about a single destination page. */
export const topicPhotos = {
  hanukkah: { pexels: 6054110, alt: 'חנוכייה עם נרות דולקים' },
  christmasPrague: { pexels: 19099383, alt: 'עץ חג המולד ושוק בכיכר העיר העתיקה בפראג' },
  gudauri: { pexels: 29952995, alt: 'רכבל מעל מדרון מושלג באתר הסקי גודאורי, גאורגיה' },
  thailandBeach: { pexels: 9625358, alt: 'סירת זנב ארוך במים טורקיז ליד צוקי גיר בתאילנד' },
  halongBay: { pexels: 5041966, alt: 'ספינת שייט בין איי הגיר במפרץ הא לונג, וייטנאם' },
  newYear: { unsplash: '1546271876-af6caec5fae5', alt: 'זיקוקים מעל העיר בערב השנה החדשה' },
} satisfies Record<string, Photo>;

/** One photo per destination, keyed by slug. */
export const destPhotos: Record<string, Photo> = {
  eilat: { unsplash: '1588784695369-d5412c1bdd18', alt: 'המרינה ובריכות המלונות בחוף הצפוני, אילת' },
  'dead-sea': { pexels: 11589243, alt: 'מתרחצת צפה וקוראת עיתון בים המלח' },
  'tel-aviv': { pexels: 17699658, alt: 'חוף הים וקו הרקיע של תל אביב' },
  jerusalem: { pexels: 11696778, alt: 'נוף העיר העתיקה וכיפת הסלע, ירושלים' },
  tiberias: { pexels: 2102619, alt: 'מבט מהאוויר על הכנרת והשדות סביבה' },
  haifa: { pexels: 17291340, alt: 'הגנים הבהאיים והעיר חיפה מלמעלה' },
  netanya: { pexels: 19400722, alt: 'המצוק, מגדלי העיר וחוף הרצל בנתניה' },
  rhodes: { pexels: 6273916, alt: 'רחוב האבירים בעיר העתיקה של רודוס בערב' },
  crete: { pexels: 6232774, alt: 'הנמל הוונציאני של חאניה בשקיעה, כרתים' },
  cyprus: { pexels: 30563689, alt: 'מבט מהאוויר על חוף פאפוס, קפריסין' },
  batumi: { pexels: 31124745, alt: 'מגדלי הטיילת של בטומי, גאורגיה' },
  athens: { unsplash: '1555993539-1732b0258235', alt: 'הפרתנון באקרופוליס, אתונה' },
  paris: { unsplash: '1502602898657-3e91760cbb34', alt: 'מגדל אייפל והסן בשקיעה, פריז' },
  london: { unsplash: '1505761671935-60b3a7427bad', alt: 'הביג בן וגשר וסטמינסטר, לונדון' },
  rome: { unsplash: '1552832230-c0197dd311b5', alt: 'הקולוסיאום, רומא' },
  barcelona: { unsplash: '1583422409516-2895a77efded', alt: 'מבט מלמעלה על רובע אשמפלה וסגרדה פמיליה, ברצלונה' },
  prague: { unsplash: '1541849546-216549ae216d', alt: 'גגות העיר העתיקה של פראג' },
  budapest: { unsplash: '1565426873118-a17ed65d74b9', alt: 'בניין הפרלמנט על הדנובה, בודפשט' },
  amsterdam: { unsplash: '1534351590666-13e3e96b5017', alt: 'תעלה עם סירות ובתים, אמסטרדם' },
  'new-york': { unsplash: '1496442226666-8d4d0e62e6e9', alt: 'טיימס סקוור, ניו יורק' },
  dubai: { unsplash: '1512453979798-5ea266f8880c', alt: 'קו הרקיע של דובאי ובורג׳ ח׳ליפה' },
  'abu-dhabi': { unsplash: '1512632578888-169bbbc64f33', alt: 'המסגד הגדול שייח׳ זאיד, אבו דאבי' },
  bangkok: { unsplash: '1508009603885-50cf7c579365', alt: 'טוק-טוק בצ׳יינה טאון בלילה, בנגקוק' },
};
