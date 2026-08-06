/**
 * contactService.js
 *
 * The single source of truth for reading and writing contacts.
 * Takes a storage adapter (see storageService.js) via dependency
 * injection so it works identically against chrome.storage.local in
 * the extension and against an in-memory store in tests.
 */

import { CONTACTS_STORE_KEY } from './storageService.js';

function makeId() {
  // crypto.randomUUID is available in MV3 service workers and modern
  // browsers; fall back to a timestamp+random id in older test runners.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createContactService(adapter) {
  async function listContacts() {
    const contacts = await adapter.get(CONTACTS_STORE_KEY);
    return Array.isArray(contacts) ? contacts : [];
  }

  async function saveAll(contacts) {
    await adapter.set(CONTACTS_STORE_KEY, contacts);
    return contacts;
  }

  async function getById(id) {
    const contacts = await listContacts();
    return contacts.find((c) => c.id === id) || null;
  }

  /**
   * Creates a contact, or if one already exists with the same
   * LinkedIn slug or email, merges the new fields into it instead
   * of creating a duplicate. Returns the resulting contact.
   */
  async function upsertContact(input) {
    if (!input || (!input.name && !input.email && !input.linkedinSlug)) {
      throw new Error('upsertContact requires at least a name, email, or linkedinSlug');
    }
    const contacts = await listContacts();
    const now = new Date().toISOString();

    const existing = contacts.find(
      (c) =>
        (input.linkedinSlug && c.linkedinSlug === input.linkedinSlug) ||
        (input.email && c.email && c.email.toLowerCase() === input.email.toLowerCase())
    );

    if (existing) {
      Object.assign(existing, {
        name: input.name || existing.name,
        headline: input.headline || existing.headline,
        email: input.email || existing.email,
        linkedinSlug: input.linkedinSlug || existing.linkedinSlug,
        linkedinUrl: input.linkedinUrl || existing.linkedinUrl,
        updatedAt: now
      });
      await saveAll(contacts);
      return existing;
    }

    const contact = {
      id: makeId(),
      name: input.name || null,
      headline: input.headline || null,
      email: input.email || null,
      linkedinSlug: input.linkedinSlug || null,
      linkedinUrl: input.linkedinUrl || null,
      source: input.source || 'manual',
      notes: [],
      followUp: null,
      createdAt: now,
      updatedAt: now,
      lastContactedAt: now
    };
    contacts.push(contact);
    await saveAll(contacts);
    return contact;
  }

  async function addNote(contactId, text) {
    if (!text || !text.trim()) throw new Error('Note text cannot be empty');
    const contacts = await listContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error(`No contact with id ${contactId}`);

    contact.notes.push({
      id: makeId(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    });
    contact.updatedAt = new Date().toISOString();
    await saveAll(contacts);
    return contact;
  }

  async function setFollowUp(contactId, dueAt, note = null) {
    const contacts = await listContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error(`No contact with id ${contactId}`);

    contact.followUp = { dueAt, note, completed: false };
    contact.updatedAt = new Date().toISOString();
    await saveAll(contacts);
    return contact;
  }

  async function completeFollowUp(contactId) {
    const contacts = await listContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error(`No contact with id ${contactId}`);
    if (contact.followUp) contact.followUp.completed = true;
    contact.updatedAt = new Date().toISOString();
    await saveAll(contacts);
    return contact;
  }

  async function deleteContact(contactId) {
    const contacts = await listContacts();
    const remaining = contacts.filter((c) => c.id !== contactId);
    await saveAll(remaining);
    return remaining;
  }

  return {
    listContacts,
    getById,
    upsertContact,
    addNote,
    setFollowUp,
    completeFollowUp,
    deleteContact
  };
}
