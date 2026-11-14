# Render hosting

Create one **free Docker web service** from `varunkainth/Expense-Tracker` after publishing the current `webapp/` and root `packages/` directories and `.dockerignore`.

- Root directory: leave blank (repository root)
- Dockerfile: `webapp/Dockerfile`
- Docker build context: `.`
- Health check: `/api/v1/health`
- One instance only: pairing sessions and encrypted relay queue are in memory.
- Environment: `TRUST_PROXY_HOPS=1` for Render's edge proxy. Do not enable this when directly exposing Node to the internet. Verify client IP behavior after deployment.
- `WEB_ORIGIN` defaults to Render's `RENDER_EXTERNAL_URL`. For a custom domain, explicitly set `WEB_ORIGIN` to its exact HTTPS origin without a trailing slash.
- Frontend API requests use the same HTTPS origin. Do not set `VITE_API_URL` for this setup.

Verify `/api/v1/health`, `/`, direct navigation to `/company`, missing asset/API 404s, phone pairing, and encrypted transfer/import before sharing the URL. In the phone app, enter the deployed HTTPS origin as the trusted pairing address.

Free services sleep when idle and can restart. Restarting or deploying loses active pairing sessions and queued transfers; browser-imported data stays in that browser's IndexedDB. A keepalive request cannot guarantee session persistence. Free instance hours are shared with other free services in this workspace, including the existing Telegram bot.

Container builds require internet access to download dependencies. Docker is unavailable in the current development sandbox, so validate the container build on Render before marking deployment successful.
