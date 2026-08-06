import { buildContactSearchQuery, parseGmailMessage, latestPerThread } from '../src/lib/gmailQuery.js';

describe('buildContactSearchQuery', () => {
  it('builds a from/to clause for each email, ORed together', () => {
    const query = buildContactSearchQuery(['jane@example.com', 'john@example.com'], 30);
    expect(query).toBe('(from:jane@example.com OR to:jane@example.com OR from:john@example.com OR to:john@example.com) newer_than:30d');
  });

  it('deduplicates and lowercases emails', () => {
    const query = buildContactSearchQuery(['Jane@Example.com', 'jane@example.com'], 30);
    expect(query).toBe('(from:jane@example.com OR to:jane@example.com) newer_than:30d');
  });

  it('filters out falsy entries', () => {
    const query = buildContactSearchQuery(['jane@example.com', null, undefined, ''], 7);
    expect(query).toBe('(from:jane@example.com OR to:jane@example.com) newer_than:7d');
  });

  it('returns an empty string when there are no emails', () => {
    expect(buildContactSearchQuery([], 30)).toBe('');
    expect(buildContactSearchQuery([null, undefined], 30)).toBe('');
  });

  it('defaults afterDays to 30', () => {
    expect(buildContactSearchQuery(['jane@example.com'])).toContain('newer_than:30d');
  });
});

describe('parseGmailMessage', () => {
  it('flattens headers and snippet into a simple shape', () => {
    const raw = {
      id: 'msg1',
      threadId: 'thread1',
      snippet: 'Great chatting with you...',
      payload: {
        headers: [
          { name: 'From', value: 'Jane Doe <jane@example.com>' },
          { name: 'Subject', value: 'Following up' },
          { name: 'Date', value: 'Mon, 1 Jun 2026 09:00:00 -0700' }
        ]
      }
    };
    expect(parseGmailMessage(raw)).toEqual({
      id: 'msg1',
      threadId: 'thread1',
      fromHeader: 'Jane Doe <jane@example.com>',
      subject: 'Following up',
      date: 'Mon, 1 Jun 2026 09:00:00 -0700',
      snippet: 'Great chatting with you...'
    });
  });

  it('handles headers case-insensitively', () => {
    const raw = { id: '1', threadId: 't1', payload: { headers: [{ name: 'from', value: 'a@b.com' }] } };
    expect(parseGmailMessage(raw).fromHeader).toBe('a@b.com');
  });

  it('returns nulls for missing headers and snippet', () => {
    const raw = { id: '1', threadId: 't1', payload: { headers: [] } };
    expect(parseGmailMessage(raw)).toEqual({
      id: '1',
      threadId: 't1',
      fromHeader: null,
      subject: null,
      date: null,
      snippet: null
    });
  });

  it('tolerates a missing payload entirely', () => {
    expect(parseGmailMessage({ id: '1', threadId: 't1' }).fromHeader).toBeNull();
  });
});

describe('latestPerThread', () => {
  it('keeps only the most recent message per thread', () => {
    const messages = [
      { threadId: 'a', date: '2026-06-01T00:00:00.000Z', id: 'old' },
      { threadId: 'a', date: '2026-06-05T00:00:00.000Z', id: 'new' },
      { threadId: 'b', date: '2026-06-02T00:00:00.000Z', id: 'only' }
    ];
    const result = latestPerThread(messages);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.threadId === 'a').id).toBe('new');
    expect(result.find((m) => m.threadId === 'b').id).toBe('only');
  });

  it('returns an empty array for empty input', () => {
    expect(latestPerThread([])).toEqual([]);
  });
});
