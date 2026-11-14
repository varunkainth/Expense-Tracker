import { expect, test } from 'bun:test';
import { fromDateInput, toDateInput } from '../src/lib/dates';
test('calendar dates round-trip in local time', () => {
    expect(toDateInput(fromDateInput('2026-11-14'))).toBe('2026-11-14');
    expect(() => fromDateInput('2026-02-30')).toThrow();
    expect(() => fromDateInput('')).toThrow();
});
