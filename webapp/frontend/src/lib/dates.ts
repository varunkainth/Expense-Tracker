export function toDateInput(timestamp = Date.now()): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function fromDateInput(value: string): number {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(date.getTime()) || toDateInput(date.getTime()) !== value)
        throw new Error('Choose a valid date.');
    return date.getTime();
}
