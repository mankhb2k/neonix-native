FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV BENCHMARK_DURATION_SECONDS=60
ENV BENCHMARK_FRAMES=1800
CMD ["pnpm", "--filter", "@motionvideo/export-renderer", "exec", "tsx", "src/benchmark-canvaskit-cpu.ts"]
