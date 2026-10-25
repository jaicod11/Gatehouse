/** Shown when someone signs in with a Google account outside the allowed domain. Required verbatim. */
export const ACCESS_DENIED_MESSAGE =
  'Access restricted. Please login using your official domain email.';

/**
 * True only for a single address whose domain is exactly `allowedDomain`, ignoring case and
 * surrounding whitespace. Subdomains and lookalikes ("mail.<domain>", "x<domain>",
 * "<domain>.evil.com") are rejected.
 *
 * This is the client-side layer of the domain restriction. Supabase must enforce the same rule on
 * the server, since anything in the app can be bypassed.
 */
export function isAllowedEmail(email: string | null | undefined, allowedDomain: string): boolean {
  if (!email) return false;

  const domain = allowedDomain.trim().toLowerCase();
  const address = email.trim().toLowerCase();
  if (!domain || /\s/.test(address)) return false;

  const parts = address.split('@');
  if (parts.length !== 2) return false;

  const [local, emailDomain] = parts;
  return local.length > 0 && emailDomain === domain;
}
