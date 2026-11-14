# Web workspace instructions

This is the separate React/Vite frontend and Node/Fastify backend. The Expo application lives at the repository root. Use Bun here; do not install web packages into the mobile app. Use React Router for web routes.

- Keep frontend, backend, and shared package boundaries described in README.md. Shared code must remain platform-neutral.
- Components render UI; hooks subscribe; repositories validate and transact local data.
- Store money as integer paise. Never change UUID identities when editing.
- Commit record changes and outbox entries in the same transaction. Preserve deletion markers.
- No QR pairing, phone presence, encryption, or synced status should be shown as working until implemented and tested end to end.
- Never send financial data to the relay before authenticated end-to-end encryption is implemented.
- No dependency on a permanent cloud expense database. Keep pairing state and relay messages bounded and temporary.
- Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` from this directory. Clearly report checks blocked by missing dependencies.
- Keep mobile checks separate. Do not regenerate Android/iOS while working on web-only code.
