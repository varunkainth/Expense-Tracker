# Expense Tracker · Web workspace

## Workspace transfer

Encrypted phone-to-browser transfer covers all 22 datasets: company records and receipts, personal expenses, split groups, fuel, budgets, recurring items, subscriptions, investments and preferences. The web navigation opens searchable read-only views, calculations, monthly Excel claim workbooks, attendance print/PDF forms, combined receipt PDFs, CSV exports and encrypted phone-data copies. See [workspace-transfer.md](docs/workspace-transfer.md) for setup, limits and verification. Browser-origin changes are not sent to the phone.

An independent Bun workspace alongside the existing Expo mobile app. The mobile app remains at the repository root. Frontend and backend have separate entry points, configuration, dependencies, and deployment targets.

## First-open flow

Opening or reloading the app shows phone pairing first, including direct dashboard URLs. The web client creates a temporary backend challenge and renders its QR, polls for a scan/phone approval, and connects automatically after you compare the matching code and approve on the phone. Only a server-confirmed link opens the workspace. The optional **Use browser only** action keeps separate browser-local records and never marks a phone as paired. A lost/revoked session returns a paired workspace to the entry screen; existing IndexedDB records are preserved.

With “Remember this browser” enabled, the confirmed browser credentials and transfer key are saved in local storage and verified with the backend on refresh. Turn it off on the Connection page to use a session-only link. Disconnect, revocation or expiry removes the saved link; a backend restart still requires pairing again. Phone credentials are held in SecureStore. After pairing, the complete allowlisted workspace transfers from phone to browser while both devices stay open; browser-origin edits are not sent to the phone. The implementation requires the camera package and configured backend below; live camera/device verification remains to be done.

## Current scope

- React dashboard and expense list with browser-local add, edit, delete, and search.
- Grouped navigation for all mobile feature areas, company and settings hubs, and read-only views for every transferred dataset.
- Light, dark, and system themes, saved in browser preferences and available from the header and Appearance page.
- IndexedDB through Dexie, with a transactional pending-change queue and deletion markers.
- Shared TypeScript domain validation and integer-paise money helpers.
- Fastify pairing API with single-use challenges, phone approval, browser confirmation, revocation and authenticated heartbeat presence. Sessions live only in bounded memory. A bounded in-memory relay accepts authenticated encrypted workspace chunks, without a financial server database.
- Connection page reports authenticated heartbeat-based phone availability and can revoke the link. A disconnected app is not proof that the phone lacks internet.

Two-way synchronization, browser editing of phone-owned records, background delivery and installable/offline-loaded PWA support are **not implemented**. Phone data uses encrypted one-way snapshots and remains read-only in the browser. Receipt downloads, fuel history, exports and encrypted web phone-data copies are implemented. Records persist locally, but an initial page load still needs the frontend server. The outbox contracts remain a draft for future two-way synchronization. No demonstration expenses are seeded.

## Setup

Use Bun 1.4+ and Node 22.12+ (or a newer Node version supported by the installed Vite release).

From this directory:

```bash
bun install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
bun run dev:frontend
```

In a second terminal, from this directory:

```bash
bun run dev:backend
```

Open http://localhost:5173. The health route is http://localhost:3001/api/v1/health. Vite requires port 5173 so the default CORS origin stays consistent. Development accepts `localhost`, `127.0.0.1` and IPv6 loopback aliases on the configured protocol and port. They still have separate browser storage: keep using one address for your saved records. Production startup sets `NODE_ENV=production` and accepts only the exact `WEB_ORIGIN`. Backend `.env` is loaded by Bun with the backend as the working directory. Values starting with `VITE_` are public; never put secrets there.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

The workspace owns one `bun.lock` after installation. Do not create npm/yarn lockfiles. Its dependencies are installed independently of the Expo app; use `bun install` here, not `expo install`. Expo dependency rules still apply at the mobile root.

## Folder ownership

