// Search centre and radius for each destination, for providers that search by coordinates
// (Booking.com Demand API). Island and region destinations use a wide radius around their main hub;
// switch those to the providers' own city/region IDs once we have the content feeds.

export const geo: Record<string, { lat: number; lng: number; radiusKm: number }> = {
  eilat: { lat: 29.5577, lng: 34.9519, radiusKm: 8 },
  'dead-sea': { lat: 31.2006, lng: 35.3625, radiusKm: 6 }, // Ein Bokek hotel strip
  'tel-aviv': { lat: 32.0853, lng: 34.7818, radiusKm: 8 },
  jerusalem: { lat: 31.7683, lng: 35.2137, radiusKm: 8 },
  tiberias: { lat: 32.7922, lng: 35.5312, radiusKm: 10 },
  haifa: { lat: 32.794, lng: 34.9896, radiusKm: 8 },
  netanya: { lat: 32.3215, lng: 34.8532, radiusKm: 6 },
  athens: { lat: 37.9838, lng: 23.7275, radiusKm: 10 },
  rhodes: { lat: 36.4341, lng: 28.2176, radiusKm: 30 },
  crete: { lat: 35.3387, lng: 25.1442, radiusKm: 60 }, // Heraklion hub; the island is long
  cyprus: { lat: 34.9003, lng: 33.6232, radiusKm: 60 }, // Larnaca hub, reaches Ayia Napa and Limassol
  dubai: { lat: 25.2048, lng: 55.2708, radiusKm: 20 },
  'abu-dhabi': { lat: 24.4539, lng: 54.3773, radiusKm: 20 },
  paris: { lat: 48.8566, lng: 2.3522, radiusKm: 8 },
  london: { lat: 51.5072, lng: -0.1276, radiusKm: 10 },
  rome: { lat: 41.9028, lng: 12.4964, radiusKm: 8 },
  barcelona: { lat: 41.3874, lng: 2.1686, radiusKm: 8 },
  prague: { lat: 50.0755, lng: 14.4378, radiusKm: 8 },
  budapest: { lat: 47.4979, lng: 19.0402, radiusKm: 8 },
  amsterdam: { lat: 52.3676, lng: 4.9041, radiusKm: 8 },
  'new-york': { lat: 40.7128, lng: -74.006, radiusKm: 10 },
  batumi: { lat: 41.6168, lng: 41.6367, radiusKm: 8 },
  bangkok: { lat: 13.7563, lng: 100.5018, radiusKm: 12 },
};
