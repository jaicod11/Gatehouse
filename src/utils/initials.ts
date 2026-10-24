/**
 * Up to two initials from a display name or an email address:
 * "Ada Lovelace" -> "AL", "ada.lovelace@hbplus.fit" -> "AL", "Ada" -> "A".
 */
export function getInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return '';

  const source = nameOrEmail.includes('@')
    ? nameOrEmail.slice(0, nameOrEmail.indexOf('@')).replace(/[._+-]+/g, ' ')
    : nameOrEmail;
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  // Array.from keeps characters outside the BMP (emoji, some scripts) intact.
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}
