/**
 * Utility functions for handling currency in paise (integer minor units).
 * ₹1 = 100 paise
 */

/**
 * Converts rupees (number or string) to paise (integer).
 * Examples:
 * 1 -> 100
 * 99.50 -> 9950
 * 1250.75 -> 125075
 */
export function rupeesToPaise(rupees: number | string): number {
  const num =
    typeof rupees === 'string' ? parseStrictNumber(rupees) : rupees;

  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error('Invalid rupee amount');
  }

  return Math.round(num * 100);
}

/**
 * Parses a string as a strict decimal number.
 * Rejects: empty, whitespace-only, trailing junk, multiple dots,
 * commas, currency symbols, scientific notation, hex, etc.
 * Accepts: "100", "99.50", ".5", "0.5", "-5" (sign is allowed but
 * callers must guard positivity themselves).
 */
function parseStrictNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return NaN;

  // Only digits, optional single leading -, optional single .
  if (!/^-?\d*\.?\d*$/.test(trimmed)) return NaN;
  if (trimmed === '.' || trimmed === '-' || trimmed === '-.') return NaN;

  return Number(trimmed);
}

/**
 * Converts paise (integer) to rupees (number).
 * Examples:
 * 100 -> 1
 * 9950 -> 99.50
 * 125075 -> 1250.75
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Formats paise as Indian Rupee display string.
 * Example: 125075 -> "₹1,250.75"
 */
export function formatPaiseToRupees(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
