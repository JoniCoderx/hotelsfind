// The currency prices are shown in, picked in the header and remembered in the browser. Prices arrive in shekels
// and are converted here with the ECB's daily rates (/api/fx); the booking sites open in the same currency.
export type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP';
export const CURRENCIES: { code: Currency; symbol: string; he: string }[] = [
  { code: 'ILS', symbol: '₪', he: 'שקל' },
  { code: 'USD', symbol: '$', he: 'דולר' },
  { code: 'EUR', symbol: '€', he: 'יורו' },
  { code: 'GBP', symbol: '£', he: 'ליש״ט' },
];
const STORE = 'mz-cur';
const RATES = 'mz-fx';

// Units of each currency per shekel, once they're in.
let rates: Partial<Record<Currency, number>> = { ILS: 1 };
try {
  const saved = JSON.parse(sessionStorage.getItem(RATES) || 'null');
  if (saved?.ILS === 1) rates = saved;
} catch {}

const valid = (c: unknown): c is Currency => CURRENCIES.some((x) => x.code === c);

/** The visitor's currency (shekels on the server and until they pick another). */
export function currency(): Currency {
  try {
    const c = localStorage.getItem(STORE);
    if (valid(c) && rates[c]) return c;
  } catch {}
  return 'ILS';
}

/** The currency the visitor picked, whether or not its rate is in yet. */
export function picked(): Currency {
  try {
    const c = localStorage.getItem(STORE);
    if (valid(c)) return c;
  } catch {}
  return 'ILS';
}

async function loadRates() {
  if (CURRENCIES.every((c) => rates[c.code])) return;
  try {
    const r = await fetch('/api/fx').then((res) => res.json());
    if (r?.ILS === 1) {
      rates = r;
      try {
        sessionStorage.setItem(RATES, JSON.stringify(r));
      } catch {}
    }
  } catch {}
}

/** Shows prices in the currency from now on; everything that draws prices redraws on `mz:currency`. */
export async function setCurrency(c: Currency) {
  try {
    localStorage.setItem(STORE, c);
  } catch {}
  if (c !== 'ILS') await loadRates();
  window.dispatchEvent(new CustomEvent('mz:currency'));
}

/** A shekel amount in the visitor's currency. */
export function fromIls(n: number): { amount: number; currency: Currency } {
  const c = currency();
  return { amount: n * (rates[c] ?? 1), currency: c };
}

// A visitor who picked another currency earlier: fetch its rate, then let the page redraw.
if (typeof window !== 'undefined' && picked() !== 'ILS' && !rates[picked()]) {
  loadRates().then(() => window.dispatchEvent(new CustomEvent('mz:currency')));
}
