// Agoda Affiliate Lite (Long Tail Search) API client. Server-only: it reads the
// secret API key. Spec: partners.agoda.com/Content/Documents/AffiliateLiteApi/Affiliate_Lite_API_V2.0.pdf

const ENDPOINT = process.env.AGODA_ENDPOINT || 'http://affiliateapi7643.agoda.com/affiliateservice/lt_v1';

export interface Hotel {
  id: number;
  name: string;
  stars: number;
  score: number;
  reviews: number;
  currency: string;
  /** Per-night rate, before taxes. */
  rate: number;
  /** Original per-night rate when discounted, otherwise equal to rate. */
  was: number;
  discount: number;
  image: string;
  url: string;
  breakfast: boolean;
  wifi: boolean;
}

export interface CitySearch {
  cityId: number;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  childrenAges?: number[];
  sortBy?: 'Recommended' | 'PriceAsc' | 'PriceDesc' | 'StarRatingDesc' | 'AllGuestsReviewScore';
  minStars?: number;
  minScore?: number;
  minRate?: number;
  maxRate?: number;
  discountOnly?: boolean;
}

export class AgodaError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function agodaConfigured(): boolean {
  return Boolean(process.env.AGODA_SITE_ID && process.env.AGODA_API_KEY);
}

interface RawHotel {
  hotelId: number;
  hotelName: string;
  starRating: number;
  reviewScore: number;
  reviewCount?: number;
  currency: string;
  dailyRate: number;
  crossedOutRate: number;
  discountPercentage?: number;
  imageURL: string;
  landingURL: string;
  includeBreakfast: boolean;
  freeWifi: boolean;
}

function normalize(h: RawHotel): Hotel {
  return {
    id: h.hotelId,
    name: h.hotelName,
    stars: h.starRating ?? 0,
    score: h.reviewScore ?? 0,
    reviews: h.reviewCount ?? 0,
    currency: h.currency,
    rate: h.dailyRate,
    was: Math.max(h.crossedOutRate || 0, h.dailyRate),
    discount: Math.round(h.discountPercentage ?? 0),
    // Agoda returns http image URLs; their CDN serves https too.
    image: (h.imageURL || '').replace(/^http:/, 'https:'),
    url: h.landingURL,
    breakfast: Boolean(h.includeBreakfast),
    wifi: Boolean(h.freeWifi),
  };
}

async function call(criteria: Record<string, unknown>): Promise<Hotel[]> {
  const siteId = process.env.AGODA_SITE_ID!;
  const apiKey = process.env.AGODA_API_KEY!;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip,deflate',
      Authorization: `${siteId}:${apiKey}`,
    },
    body: JSON.stringify({ criteria }),
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 401) throw new AgodaError('Agoda rejected the API key', 502);
  if (res.status === 403) throw new AgodaError('Agoda request quota exceeded', 429);
  if (!res.ok && res.status !== 204) throw new AgodaError(`Agoda responded ${res.status}`);
  if (res.status === 204) return [];
  const data = (await res.json()) as { results?: RawHotel[]; error?: { id: number; message: string } };
  // 911 = "No search result": a valid empty answer, not a failure.
  if (data.error) {
    if (data.error.id === 911) return [];
    throw new AgodaError(`Agoda error ${data.error.id}: ${data.error.message}`);
  }
  return (data.results ?? []).map(normalize);
}

function base(s: Pick<CitySearch, 'checkin' | 'checkout' | 'adults' | 'children' | 'childrenAges'>) {
  return {
    checkInDate: s.checkin,
    checkOutDate: s.checkout,
    additional: {
      currency: 'ILS',
      language: 'he-il',
      occupancy: {
        numberOfAdult: s.adults,
        numberOfChildren: s.children,
        ...(s.childrenAges?.length === s.children && s.children ? { childrenAges: s.childrenAges } : {}),
      },
    },
  };
}

/**
 * City search. Agoda caps one response at 30 hotels, so a "deep" search splits the
 * price range into bands and merges them, giving up to ~30 × bands distinct hotels.
 */
export async function searchCity(s: CitySearch, deep = false): Promise<Hotel[]> {
  const b = base(s);
  const query = (minRate: number, maxRate: number, sortBy = s.sortBy ?? 'Recommended') =>
    call({
      ...b,
      cityId: s.cityId,
      additional: {
        ...b.additional,
        maxResult: 30,
        sortBy,
        discountOnly: Boolean(s.discountOnly),
        minimumStarRating: s.minStars ?? 0,
        minimumReviewScore: s.minScore ?? 0,
        dailyRate: { minimum: minRate, maximum: maxRate },
      },
    });

  const lo = s.minRate ?? 0;
  const hi = s.maxRate ?? 100_000;
  if (!deep) return query(lo, hi);

  // Price bands in ILS per night, clipped to the requested range.
  const edges = [0, 350, 550, 800, 1200, 2000, 100_000];
  const bands = edges
    .slice(0, -1)
    .map((e, i) => [Math.max(e, lo), Math.min(edges[i + 1], hi)] as const)
    .filter(([a, z]) => a < z);
  const pages = await Promise.allSettled(bands.map(([a, z]) => query(a, z, 'PriceAsc')));
  const ok = pages.filter((p): p is PromiseFulfilledResult<Hotel[]> => p.status === 'fulfilled');
  if (!ok.length) throw (pages[0] as PromiseRejectedResult).reason;
  const seen = new Map<number, Hotel>();
  for (const h of ok.flatMap((p) => p.value)) if (!seen.has(h.id)) seen.set(h.id, h);
  return [...seen.values()];
}

/** Live rates for specific hotels (up to the IDs Agoda accepts per call). */
export function searchHotels(
  ids: number[],
  s: Pick<CitySearch, 'checkin' | 'checkout' | 'adults' | 'children' | 'childrenAges'>,
) {
  return call({ ...base(s), hotelId: ids });
}
