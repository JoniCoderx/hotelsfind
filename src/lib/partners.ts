// Partner deep links. Every link carries our affiliate ID (when configured)
// so a booking made after the click is attributed to MalonZol (מלונזול).
// Used both at build time (destination pages) and in the browser (/search).

export interface SearchQuery {
  /** Free-text destination, preferably in English (partners match it best). */
  q: string;
  /** ISO dates, YYYY-MM-DD. Optional: without dates partners show their flexible-date view. */
  checkin?: string;
  checkout?: string;
  adults: number;
  children: number;
  /** One age (0–17) per child, when the traveller gave them. */
  childAges?: number[];
  rooms: number;
  /** Where on our site the click came from, for affiliate reporting. */
  source?: string;
}

export interface Partner {
  id: 'booking' | 'agoda' | 'expedia' | 'hotelscom' | 'trip';
  name: string;
  /** Whether our link carries each child's age. When it doesn't, the traveller re-enters children there. */
  passesChildAges: boolean;
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

// Travelpayouts: one account covers several brands. When the marker, the project
// ID (trs) and a brand's program ID (p) are all set, that brand's links go through
// tp.media so the booking is credited to us. Copy all three from a link generated
// in the Travelpayouts dashboard (Programs → brand → Generate links).
const TP = {
  marker: env.PUBLIC_TP_MARKER || '',
  trs: env.PUBLIC_TP_TRS || '',
  p: {
    booking: env.PUBLIC_TP_BOOKING_P || '',
    agoda: env.PUBLIC_TP_AGODA_P || '',
    expedia: env.PUBLIC_TP_EXPEDIA_P || '',
    hotelscom: env.PUBLIC_TP_HOTELSCOM_P || '',
    trip: env.PUBLIC_TP_TRIP_P || '',
  } as Record<Partner['id'], string>,
};

function viaTp(id: Partner['id'], link: string, source?: string) {
  if (!TP.marker || !TP.trs || !TP.p[id]) return link;
  // sub_id splits the Travelpayouts report by where the click came from (check it shows up there).
  return url('https://tp.media/r', { marker: TP.marker, trs: TP.trs, p: TP.p[id], sub_id: source, u: link });
}

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

const raw: Partner[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    passesChildAges: true,
    accent: '#3d7bff',
    build: (s) => {
      const u = new URL(
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
          label: `malonzol-${s.source || 'web'}`,
        }),
      );
      // Booking prices children by age: one age= per child.
      if (s.childAges?.length === s.children) for (const a of s.childAges) u.searchParams.append('age', String(a));
      return u.toString();
    },
  },
  {
    id: 'agoda',
    name: 'Agoda',
    passesChildAges: false,
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
        tag: `malonzol-${s.source || 'web'}`,
      }),
  },
  {
    id: 'expedia',
    name: 'Expedia',
    passesChildAges: false,
    accent: '#ffc94a',
    build: (s) =>
      url('https://www.expedia.com/Hotel-Search', {
        destination: s.q,
        startDate: s.checkin,
        endDate: s.checkout,
        adults: s.adults,
        rooms: s.rooms,
        // Children are left out: Expedia Group wants room_age pairs ("1_8") and we haven't verified that format.
        affcid: AFF.expedia,
      }),
  },
  {
    id: 'hotelscom',
    name: 'Hotels.com',
    passesChildAges: false,
    accent: '#e04e8a',
    build: (s) =>
      url('https://www.hotels.com/Hotel-Search', {
        destination: s.q,
        startDate: s.checkin,
        endDate: s.checkout,
        adults: s.adults,
        rooms: s.rooms,
        // Children are left out: Expedia Group wants room_age pairs ("1_8") and we haven't verified that format.
        locale: 'he_IL',
        affcid: AFF.hotelscom,
      }),
  },
  {
    id: 'trip',
    name: 'Trip.com',
    passesChildAges: false,
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

/** Shown next to a link that drops children, so the traveller knows to add them on the partner site. */
export function childNote(p: Pick<Partner, 'passesChildAges'>, s: Pick<SearchQuery, 'children'>) {
  return s.children && !p.passesChildAges ? 'הילדים וגיליהם לא עוברים לאתר הזה: הזינו אותם שם מחדש.' : '';
}

export const partners: Partner[] = raw.map((x) => ({ ...x, build: (s: SearchQuery) => viaTp(x.id, x.build(s), s.source) }));
