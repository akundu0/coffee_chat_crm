/**
 * linkedinParser.js
 *
 * Pure DOM-reading helpers for LinkedIn's messaging UI. Every export
 * takes a DOM node (or the document) as an argument instead of
 * reaching for `document` globally, so tests can hand it a jsdom
 * fixture built from a saved HTML snippet instead of a live page.
 *
 * LinkedIn's markup and class names change often and are not a
 * stable public API - if selectors here go stale, update the
 * SELECTORS map below and the fixtures in tests/fixtures/.
 */

export const SELECTORS = Object.freeze({
  // The header of the currently open conversation in the messaging overlay.
  activeThreadHeader: '.msg-overlay-conversation-bubble--is-active .msg-entity-lockup__entity-title, .msg-title-bar__title',
  activeThreadProfileLink: '.msg-overlay-conversation-bubble--is-active a.msg-thread__link-to-profile',
  messageForm: '.msg-form__contenteditable',
  sendButton: '.msg-form__send-button'
});

/**
 * Extracts a LinkedIn public profile slug (the `/in/<slug>/` part)
 * from any LinkedIn profile URL, absolute or relative.
 * @param {string} url
 * @returns {string|null}
 */
export function extractProfileSlug(url) {
  if (!url) return null;
  const match = url.match(/\/in\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Reads the name and profile URL of the person in the currently
 * open LinkedIn message thread.
 * @param {ParentNode} root - typically `document`, or a test fixture.
 * @returns {{ name: string|null, profileUrl: string|null, slug: string|null }}
 */
export function parseActiveThreadContact(root) {
  const headerEl = root.querySelector(SELECTORS.activeThreadHeader);
  const linkEl = root.querySelector(SELECTORS.activeThreadProfileLink);

  const name = headerEl ? headerEl.textContent.trim().replace(/\s+/g, ' ') : null;
  const profileUrl = linkEl ? linkEl.getAttribute('href') : null;

  return {
    name: name || null,
    profileUrl: profileUrl || null,
    slug: extractProfileSlug(profileUrl)
  };
}

/**
 * Reads the headline/subtitle text (usually role + company) shown
 * next to a name in a profile card or thread header, if present.
 * @param {Element|null} cardEl
 * @returns {string|null}
 */
export function parseHeadline(cardEl) {
  if (!cardEl) return null;
  const headlineEl = cardEl.querySelector('.msg-entity-lockup__entity-info, .msg-conversation-card__subtitle');
  if (!headlineEl) return null;
  const text = headlineEl.textContent.trim().replace(/\s+/g, ' ');
  return text.length > 0 ? text : null;
}

/**
 * Builds a normalized "capture payload" for a Log-this-contact click,
 * combining the thread contact info with an optional headline element.
 * @param {ParentNode} root
 * @returns {{ name: string|null, profileUrl: string|null, slug: string|null, headline: string|null }}
 */
export function buildCapturePayload(root) {
  const contact = parseActiveThreadContact(root);
  const cardEl = root.querySelector(SELECTORS.activeThreadHeader)?.closest('.msg-entity-lockup, .msg-title-bar');
  return {
    ...contact,
    headline: parseHeadline(cardEl || null)
  };
}
