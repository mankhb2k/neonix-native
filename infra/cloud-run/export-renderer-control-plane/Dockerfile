FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
CMD ["pnpm", "--dir", "infra/cloud-run/export-renderer-control-plane", "start"]
