// The comparison engine's shared vocabulary. Every provider adapter turns its own API
// response into these shapes, so matching, ranking and the UI never see provider quirks.

export interface Room {
  adults: number;
  /** One age (0–17) per child in this room. */
  childAges: number[];
}

export interface SearchRequest {
  /** Where: a destination slug we know, with its centre for providers that search by coordinates. */
  destination: { slug: string; name: string; lat?: number; lng?: number; radiusKm?: number };
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  rooms: Room[];
  /** Currency we ask providers for. Offers in another currency are converted only with a known rate. */
  currency: string;
  /** Where on our site the search came from, for affiliate sub-IDs. */
  source: string;
}

export interface Money {
  amount: number;
  currency: string;
}

export type Board = 'room-only' | 'breakfast' | 'half-board' | 'full-board' | 'all-inclusive' | 'unknown';

export type Cancellation =
  | { kind: 'free'; until?: string }
  | { kind: 'non-refundable' }
  | { kind: 'partial' }
  | { kind: 'unknown' };

export interface OfferPrice {
  /** What the provider says the whole stay costs, for all rooms. */
  total: Money;
  /**
   * true: the provider states the total includes every mandatory tax and fee.
   * false: some mandatory charges are excluded; `excluded` holds them when the provider gives the amount.
   * null: the provider doesn't say. Such offers are shown but never called the cheapest.
   */
  inclusive: boolean | null;
  excluded?: Money;
}

export interface HotelRef {
  /** The provider's own hotel ID. */
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  stars?: number;
  address?: string;
  image?: string;
}

export interface Offer {
  provider: string;
  hotel: HotelRef;
  roomName?: string;
  rooms: number;
  board: Board;
  cancellation: Cancellation;
  price: OfferPrice;
  /** Where the traveller books: the provider's deep link, with our affiliate attribution. */
  url: string;
  /** When the provider was asked (ISO). Cached answers keep the original time. */
  checkedAt: string;
}

export type ProviderStatus =
  | { provider: string; status: 'ok'; offers: number; ms: number }
  | { provider: string; status: 'not-configured' | 'unsupported' | 'error' | 'timeout'; reason: string; ms: number };

export interface ProviderResult {
  offers: Offer[];
  /** Set when the provider can't serve this request (e.g. more rooms than its API takes). */
  unsupported?: string;
}

export interface Provider {
  id: string;
  name: string;
  /** Credentials present. Never fall back to sample data when this is false. */
  configured(): boolean;
  search(req: SearchRequest, signal: AbortSignal): Promise<ProviderResult>;
}
