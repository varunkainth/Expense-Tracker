import { ApiError } from './api-error';

/** Bounded per-process limiter. Proxy headers are deliberately not trusted. */
export class RequestLimiter {
  private readonly clients = new Map<string, { count: number; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly limit = 120, private readonly maxClients = 10_000) {}
  prune() { for (const [ip, entry] of this.clients) if (entry.expiresAt <= this.now()) this.clients.delete(ip); }
  clear() { this.clients.clear(); }
  consume(ip: string) {
    let entry = this.clients.get(ip);
    if (!entry || entry.expiresAt <= this.now()) {
      this.prune();
      if (!entry && this.clients.size >= this.maxClients) throw new ApiError(503, 'CAPACITY_REACHED', 'Service is busy. Try again shortly.');
      entry = { count: 0, expiresAt: this.now() + 60_000 }; this.clients.set(ip, entry);
    }
    if (++entry.count > this.limit) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again in a minute.');
  }
}
