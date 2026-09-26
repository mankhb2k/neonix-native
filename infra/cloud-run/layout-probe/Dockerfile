# Pinned tag, never :latest - compiled output that used this service's
# measurements gets frozen into project_revisions, so the Chromium build
# behind a measurement must be reproducible across rebuilds.
FROM mcr.microsoft.com/playwright:v1.62.0-jammy

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=8080
ENV LAYOUT_PROBE_REQUEST_TIMEOUT_MS=30000

EXPOSE 8080
CMD ["pnpm", "--dir", "infra/cloud-run/layout-probe", "start"]
