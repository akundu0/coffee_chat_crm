import {
  normalizeEmail,
  parseFromHeader,
  matchContactByEmail,
  candidateMatchesByName,
  resolveContactForMessage
} from '../src/lib/emailMatcher.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM  ')).toBe('jane.doe@example.com');
  });

  it('returns an empty string for nullish input', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('parseFromHeader', () => {
  it('parses "Name <email>" format', () => {
    expect(parseFromHeader('Jane Doe <jane@example.com>')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com'
    });
  });

  it('parses a quoted display name', () => {
    expect(parseFromHeader('"Doe, Jane" <jane@example.com>')).toEqual({
      name: 'Doe, Jane',
      email: 'jane@example.com'
    });
  });

  it('parses a bare email address with no display name', () => {
    expect(parseFromHeader('jane@example.com')).toEqual({ name: null, email: 'jane@example.com' });
  });

  it('normalizes the email case', () => {
    expect(parseFromHeader('Jane Doe <Jane@Example.COM>').email).toBe('jane@example.com');
  });

  it('returns nulls for empty input', () => {
    expect(parseFromHeader('')).toEqual({ name: null, email: null });
    expect(parseFromHeader(null)).toEqual({ name: null, email: null });
  });

  it('falls back to treating malformed input as a bare name', () => {
    expect(parseFromHeader('not an email at all')).toEqual({ name: 'not an email at all', email: null });
  });
});

describe('matchContactByEmail', () => {
  const contacts = [
    { id: '1', email: 'jane@example.com' },
    { id: '2', email: 'JOHN@EXAMPLE.COM' },
    { id: '3', email: null }
  ];

  it('matches case-insensitively', () => {
    expect(matchContactByEmail(contacts, 'john@example.com').id).toBe('2');
  });

  it('returns null when nothing matches', () => {
    expect(matchContactByEmail(contacts, 'nobody@example.com')).toBeNull();
  });

  it('returns null for an empty query', () => {
    expect(matchContactByEmail(contacts, '')).toBeNull();
  });

  it('never matches contacts with a null email', () => {
    expect(matchContactByEmail(contacts, '')).not.toBe(contacts[2]);
  });
});

describe('candidateMatchesByName', () => {
  const contacts = [
    { id: '1', name: 'Jane Doe' },
    { id: '2', name: 'jane doe' },
    { id: '3', name: 'John Smith' }
  ];

  it('matches case-insensitively and can return multiple candidates', () => {
    const result = candidateMatchesByName(contacts, 'Jane Doe');
    expect(result.map((c) => c.id).sort()).toEqual(['1', '2']);
  });

  it('returns an empty array when no name matches', () => {
    expect(candidateMatchesByName(contacts, 'Nobody Here')).toEqual([]);
  });
});

describe('resolveContactForMessage', () => {
  const contacts = [
    { id: '1', name: 'Jane Doe', email: 'jane@example.com' },
    { id: '2', name: 'Unique Name', email: null }
  ];

  it('prefers an exact email match over a name match', () => {
    const result = resolveContactForMessage(contacts, { fromHeader: 'Someone Else <jane@example.com>' });
    expect(result).toEqual({ contact: contacts[0], confidence: 'exact' });
  });

  it('falls back to a unique name match when there is no email match', () => {
    const result = resolveContactForMessage(contacts, { fromHeader: 'Unique Name <unknown@example.com>' });
    expect(result).toEqual({ contact: contacts[1], confidence: 'name' });
  });

  it('returns no match when nothing lines up', () => {
    const result = resolveContactForMessage(contacts, { fromHeader: 'Stranger <stranger@example.com>' });
    expect(result).toEqual({ contact: null, confidence: 'none' });
  });
});
