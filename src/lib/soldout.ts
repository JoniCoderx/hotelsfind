// "It was full there": a visitor back from a booking site can tell us the hotel had no room for their dates.
// The free price feed can't see sold-out rooms, so that site's price is dropped for the hotel and dates, in this
// browser only, for a few days.
const STORE = 'mz-full';
const KEEP = 3 * 86_400_000;

type Marks = Record<string, number>;

function read(): Marks {
  try {
    const m = JSON.parse(localStorage.getItem(STORE) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

const mark = (hotel: string, site: string, checkin: string, checkout: string) => `${hotel}|${site}|${checkin}|${checkout}`;

export function markFull(hotel: string, site: string, checkin: string, checkout: string) {
  const now = Date.now();
  const m = Object.fromEntries(Object.entries(read()).filter(([, at]) => now - at < KEEP));
  m[mark(hotel, site, checkin, checkout)] = now;
  try {
    localStorage.setItem(STORE, JSON.stringify(m));
  } catch {}
}

/** The prices without the sites the visitor found full for these dates. */
export function withoutFull<T extends { site: string }>(prices: T[], hotel: string, checkin: string, checkout: string): T[] {
  const m = read();
  const now = Date.now();
  return prices.filter((o) => {
    const at = m[mark(hotel, o.site, checkin, checkout)];
    return !at || now - at >= KEEP;
  });
}
