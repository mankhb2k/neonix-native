# Pinned tag, never :latest - the Playwright (pip) version below must match this
# image's bundled Chromium build exactly, same rule as infra/cloud-run/layout-probe's
# Node image. Bump both together, deliberately.
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/render-html/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/render-html/render_neonix_video.py packages/render-html/server.py ./

ENV PORT=8080
ENV TMPDIR=/tmp/neonix-render-html
RUN mkdir -p "$TMPDIR"

EXPOSE 8080
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
