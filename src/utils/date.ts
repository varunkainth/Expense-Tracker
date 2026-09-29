/**
 * Date and timestamp utilities for integer Unix timestamps (milliseconds).
 */

/**
 * Returns the current Unix timestamp in milliseconds as an integer.
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Converts a Date object or ISO string to Unix timestamp in milliseconds.
 */
export function toUnixTimestamp(date: Date | string | number): number {
  if (typeof date === 'number') {
    return Math.floor(date);
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime();
}

/**
 * Converts an integer Unix timestamp to a Date object.
 */
export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp);
}

/**
 * Formats a Unix timestamp to a human-readable date string (e.g. "DD MMM YYYY").
 */
export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}