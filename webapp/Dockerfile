FROM oven/bun:1.4.1 AS bun
FROM node:22-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app/webapp
COPY webapp/package.json webapp/bun.lock ./
COPY webapp/frontend/package.json frontend/package.json
COPY webapp/backend/package.json backend/package.json
COPY webapp/packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile
COPY webapp/ ./
COPY packages/ /app/packages/
RUN ln -s /app/webapp/frontend/node_modules /app/node_modules
RUN bun run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 FRONTEND_DIST=/app/webapp/frontend/dist
WORKDIR /app/webapp/backend
COPY --from=build --chown=node:node /app/webapp /app/webapp
USER node
EXPOSE 10000
CMD ["node", "dist/server.js"]
