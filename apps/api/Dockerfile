# Build from the monorepo root: docker build -f apps/api/Dockerfile -t neonix-api .
#
# Multi-stage, same shape as infra/render-queue-worker/Dockerfile: the builder
# does a full workspace install, then `pnpm deploy --prod` prunes to just
# @motionvideo/api plus its production workspace/external dependencies (no
# devDependencies - eslint, vitest, drizzle-kit, tsx - reach the runtime image).
FROM node:22-bookworm-slim AS builder

WORKDIR /workspace
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
# .dockerignore excludes every package's dist/ (avoids copying stale local
# build output), so each workspace dependency that now ships a real dist
# build (see ARCHITECHTURE.md's packaging notes) must be rebuilt here before
# @motionvideo/api's own tsc build can resolve them. render-native's
# contracts subpath uses a non-"build"-named script (build:contracts) so it
# needs its own line; motion-mcp's esbuild step inlines it (and motion-
# compiler), so it must run after.
RUN pnpm --filter @motionvideo/render-native run build:contracts
RUN pnpm --filter "@motionvideo/api..." --if-present run build
RUN pnpm --filter @motionvideo/api deploy --prod --legacy /app

FROM node:22-bookworm-slim

WORKDIR /app
COPY --from=builder /app .
COPY --from=builder /workspace/apps/api/dist ./dist

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/main.js"]
