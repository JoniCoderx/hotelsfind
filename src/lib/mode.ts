// What the site may do with prices, decided once per deployment.
//
// PUBLIC_PRICE_MODE=links (default): no prices anywhere. Price routes return nothing and never call a provider,
//   and the page copy doesn't promise prices.
// PUBLIC_PRICE_MODE=live: price routes call the configured providers. Turn on only with a provider's approval.
//
// The PUBLIC_ prefix makes the same value available to page copy at build time and to the API at run time.

export type PriceMode = 'links' | 'live';

export function priceMode(): PriceMode {
  const v = (typeof process !== 'undefined' && process.env?.PUBLIC_PRICE_MODE) || import.meta.env?.PUBLIC_PRICE_MODE;
  return v === 'live' ? 'live' : 'links';
}

export const isProduction = () => process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

/** Sample data for local UI work only; never in a built or deployed site. */
export const devSamplesAllowed = (flag: string) => process.env[flag] === '1' && !isProduction();
