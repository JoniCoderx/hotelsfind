import { describe, expect, it } from 'vitest';
import { attributed, kidsHandoff, partners } from './partners';

const p = (id: string) => partners.find((x) => x.id === id)!;
const s = { q: 'Athens, Greece', checkin: '2026-12-10', checkout: '2026-12-13', adults: 2, children: 2, childAges: [5, 9], rooms: 1 };

describe('child hand-off', () => {
  it('says what each link carries, and only what it carries', () => {
    expect(kidsHandoff(p('booking'), s)).toEqual({ sent: '2 ילדים כולל הגילים', todo: '' });
    expect(kidsHandoff(p('agoda'), s).sent).toBe('2 ילדים');
    expect(kidsHandoff(p('agoda'), s).todo).toContain('גילי הילדים לא עוברים');
    expect(kidsHandoff(p('expedia'), s)).toEqual({ sent: '', todo: 'הילדים לא עוברים לאתר הזה: הוסיפו אותם שם.' });
    expect(kidsHandoff(p('booking'), { children: 0 })).toEqual({ sent: '', todo: '' });
  });

  it('matches the links: Expedia and Hotels.com send no children, Booking sends ages', () => {
    for (const id of ['expedia', 'hotelscom']) expect(p(id).build(s)).not.toMatch(/child/i);
    expect(p('booking').build(s)).toContain('age=5&age=9');
    expect(p('agoda').build(s)).toContain('children=2');
  });

  it('does not claim ages went to Booking when one is missing', () => {
    const partial = { ...s, childAges: [5] };
    expect(p('booking').build(partial)).not.toContain('age=');
    expect(kidsHandoff(p('booking'), partial).todo).toContain('גילי הילדים לא עוברים');
  });
});

describe('attribution', () => {
  it('a campaign label alone is not attribution', () => {
    // Only Agoda has an ID by default; the others carry a label/tag but no affiliate ID.
    expect(p('booking').build(s)).toContain('label=malonzol');
    for (const x of partners) expect(attributed(x.id)).toBe(x.id === 'agoda');
  });

  it('Agoda links carry our partner ID', () => {
    expect(p('agoda').build(s)).toContain('cid=1979232');
  });
});
