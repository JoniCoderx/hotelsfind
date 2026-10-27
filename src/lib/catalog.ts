// Hotel catalog imported from Agoda's Hotel Data File (scripts/agoda-import.mjs).
// Empty until the import has run; pages that use it simply render without it.

export interface CatalogHotel {
  id: number;
  name: string;
  nameEn: string;
  city: string;
  stars: number;
  score: number;
  reviews: number;
  photo: string;
  address: string;
  lat: number | null;
  lng: number | null;
  ratesFrom: number | null;
  ratesCurrency: string | null;
  overview: string;
}

const files = import.meta.glob<CatalogHotel[]>('../data/catalog/*.json', { eager: true, import: 'default' });

export const catalog: Record<string, CatalogHotel[]> = Object.fromEntries(
  Object.entries(files).map(([path, list]) => [path.split('/').pop()!.replace('.json', ''), list]),
);
