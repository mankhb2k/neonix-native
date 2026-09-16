# Native Skia command-buffer parity benchmark.
# The final image intentionally contains no CanvasKit usage for the benchmark
# process; CanvasKit remains in the repository for the separate control image.
FROM ubuntu:22.04 AS skia-build

ARG DEBIAN_FRONTEND=noninteractive
ARG SKIA_REV=00bc6c117cf10d37e02753b014cd5b5df979e67f

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates clang git libfontconfig1-dev libfreetype6-dev \
    libavcodec-dev libavformat-dev libavutil-dev libglu1-mesa-dev \
    libjpeg-dev libpng-dev libswscale-dev ninja-build python3 \
    python3-pip python-is-python3 unzip wget xz-utils zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

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

COPY packages/skia-renderer/native/skia_command_cpu_backend.cpp /opt/skia/neonix/skia_command_cpu_backend.cpp
COPY infra/cloud-run/export-renderer/skia-gpu-poc/neonix_skia_target.gni /tmp/neonix_skia_target.gni
RUN python3 -c "from pathlib import Path; p=Path('/opt/skia/BUILD.gn'); p.write_text(p.read_text() + '\\n' + Path('/tmp/neonix_skia_target.gni').read_text())"
RUN gn gen out/Release --args='is_official_build=true skia_use_vulkan=true skia_enable_ganesh=true skia_enable_tools=true skia_use_gl=false skia_use_egl=false skia_use_x11=false skia_use_freetype=false skia_use_fontconfig=false skia_use_harfbuzz=false skia_use_icu=false skia_use_expat=false skia_use_libjpeg_turbo_decode=false skia_use_libjpeg_turbo_encode=false skia_use_libpng_decode=false skia_use_libpng_encode=false skia_use_libwebp_decode=false skia_use_libwebp_encode=false skia_use_perfetto=false skia_use_wuffs=false skia_enable_pdf=false skia_enable_skottie=false skia_use_partition_alloc=false'
RUN ninja -C out/Release neonix_skia_command_cpu_backend

# The native binary is linked against the Ubuntu 22 FFmpeg ABI. Keep the
# exact non-system shared-library closure available to the benchmark runtime;
# the Node/Debian runtime image has a newer FFmpeg ABI.
RUN mkdir -p /opt/ffmpeg-compat \
  && ldd /opt/skia/out/Release/neonix_skia_command_cpu_backend \
    | awk '/=> \/[^ ]+/ { print $3 } /^\// { print $1 }' \
    | sort -u \
    | while read -r library; do \
        case "$library" in \
          */libc.so*|*/libm.so*|*/libdl.so*|*/libpthread.so*|*/librt.so*|*/libgcc_s.so*|*/libstdc++.so*|*/ld-linux*) ;; \
          *) cp -L "$library" /opt/ffmpeg-compat/ ;; \
        esac; \
      done

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
COPY --from=skia-build /opt/skia/out/Release/neonix_skia_command_cpu_backend /usr/local/bin/neonix-skia-command-cpu-backend
COPY --from=skia-build /opt/ffmpeg-compat /opt/ffmpeg-compat

ENV NODE_ENV=production
ENV BENCHMARK_NATIVE_LD_LIBRARY_PATH=/opt/ffmpeg-compat
ENV BENCHMARK_DURATION_SECONDS=60
ENV BENCHMARK_FRAMES=1800
ENV FFMPEG_THREADS=1
ENV BENCHMARK_PROTOCOL_BATCH_FRAMES=1
ENV BENCHMARK_PROTOCOL_TRANSPORT=pipe
CMD ["pnpm", "--filter", "@motionvideo/export-renderer", "exec", "tsx", "src/benchmark-native-skia-command-cpu.ts"]
