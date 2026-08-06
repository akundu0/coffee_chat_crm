import { createChromeStorageAdapter } from '../lib/storageService.js';
import { createContactService } from '../lib/contactService.js';

const storage = createChromeStorageAdapter(chrome.storage.local);
const contactService = createContactService(storage);

const statusEl = document.getElementById('gmail-status');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

async function refreshGmailStatus() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    const connected = Boolean(token) && !chrome.runtime.lastError;
    statusEl.textContent = connected
      ? 'Connected. New contact list emails are checked hourly.'
      : 'Not connected. Follow-up emails will not be auto-linked until you connect.';
    connectBtn.hidden = connected;
    disconnectBtn.hidden = !connected;
  });
}

connectBtn.addEventListener('click', () => {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      statusEl.textContent = `Could not connect: ${chrome.runtime.lastError?.message || 'unknown error'}`;
      return;
    }
    refreshGmailStatus();
  });
});

disconnectBtn.addEventListener('click', () => {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (!token) return;
    chrome.identity.removeCachedAuthToken({ token }, refreshGmailStatus);
  });
});

document.getElementById('export-btn').addEventListener('click', async () => {
  const contacts = await contactService.listContacts();
  const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coffee-chat-crm-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('clear-btn').addEventListener('click', async () => {
  if (!confirm('Delete all contacts, notes, and follow-ups? This cannot be undone.')) return;
  const contacts = await contactService.listContacts();
  await Promise.all(contacts.map((c) => contactService.deleteContact(c.id)));
  alert('All data cleared.');
});

refreshGmailStatus();
