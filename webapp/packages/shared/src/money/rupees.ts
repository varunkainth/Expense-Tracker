/** Money is transported and stored as integer paise, matching the mobile app. */
export function parseRupees(value: string): number {
    const clean = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(clean))
        throw new Error('Enter an amount with up to two decimal places.');
    const [rupees, fraction = ''] = clean.split('.');
    const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(paise) || paise <= 0)
        throw new Error('Enter a positive amount within the supported range.');
    return paise;
}
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export function formatMoney(paise: number): string { return currency.format(paise / 100); }
