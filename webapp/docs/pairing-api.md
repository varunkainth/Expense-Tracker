# Pairing and presence API · version 1

This is a control API, not expense sync. It uses HTTP requests and authenticated heartbeat polling for the first backend slice. Mobile scanner and browser QR/approval clients are now implemented against the shared HTTP client in `packages/pairing-protocol`. The native camera dependency must be installed and a real-device flow still needs verification. WebSocket transport is not used. Encrypted one-way personal expense transfer is documented in [expense-transfer.md](expense-transfer.md). Health reports `{ pairing: true, presence: true, expenseTransfer: true, sync: false }`; those flags describe backend endpoints, not a claim of completed hardware/device verification.

## Endpoint reference

All paths are relative to `/api/v1`. Bodies are strict JSON; extra fields are rejected. No secrets are accepted in query parameters. A token means `Authorization: Bearer <token>`.

| Method / path | Authentication | Purpose |
| --- | --- | --- |
| `GET /health` | None | Service and capability status |
| `POST /pairing` | None | Create a short-lived browser challenge; body `{ browserName }` |
| `POST /pairing/:id/claim` | One-use QR claim token in body | Body `{ claimToken, phoneDeviceId, phoneName }`; claim on the phone after scanning |
| `POST /pairing/:id/approve` | Phone token | Body `{ verificationCode }`; approve on the phone |
| `POST /pairing/:id/confirm` | Browser token | Body `{ verificationCode }`; finish only after phone approval and user comparison of the displayed code |
| `GET /pairing/:id` | Browser or phone token | Read handshake status and heartbeat-based presence |
| `POST /pairing/:id/heartbeat` | Browser or phone token | Update that peer's presence after linking; no body, or `{}` |
| `DELETE /pairing/:id` | Browser or phone token | Cancel pending pairing or revoke a linked session |

A browser token cannot approve as a phone, and a phone token cannot confirm as a browser. A device UUID is metadata, not authorization. Credentials must never appear in URLs, analytics or logs. “Remember this browser” optionally saves the confirmed browser credentials and transfer key in local storage; disconnect, opt-out, revocation and expiry clear them. Saved sessions are checked against the backend before restoring the workspace.

## Handshake

1. Browser creates a session. The response contains `sessionId`, `browserToken`, `expiresAt` and a `qr` object. Retain the browser token in memory until linked; persist only when remembering is enabled. Encode **only the `qr` object** into the QR, not the complete response.
2. The phone parses and validates `pairingQrSchema`, then submits the single-use claim token to its configured trusted backend. The QR contains no backend URL; do not use scanned content to choose an arbitrary server. The claim response gives the phone its own token and a six-digit verification code.
3. Browser polls status using its browser token. It can display the claimed phone name and the same verification code. Both sides must present the code for the user to compare. Claims do not make a device trusted or online yet.
4. After explicit phone approval, the phone calls `approve`. The browser automatically calls `confirm` with the matching code; no second user approval is required. Only then is state `linked`; the QR claim token has already been consumed.
5. Both foreground clients send heartbeats every 20 seconds. Status polling alone does not update presence. A peer becomes unavailable 45 seconds after its most recent authenticated action/heartbeat. Presence is app reachability, not proof that the phone lacks internet.
6. Either side can revoke. On lost responses, poll authenticated status to recover the current state rather than generating a new logical approval blindly. A lost initial claim response requires canceling/expiring that challenge and starting again; the claim credential is intentionally single use.

Challenge lifetime is two minutes from creation, including claim/approval; it does not slide. Confirmation replaces that with an absolute eight-hour linked-session deadline. Heartbeats do not extend that deadline. Expired, revoked and unknown IDs return the same 404 response. Retry with a fresh challenge after expiration/restart.

## Storage and privacy

The service stores session IDs, display names, phone device UUIDs, SHA-256 token digests, temporary comparison codes, timestamps and state in memory only. Browser/phone/claim capabilities are independent random 256-bit tokens. Credential comparisons use constant-time digest comparison. Cleartext tokens are returned only to the appropriate requester. The server never receives private encryption keys or plaintext expense records; the transfer routes hold only bounded temporary ciphertext. Bodies with unexpected fields are rejected, including attempts to attach financial records to pairing/heartbeat requests.

This handshake authorizes a temporary server control session; it does **not** establish authenticated end-to-end encryption keys. Do not use a `linked` state to send expenses until that separate protocol and mobile/web integration are implemented and tested. A trusted TLS deployment and user verification of the intended pairing are required. No trust guarantee is made against a malicious relay or compromised device.

## Operational limits

- Default bind is loopback (`127.0.0.1:3001`). Configure `HOST` explicitly for deployment. Use HTTPS at a trusted reverse proxy for real devices; do not publicly serve bearer credentials over plaintext HTTP.
- `WEB_ORIGIN` must be a browser origin without a trailing slash. In development, configuring a loopback hostname also permits `localhost`, `127.0.0.1` and `[::1]` on exactly the same scheme and port. Production accepts only the exact configured origin. Other supplied origins are rejected, not merely hidden by CORS. Origin-less native requests are allowed but still require capabilities where applicable.
- Body limit: 8 KiB. Pairing sessions: at most 1,000 by default. Display names: 80 characters. Unknown fields and malformed IDs are rejected.
- Limits per direct client IP: 120 total requests/minute and 10 session creations/minute. Rate-limit buckets are bounded to 10,000 IPs and pruned alongside expired sessions every 30 seconds. Limits are per process; proxy headers are not trusted. Behind a proxy, clients may share one bucket until trusted proxy/rate-limit infrastructure is explicitly configured.
- Cleanup timers are stopped and all state discarded on server close. Restarting revokes every session. Run a single backend instance for this version. Multiple replicas require a deliberately designed shared, expiring control-state store and distributed limits; a permanent expense database is not required.
- Responses are `Cache-Control: no-store`. Automatic request logging is disabled; expected failures do not log bodies, credentials or QR payloads. Do not enable proxy body/query logging of these routes.
- The frontend/phone must stop polling and clear in-memory tokens on 401/404, handle 409 state conflicts, honor 429 `Retry-After`, and prompt to pair again when the session expires.

## Configuration

`PAIRING_TTL_SECONDS` defaults to `120`, `LINKED_TTL_SECONDS` to `28800`, `PRESENCE_TTL_SECONDS` to `45`, and `MAX_PAIRING_SESSIONS` to `1000`. Validation bounds are defined in `backend/src/config/env.ts`.

Run the backend from `webapp` with `bun run dev:backend`. Run `bun run test` for request-injection tests covering the handshake, roles, replay, stale presence, expiration, revocation, restart, payload rejection, origin checks and capacity/rate limits. No real financial data or live phone connection is used by these tests.
