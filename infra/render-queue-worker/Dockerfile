# Build from the monorepo root: docker build -f infra/render-queue-worker/Dockerfile .
# The worker is a plain long-running Node process (no native rendering
# happens here); it only reads the PGMQ render_jobs queue and POSTs a
# dispatch request to the export-renderer Cloud Run service.
#
# Multi-stage: the builder stage does a full workspace install (large, never
# shipped), then `pnpm deploy --prod` prunes that down to just @motionvideo/web
# plus its production workspace/external dependencies, materialized as a
# standalone npm-compatible package (no devDependencies: eslint, vitest,
# playwright, etc. never reach the runtime image).
FROM node:22-bookworm-slim AS builder

WORKDIR /workspace
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @motionvideo/web deploy --prod --legacy /app

FROM node:22-bookworm-slim

WORKDIR /app
COPY --from=builder /app .
# tsx and @next/env are devDependencies (stripped by --prod above), but this
# script has no build step and imports both directly, so they're real
# runtime needs despite the package.json classification. Installed via a
# scratch prefix, not `npm install` in /app, because /app's deployed
# package.json still has pnpm "workspace:*" specifiers npm can't parse.
RUN npm install -g tsx@4.23.1 \
  && npm install --prefix /tmp/extra @next/env@15.5.20 \
  && mkdir -p node_modules/@next \
  && cp -r /tmp/extra/node_modules/@next/env node_modules/@next/env \
  && rm -rf /tmp/extra

ENV NODE_ENV=production

CMD ["npm", "run", "render:queue-worker"]
