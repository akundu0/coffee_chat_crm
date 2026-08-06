import {
  computeFollowUpDate,
  daysUntil,
  getDueFollowUps,
  getUpcomingFollowUps,
  formatDueLabel,
  FOLLOWUP_PRESETS
} from '../src/lib/followupScheduler.js';

describe('computeFollowUpDate', () => {
  it('adds the given number of days to the base date', () => {
    const result = computeFollowUpDate('2026-01-01T00:00:00.000Z', 7);
    expect(new Date(result).toISOString().slice(0, 10)).toBe('2026-01-08');
  });

  it('accepts a Date instance as the base', () => {
    const result = computeFollowUpDate(new Date('2026-03-15T12:00:00.000Z'), 14);
    expect(new Date(result).toISOString().slice(0, 10)).toBe('2026-03-29');
  });

  it('throws on a negative day count', () => {
    expect(() => computeFollowUpDate('2026-01-01', -1)).toThrow(RangeError);
  });

  it('throws on a non-numeric day count', () => {
    expect(() => computeFollowUpDate('2026-01-01', 'soon')).toThrow(RangeError);
  });

  it('throws on an invalid base date', () => {
    expect(() => computeFollowUpDate('not-a-date', 7)).toThrow(RangeError);
  });

  it('matches every named preset value used by the popup', () => {
    expect(FOLLOWUP_PRESETS.ONE_WEEK).toBe(7);
    expect(FOLLOWUP_PRESETS.TWO_WEEKS).toBe(14);
    expect(FOLLOWUP_PRESETS.ONE_MONTH).toBe(30);
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-06-15T09:00:00.000Z');

  it('returns 0 for a date later today', () => {
    expect(daysUntil('2026-06-15T23:00:00.000Z', now)).toBe(0);
  });

  it('returns 0 for a date earlier today', () => {
    expect(daysUntil('2026-06-15T01:00:00.000Z', now)).toBe(0);
  });

  it('returns a positive count for future dates', () => {
    expect(daysUntil('2026-06-20T09:00:00.000Z', now)).toBe(5);
  });

  it('returns a negative count for past dates', () => {
    expect(daysUntil('2026-06-10T09:00:00.000Z', now)).toBe(-5);
  });

  it('throws on an invalid date string', () => {
    expect(() => daysUntil('not-a-date', now)).toThrow(RangeError);
  });
});

describe('getDueFollowUps', () => {
  const now = new Date('2026-06-15T09:00:00.000Z');

  const overdue = { id: '1', name: 'Overdue Olive', followUp: { dueAt: '2026-06-01T00:00:00.000Z', completed: false } };
  const dueToday = { id: '2', name: 'Today Tara', followUp: { dueAt: '2026-06-15T18:00:00.000Z', completed: false } };
  const future = { id: '3', name: 'Future Fran', followUp: { dueAt: '2026-07-01T00:00:00.000Z', completed: false } };
  const completed = { id: '4', name: 'Done Dana', followUp: { dueAt: '2026-06-01T00:00:00.000Z', completed: true } };
  const none = { id: '5', name: 'No Followup Nia', followUp: null };

  it('returns only overdue and due-today contacts, soonest first', () => {
    const result = getDueFollowUps([future, none, dueToday, overdue, completed], now);
    expect(result.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('returns an empty array when nothing is due', () => {
    expect(getDueFollowUps([future, none, completed], now)).toEqual([]);
  });

  it('ignores contacts without a followUp object at all', () => {
    expect(getDueFollowUps([{ id: '6', name: 'Bare' }], now)).toEqual([]);
  });
});

describe('getUpcomingFollowUps', () => {
  const now = new Date('2026-06-15T09:00:00.000Z');
  const in3days = { id: '1', followUp: { dueAt: '2026-06-18T09:00:00.000Z', completed: false } };
  const in10days = { id: '2', followUp: { dueAt: '2026-06-25T09:00:00.000Z', completed: false } };
  const overdue = { id: '3', followUp: { dueAt: '2026-06-01T09:00:00.000Z', completed: false } };

  it('only includes future dates within the window, excluding due/overdue', () => {
    const result = getUpcomingFollowUps([in3days, in10days, overdue], 7, now);
    expect(result.map((c) => c.id)).toEqual(['1']);
  });

  it('widens correctly when the window grows', () => {
    const result = getUpcomingFollowUps([in3days, in10days, overdue], 14, now);
    expect(result.map((c) => c.id)).toEqual(['1', '2']);
  });
});

describe('formatDueLabel', () => {
  const now = new Date('2026-06-15T09:00:00.000Z');

  it('labels today', () => {
    expect(formatDueLabel('2026-06-15T20:00:00.000Z', now)).toBe('Due today');
  });

  it('labels future dates with a day count', () => {
    expect(formatDueLabel('2026-06-20T09:00:00.000Z', now)).toBe('Due in 5 days');
  });

  it('singularizes a 1-day-away label', () => {
    expect(formatDueLabel('2026-06-16T09:00:00.000Z', now)).toBe('Due in 1 day');
  });

  it('labels overdue dates with an absolute day count', () => {
    expect(formatDueLabel('2026-06-10T09:00:00.000Z', now)).toBe('Overdue by 5 days');
  });

  it('singularizes a 1-day overdue label', () => {
    expect(formatDueLabel('2026-06-14T09:00:00.000Z', now)).toBe('Overdue by 1 day');
  });
});
