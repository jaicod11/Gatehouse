// Hand-rolled rather than Intl-based so the output is identical on web, iOS and Android (Hermes'
// Intl support varies by platform) and stays predictable in tests. English only.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** "12 Oct 2026", in the device's time zone. Null for a missing or invalid date. */
export function formatDate(value: DateInput): string | null {
  const date = toDate(value);
  if (!date) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Short relative time: "just now", "5 min ago", "2 hours ago", "yesterday", "3 days ago", or the
 * date once it's over a week away. Future times read "in 48 min", "in 2 hours", "in 3 days".
 */
export function formatRelativeTime(value: DateInput, now: number = Date.now()): string | null {
  const date = toDate(value);
  if (!date) return null;

  const diff = date.getTime() - now;
  const distance = Math.abs(diff);

  if (diff <= 0) {
    if (distance < 45_000) return 'just now';
    if (distance < HOUR) return `${Math.max(1, Math.floor(distance / MINUTE))} min ago`;
    if (distance < DAY) return `${plural(Math.floor(distance / HOUR), 'hour')} ago`;
    if (distance < 2 * DAY) return 'yesterday';
    if (distance < 7 * DAY) return `${plural(Math.floor(distance / DAY), 'day')} ago`;
    return formatDate(date);
  }

  if (distance < MINUTE) return 'in less than a minute';
  if (distance < HOUR) return `in ${Math.floor(distance / MINUTE)} min`;
  if (distance < DAY) return `in ${plural(Math.floor(distance / HOUR), 'hour')}`;
  if (distance < 7 * DAY) return `in ${plural(Math.floor(distance / DAY), 'day')}`;
  return `on ${formatDate(date)}`;
}
