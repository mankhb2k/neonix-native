# Native Skia command-buffer production worker.
# The final image intentionally contains no CanvasKit usage and uses libyuv
# for the RGBA -> BT.709 limited-range YUV420P conversion. The separate
# skia-command-cpu-libyuv-sandbox image owns the libswscale fallback/A-B path.
FROM ubuntu:22.04 AS skia-build

ARG DEBIAN_FRONTEND=noninteractive
ARG SKIA_REV=00bc6c117cf10d37e02753b014cd5b5df979e67f
ARG LIBYUV_REV=2dd4257364d39c38d79465c4ddc4b93137fe729b

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates clang cmake git libfontconfig1-dev libfreetype6-dev \
    libavcodec-dev libavformat-dev libavutil-dev libglu1-mesa-dev \
    libjpeg-dev libpng-dev ninja-build python3 \
    python3-pip python-is-python3 unzip wget xz-utils zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

# Build the pinned libyuv revision in the builder. It is linked into the
# native binary, so the runtime image does not need a libyuv shared object.
RUN git clone --filter=blob:none --no-tags https://chromium.googlesource.com/libyuv/libyuv.git /opt/libyuv \
  && cd /opt/libyuv \
  && git checkout "${LIBYUV_REV}" \
  && cmake -S . -B out -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/libyuv-install -DBUILD_SHARED_LIBS=OFF \
  && cmake --build out --config Release --parallel 8 \
  && cmake --build out --target install --config Release \
  && git rev-parse HEAD > /opt/libyuv-install/REVISION

RUN git clone --depth 1 https://chromium.googlesource.com/chromium/tools/depot_tools.git /opt/depot_tools \
  && git clone --depth 1 --filter=blob:none --no-tags https://skia.googlesource.com/skia.git /opt/skia \
  && cd /opt/skia && git checkout "${SKIA_REV}"

ENV PATH="/opt/depot_tools:${PATH}"
ENV GIT_SYNC_DEPS_SKIP_EMSDK=1
WORKDIR /opt/skia

RUN /opt/depot_tools/ensure_bootstrap
RUN python3 -c "from pathlib import Path; p=Path('tools/git-sync-deps'); s=p.read_text(); s=s.replace('multithread(git_checkout_to_directory, list_of_arg_lists)', '[(git_checkout_to_directory(*args)) for args in list_of_arg_lists]'); p.write_text(s)" \
  && python3 -c "from pathlib import Path; p=Path('DEPS'); skip={'angle2','d3d12allocator','dawn','abseil-cpp','jinja2','markupsafe','webgpu-headers','delaunator-cpp','dng_sdk','egl-registry','emsdk','expat','freetype','harfbuzz','highway','icu','icu4x','imgui','libavif','libgav1','libgrapheme','libjpeg-turbo','libjxl','libpng','libwebp','libyuv','oboe','opengl-registry','partition_alloc','perfetto','piex','swiftshader','vello','vulkan-tools','vulkan-utility-libraries','unicodetools','wuffs','zlib'}; lines=p.read_text().splitlines(); p.write_text('\\n'.join(line for line in lines if not any(('third_party/externals/'+name) in line for name in skip))+'\\n')" \
  && git config --global http.version HTTP/1.1 \
  && git config --global url.https://github.com/.insteadOf https://skia.googlesource.com/external/github.com/ \
  && for attempt in 1 2 3; do python3 tools/git-sync-deps && exit 0; echo "git-sync-deps retry ${attempt}"; sleep 5; done; exit 1

