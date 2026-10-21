/**
 * Validation utilities for application forms and business rules.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates money amount in paise (must be a positive integer).
 */
export function validateAmount(amountInPaise: number): ValidationResult {
  if (!Number.isSafeInteger(amountInPaise)) {
    return { isValid: false, error: 'Amount must be a valid number.' };
  }
  if (amountInPaise <= 0) {
    return { isValid: false, error: 'Amount must be greater than ₹0.' };
  }
  return { isValid: true };
}

/**
 * Validates required non-empty string.
 */
export function validateRequiredText(value: string | undefined | null, fieldName = 'Field'): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  return { isValid: true };
}

/**
 * Validates Unix timestamp.
 */
export function validateTimestamp(timestamp: number, fieldName = 'Date'): ValidationResult {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || Number.isNaN(new Date(timestamp).getTime())) {
    return { isValid: false, error: `Invalid ${fieldName}.` };
  }
  return { isValid: true };
}

/**
 * Validates hotel stay date range and number of days.
 */
export function validateHotelStay(
  startDate: number,
  endDate: number,
  noOfDays: number,
  ratePerDay: number,
  amount: number
): ValidationResult {
  if (!validateTimestamp(startDate).isValid || !validateTimestamp(endDate).isValid || endDate <= startDate) {
    return { isValid: false, error: 'Check-out date must be after check-in date (at least 1 night).' };
  }
  if (!Number.isSafeInteger(noOfDays) || noOfDays <= 0) {
    return { isValid: false, error: 'Number of nights must be at least 1.' };
  }
  if (!Number.isSafeInteger(ratePerDay) || ratePerDay <= 0) {
    return { isValid: false, error: 'Rate per night must be greater than ₹0.' };
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { isValid: false, error: 'Total hotel amount must be greater than ₹0.' };
  }
  return { isValid: true };
}

export function assertValidAmount(amount: number, allowZero = false): void {
  if (!Number.isSafeInteger(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(allowZero ? 'Enter a valid non-negative amount.' : 'Enter a valid amount greater than zero.');
  }
}
export function assertValidTimestamp(timestamp: number): void {
  const result = validateTimestamp(timestamp);
  if (!result.isValid) throw new Error(result.error);
}
