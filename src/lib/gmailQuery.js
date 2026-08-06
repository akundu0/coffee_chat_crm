/**
 * gmailQuery.js
 *
 * Pure helpers for talking to the Gmail REST API: building search
 * queries and flattening the API's nested message payload into the
 * flat shape emailMatcher.js expects. No fetch() or chrome.identity
 * calls live here - see src/background/gmailClient.js for the
 * network layer that wraps these.
 */

/**
 * Builds a Gmail search query that looks for mail to/from any of the
 * given contact email addresses, newer than `afterDays` ago. Keeping
 * this narrow (rather than scanning the whole inbox) is both faster
 * and respects the read-only, contact-scoped nature of the integration.
 * @param {string[]} emails
 * @param {number} afterDays
 * @returns {string} a Gmail search query, or '' if there are no emails to search for.
 */
export function buildContactSearchQuery(emails, afterDays = 30) {
  const clean = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (clean.length === 0) return '';
  const addressClause = clean.map((e) => `from:${e} OR to:${e}`).join(' OR ');
  return `(${addressClause}) newer_than:${afterDays}d`;
}

function findHeader(headers, name) {
  const header = (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : null;
}

/**
 * Flattens a Gmail API `messages.get` response (format=metadata,
 * headers=From/Subject/Date) into the shape the rest of the app uses.
 * @param {object} gmailMessage - raw response from the Gmail API
 * @returns {{ id: string, threadId: string, fromHeader: string|null, subject: string|null, date: string|null, snippet: string|null }}
 */
export function parseGmailMessage(gmailMessage) {
  const headers = gmailMessage?.payload?.headers || [];
  return {
    id: gmailMessage.id,
    threadId: gmailMessage.threadId,
    fromHeader: findHeader(headers, 'From'),
    subject: findHeader(headers, 'Subject'),
    date: findHeader(headers, 'Date'),
    snippet: gmailMessage.snippet || null
  };
}

/**
 * Deduplicates parsed Gmail messages by thread, keeping only the
 * most recent message per thread (the one worth surfacing as a
 * "last contact" preview).
 * @param {Array<{threadId: string, date: string|null}>} messages
 * @returns {Array<object>}
 */
export function latestPerThread(messages) {
  const byThread = new Map();
  for (const msg of messages) {
    const existing = byThread.get(msg.threadId);
    if (!existing || new Date(msg.date) > new Date(existing.date)) {
      byThread.set(msg.threadId, msg);
    }
  }
  return [...byThread.values()];
}
