import { formatYmdHm } from '../formatYmdHm';

describe('formatYmdHm', () => {
  test('formats a known Date instance to YYYY-MM-DD HH:mm', () => {
    // Constructed from local components so the assertion is timezone-stable
    const d = new Date(2026, 0, 5, 9, 7); // 2026-01-05 09:07 LOCAL
    expect(formatYmdHm(d)).toBe('2026-01-05 09:07');
  });

  test('zero-pads single-digit month, day, hour, minute', () => {
    const d = new Date(2026, 2, 3, 4, 5); // 2026-03-03 04:05 LOCAL
    expect(formatYmdHm(d)).toBe('2026-03-03 04:05');
  });

  test('accepts an ISO string and formats identically to a Date instance constructed from the same moment', () => {
    const d = new Date(2026, 5, 15, 14, 30);
    const iso = d.toISOString(); // round-trip via UTC
    // Both will produce the same local-time string
    expect(formatYmdHm(iso)).toBe(formatYmdHm(d));
  });

  test('returns "-" for null / undefined / empty inputs', () => {
    expect(formatYmdHm(null)).toBe('-');
    expect(formatYmdHm(undefined)).toBe('-');
    expect(formatYmdHm('')).toBe('-');
  });

  test('returns "-" for unparseable strings', () => {
    expect(formatYmdHm('not a date')).toBe('-');
  });
});
