# Standalone correctness sandbox. It deliberately does not build Skia: the
# test compares the exact RGBA->YUV contract independently from render cost.
FROM ubuntu:22.04 AS build

ARG DEBIAN_FRONTEND=noninteractive
ARG LIBYUV_REV=2dd4257364d39c38d79465c4ddc4b93137fe729b

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates cmake git libavutil-dev libswscale-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --filter=blob:none --no-tags https://chromium.googlesource.com/libyuv/libyuv.git /opt/libyuv \
  && cd /opt/libyuv \
  && git checkout "${LIBYUV_REV}" \
  && cmake -S . -B out -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/libyuv-install -DBUILD_SHARED_LIBS=OFF \
  && cmake --build out --config Release --parallel 8 \
  && cmake --build out --target install --config Release \
  && git rev-parse HEAD > /opt/libyuv-install/REVISION

COPY infra/cloud-run/export-renderer/skia-gpu-poc/neonix_libyuv_color_ab_test.cpp /tmp/neonix_libyuv_color_ab_test.cpp
RUN g++ -std=c++17 -O3 -DNDEBUG \
    -I/opt/libyuv-install/include \
    /tmp/neonix_libyuv_color_ab_test.cpp \
    -L/opt/libyuv-install/lib -Wl,-Bstatic -lyuv -Wl,-Bdynamic \
    $(pkg-config --cflags libswscale libavutil) \
    -lswscale -lavutil \
    -lpthread -lm -o /usr/local/bin/neonix-libyuv-color-ab-test

FROM ubuntu:22.04
RUN apt-get update && apt-get install -y --no-install-recommends \
    libavutil56 libswscale5 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/neonix-libyuv-color-ab-test /usr/local/bin/neonix-libyuv-color-ab-test
COPY --from=build /opt/libyuv-install/REVISION /usr/share/neonix/libyuv-revision
ENTRYPOINT ["/usr/local/bin/neonix-libyuv-color-ab-test"]
