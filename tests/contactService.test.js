import { createInMemoryAdapter } from '../src/lib/storageService.js';
import { createContactService } from '../src/lib/contactService.js';

function makeService() {
  return createContactService(createInMemoryAdapter());
}

describe('upsertContact', () => {
  it('creates a new contact with sensible defaults', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe', linkedinSlug: 'jane-doe' });

    expect(contact.name).toBe('Jane Doe');
    expect(contact.linkedinSlug).toBe('jane-doe');
    expect(contact.notes).toEqual([]);
    expect(contact.followUp).toBeNull();
    expect(contact.source).toBe('manual');
    expect(typeof contact.id).toBe('string');
    expect(contact.id.length).toBeGreaterThan(0);
  });

  it('persists the contact so it shows up in listContacts', async () => {
    const service = makeService();
    await service.upsertContact({ name: 'Jane Doe', linkedinSlug: 'jane-doe' });
    const contacts = await service.listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Jane Doe');
  });

  it('merges into an existing contact with the same linkedinSlug instead of duplicating', async () => {
    const service = makeService();
    const first = await service.upsertContact({ name: 'Jane Doe', linkedinSlug: 'jane-doe', source: 'linkedin' });
    const second = await service.upsertContact({ name: 'Jane Doe', headline: 'PM at Acme', linkedinSlug: 'jane-doe' });

    expect(second.id).toBe(first.id);
    expect(second.headline).toBe('PM at Acme');
    const contacts = await service.listContacts();
    expect(contacts).toHaveLength(1);
  });

  it('merges into an existing contact with the same email instead of duplicating', async () => {
    const service = makeService();
    const first = await service.upsertContact({ name: 'Jane Doe', email: 'jane@example.com' });
    const second = await service.upsertContact({ name: 'Jane Doe (updated)', email: 'JANE@EXAMPLE.COM' });

    expect(second.id).toBe(first.id);
    const contacts = await service.listContacts();
    expect(contacts).toHaveLength(1);
  });

  it('creates separate contacts for different people', async () => {
    const service = makeService();
    await service.upsertContact({ name: 'Jane Doe', linkedinSlug: 'jane-doe' });
    await service.upsertContact({ name: 'John Smith', linkedinSlug: 'john-smith' });
    expect(await service.listContacts()).toHaveLength(2);
  });

  it('throws when given no identifying information at all', async () => {
    const service = makeService();
    await expect(service.upsertContact({})).rejects.toThrow();
  });
});

describe('addNote', () => {
  it('appends a timestamped note to the contact', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    const updated = await service.addNote(contact.id, '  Great coffee chat about ML infra  ');

    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].text).toBe('Great coffee chat about ML infra');
    expect(typeof updated.notes[0].createdAt).toBe('string');
  });

  it('rejects an empty note', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    await expect(service.addNote(contact.id, '   ')).rejects.toThrow('Note text cannot be empty');
  });

  it('throws for an unknown contact id', async () => {
    const service = makeService();
    await expect(service.addNote('nonexistent', 'hi')).rejects.toThrow('No contact with id nonexistent');
  });

  it('preserves note order across multiple additions', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    await service.addNote(contact.id, 'first');
    const updated = await service.addNote(contact.id, 'second');
    expect(updated.notes.map((n) => n.text)).toEqual(['first', 'second']);
  });
});

describe('follow-ups', () => {
  it('sets a follow-up as not completed', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    const updated = await service.setFollowUp(contact.id, '2026-07-01T00:00:00.000Z', 'ping about referral');

    expect(updated.followUp).toEqual({
      dueAt: '2026-07-01T00:00:00.000Z',
      note: 'ping about referral',
      completed: false
    });
  });

  it('marks a follow-up complete', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    await service.setFollowUp(contact.id, '2026-07-01T00:00:00.000Z');
    const updated = await service.completeFollowUp(contact.id);
    expect(updated.followUp.completed).toBe(true);
  });

  it('is a no-op on completeFollowUp when there was never a follow-up set', async () => {
    const service = makeService();
    const contact = await service.upsertContact({ name: 'Jane Doe' });
    const updated = await service.completeFollowUp(contact.id);
    expect(updated.followUp).toBeNull();
  });

  it('throws for an unknown contact id', async () => {
    const service = makeService();
    await expect(service.setFollowUp('nonexistent', '2026-07-01T00:00:00.000Z')).rejects.toThrow();
  });
});

describe('deleteContact', () => {
  it('removes the contact and returns the remaining list', async () => {
    const service = makeService();
    const a = await service.upsertContact({ name: 'Jane Doe', linkedinSlug: 'jane' });
    await service.upsertContact({ name: 'John Smith', linkedinSlug: 'john' });

    const remaining = await service.deleteContact(a.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('John Smith');
    expect(await service.getById(a.id)).toBeNull();
  });

  it('is a no-op for an id that does not exist', async () => {
    const service = makeService();
    await service.upsertContact({ name: 'Jane Doe' });
    const remaining = await service.deleteContact('nonexistent');
    expect(remaining).toHaveLength(1);
  });
});

describe('getById', () => {
  it('returns null for an unknown id', async () => {
    const service = makeService();
    expect(await service.getById('nonexistent')).toBeNull();
  });
});
