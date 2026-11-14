# Full phone workspace transfer

The v2 snapshot transfers all 22 schema-13 datasets from the foreground, unlocked phone to the linked browser. Browser-origin records remain separate. Phone records are read-only on web; there are no browser-to-phone writes or automatic conflict merges.

## Included

| Area | Data and web tools |
| --- | --- |
| Company | Employee profiles; local/outstation/tour conveyance, hotel, phone, miscellaneous and daily allowance; employee/month filters, row details, totals and CSV |
| Receipts | PDF/JPEG bytes and metadata; download from the corresponding company row’s details |
| Personal | Categories, subcategories and personal expenses; existing searchable all-date expense list |
| Split | Groups, people and expenses; per-expense equal shares and whole-rupee settlement suggestions matching the phone |
| Fuel | Vehicles, refills, linked expense identity; distance and estimated mileage using the previous refill’s litres |
| Planning | Recurring expenses, subscriptions, active SIP/one-time plans, contributions and upcoming dues |
| Insights | Personal monthly history and current-month category spending; no double-counting of linked fuel rows |
| Budgets | Monthly/category preferences and remaining/over-budget figures for each phone |
| Reminders | Phone reminder configuration and due-item inbox; background notifications remain on the phone |
| Preferences | Appearance choice and allowance rates, retained as phone data without changing the browser’s own theme |
| Export/backup | Per-table CSV and password-encrypted phone-data copy with receipt bytes; validated transactional restore |

PINs, biometrics, authentication credentials, permission state and private device file paths are excluded. Browser Security manages remembered access; it does not duplicate the phone’s lock. Exports/backup here cover received phone data. Browser-created personal expenses can be exported from their own list. The web copy format is explicitly separate from native mobile backups.

## Update and try

Update/reload both mobile and frontend code, restart the backend and pair again if the restart invalidated the session. No new native dependency is added. Keep the phone unlocked and the browser visible until the counts confirm the entire workspace was imported. A session includes its remembered transfer key; remembering a browser does not preserve the in-memory backend across server restarts.

Open Company Expenses, choose a category and expand a row’s Details for receipts. Other navigation items now open data views rather than coming-next placeholders. All-date lists, month filters, search, pagination and CSV work from imported IndexedDB data, even when the phone subsequently goes offline. Initial page loading still requires the frontend; no service worker is claimed.

## Protocol

The phone reads all allowlisted columns with one SQLite JSON statement. Only allowlisted non-security preferences are selected. It then reads receipt files from its own attachment directory, removes local storage names, and adds file bytes and SHA-256 checksums.

A workspace is limited to 3,000 rows per table, 20,000 total records, and 16 MiB UTF-8 snapshot data. Receipt files support 8 MiB each and 11 MiB combined (base64 expands the workspace). Missing or individual oversized files have explicit availability markers; the UI does not invent download links. A copy exceeding the combined limit fails visibly and leaves prior data intact.

The JSON snapshot is divided into 300,000-byte segments. Each segment carries a snapshot UUID, zero-based part, part count and full-workspace SHA-256 digest, and is encrypted with a fresh AES-256-GCM nonce under the established QR-only key. Existing session/sequence/direction authenticated data and 750,000-character relay limits stay in place. The relay still holds one replaceable ciphertext per session, never the full plaintext workspace, with its existing temporary TTL and aggregate memory bound.

The browser durably stages a chunk before acknowledging it. Intermediate `importInfo.completed=false` acknowledgements do not claim imported records. The phone sends the next chunk only after that receipt, reusing exactly the same encrypted envelope for retries. Staging survives browser refresh and old partial stages expire after ten minutes. A restarted mobile bundle can start a fresh snapshot without exposing a half-import.

After all parts arrive, the browser verifies full and per-receipt hashes, MIME signatures, schema version, fields, IDs, money, dates, relationships and preference allowlists. Personal data, all datasets, receipt blobs, deletion markers and the final cursor commit together. Old phone rows are replaced only for the snapshot’s source device. Browser-local and other-phone data are preserved; a conflicting personal UUID aborts the transaction. Only then is `completed=true` acknowledged with personal/company/record/receipt counts. Completed snapshot IDs and sequence checks deduplicate retry deliveries.

Receipt bytes are stored separately from metadata to keep normal lists small. Downloads use browser Blob URLs; phone `file:///` paths never become links.

## Encrypted web copies

The phone-data backup uses PBKDF2-HMAC-SHA256 (600,000 iterations, random 16-byte salt) and AES-256-GCM (random 12-byte IV and format-bound authenticated data). A password of at least ten characters is required. The password/key never reaches the relay. Up to ten device sources and 32 MiB combined plaintext can be exported per copy. Restore authenticates and validates all sources and files before an atomic transaction; it preserves browser-origin expenses and unrelated phones. An actively connected phone may replace a restored historical copy with its current data, which the restore confirmation explains.

## Verification and limits

Tests exercise every dataset, SQLite column consistency and preference filtering, large multi-chunk encrypted API delivery, staged/atomic application, duplicate/mismatched delivery, source isolation, deletion, receipt integrity, paise-preserving balances and mobile-compatible rounded settlement suggestions, previous-refill mileage, CSV formula escaping, and encrypted backup/restore with wrong-password rejection. Run the web lint, typecheck, test and build scripts, plus mobile lint/typecheck and `bun test tests/expense-snapshot.test.js tests/workspace-snapshot.test.js` at the mobile root.

A physical phone/browser verification of this expanded feature set remains required. This is foreground phone-to-browser replication, not bidirectional editing, background delivery, or a permanent cloud financial database.

## Monthly company exports

Open web Export after the employee profile and company records have arrived. Choose the source employee and reporting month. Excel and receipt exports also support all dates; attendance requires one calendar month.

- **Export Excel (.xlsx)** downloads the styled native claim workbook with `LOCAL CON`, `OUTSTAION`, and `OUTSTAION RELATED OTHER EXP.` sheets. Mobile and web now use the same platform-neutral workbook renderer, including numeric rupee values, borders, totals and blank form rows.
- **Export expense attachments** combines the selected employee’s received PDF and JPEG receipts into one PDF, in expense-date/attachment order. PDF originals keep their pages after a filename cover; images fit an A4 page. Missing, oversized, damaged or encrypted receipts produce an error rather than a silently incomplete claim packet.
- **Preview attendance form** uses the exact shared mobile A4 HTML and day-status logic. Enter Google reviews, service-call TAT, Saturday-off rule, holiday days and absent days. Click **Print / Save attendance PDF**, then choose Save as PDF, A4 portrait, no margins and no browser headers/footers. A sandboxed same-origin preview avoids popup blockers and keeps the form on the local browser.

Month dates use inclusive start/exclusive end. Hotel and daily allowance rows are included when their date range overlaps the selected month, matching mobile; their recorded amounts are not prorated. Employee and source IDs are both filtered so records from different phones never mix. The export reads an IndexedDB snapshot and does not upload report data or file bytes to another service.

The shared templates live in `packages/claim-exports`; native modules remain responsible only for SQLite loading and platform file/print handling. `xlsx-js-style` and `pdf-lib` are explicit frontend dependencies and are loaded only when their export is requested. Tests cover month boundaries/overlaps, source isolation, workbook sheet structure and numeric values, attendance rules/HTML escaping, receipt selection/missing files, PDF page preservation and JPEG output. The full A4 attendance layout has also been visually inspected in the browser.
