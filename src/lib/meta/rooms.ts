// Rooms in a URL: "2:5,9;2" = room 1 with 2 adults and children aged 5 and 9, room 2 with 2 adults.

import type { Room } from './types';

export function parseRooms(v: string | null): Room[] | null {
  if (!v) return null;
  const rooms = v.split(';').map((part) => {
    const [a, kids = ''] = part.split(':');
    const adults = Number(a);
    const childAges = kids ? kids.split(',').map(Number) : [];
    return { adults, childAges };
  });
  const ok =
    rooms.length >= 1 &&
    rooms.length <= 8 &&
    rooms.every(
      (r) =>
        Number.isInteger(r.adults) &&
        r.adults >= 1 &&
        r.adults <= 8 &&
        r.childAges.length <= 6 &&
        r.childAges.every((x) => Number.isInteger(x) && x >= 0 && x <= 17),
    );
  return ok ? rooms : null;
}

export function formatRooms(rooms: Room[]): string {
  return rooms.map((r) => `${r.adults}${r.childAges.length ? `:${r.childAges.join(',')}` : ''}`).join(';');
}
