// Partner deep links. Every link carries our affiliate ID (when configured)
// so a booking made after the click is attributed to LaylaZol.
// Used both at build time (destination pages) and in the browser (/search).

export interface SearchQuery {
  /** Free-text destination, preferably in English (partners match it best). */
  q: string;
  /** ISO dates, YYYY-MM-DD. Optional: without dates partners show their flexible-date view. */
  checkin?: string;
  checkout?: string;
  adults: number;
  children: number;
  rooms: number;
  /** Where on our site the click came from, for affiliate reporting. */
  source?: string;
}

export interface Partner {
  id: 'booking' | 'agoda' | 'expedia' | 'hotelscom' | 'trip';
  name: string;
  /** Short Hebrew pitch: why this partner is worth checking. */
  pitch: string;
  /** A money-saving tip specific to the partner. */
  tip: string;
  accent: string;
  build: (s: SearchQuery) => string;
}

const env = import.meta.env;
const AFF = {
  booking: env.PUBLIC_BOOKING_AID || '',
  agoda: env.PUBLIC_AGODA_CID || '',
  expedia: env.PUBLIC_EXPEDIA_AFFCID || '',
  hotelscom: env.PUBLIC_HOTELSCOM_AFFCID || '',
  tripAlliance: env.PUBLIC_TRIP_ALLIANCE_ID || '',
  tripSid: env.PUBLIC_TRIP_SID || '',
};

function url(base: string, params: Record<string, string | number | undefined>) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export function nights(s: Pick<SearchQuery, 'checkin' | 'checkout'>): number {
  if (!s.checkin || !s.checkout) return 0;
  const ms = Date.parse(s.checkout) - Date.parse(s.checkin);
  return ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

export const partners: Partner[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    pitch: 'המלאי הגדול בעולם, הרבה חדרים עם ביטול חינם.',
    tip: 'התחברו לחשבון Genius: הנחה של 10%–15% נפתחת אחרי שתי הזמנות.',
    accent: '#3d7bff',
    build: (s) =>
      url('https://www.booking.com/searchresults.he.html', {
        ss: s.q,
        checkin: s.checkin,
        checkout: s.checkout,
        group_adults: s.adults,
        group_children: s.children,
        no_rooms: s.rooms,
        lang: 'he',
        selected_currency: 'ILS',
        aid: AFF.booking,
        label: `laylazol-${s.source || 'web'}`,
      }),
  },
  {
    id: 'agoda',
    name: 'Agoda',
    pitch: 'לעיתים קרובות הכי זול באסיה, דובאי ויוון.',
    tip: 'שווה לבדוק "מחיר בלעדי לאפליקציה" ואת דילי ה-Insider של הסוף שבוע.',
    accent: '#ff5f6d',
    build: (s) =>
      url('https://www.agoda.com/he-il/search', {
        textToSearch: s.q,
        checkIn: s.checkin,
        los: nights(s) || undefined,
        adults: s.adults,
        children: s.children,
        rooms: s.rooms,
        currency: 'ILS',
        cid: AFF.agoda,
        tag: `laylazol-${s.source || 'web'}`,
      }),
  },
  {
    id: 'expedia',
    name: 'Expedia',
    pitch: 'חזק במיוחד בארה"ב ובחבילות מלון + טיסה.',
    tip: 'הזמנה משולבת עם טיסה יכולה להוזיל את המלון בעשרות אחוזים.',
    accent: '#ffc94a',
    build: (s) =>
      url('https://www.expedia.com/Hotel-Search', {
        destination: s.q,
        startDate: s.checkin,
        endDate: s.checkout,
        adults: s.adults,
        rooms: s.rooms,
        // Expedia Group expects children as room_age pairs ("1_8"); we don't ask for ages, so the site prompts.
        affcid: AFF.expedia,
      }),
  },
  {
    id: 'hotelscom',
    name: 'Hotels.com',
    pitch: 'מועדון One Key: צוברים קרדיט על כל לילה.',
    tip: 'חברי One Key רואים "מחירי חברים" שזולים בכ-10% מהמחיר הרגיל.',
    accent: '#e04e8a',
    build: (s) =>
      url('https://www.hotels.com/Hotel-Search', {
        destination: s.q,
        startDate: s.checkin,
        endDate: s.checkout,
        adults: s.adults,
        rooms: s.rooms,
        // Expedia Group expects children as room_age pairs ("1_8"); we don't ask for ages, so the site prompts.
        locale: 'he_IL',
        affcid: AFF.hotelscom,
      }),
  },
  {
    id: 'trip',
    name: 'Trip.com',
    pitch: 'מחירים אגרסיביים בעיקר במזרח הרחוק ובאירופה.',
    tip: 'קופונים למשתמשים חדשים מופיעים לרוב בדף הבית של האפליקציה.',
    accent: '#2bd4c4',
    build: (s) =>
      url('https://www.trip.com/hotels/list', {
        keyword: s.q,
        checkin: s.checkin?.replaceAll('-', '/'),
        checkout: s.checkout?.replaceAll('-', '/'),
        adult: s.adults,
        children: s.children,
        crn: s.rooms,
        curr: 'ILS',
        locale: 'he-IL',
        Allianceid: AFF.tripAlliance,
        SID: AFF.tripSid,
      }),
  },
];
