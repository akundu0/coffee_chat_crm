/**
 * gmailClient.js
 *
 * Thin network layer around the Gmail REST API. Delegates all
 * query-building and payload-parsing to src/lib/gmailQuery.js (which
 * is unit tested) - this file is intentionally kept small since it
 * depends on chrome.identity and fetch(), which only exist in a real
 * extension context and are exercised via manual/integration testing
 * (see README's "Testing" section for why).
 */

import { buildContactSearchQuery, parseGmailMessage, latestPerThread } from '../lib/gmailQuery.js';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Resolves an OAuth token via chrome.identity, prompting an
 * interactive consent screen the first time.
 * @param {boolean} interactive
 * @returns {Promise<string>}
 */
export function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error('No Gmail token returned'));
        return;
      }
      resolve(token);
    });
  });
}

async function gmailFetch(path, token) {
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Gmail API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Finds recent Gmail messages to/from any of the given contact
 * emails and returns one flattened, deduplicated (latest-per-thread)
 * message per matching thread.
 * @param {string[]} contactEmails
 * @param {object} [options]
 * @param {number} [options.afterDays]
 * @param {number} [options.maxResults]
 * @returns {Promise<Array<object>>}
 */
export async function fetchRecentMessagesForContacts(contactEmails, { afterDays = 30, maxResults = 25 } = {}) {
  const query = buildContactSearchQuery(contactEmails, afterDays);
  if (!query) return [];

  const token = await getAuthToken(false);
  const listResp = await gmailFetch(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    token
  );
  const ids = (listResp.messages || []).map((m) => m.id);

  const messages = await Promise.all(
    ids.map((id) =>
      gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token)
    )
  );

  return latestPerThread(messages.map(parseGmailMessage));
}
