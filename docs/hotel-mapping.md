# Verified hotel mapping

Offers from different connectors are compared only for hotels listed in `src/data/hotel-map.json`. A row says
"these IDs are the same property", and someone has checked it. Automatic name and location matching only proposes
candidates.

## Row format

```json
{
  "id": "mz-eilat-001",
  "slug": "eilat",
  "name": "Herods Palace Eilat",
  "stars": 5,
  "agoda": 123456,
  "booking": 234567,
  "vioName": "Herods Palace Hotel Eilat",
  "verified": { "by": "yoni", "at": "2026-11-02", "note": "same address and phone on both listings" }
}
```

- `id` is ours and never changes, even if a connector's ID does.
- Only rows with `verified.at` are used.
- `vioName` is the name sent to Vio; Vio echoes it back as `requestedName`. Check that Vio maps it to the same property.

## How to verify a candidate

1. Generate candidates:

   ```bash
   node --experimental-strip-types scripts/match-candidates.ts agoda.json booking.json > candidates.csv
   ```

   The inputs come from the content feeds: Agoda's hotel data file, and Booking's `/accommodations/details`.
2. Open both listings. The address, phone number, room types and photos of the building must match.
   Resorts, sister hotels in one complex, and apartment blocks often share names and coordinates.
   Example: Herods Palace and Herods Vitalis in Eilat are 20 m apart.
3. Add the row with who checked it and when. If in doubt, leave it out: the hotel then shows separately per site,
   with no comparison.

## First experiment

One destination, 10–20 hotels, one room. Only these hotels are searched, so all connectors are asked about the
same list.
