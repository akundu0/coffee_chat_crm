/**
 * background.js
 *
 * MV3 service worker. Responsibilities:
 *  - Handle messages from the content script ("log this contact")
 *    and the popup (list/edit contacts, notes, follow-ups).
 *  - On an alarm, poll Gmail for messages to/from known contacts and
 *    auto-link them (lastContactedAt + an auto-generated note).
 *  - On another alarm, check for due follow-ups and fire a
 *    chrome.notifications reminder.
 *
 * Business logic lives in src/lib/*.js and is unit tested there;
 * this file is the thin glue that only exists inside a real browser.
 */

import { createChromeStorageAdapter } from '../lib/storageService.js';
import { createContactService } from '../lib/contactService.js';
import { getDueFollowUps } from '../lib/followupScheduler.js';
import { resolveContactForMessage } from '../lib/emailMatcher.js';
import { fetchRecentMessagesForContacts } from './gmailClient.js';

const GMAIL_SYNC_ALARM = 'coffeeChatCrm.gmailSync';
const FOLLOWUP_CHECK_ALARM = 'coffeeChatCrm.followupCheck';

const storage = createChromeStorageAdapter(chrome.storage.local);
const contactService = createContactService(storage);

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(GMAIL_SYNC_ALARM, { periodInMinutes: 60 });
  chrome.alarms.create(FOLLOWUP_CHECK_ALARM, { periodInMinutes: 60 * 12 });
});

async function handleCaptureContact(payload) {
  const contact = await contactService.upsertContact({
    name: payload.name,
    headline: payload.headline,
    linkedinSlug: payload.slug,
    linkedinUrl: payload.profileUrl,
    source: 'linkedin'
  });
  return contact;
}

async function syncGmail() {
  const contacts = await contactService.listContacts();
  const emails = contacts.map((c) => c.email).filter(Boolean);
  if (emails.length === 0) return { linked: 0 };

  let messages = [];
  try {
    messages = await fetchRecentMessagesForContacts(emails);
  } catch (err) {
    // Most commonly: user hasn't connected Gmail yet, or the token
    // expired. Fail quietly - this runs on a background alarm and
    // shouldn't surface an error UI on its own.
    console.warn('[coffee-chat-crm] Gmail sync skipped:', err.message);
    return { linked: 0, error: err.message };
  }

  let linked = 0;
  for (const message of messages) {
    const { contact, confidence } = resolveContactForMessage(contacts, message);
    if (!contact || confidence !== 'exact') continue;
    await contactService.addNote(
      contact.id,
      `Email: "${message.subject || '(no subject)'}" - ${message.snippet || ''}`.trim()
    );
    linked += 1;
  }
  return { linked };
}

async function checkDueFollowUps() {
  const contacts = await contactService.listContacts();
  const due = getDueFollowUps(contacts);
  if (due.length === 0) return;

  chrome.notifications.create(`coffeeChatCrm.followups.${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: due.length === 1 ? 'You have a follow-up due' : `You have ${due.length} follow-ups due`,
    message: due
      .slice(0, 3)
      .map((c) => c.name)
      .join(', ')
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === GMAIL_SYNC_ALARM) syncGmail();
  if (alarm.name === FOLLOWUP_CHECK_ALARM) checkDueFollowUps();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'CAPTURE_CONTACT':
          sendResponse({ ok: true, contact: await handleCaptureContact(message.payload) });
          break;
        case 'LIST_CONTACTS':
          sendResponse({ ok: true, contacts: await contactService.listContacts() });
          break;
        case 'ADD_NOTE':
          sendResponse({ ok: true, contact: await contactService.addNote(message.contactId, message.text) });
          break;
        case 'SET_FOLLOWUP':
          sendResponse({
            ok: true,
            contact: await contactService.setFollowUp(message.contactId, message.dueAt, message.note)
          });
          break;
        case 'COMPLETE_FOLLOWUP':
          sendResponse({ ok: true, contact: await contactService.completeFollowUp(message.contactId) });
          break;
        case 'DELETE_CONTACT':
          sendResponse({ ok: true, contacts: await contactService.deleteContact(message.contactId) });
          break;
        case 'UPDATE_CONTACT_EMAIL':
          sendResponse({
            ok: true,
            contact: await contactService.upsertContact({
              linkedinSlug: message.linkedinSlug,
              email: message.email
            })
          });
          break;
        case 'SYNC_GMAIL_NOW':
          sendResponse({ ok: true, result: await syncGmail() });
          break;
        default:
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep the message channel open for the async response
});