COPY packages/render-native/native/util.h packages/render-native/native/protocol.h packages/render-native/native/protocol.cpp packages/render-native/native/paint.h packages/render-native/native/paint.cpp packages/render-native/native/effects.h packages/render-native/native/effects.cpp packages/render-native/native/encoder.h packages/render-native/native/encoder.cpp packages/render-native/native/main.cpp /opt/skia/neonix/
COPY infra/cloud-run/export-renderer/skia-command-cpu-bench/neonix_skia_target.gni /tmp/neonix_skia_target.gni
RUN python3 -c "from pathlib import Path; p=Path('/opt/skia/BUILD.gn'); p.write_text(p.read_text() + '\\n' + Path('/tmp/neonix_skia_target.gni').read_text())"
RUN gn gen out/Release --args='is_official_build=true skia_use_vulkan=false skia_enable_ganesh=false skia_enable_tools=true skia_use_gl=false skia_use_egl=false skia_use_x11=false skia_use_freetype=false skia_use_fontconfig=false skia_use_harfbuzz=false skia_use_icu=false skia_use_expat=false skia_use_libjpeg_turbo_decode=false skia_use_libjpeg_turbo_encode=false skia_use_libpng_decode=false skia_use_libpng_encode=false skia_use_libwebp_decode=false skia_use_libwebp_encode=false skia_use_perfetto=false skia_use_wuffs=false skia_enable_pdf=false skia_enable_skottie=false skia_use_partition_alloc=false'
RUN ninja -C out/Release neonix_skia_command_cpu_backend_libyuv

# The native binary is linked against the Ubuntu 22 FFmpeg ABI. Keep the
# exact non-system shared-library closure available to the benchmark runtime;
# the Node/Debian runtime image has a newer FFmpeg ABI.
RUN mkdir -p /opt/ffmpeg-compat \
  && cp -a /opt/libyuv-install/lib/libyuv.so* /opt/ffmpeg-compat/ \
  && ldd /opt/skia/out/Release/neonix_skia_command_cpu_backend_libyuv \
    | awk '/=> \/[^ ]+/ { print $3 } /^\// { print $1 }' \
    | sort -u \
    | while read -r library; do \
        case "$library" in \
          */libc.so*|*/libm.so*|*/libdl.so*|*/libpthread.so*|*/librt.so*|*/libgcc_s.so*|*/libstdc++.so*|*/ld-linux*) ;; \
          *) cp -L "$library" /opt/ffmpeg-compat/ ;; \
        esac; \
      done

# Full workspace install (large, never shipped) then pruned two ways:
# (1) `pnpm deploy --prod` drops every devDependency (tsx, typescript,
#     vitest...) from the deployed node_modules; (2) esbuild bundles each Job
#     entrypoint (first-party TS across the whole workspace, since
#     workspace:* packages point straight at .ts source) into one plain JS
#     file, so cold start never pays for tsx's on-the-fly transpilation.
# Real npm dependencies (sharp, @aws-sdk/*, google-auth-library, zod...) stay
# external — resolved from the deployed node_modules at runtime, not bundled.
FROM node:22-bookworm-slim AS app-builder
WORKDIR /workspace
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @motionvideo/render-worker deploy --prod --legacy /app
# Deploying render-worker (not render-native) here is deliberate: pnpm deploy
# resolves a package's workspace:* dependencies into real node_modules too,
# so deploying the package that depends on render-native (rather than the
# other way around) transitively pulls in everything render-native's other
# entrypoints below need as well - render-job.ts moved to packages/render-
# worker (the Postgres claim/lease/publish orchestration layer);
# render-native itself is pure rendering now, no DB/queue code.
RUN pnpm exec esbuild \
  packages/render-worker/src/render-job.ts \
  --bundle --platform=node --format=esm --outdir=/app/dist \
  --external:@aws-sdk/client-s3 --external:google-auth-library --external:sharp --external:zod --external:pg

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=app-builder /app .
COPY --from=skia-build /opt/skia/out/Release/neonix_skia_command_cpu_backend_libyuv /usr/local/bin/neonix-skia-command-cpu-backend
COPY --from=skia-build /opt/ffmpeg-compat /opt/ffmpeg-compat

ENV NODE_ENV=production
# native-command.ts (packages/render-native) spawns this binary directly over
# stdin/stderr - no intermediate bundled JS process anymore.
ENV NATIVE_SKIA_BINARY=/usr/local/bin/neonix-skia-command-cpu-backend
ENV BENCHMARK_NATIVE_LD_LIBRARY_PATH=/opt/ffmpeg-compat
# This final stage carries no pnpm/tsx (only `pnpm deploy --prod`'s pruned
# node_modules, no devDependencies) - the render Job entrypoint is
# pre-bundled above and invoked as plain `node dist/*.js` at deploy time;
# see deploy.ps1.
CMD ["node", "dist/render-job.js"]
