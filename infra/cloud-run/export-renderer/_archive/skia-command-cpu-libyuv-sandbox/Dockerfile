# Sandbox-only native Skia color-conversion A/B benchmark.
# This image keeps both the libyuv candidate and libswscale fallback. The
# production image is libyuv-only and does not ship the fallback dependency.
FROM ubuntu:22.04 AS skia-build

ARG DEBIAN_FRONTEND=noninteractive
ARG SKIA_REV=00bc6c117cf10d37e02753b014cd5b5df979e67f
ARG LIBYUV_REV=2dd4257364d39c38d79465c4ddc4b93137fe729b

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates clang cmake git libfontconfig1-dev libfreetype6-dev \
    libavcodec-dev libavformat-dev libavutil-dev libglu1-mesa-dev \
    libjpeg-dev libpng-dev libswscale-dev ninja-build python3 \
    python3-pip python-is-python3 unzip wget xz-utils zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

# Ubuntu 22.04 ships an older libyuv package without the explicit matrix API
# and BT.709 constants needed by this correctness experiment. Build the
# pinned upstream revision instead of changing the production image.
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
  && python3 -c "from pathlib import Path; p=Path('DEPS'); skip={'angle2','d3d12allocator','dawn','abseil-cpp','jinja2','markupsafe','webgpu-headers','delaunator-cpp','dng_sdk','egl-registry','emsdk','expat','freetype','harfbuzz','highway','icu','icu4x','imgui','libavif','libgav1','libgrapheme','libjpeg-turbo','libjxl','libpng','libwebp','libyuv','oboe','opengl-registry','partition_alloc','perfetto','piex','swiftshader','vello','vulkan-tools','vulkan-utility-libraries','unicodetools','wuffs','zlib'}; lines=p.read_text().splitlines(); p.write_text('\n'.join(line for line in lines if not any(('third_party/externals/'+name) in line for name in skip))+'\n')" \
  && git config --global http.version HTTP/1.1 \
  && git config --global url.https://github.com/.insteadOf https://skia.googlesource.com/external/github.com/ \
  && for attempt in 1 2 3; do python3 tools/git-sync-deps && exit 0; echo "git-sync-deps retry ${attempt}"; sleep 5; done; exit 1

COPY packages/skia-renderer/native/skia_command_cpu_backend.cpp /opt/skia/neonix/skia_command_cpu_backend.cpp
COPY infra/cloud-run/export-renderer/skia-gpu-poc/neonix_libyuv_color_ab_test.cpp /opt/skia/neonix/neonix_libyuv_color_ab_test.cpp
COPY infra/cloud-run/export-renderer/skia-gpu-poc/neonix_skia_target.gni /tmp/neonix_skia_target.gni
RUN python3 -c "from pathlib import Path; p=Path('/opt/skia/BUILD.gn'); p.write_text(p.read_text() + '\n' + Path('/tmp/neonix_skia_target.gni').read_text())"
RUN gn gen out/Release --args='is_official_build=true skia_use_vulkan=true skia_enable_ganesh=true skia_enable_tools=true skia_use_gl=false skia_use_egl=false skia_use_x11=false skia_use_freetype=false skia_use_fontconfig=false skia_use_harfbuzz=false skia_use_icu=false skia_use_expat=false skia_use_libjpeg_turbo_decode=false skia_use_libjpeg_turbo_encode=false skia_use_libpng_decode=false skia_use_libpng_encode=false skia_use_libwebp_decode=false skia_use_libwebp_encode=false skia_use_perfetto=false skia_use_wuffs=false skia_enable_pdf=false skia_enable_skottie=false skia_use_partition_alloc=false'
RUN ninja -C out/Release neonix_skia_command_cpu_backend neonix_skia_command_cpu_backend_libyuv_sandbox neonix_libyuv_color_ab_test

RUN mkdir -p /opt/ffmpeg-compat \
  && cp -a /opt/libyuv-install/lib/libyuv.so* /opt/ffmpeg-compat/ \
  && ldd /opt/skia/out/Release/neonix_skia_command_cpu_backend_libyuv_sandbox \
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
COPY --from=skia-build /opt/skia/out/Release/neonix_skia_command_cpu_backend_libyuv_sandbox /usr/local/bin/neonix-skia-command-cpu-backend-libyuv-sandbox
COPY --from=skia-build /opt/skia/out/Release/neonix_skia_command_cpu_backend /usr/local/bin/neonix-skia-command-cpu-backend-swscale-sandbox
COPY --from=skia-build /opt/skia/out/Release/neonix_libyuv_color_ab_test /usr/local/bin/neonix-libyuv-color-ab-test
COPY --from=skia-build /opt/ffmpeg-compat /opt/ffmpeg-compat

ENV NODE_ENV=production
ENV NATIVE_SKIA_BINARY=/usr/local/bin/neonix-skia-command-cpu-backend-swscale-sandbox
ENV BENCHMARK_NATIVE_LD_LIBRARY_PATH=/opt/ffmpeg-compat
ENV BENCHMARK_DURATION_SECONDS=60
ENV BENCHMARK_FRAMES=1800
ENV FFMPEG_THREADS=4
ENV BENCHMARK_PROTOCOL_BATCH_FRAMES=1
ENV BENCHMARK_PROTOCOL_TRANSPORT=file
ENV BENCHMARK_MODE=in-process
ENV BENCHMARK_COLOR_CONVERTER=swscale
ENV BENCHMARK_COMPARE_COLOR=false
ENV BENCHMARK_SURFACE_MODE=copy
ENV LIBYUV_REVISION=2dd4257364d39c38d79465c4ddc4b93137fe729b
CMD ["pnpm", "--filter", "@motionvideo/export-renderer", "exec", "tsx", "src/benchmark-native-skia-command-cpu.ts"]
