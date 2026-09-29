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
  if (isNaN(amountInPaise) || !Number.isInteger(amountInPaise)) {
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
  if (isNaN(timestamp) || timestamp <= 0) {
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
  if (!Number.isFinite(noOfDays) || noOfDays <= 0) {
    return { isValid: false, error: 'Number of days must be at least 1.' };
  }
  if (endDate < startDate) {
    return { isValid: false, error: 'Check-out date cannot be before check-in date.' };
  }
  if (!Number.isFinite(ratePerDay) || ratePerDay <= 0) {
    return { isValid: false, error: 'Rate per day must be greater than ₹0.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { isValid: false, error: 'Total hotel amount must be greater than ₹0.' };
  }
  return { isValid: true };
}

