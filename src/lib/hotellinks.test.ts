import { describe, expect, it } from 'vitest';
import { catalogMatch, nameMatch } from './hotellinks';
import { catalog } from './catalog';

describe('hotel name matching', () => {
  it('matches the same hotel under slightly different names', () => {
    expect(nameMatch('Hôtel Astra Opéra - Astotel', 'hotel astra opera')).toBe(1);
    expect(nameMatch('Leonardo Plaza Hotel Dead Sea', 'leonardo plaza dead sea', 'Dead Sea, Israel')).toBe(1);
  });

  it('rejects a different hotel', () => {
    expect(nameMatch('Milos Dead Sea Hotel', 'royal hotel dead sea', 'Dead Sea, Israel')).toBe(0);
    expect(nameMatch('Hotel', 'Resort')).toBe(0);
    expect(nameMatch('Kayma by Isrotel Exclusive', 'isrotel dead sea', 'Dead Sea, Israel')).toBe(0);
  });

  it('finds a catalog hotel by name and place, and nothing for an unknown one', () => {
    const h = catalog['rome']?.[0];
    if (h?.lat != null && h.lng != null) expect(catalogMatch('rome', h.nameEn || h.name, h.lat, h.lng)?.id).toBe(h.id);
    expect(catalogMatch('rome', 'Totally Unknown Palace', 41.9, 12.49)).toBeUndefined();
  });
});
