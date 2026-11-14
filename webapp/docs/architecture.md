> The original staged plan below is historical. See [workspace-transfer.md](workspace-transfer.md) for current implemented behavior and remaining limits.

# Architecture and next steps

## Data ownership

The phone uses SQLite; the web workspace uses IndexedDB. The backend is intended only for temporary pairing/presence and forwarding encrypted messages. It now exposes a pairing and presence control API, with bounded in-memory sessions that expire and disappear on restart. No financial records, encryption keys or offline relay messages are retained. See pairing-api.md.

UI → feature hook → repository → IndexedDB. Domain validation and sync contracts come from the shared package. Repositories own atomic writes; components do not write tables directly. `App` initializes the database once per mount; initialization is transactionally idempotent across tabs.

## Current records

An expense retains the mobile fields (`amount` in paise, UUID IDs, millisecond timestamps). Browser metadata adds `revision` and `deleted_at`. An immutable outbox operation records a unique operation ID, originating device, record, base revision, timestamp and action. Deletion keeps a tombstone rather than physically erasing the record. Neither timestamps nor connectivity flags establish sync ordering.

## Before enabling phone sync

1. Share domain contracts with mobile through an explicit integration; do not import mobile UI into this workspace. Add contracts for categories, vehicles, refills, and attachments and agree a schema negotiation policy.
2. Establish first pairing: reconcile pre-existing browser and mobile records/categories, create authenticated device identities and short-lived single-use QR challenges. Browser identity is not just a public device ID.
3. Choose an audited cross-platform authenticated key-exchange/encryption approach. Bind identities to the approved QR session, expire challenges, support revocation, and keep tokens and decrypted payloads out of logs.
4. Implement bounded WebSocket forwarding with origin checks, authentication, expiry, heartbeat timeouts, backpressure, size/rate limits and no persistent expense storage. WSS alone is not end-to-end encryption. Presence is reachability of the approved app session, not general phone internet access.
5. Transfer a consistent initial snapshot plus a change cursor. Reject incompatible schemas. A network interruption must not expose a half-imported database; keep local edits made while snapshotting.
6. Apply ordered operations transactionally with durable deduplication, per-device acknowledgements/cursors and revision conflict detection. Preserve offline edits. Conflicting edits and edit-vs-delete require a resolution workflow. Do not silently use wall-clock last-write-wins.
7. Sync related changes as one operation group: especially a fuel refill and its linked personal expense. Never independently merge the two sides and risk double-counting.
8. Keep tombstones/deduplication history until all paired peers acknowledge them, or require a full resnapshot for stale peers. Add browser storage persistence requests, quotas/eviction handling and encrypted export/restore.
9. Test crash recovery, cross-tab writes, disconnect/retry, duplicate delivery, concurrent edits, device revocation, old schemas and large histories before showing a synced indicator.

## Privacy and offline behavior

Browser-local writes currently work without a backend, provided the app page is loaded. There is no service worker yet. No financial data is accepted by the health or pairing APIs. Pairing metadata and credential digests are temporary server memory. Without durable relay queues, both endpoints must be reachable together to exchange changes. Foreground-only phone sync is the first intended release; background reliability must not be promised.

## Verification

Tests cover money and protocol validation, repository/outbox rollback using fake IndexedDB, deletion idempotency and API health behavior. Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` after dependencies install. Browser QA: add/edit/search/delete, reload for persistence, open another tab, verify totals exclude deleted records, and check the offline relay message. The shared browser/mobile HTTP client is also tested through the real in-process backend handshake. Camera scanning and a physical-device network flow require installed dependencies and a fresh native build. Real financial sync remains outside these checks.
