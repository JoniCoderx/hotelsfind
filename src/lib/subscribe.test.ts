import { describe, expect, it, vi } from 'vitest';
import { subscribe, validEmail } from './subscribe';
import { adSubject, esc, newsletterEmail, track, welcomeEmail } from './email/templates.mjs';

const res = (status: number, body = '{}') => new Response(body, { status });

describe('validEmail', () => {
  it('accepts and normalises a real address', () => {
    expect(validEmail('  Dana@Example.co.il ')).toBe('dana@example.co.il');
  });
  it('rejects junk', () => {
    for (const bad of ['', 'dana', 'dana@', 'dana@example', 'da na@example.com', 42, null, 'a@b.c']) expect(validEmail(bad)).toBeNull();
  });
});

describe('subscribe', () => {
  it('adds the contact to the segment and sends the welcome email', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(200, '{"id":"c1"}')).mockResolvedValueOnce(res(200, '{"id":"e1"}'));
    expect(await subscribe('dana@example.com', { key: 'k', segment: 's1' }, f)).toBe('subscribed');
    const [url1, init1] = f.mock.calls[0];
    expect(url1).toBe('https://api.resend.com/contacts');
    expect(JSON.parse(init1.body)).toEqual({ email: 'dana@example.com', unsubscribed: false, segments: [{ id: 's1' }] });
    const [url2, init2] = f.mock.calls[1];
    expect(url2).toBe('https://api.resend.com/emails');
    const mail = JSON.parse(init2.body);
    expect(mail.to).toEqual(['dana@example.com']);
    expect(mail.from).toBe('מלונזול <hello@malonzol.com>');
  });
  it('does not welcome an address twice', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(409, '{"message":"Contact already exists"}'));
    expect(await subscribe('dana@example.com', { key: 'k' }, f)).toBe('already');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('reports a missing key instead of calling Resend', async () => {
    const f = vi.fn();
    expect(await subscribe('dana@example.com', {}, f)).toBe('not_configured');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('email templates', () => {
  it('marks newsletters as advertising, as Israeli law requires', () => {
    expect(adSubject('דילים לחנוכה')).toBe('פרסומת: דילים לחנוכה');
    expect(adSubject('פרסומת: דילים')).toBe('פרסומת: דילים');
  });
  it('tags site links and leaves other links alone', () => {
    expect(track('https://malonzol.com/guides/x/', 'w')).toBe('https://malonzol.com/guides/x/?utm_source=email&utm_medium=email&utm_campaign=w');
    expect(track('https://www.agoda.com/x', 'w')).toBe('https://www.agoda.com/x');
  });
  it('escapes issue text and includes the unsubscribe link', () => {
    const { subject, html } = newsletterEmail({ subject: 'דילים', title: 'A<b>', deals: [{ name: 'X&Y', city: 'אילת', url: 'https://malonzol.com/' }] });
    expect(subject).toBe('פרסומת: דילים');
    expect(html).toContain('A&lt;b&gt;');
    expect(html).toContain('X&amp;Y');
    expect(html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(esc('"')).toBe('&quot;');
  });
  it('builds the welcome email with a way to opt out', () => {
    const { html } = welcomeEmail();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('mailto:hello@malonzol.com');
  });
});
