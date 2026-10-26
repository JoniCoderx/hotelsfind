// The comparison engine's shared vocabulary. Every connector turns its own API response into these shapes,
// so matching, ranking and the UI never see connector quirks.

export interface Room {
  adults: number;
  /** One age (0–17) per child in this room. */
  childAges: number[];
}

export interface SearchRequest {
  /** A destination we know. Connectors are asked about the verified hotel list for it, not a free city search. */
  destination: { slug: string; name: string; country: string };
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  rooms: Room[];
  /** Currency we ask for. Offers in another currency are converted only with a known, dated rate. */
  currency: string;
  /** Where the booker is (Booking prices by booker country). Part of the request key. */
  userCountry: string;
  /** The guest's nationality where a connector asks for it (Agoda's userCountry). A configured default, not a guess. */
  nationality: string;
  device: 'desktop' | 'mobile';
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
  /** The amount the connector returned for the whole stay and all rooms, as returned. */
  total: Money;
  /**
   * true: the connector states `total` includes every mandatory tax and fee.
   * false: some mandatory charges are outside `total`; `excluded` holds them when their amount is known.
   * null: the connector doesn't say.
   */
  inclusive: boolean | null;
  excluded?: Money;
  /** A mandatory charge exists whose amount is unknown (e.g. Booking's "incalculable"). Blocks an all-in price. */
  unknownMandatory?: boolean;
  /** Charges that apply only in some cases (Booking "conditional"): not added, but the traveller is told. */
  conditional?: boolean;
}

export interface HotelRef {
  /** The connector's own hotel ID (or, for name queries, the name we sent). */
  id: string;
  /** A second identity check for name queries: the property page the connector says it matched (Vio vioUrl). */
  ref?: string;
  name: string;
  lat?: number;
  lng?: number;
  stars?: number;
}

export interface Offer {
  /** Which connector returned it (e.g. 'agoda-search', 'booking-demand', 'vio'). */
  source: string;
  /**
   * The booking site the traveller would book on. Comparisons count sites, not connectors, and only sites whose
   * identity as the seller is confirmed (`confirmed`). An aggregator's distributor name is not a confirmed seller.
   */
  site: { id: string; name: string; confirmed: boolean };
  /** The aggregator that delivered the offer (e.g. Vio), when not the site itself. */
  via?: string;
  hotel: HotelRef;
  roomName?: string;
  /** Rooms this offer covers. Must equal the request's room count to be comparable. */
  rooms: number;
  board: Board;
  cancellation: Cancellation;
  price: OfferPrice;
  /** Where the traveller goes, before our per-click attribution is added. */
  url: string;
  /** When the connector was asked (ISO). */
  checkedAt: string;
}

export type ConnectorStatus =
  | { source: string; status: 'ok'; offers: number; ms: number }
  | { source: string; status: 'partial'; offers: number; ms: number; reason: string }
  | { source: string; status: 'not-configured' | 'unsupported' | 'error' | 'timeout'; reason: string; ms: number };

export interface ConnectorResult {
  offers: Offer[];
  /** Set when the connector can't serve this request (e.g. more rooms than its API prices correctly). */
  unsupported?: string;
  /** false when the connector stopped before every booking site answered (aggregator timeouts). */
  complete?: boolean;
}

export interface Connector {
  id: string;
  name: string;
  /** Credentials present. Never fall back to sample data when this is false. */
  configured(): boolean;
  search(req: SearchRequest, hotels: MappedHotel[], signal: AbortSignal): Promise<ConnectorResult>;
}

/** One row of the verified hotel mapping: our ID and each connector's ID for the same property. */
export interface MappedHotel {
  id: string;
  slug: string;
  name: string;
  lat?: number;
  lng?: number;
  stars?: number;
  agoda?: number;
  booking?: number;
  /** Vio is queried by name; an offer joins only if Vio returns this exact hotel page (`vioUrl`) for the name. */
  vioName?: string;
  vioUrl?: string;
  verified: { by: string; at: string; note?: string };
}
