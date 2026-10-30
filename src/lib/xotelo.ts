// Hotel lists and live rates from Xotelo (https://xotelo.com), a free API over TripAdvisor's hotel data:
// per hotel, the nightly rate on each booking site. Rates come in US dollars; we show shekels.

const BASE = 'https://data.xotelo.com/api';

/** TripAdvisor location key per destination slug (checked against Xotelo's list endpoint). */
export const LOCATIONS: Record<string, string> = {
  eilat: 'g293980',
  'dead-sea': 'g488154', // Ein Bokek
  'tel-aviv': 'g293984',
  jerusalem: 'g293983',
  tiberias: 'g297765',
  haifa: 'g293982',
  netanya: 'g297759',
  athens: 'g189400',
  rhodes: 'g189449',
  crete: 'g189413',
  cyprus: 'g190372',
  dubai: 'g295424',
  'abu-dhabi': 'g294013',
  paris: 'g187147',
  london: 'g186338',
  rome: 'g187791',
  barcelona: 'g187497',
  prague: 'g274707',
  budapest: 'g274887',
  amsterdam: 'g188590',
  'new-york': 'g60763',
  batumi: 'g297576',
  bangkok: 'g293916',
};

export const HOTEL_KEY = /^g\d+-d\d+$/;

/** Hotels per page of a destination's list. */
export const PAGE = 30;

/** Booking sites we can send people to, by Xotelo's provider code. Other sites' rates are left out. */
export const PROVIDERS: Record<string, 'booking' | 'agoda' | 'trip' | 'expedia' | 'hotelscom'> = {
  BookingCom: 'booking',
  Agoda: 'agoda',
  CtripTA: 'trip',
  Expedia: 'expedia',
  HotelsCom2: 'hotelscom',
  HotelsCom: 'hotelscom',
};

const LABELS: Record<string, string> = {
  'Breakfast included': 'ארוחת בוקר כלולה',
  'All inclusive': 'הכל כלול',
  'Free cancellation': 'ביטול חינם',
};

export interface ListHotel {
  key: string;
  name: string;
  /** Guest rating out of 5, and how many reviews. */
  rating: number;
  reviews: number;
  image: string;
  tags: string[];
  /** Typical nightly price range, in shekels. */
  from: number;
  to: number;
  lat?: number;
  lng?: number;
  /** A hotel, rather than a hostel, apartment or B&B. */
  hotel: boolean;
  /** What the hotel has (keys of FEATURES), when the source says; TripAdvisor's list doesn't. */
  features?: string[];
  /** Hotel class (stars), when the source says. */
  stars?: number;
}

export interface Offer {
  site: 'booking' | 'agoda' | 'trip' | 'expedia' | 'hotelscom';
  /** Nightly rate in shekels, before taxes and fees the site may add. */
  price: number;
}

