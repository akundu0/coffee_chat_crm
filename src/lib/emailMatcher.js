/**
 * emailMatcher.js
 *
 * Pure functions that link Gmail messages back to existing contacts,
 * and parse RFC 5322-style "From" headers. No network or chrome.*
 * calls happen here, which keeps it cheap to unit test.
 */

/**
 * Lowercases and trims an email address for stable comparisons.
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Parses a "From" header like `Jane Doe <jane@example.com>` or a bare
 * address into { name, email }. Falls back gracefully on malformed input.
 * @param {string} fromHeader
 * @returns {{ name: string|null, email: string|null }}
 */
export function parseFromHeader(fromHeader) {
  if (!fromHeader || typeof fromHeader !== 'string') {
    return { name: null, email: null };
  }
  const angleMatch = fromHeader.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    const name = angleMatch[1].trim();
    return {
      name: name.length > 0 ? name : null,
      email: normalizeEmail(angleMatch[2])
    };
  }
  const bareEmailMatch = fromHeader.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (bareEmailMatch) {
    return { name: null, email: normalizeEmail(fromHeader) };
  }
  return { name: fromHeader.trim() || null, email: null };
}

/**
 * Finds the contact whose stored email matches `email` exactly
 * (case-insensitive). Returns null if there's no match.
 * @param {Array<object>} contacts
 * @param {string} email
 * @returns {object|null}
 */
export function matchContactByEmail(contacts, email) {
  const target = normalizeEmail(email);
  if (!target) return null;
  return contacts.find((c) => normalizeEmail(c.email) === target) || null;
}

/**
 * Fallback fuzzy match by display name, for contacts captured on
 * LinkedIn (which has no email) before any email was ever seen.
 * Requires an exact case-insensitive full-name match to avoid
 * false positives - this is intentionally conservative.
 * @param {Array<object>} contacts
 * @param {string} name
 * @returns {Array<object>} all contacts sharing that name, so the
 *   caller can disambiguate rather than silently picking one.
 */
export function candidateMatchesByName(contacts, name) {
  if (!name) return [];
  const target = name.trim().toLowerCase();
  if (!target) return [];
  return contacts.filter((c) => (c.name || '').trim().toLowerCase() === target);
}

/**
 * Given a parsed Gmail message, returns the single best contact match
 * plus how confident that match is, so the caller can decide whether
 * to auto-link or ask the user to confirm.
 * @param {Array<object>} contacts
 * @param {{ fromHeader: string }} message
 * @returns {{ contact: object|null, confidence: 'exact'|'name'|'none' }}
 */
export function resolveContactForMessage(contacts, message) {
  const { name, email } = parseFromHeader(message.fromHeader);

  const exact = email ? matchContactByEmail(contacts, email) : null;
  if (exact) return { contact: exact, confidence: 'exact' };

  const nameMatches = name ? candidateMatchesByName(contacts, name) : [];
  if (nameMatches.length === 1) return { contact: nameMatches[0], confidence: 'name' };

  return { contact: null, confidence: 'none' };
}
