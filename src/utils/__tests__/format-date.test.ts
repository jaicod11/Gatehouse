import { formatDate, formatRelativeTime } from '@/utils/format-date';

// Local times, so the expectations hold in any time zone.
const NOW = new Date(2026, 9, 25, 12, 0, 0).getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatDate', () => {
  it('formats a date as "12 Oct 2026"', () => {
    expect(formatDate(new Date(2026, 9, 12, 15, 30))).toBe('12 Oct 2026');
    expect(formatDate(new Date(2027, 0, 1))).toBe('1 Jan 2027');
  });

  it('accepts ISO strings and timestamps', () => {
    expect(formatDate(new Date(2026, 4, 3, 12).toISOString())).toBe('3 May 2026');
    expect(formatDate(new Date(2026, 11, 31, 12).getTime())).toBe('31 Dec 2026');
  });

  it.each([null, undefined, '', 'not a date'])('returns null for %p', (value) => {
    expect(formatDate(value)).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  it.each([
    [-10 * SECOND, 'just now'],
    [-50 * SECOND, '1 min ago'],
    [-5 * MINUTE, '5 min ago'],
    [-59 * MINUTE, '59 min ago'],
    [-1 * HOUR, '1 hour ago'],
    [-2 * HOUR - 10 * MINUTE, '2 hours ago'],
    [-30 * HOUR, 'yesterday'],
    [-3 * DAY, '3 days ago'],
    [-10 * DAY, '15 Oct 2026'],
  ])('describes %i ms ago as %j', (offset, expected) => {
    expect(formatRelativeTime(NOW + offset, NOW)).toBe(expected);
  });

  it.each([
    [30 * SECOND, 'in less than a minute'],
    [48 * MINUTE + 30 * SECOND, 'in 48 min'],
    [1 * HOUR, 'in 1 hour'],
    [2 * HOUR + 5 * MINUTE, 'in 2 hours'],
    [3 * DAY, 'in 3 days'],
    [10 * DAY, 'on 4 Nov 2026'],
  ])('describes %i ms ahead as %j', (offset, expected) => {
    expect(formatRelativeTime(NOW + offset, NOW)).toBe(expected);
  });

  it('returns null for a missing date', () => {
    expect(formatRelativeTime(null, NOW)).toBeNull();
  });
});
