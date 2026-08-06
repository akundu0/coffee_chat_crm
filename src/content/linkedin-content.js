/**
 * linkedin-content.js
 *
 * Runs on linkedin.com. Injects a small "Log this contact" button
 * into the open messaging thread header. On click it reads (never
 * automates or sends anything) the currently open conversation's
 * name/profile URL/headline and asks the background service worker
 * to save it. Nothing here runs unless the user clicks the button -
 * see the README for why that's a deliberate design choice.
 *
 * This file is loaded as a classic (non-module) content script, so
 * the parsing helpers in src/lib/linkedinParser.js - which use ESM
 * `export` - are loaded via a runtime dynamic import() against the
 * extension's own web-accessible resource instead of a manifest
 * <script> include.
 */

const BUTTON_ID = 'coffee-chat-crm-log-button';
const STATUS_ID = 'coffee-chat-crm-log-status';

let parserModulePromise = null;
function loadParser() {
  if (!parserModulePromise) {
    parserModulePromise = import(chrome.runtime.getURL('src/lib/linkedinParser.js'));
  }
  return parserModulePromise;
}

function createButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'coffee-chat-crm-widget';

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'coffee-chat-crm-button';
  button.textContent = 'Log this contact';

  const status = document.createElement('span');
  status.id = STATUS_ID;
  status.className = 'coffee-chat-crm-status';

  wrapper.appendChild(button);
  wrapper.appendChild(status);
  return wrapper;
}

function setStatus(text, isError = false) {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('coffee-chat-crm-status--error', isError);
  if (text) {
    setTimeout(() => {
      if (status.textContent === text) status.textContent = '';
    }, 3000);
  }
}

async function handleLogClick() {
  const { buildCapturePayload } = await loadParser();
  const payload = buildCapturePayload(document);

  if (!payload.name) {
    setStatus('Open a conversation first', true);
    return;
  }

  setStatus('Saving...');
  chrome.runtime.sendMessage({ type: 'CAPTURE_CONTACT', payload }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      setStatus('Could not save contact', true);
      return;
    }
    setStatus(`Saved ${response.contact.name}`);
  });
}

/**
 * LinkedIn's messaging overlay is a single-page-app fragment that
 * gets re-rendered as the user opens/switches conversations, so a
 * one-time DOMContentLoaded injection isn't enough - a
 * MutationObserver keeps the button present as the thread changes.
 */
function ensureButtonInjected() {
  if (document.getElementById(BUTTON_ID)) return;

  const header = document.querySelector(
    '.msg-overlay-conversation-bubble--is-active .msg-title-bar, .msg-overlay-conversation-bubble--is-active .msg-entity-lockup'
  );
  if (!header) return;

  const widget = createButton();
  widget.querySelector('button').addEventListener('click', handleLogClick);
  header.appendChild(widget);
}

const observer = new MutationObserver(() => ensureButtonInjected());
observer.observe(document.body, { childList: true, subtree: true });
ensureButtonInjected();
