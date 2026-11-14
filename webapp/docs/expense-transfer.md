> Legacy v1 reference. Current all-dataset transfer, chunking, receipt files and web views are documented in [workspace-transfer.md](workspace-transfer.md).

# Personal expense transfer (v1)

This version sends complete personal-expense snapshots from the unlocked, foreground mobile app to its linked browser. It does not send browser edits to the phone. Company expenses, attachments, fuel details and other modules are excluded. Phone-origin records are read-only on web; existing browser-created records and their outbox are preserved.

## Try it

Restart the backend and frontend after updating the code, reload the mobile bundle, disconnect the old link and scan a fresh QR. New QR codes contain a browser-generated transfer key that old links do not have. Compare the verification codes and approve on the phone; the browser connects automatically. Keep the phone unlocked and the browser visible. Initial transfer starts with the next phone heartbeat; changes are checked about every 20 seconds. Unchanged snapshots are resent every minute to recover from relay expiry or interrupted delivery.

Open web Expenses to see the records; Connection reports import status. Add/edit/delete a personal expense on the phone and wait for the next snapshot. Check that paise and dates match. Browser records should remain unchanged. With “Remember this browser” enabled, refresh restores the link after server verification; imports remain in IndexedDB after disconnect. The saved link expires with the server session and is invalidated by a backend restart.

## Transport and security

The browser generates 32 random bytes using Web Crypto and puts their hex encoding in `syncKey` in the locally rendered QR only. The claim request deliberately sends only the claim token and phone identity; the encryption key never goes to the backend. The phone stores it with the link in SecureStore. Browser credentials and key remain in memory when remembering is disabled. When enabled, they are saved in browser local storage until disconnect, revocation, expiry or opt-out. This storage is not encrypted at rest.

AES-256-GCM uses a fresh 12-byte nonce, 16-byte tag and authenticated context `expense-transfer-v1:<sessionId>:<sequence>:phone-to-browser`. Expo Crypto's combined wire representation is base64(IV + ciphertext + tag), interoperable with browser Web Crypto. Never log QR values or keys. Trust depends on the browser code/QR and the approved phone; browser storage is not encrypted at rest by this feature.

POST `/api/v1/pairing/:id/transfer` accepts `{sequence,ciphertext}` only from the linked phone. GET at the same path is browser-only. POST `/transfer/ack` accepts `{sequence}` only from that browser. Tokens use the existing bearer credentials, and the existing HTTPS/origin restrictions remain. One replaceable encrypted snapshot is retained per session with a 120-second delivery expiry (periodic memory cleanup runs every 30 seconds), with 750,000 base64 characters per snapshot and 8,000,000 aggregate characters per process. Restart, expiry and revocation clear ciphertext. No financial database is added to the relay.

The mobile snapshot is read with one SQL statement for consistency. Payloads contain original expense UUIDs, integer paise and categories. A snapshot is limited to 3,000 expenses, 3,000 categories and 550,000 UTF-8 bytes. Oversized or invalid snapshots fail without a partial import. Import categories have an explicit device-prefixed mapping. Expense UUID collisions with browser/other-phone records abort the entire transaction. Only rows owned by that phone may be updated or marked deleted; missing rows in a complete validated snapshot are deletion markers. No browser outbox entries are drained.

The browser commits expenses, categories, deletion markers and the applied sequence atomically before acknowledging. Replayed/older sequences in the same session are ignored. AAD prevents moving ciphertext between sessions or changing its sequence. Delivery can be repeated safely; the sender never treats relay acceptance as proof of a browser commit. A phone-only GET `/transfer/status` returns the latest and acknowledged sequences; only after the browser commits and acknowledges does mobile show “Last transfer imported by browser.”

## Verification

Automated coverage includes API role authorization before/after approval and revocation, Node AES-GCM to browser Web Crypto interoperability, tampering/wrong key/context rejection, full relay → decrypt → IndexedDB import → acknowledgement, repeat/stale delivery, queue expiry/replacement, size validation, transactional collision rejection, read-only enforcement, and phone edits/deletions/restore. Mobile SQL is exercised against SQLite with Unicode, null values and integer paise.

A physical device check of Expo native AES and camera/network operation is still required. Tests do not substitute for that check. Two-way synchronization needs a durable mobile outbox, tombstones and explicit conflict rules; it is not enabled by this version.

## Backend logs

Run `bun run dev:backend` from `webapp`. The default `LOG_LEVEL=info` prints structured console logs for QR creation, phone claim/approval, completed link, encrypted upload, first delivery, browser import acknowledgement (including personal expense count), revocation and expiry. Repeated identical empty polling results are suppressed.

For every request's route, status, request ID and elapsed time, run `LOG_LEVEL=debug bun run dev:backend`. Request rejections log at warn/error even at the default level. Logs exclude credential values, comparison codes, encryption keys, ciphertext, device labels and expense contents. Session IDs correlate stages but do not authorize requests.

| Event | Meaning / next check |
| --- | --- |
| `phone_approved` without `browser_linked` | Browser has not completed the automatic handshake. |
| `transfer_queue_empty`, reason `not_uploaded` | No phone snapshot has reached this session. Check the phone is unlocked, foregrounded and paired to this backend. |
| `transfer_uploaded` | Relay accepted encrypted bytes. |
| `transfer_delivered` | Relay returned the encrypted snapshot to the browser; import is not yet proven. |
| `browser_import_acknowledged` | Browser reported a completed local transaction. Check `expenseCount`, then open web Personal Expenses for all dates. |
| `transfer_queue_empty`, reason `already_imported` | Normal: the acknowledged payload was removed; `envelope: null` is expected. |
| `transfer_expired` / reason `expired_waiting_for_retry` | Browser did not acknowledge before the relay TTL. Check browser Connection status and retry with both devices open. |
| `request_failed` | Inspect the safe error code, route and status; do not paste credentials. |

The mobile receipt and web Connection screen now show a personal record count. Empty snapshots explicitly report zero rather than implying that company data transferred. The overview is a current-month view; Personal Expenses shows all dates.
