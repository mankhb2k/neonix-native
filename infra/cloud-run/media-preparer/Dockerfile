FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=8080
ENV MEDIA_PREPARER_REQUEST_TIMEOUT_MS=3600000
ENV TMPDIR=/tmp/neonix-media

EXPOSE 8080
CMD ["pnpm", "--dir", "infra/cloud-run/media-preparer", "start"]
