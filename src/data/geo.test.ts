import { expect, it } from 'vitest';
import { destinations } from './destinations';
import { geo } from './geo';

it('has a search centre for every destination', () => {
  expect(destinations.filter((d) => !geo[d.slug]).map((d) => d.slug)).toEqual([]);
});
