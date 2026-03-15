/**
 * Converts a value representing a calendar date into a stable date-only string (YYYY-MM-DD).
 *
 * Why: Some drivers/languages serialize DATE values as a Date/ISO string in UTC midnight.
 * When a client converts that to local time (e.g. UTC-03), it can show the previous day.
 */
export function toDateOnlyString(value) {
  if (value == null) return value;

  if (typeof value === 'string') {
    // Common cases:
    // - '2026-03-14'
    // - '2026-03-14T00:00:00.000Z'
    // - '2026-03-14 00:00:00'
    const m = /^\d{4}-\d{2}-\d{2}/.exec(value);
    return m ? m[0] : value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return value;
}
