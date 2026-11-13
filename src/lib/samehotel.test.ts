import { describe, expect, it } from 'vitest';
import { copiesIn } from './samehotel.mjs';

describe('one place listed twice', () => {
  it('points the copy with fewer reviews to the other', () => {
    const list = [
      { id: 9, name: 'Flat A', lat: 31.7831, lng: 35.2226, reviews: 2 },
      { id: 5, name: 'Flat A ', lat: 31.7831, lng: 35.2226, reviews: 0 },
      { id: 7, name: 'Flat A', lat: 31.79, lng: 35.2226, reviews: 0 },
    ];
    expect([...copiesIn(list)]).toEqual([[5, 9]]);
  });
  it('keeps the lower ID when reviews are equal', () => {
    expect([...copiesIn([{ id: 8, name: 'X', lat: 1, lng: 2 }, { id: 3, name: 'X', lat: 1, lng: 2 }])]).toEqual([[8, 3]]);
  });
});
