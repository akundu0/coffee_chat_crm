/**
 * followupScheduler.js
 *
 * Pure functions for computing and querying follow-up reminders.
 * Deliberately has zero dependency on chrome.* APIs so it can be
 * unit tested in plain Node/Jest without any browser mocking.
 */

/** Named presets shown in the popup's "remind me in" dropdown. */
export const FOLLOWUP_PRESETS = Object.freeze({
  THREE_DAYS: 3,
  ONE_WEEK: 7,
  TWO_WEEKS: 14,
  ONE_MONTH: 30,
  ONE_QUARTER: 90
});

/**
 * Adds `days` to `baseDate` and returns an ISO-8601 string.
 * @param {Date|string|number} baseDate
 * @param {number} days
 * @returns {string} ISO date string
 */
export function computeFollowUpDate(baseDate, days) {
  if (typeof days !== 'number' || Number.isNaN(days) || days < 0) {
    throw new RangeError(`days must be a non-negative number, got ${days}`);
  }
  const base = new Date(baseDate);
  if (Number.isNaN(base.getTime())) {
    throw new RangeError(`baseDate is not a valid date: ${baseDate}`);
  }
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

/**
 * Whole number of days between `now` and `dateStr`.
 * Negative means `dateStr` is in the past.
 * @param {string} dateStr ISO date string
 * @param {Date} [now]
 * @returns {number}
 */
export function daysUntil(dateStr, now = new Date()) {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) {
    throw new RangeError(`dateStr is not a valid date: ${dateStr}`);
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  // Compare calendar-day boundaries, not raw millisecond diffs, so
  // "today at 11pm" and "today at 6am" both read as 0 days away.
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfTarget - startOfNow) / msPerDay);
}

function hasActiveFollowUp(contact) {
  return Boolean(contact.followUp && contact.followUp.dueAt && !contact.followUp.completed);
}

/**
 * Contacts whose follow-up is due today or overdue, soonest first.
 * @param {Array<object>} contacts
 * @param {Date} [now]
 * @returns {Array<object>}
 */
export function getDueFollowUps(contacts, now = new Date()) {
  return contacts
    .filter((c) => hasActiveFollowUp(c) && daysUntil(c.followUp.dueAt, now) <= 0)
    .sort((a, b) => new Date(a.followUp.dueAt) - new Date(b.followUp.dueAt));
}

/**
 * Contacts with a follow-up due in the future, within `withinDays`.
 * @param {Array<object>} contacts
 * @param {number} withinDays
 * @param {Date} [now]
 * @returns {Array<object>}
 */
export function getUpcomingFollowUps(contacts, withinDays, now = new Date()) {
  return contacts
    .filter((c) => {
      if (!hasActiveFollowUp(c)) return false;
      const d = daysUntil(c.followUp.dueAt, now);
      return d > 0 && d <= withinDays;
    })
    .sort((a, b) => new Date(a.followUp.dueAt) - new Date(b.followUp.dueAt));
}

/**
 * Human-readable label for a due date, e.g. "Overdue by 3 days",
 * "Due today", "Due in 5 days".
 * @param {string} dateStr
 * @param {Date} [now]
 */
export function formatDueLabel(dateStr, now = new Date()) {
  const d = daysUntil(dateStr, now);
  if (d === 0) return 'Due today';
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
}
