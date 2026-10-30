// Live hotel prices from Google Hotels, through SerpApi (https://serpapi.com/google-hotels-api): for the visitor's
// dates and guests, each hotel with the nightly price on each booking site, as Google shows it. Unlike the Xotelo
// feed (TripAdvisor's last-seen prices), these come from a live search, so a sold-out hotel shows no price.
// Off until SERPAPI_KEY is set (Vercel → Settings → Environment Variables).
import type { ListHotel, Offer } from './xotelo';

const ENDPOINT = 'https://serpapi.com/search.json';
export const googleConfigured = () => Boolean(process.env.SERPAPI_KEY);

/** Booking sites we link to, by the name Google gives the offer. Other sites' prices are left out. */
export function siteOf(source: string): Offer['site'] | null {
  const s = source.toLowerCase();
  if (s.includes('booking.com')) return 'booking';
  if (s.includes('agoda')) return 'agoda';
  if (s.includes('trip.com')) return 'trip';
  if (s.includes('hotels.com')) return 'hotelscom';
  if (s.includes('expedia')) return 'expedia';
  return null;
}

export type GoogleHotel = ListHotel & { prices: Offer[] };

const num = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.round(v) : 0);

/** One Google Hotels property as a row of the comparison. */
export function toGoogleHotel(p: any): GoogleHotel | null {
  if (!p?.name || !p?.property_token) return null;
  const best = new Map<Offer['site'], number>();
  for (const o of p.prices ?? []) {
    const site = siteOf(String(o?.source ?? ''));
    const price = num(o?.rate_per_night?.extracted_lowest);
    if (site && price && (!best.has(site) || price < best.get(site)!)) best.set(site, price);
  }
  const amenities: string[] = (p.amenities ?? []).map((a: unknown) => String(a).toLowerCase());
  const tags = [
    amenities.some((a) => a.includes('breakfast')) ? 'ארוחת בוקר כלולה' : '',
    amenities.some((a) => a.includes('all-inclusive') || a.includes('all inclusive')) ? 'הכל כלול' : '',
  ].filter(Boolean);
  const lowest = num(p.rate_per_night?.extracted_lowest);
  return {
    key: `gh-${p.property_token}`,
    name: p.name,
    rating: Number(p.overall_rating) || 0,
    reviews: Number(p.reviews) || 0,
    image: p.images?.[0]?.thumbnail || p.images?.[0]?.original_image || '',
    tags,
    from: lowest,
    to: lowest,
    lat: Number(p.gps_coordinates?.latitude) || undefined,
    lng: Number(p.gps_coordinates?.longitude) || undefined,
    hotel: !/vacation rental/i.test(String(p.type ?? '')),
    prices: [...best].map(([site, price]) => ({ site, price })).sort((a, b) => a.price - b.price),
  };
}

export interface GoogleSearch {
  place: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  childAges: number[];
  sort?: 'best_value' | 'popularity';
  next?: string;
}

/** A page of hotels with live prices, and the token for the next page. */
export async function googleHotels(s: GoogleSearch): Promise<{ hotels: GoogleHotel[]; next: string; total: number }> {
  const u = new URL(ENDPOINT);
  const params: Record<string, string | undefined> = {
    engine: 'google_hotels',
    q: `Hotels in ${s.place}`,
    check_in_date: s.checkin,
    check_out_date: s.checkout,
    adults: String(s.adults),
    // Google wants an age per child; without them the search is for the adults (the page says so).
    children: s.children && s.childAges.length === s.children ? String(s.children) : undefined,
    children_ages: s.children && s.childAges.length === s.children ? s.childAges.join(',') : undefined,
    currency: 'ILS',
    gl: 'il',
    hl: 'en',
    sort_by: s.sort === 'popularity' ? '13' : undefined,
    next_page_token: s.next,
    api_key: process.env.SERPAPI_KEY,
  };
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`google hotels: ${data.error ?? res.status}`);
  const hotels = ((data.properties ?? []).map(toGoogleHotel).filter(Boolean) as GoogleHotel[]).filter((h) => h.prices.length || h.from);
  return {
    hotels,
    next: data.serpapi_pagination?.next_page_token ?? '',
    total: Number(data.search_information?.total_results) || hotels.length,
  };
}
