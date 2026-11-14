import { healthResponseSchema, type HealthResponse } from '@expense-tracker/shared';
export async function checkRelay(signal?: AbortSignal): Promise<HealthResponse> {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${base.replace(/\/$/, '')}/api/v1/health`, { signal, cache: 'no-store' });
    if (!response.ok)
        throw new Error('Relay is not reachable.');
    return healthResponseSchema.parse(await response.json());
}