async function get(path: string, params: Record<string, string | number | undefined>, timeoutMs: number) {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  const res = await fetch(u, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'malonzol.com' } });
  if (!res.ok) throw new Error(`xotelo ${path} ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`xotelo ${path}: ${data.error.message ?? 'error'}`);
  return data.result;
}

/** TripAdvisor's 550px copy of a photo instead of the full-size upload (often several MB). */
export function thumb(image: string) {
  return image.replace(/(dynamic-media-cdn\.tripadvisor\.com\/media\/)photo-o\//, '$1photo-s/');
}

export function toListHotel(h: any, usdToIls: number): ListHotel | null {
  if (!h?.key || !HOTEL_KEY.test(h.key) || !h.name) return null;
  const ils = (n: unknown) => (typeof n === 'number' && n > 0 ? Math.round(n * usdToIls) : 0);
  return {
    key: h.key,
    name: h.name,
    rating: Number(h.review_summary?.rating) || 0,
    reviews: Number(h.review_summary?.count) || 0,
    image: h.image ? thumb(h.image) : '',
    tags: (h.merchandising_labels ?? []).map((l: string) => LABELS[l]).filter(Boolean),
    from: ils(h.price_ranges?.minimum),
    to: ils(h.price_ranges?.maximum),
    hotel: /hotel|resort/i.test(String(h.accommodation_type ?? 'Hotel')),
    lat: Number(h.geo?.latitude) || undefined,
    lng: Number(h.geo?.longitude) || undefined,
  };
}

/**
 * Hotels within `maxKm` of the middle of the list (the median of their coordinates). TripAdvisor files a few hotels
 * under the wrong city (Tel Aviv hotels under Haifa); they'd show up in a search for a place they aren't in.
 * Hotels without coordinates stay.
 */
export function nearby<T extends { lat?: number; lng?: number }>(hotels: T[], maxKm: number): T[] {
  const geo = hotels.filter((h) => h.lat != null && h.lng != null) as (T & { lat: number; lng: number })[];
  if (geo.length < 5) return hotels;
  const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const lat = mid(geo.map((h) => h.lat));
  const lng = mid(geo.map((h) => h.lng));
  const km = (h: { lat: number; lng: number }) => Math.hypot((h.lat - lat) * 111, (h.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180));
  return hotels.filter((h) => h.lat == null || h.lng == null || km(h as { lat: number; lng: number }) <= maxKm);
}

// Destinations that are a whole island or a long shore: their hotels are legitimately far apart.
const SPREAD = new Set(['crete', 'cyprus', 'rhodes', 'dead-sea']);
/** How far from the middle of a destination's list a hotel may be. */
export const reachKm = (slug: string) => (SPREAD.has(slug) ? Infinity : 35);

export async function listHotels(location: string, opts: { offset: number; sort: 'best_value' | 'popularity' }, usdToIls: number) {
  const r = await get('list', { location_key: location, limit: PAGE, offset: opts.offset, sort: opts.sort }, 10_000);
  const seen = new Set<string>();
  const hotels = ((r?.list ?? []).map((h: any) => toListHotel(h, usdToIls)).filter(Boolean) as ListHotel[]).filter((h) => {
    // TripAdvisor lists some hotels twice under different keys; keep the first.
    const id = h.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { total: Number(r?.total_count) || 0, hotels };
}

/** The cheapest rate per site we link to, cheapest first. */
export function toOffers(rates: any[], usdToIls: number): Offer[] {
  const best = new Map<Offer['site'], number>();
  for (const r of rates ?? []) {
    const site = PROVIDERS[r?.code];
    if (!site || typeof r.rate !== 'number' || r.rate <= 0) continue;
    const price = Math.round(r.rate * usdToIls);
    if (!best.has(site) || price < best.get(site)!) best.set(site, price);
  }
  return [...best].map(([site, price]) => ({ site, price })).sort((a, b) => a.price - b.price);
}

export async function hotelOffers(key: string, s: { checkin: string; checkout: string; adults: number; rooms: number }, usdToIls: number) {
  // Xotelo returns no rates at all when children are included, so families get the adults' price (the page says so).
  const params = { hotel_key: key, chk_in: s.checkin, chk_out: s.checkout, adults: s.adults, rooms: s.rooms };
  let offers = toOffers((await get('rates', params, 12_000))?.rates ?? [], usdToIls);
  // TripAdvisor's offers vary from call to call; an empty answer is often filled on a second try.
  if (!offers.length) offers = toOffers((await get('rates', params, 12_000))?.rates ?? [], usdToIls);
  return offers;
}

// ---------- US dollars to shekels ----------
let fx: { rate: number; at: number } | undefined;
const FX_FALLBACK = 3.7;

/** Today's USD→ILS rate from the ECB (via frankfurter), kept for 12 hours; a safe fallback if it can't be fetched. */
export async function usdToIls(): Promise<number> {
  if (fx && Date.now() - fx.at < 12 * 3_600_000) return fx.rate;
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS', { signal: AbortSignal.timeout(4000) });
    const rate = Number((await res.json())?.rates?.ILS);
    if (rate > 2 && rate < 6) {
      fx = { rate, at: Date.now() };
      return rate;
    }
  } catch {}
  return fx?.rate ?? FX_FALLBACK;
}
