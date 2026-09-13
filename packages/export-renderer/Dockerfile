FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV EXPORT_RENDERER_PORT=8787
ENV EXPORT_RENDERER_OUTPUT_ROOT=/app/tmp/export-renderer
ENV EXPORT_RENDERER_ASSET_ROOT=/app/apps/web/public
EXPOSE 8787
CMD ["pnpm", "--filter", "@motionvideo/export-renderer", "start"]
