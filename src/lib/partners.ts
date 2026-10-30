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
  /**
   * Where the search is centred: the hotel's own coordinates for a hotel, the destination's centre for a place.
   * Links go out through Stay22, which re-geocodes free text on its own and can land a hotel's name in the wrong
   * country; with coordinates the search lands where we mean.
   */
  lat?: number;
  lng?: number;
}

export interface Partner {
  id: 'booking' | 'agoda' | 'expedia' | 'hotelscom' | 'trip';
  name: string;
  /** What our link sends about children: each age, only the count, or nothing. */
  kids: 'ages' | 'count' | 'none';
  accent: string;
  build: (s: SearchQuery) => string;
}

import { kidsHe } from './he';
import { allezUrl } from './stay22';

const env = import.meta.env;
const AFF = {
  booking: env.PUBLIC_BOOKING_AID || '',
  // Agoda Partners site ID; it appears in every link anyway, so it lives here rather than only in env.
  agoda: env.PUBLIC_AGODA_CID || '1979232',
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

// Stay22: every partner link goes out through Stay22's Allez with link= the partner URL, so the booking is
// credited to our Stay22 account (malonzol) whether or not that brand has approved us directly.
// PUBLIC_STAY22_LINKS=off sends the plain partner links instead.
const STAY22_LINKS = (env.PUBLIC_STAY22_LINKS ?? '').trim() !== 'off';

/**
 * Whether links to this partner carry a configured affiliate ID (Stay22, Travelpayouts, or the brand's own).
 * A campaign label alone (Booking's label, Agoda's tag) is not attribution.
 */
export function attributed(id: Partner['id']): boolean {
  if (STAY22_LINKS) return true;
  if (TP.marker && TP.trs && TP.p[id]) return true;
  if (id === 'trip') return Boolean(AFF.tripAlliance && AFF.tripSid);
  return Boolean(AFF[id]);
}

/** One hotel on Agoda (by Agoda hotel ID), with our partner ID and the traveller's dates and party. */
export function agodaHotel(id: number | string, s: { checkin?: string; checkout?: string; adults?: number; children?: number; childAges?: number[] }) {
  return route(
    'agoda',
    s,
    url('https://www.agoda.com/partners/partnersearch.aspx', {
      cid: AFF.agoda,
      hid: id,
      checkin: s.checkin,
      checkout: s.checkout,
      NumberofAdults: s.adults,
      NumberofChildren: s.children || undefined,
      childages: s.childAges?.length ? s.childAges.join(',') : undefined,
      Rooms: 1,
      currency: 'ILS',
    }),
    true,
  );
}

type Stay = {
  q?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  childAges?: number[];
  source?: string;
  lat?: number;
  lng?: number;
};

/**
 * A partner link as it goes out: through Travelpayouts when that brand is set up there, else through Stay22.
 * `exact` links (one hotel by its ID) go to Stay22 as they are. Searches are rebuilt for Stay22, which re-geocodes
 * free text on Booking.com, Expedia and Hotels.com: a hotel's name could land in another country. So those search by
 * coordinates when we have them, else by the place's name as an address; Agoda and Trip.com keep their own search.
 */
function route(id: Partner['id'], s: Stay, link: string, exact = false) {
  if (TP.marker && TP.trs && TP.p[id]) return viaTp(id, link);
  if (!STAY22_LINKS) return link;
  // Allez reads the stay from its own parameters (inside link= it keeps only some of them).
  // Expedia and Hotels.com get no children from us (we haven't verified their format), as kidsHandoff says.
  const kids = id !== 'expedia' && id !== 'hotelscom';
  const stay = {
    checkin: s.checkin,
    checkout: s.checkout,
    adults: s.adults,
    children: (kids && s.children) || undefined,
    childrenAges: kids && s.children && s.childAges?.length === s.children ? s.childAges.join(',') : undefined,
    currency: 'ILS',
    campaign: (s.source || 'web').replace(/-/g, '_'),
  };
  // Agoda and Trip.com keep their own text search through Allez (and Agoda's coordinate search can land on its home
  // page), so they always search by name. The others are re-geocoded, so they go by coordinates, else an address.
  if (exact || id === 'agoda' || id === 'trip') return allezUrl(id, { link, ...stay });
  if (s.lat != null && s.lng != null) return allezUrl(id, { lat: s.lat, lng: s.lng, ...stay });
  return allezUrl(id, { address: s.q, ...stay });
}

function viaTp(id: Partner['id'], link: string) {
  if (!TP.marker || !TP.trs || !TP.p[id]) return link;
  // No sub-ID yet: the documented way to add one is Travelpayouts' link-generation API, not a hand-built
  // parameter. Until that's wired, the source survives only in our own outbound events.
  return url('https://tp.media/r', { marker: TP.marker, trs: TP.trs, p: TP.p[id], u: link });
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
    kids: 'ages',
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
    kids: 'count',
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
    kids: 'none',
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
    kids: 'none',
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
    kids: 'count',
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

/**
 * What a partner link actually carries about the children, and what the traveller still has to enter there.
 * Booking gets the ages only when every child has one; otherwise it gets the count, like Agoda and Trip.com.
 */
export function kidsHandoff(p: Pick<Partner, 'kids'>, s: Pick<SearchQuery, 'children' | 'childAges'>) {
  const n = s.children;
  if (!n) return { sent: '', todo: '' };
  const many = n > 1;
  if (p.kids === 'ages' && s.childAges?.length === n) return { sent: `${kidsHe(n)} כולל ${many ? 'הגילים' : 'הגיל'}`, todo: '' };
  if (p.kids === 'none') return { sent: '', todo: `${many ? 'הילדים לא עוברים' : 'הילד לא עובר'} לאתר הזה: הוסיפו ${many ? 'אותם' : 'אותו'} שם.` };
  return { sent: kidsHe(n), todo: `${many ? 'גילי הילדים לא עוברים' : 'גיל הילד לא עובר'}: בחרו ${many ? 'אותם' : 'אותו'} באתר.` };
}

export const partners: Partner[] = raw.map((x) => ({ ...x, build: (s: SearchQuery) => route(x.id, s, x.build(s)) }));