| Folder | Responsibility |
| --- | --- |
| `frontend/src/app` | Application startup, browser routes and the single navigation registry |
| `frontend/src/components/layout` | Navigation and workspace layout |
| `frontend/src/components/ui` | Reusable presentation components |
| `frontend/src/features/<feature>/pages` | Route-level screens |
| `frontend/src/features/<feature>/components` | Feature-specific UI |
| `frontend/src/features/<feature>/hooks` | React data subscriptions |
| `frontend/src/features/<feature>/data` | Local repositories and transactions |
| `frontend/src/features/<feature>/api` | Remote requests, kept separate from local data |
| `frontend/src/lib/database` | IndexedDB schema, initialization and migrations |
| `frontend/src/lib` | Browser-specific helpers |
| `frontend/src/styles` | Semantic light/dark tokens, base styles and responsive layouts |
| `backend/src/config` | Validated environment settings |
| `backend/src/modules/<module>` | Feature endpoints; add services beside routes as behavior grows |
| `backend/src/app.ts` | App construction without opening a port |
| `backend/src/server.ts` | Listening and shutdown |
| `packages/shared/src/domain` | Runtime schemas and inferred domain types |
| `packages/shared/src/money` | Platform-neutral money helpers |
| `packages/shared/src/sync` | Versioned transport contracts |
| `docs` | Architecture and implementation sequence |

Use `@expense-tracker/shared` for cross-package imports. Frontend must never import backend code; backend must never import browser code. Shared code must not import React, Dexie, Fastify, or Expo. Prefer direct file imports inside features and keep the shared public exports in `src/index.ts`. Add folders when they have a purpose, rather than accumulating empty controllers/services/utils directories.

All UI writes go through repositories. A local record and its queue entry must commit or roll back together. The queue must not be cleared until an authenticated remote peer acknowledges durable application. It is not drained in this version. Store money in integer paise, never floating-point rupees. Mobile DTO field names are preserved to ease future adapters; imported phone categories use an explicit device-prefixed mapping to preserve browser categories.

## Deployment boundaries

The frontend builds to `frontend/dist` and needs SPA fallback to `index.html` for nested URLs. Serve over HTTPS. The backend builds to `backend/dist/server.js`, starts with Node, and will need a long-running WebSocket-capable host when relay transport is implemented. Install workspace dependencies for the backend runtime (`fastify`, `@fastify/cors`, `zod`); the shared source is bundled into the server build.

The root `.easignore` excludes this workspace from Android/iOS uploads. Mobile TypeScript and lint configuration also exclude it. This workspace has no hosting registration or deployment.

IndexedDB is per-browser/profile/origin and can be cleared. Do not use real financial records as the only copy while backup and sync are unfinished. Browser storage is not encrypted at rest. Workspace transport uses AES-256-GCM with a key exchanged through the QR only.

## Pairing backend

See [`docs/pairing-api.md`](docs/pairing-api.md) for endpoints, credentials, timeouts and the handshake. The website and mobile scanner now share a platform-neutral client and are wired to perform this handshake; hardware camera/network verification requires a fresh native build. Encrypted one-way transfer is documented in [workspace-transfer.md](docs/workspace-transfer.md).

## Installing pairing dependencies

From the mobile repository root:

```bash
bunx expo install expo-camera
```

From `webapp`:

```bash
bun install
```

The frontend uses `toqr`, a small local QR encoder, with an SVG renderer. It never sends QR contents to an external image service. Dependency downloads may require running these commands outside the restricted agent environment. Regenerate/rebuild the mobile development app after installing the new native camera module. Existing APKs do not gain the scanner through a JavaScript refresh.

In mobile Settings → **Linked Browser**, configure the trusted server origin (or set `EXPO_PUBLIC_PAIRING_URL` before bundling), scan the browser QR, compare the code and approve. After phone approval, the browser finishes connecting automatically. Production clients require HTTPS. For development only, `HOST=0.0.0.0` lets a physical phone reach the backend at your computer’s LAN IP; set `WEB_ORIGIN` to the actual browser origin. Development clients allow HTTP for this local workflow; production APKs do not. Neither the backend address nor phone credentials are taken from the QR.

The shared HTTP implementation lives in the repository-level `packages/pairing-protocol`, outside this web workspace so mobile builds can include it. Keep that source present when building the web workspace. Only bounded, temporary encrypted financial payloads are stored on the relay; keys and plaintext remain on the devices.
