// Hotel name comparison, without data imports, so pages can use it in the browser too.

const STOP = new Set(
  'hotel hotels resort resorts spa the by and an a of at in collection exclusive suites suite boutique inn rooms luxury design le la les el al de du des di da del il all inclusive member'.split(
    ' ',
  ),
);

/** The distinctive words of a hotel name (lowercase, accents dropped, common words and the place's own words left out). */
export function nameTokens(s: string, place = ''): Set<string> {
  const skip = place ? nameTokens(place) : new Set<string>();
  const plain = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  return new Set(plain.split(' ').filter((w) => w.length > 1 && !STOP.has(w) && !skip.has(w)));
}

// Chain names: sharing one says nothing about being the same hotel ("Kayma by Isrotel" isn't "Isrotel Dead Sea").
const CHAINS = new Set(
  'isrotel leonardo fattal dan herods astral prima atlas brown afi vert caesar hilton marriott ibis novotel mercure crowne radisson sheraton hyatt melia ramada intercontinental kempinski rotana jumeirah wyndham ihg accor nh hampton doubletree courtyard thistle guoman kimpton eurostars barcelo occidental sofitel pullman movenpick hotel westin hyatt regency conrad waldorf astoria ritz carlton regis st four seasons shangri meridien indigo moxy motto embassy holiday express premier travelodge rotana centara eastin quinta tapestry curio autograph marriot best western wyndham ibis mgallery kimpton'.split(
    ' ',
  ),
);

// Kinds of stay a name can say it is.
const TYPES = new Set('apartments apartment apartament aparthotel villas villa hostel residence residences camping'.split(' '));

/**
 * How well two names agree on the words that name the hotel (0–1): shared distinctive words over the distinctive
 * words of the longer name. Chain names ("Isrotel", "Dan", "Atlas") and the place's own words don't count, so
 * "Dan Panorama" vs "Dan Eilat" or "Royal Beach" vs "Royal Garden" score 0.5 or less.
 */
export function nameMatch(a: string, b: string, place = '', opts: { near?: boolean } = {}): number {
  // Two different chains are two different hotels, whatever else they share ("Leonardo Plaza" vs "Crowne Plaza").
  const chains = (s: string) => [...nameTokens(s, place)].filter((w) => CHAINS.has(w) && w !== 'hotel');
  const ca = chains(a);
  const cb = chains(b);
  if (ca.length && cb.length && !ca.some((w) => cb.includes(w))) return 0;
  const own = (s: string) => new Set([...nameTokens(s, place)].filter((w) => !CHAINS.has(w)));
  const x = own(a);
  const y = own(b);
  // A name made only of chain words ("Caesar Premier Eilat Hotel"): the same hotel only when it's the same words.
  if (!x.size && !y.size) return ca.length && ca.slice().sort().join(' ') === cb.slice().sort().join(' ') ? 1 : 0;
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  // Apartments, villas or a hostel aren't the hotel of the same name.
  const kind = (s: string) => [...nameTokens(s, place)].filter((w) => TYPES.has(w)).sort().join(' ');
  if (kind(a) !== kind(b)) return 0;
  // A word only one name has is fine ("Kings Court" / "Kings Court Deluxe"); a different word on each side means a
  // different hotel ("Signature Saint Germain" / "Studio Saint Germain"), unless one is short for the other (FH55 / FH).
  const onlyX = [...x].filter((w) => !y.has(w));
  const onlyY = [...y].filter((w) => !x.has(w));
  if (onlyX.length && onlyY.length && onlyX.some((a) => !onlyY.some((b) => a.startsWith(b) || b.startsWith(a)))) return 0;
  // A chain on one side only is another hotel too often to trust ("The Tower Hotel" / "DoubleTree ... Tower of
  // London", "Premier Inn Dubai Airport" / "Dubai International Airport Hotel", "Hotel Old Town" / "Hotel Indigo
  // Old Town"); those get a search instead.
  // Next to each other (a catalog hotel within 400 m), the chain is just part of one listing's name ("Royal Beach
  // Eilat Hotel" / "Royal Beach Eilat Hotel by Isrotel Exclusive").
  if ((ca.length > 0) !== (cb.length > 0) && !opts.near) return 0;
  return common / Math.max(x.size, y.size);
}

/** Enough to call two names the same hotel. */
export const SAME_NAME = 0.6;
