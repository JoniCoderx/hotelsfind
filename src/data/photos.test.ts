import { expect, it } from 'vitest';
import { destinations } from './destinations';
import { destPhotos } from './photos';

// Without its own photo a destination falls back to a generic resort shot, which isn't the place.
it('has a photo of every destination', () => {
  expect(destinations.filter((d) => !destPhotos[d.slug]).map((d) => d.slug)).toEqual([]);
});
