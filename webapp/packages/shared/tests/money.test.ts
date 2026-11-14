import { describe, expect, test } from 'bun:test';
import { parseRupees } from '../src/money/rupees';
describe('integer paise conversion', () => {
    test('preserves exact decimal cents', () => {
        expect(parseRupees('0.01')).toBe(1);
        expect(parseRupees(' 123.4 ')).toBe(12340);
        expect(parseRupees('200')).toBe(20000);
        expect(parseRupees('100.29')).toBe(10029);
    });
    test('rejects zero, negatives, precision loss and unsafe amounts', () => {
        for (const value of ['', '0', '-2', '1.234', '1e3', 'Infinity', '9007199254740992'])
            expect(() => parseRupees(value)).toThrow();
    });
});
