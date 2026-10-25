// Who is travelling, read from query params the same way by every API route.
// Children are only priced with an age each; without them we refuse rather than guess.

const int = (v: string | null, def: number, min: number, max: number) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : def;
};

export type Guests = { adults: number; children: number; childAges: number[]; rooms: number };

export function parseGuests(p: URLSearchParams): Guests | { error: 'child_ages' } {
  const adults = int(p.get('a'), 2, 1, 16);
  const children = int(p.get('c'), 0, 0, 10);
  const rooms = int(p.get('r'), 1, 1, 8);
  const childAges = (p.get('ages') || '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
  if (children && childAges.length !== children) return { error: 'child_ages' };
  return { adults, children, childAges: children ? childAges : [], rooms };
}
