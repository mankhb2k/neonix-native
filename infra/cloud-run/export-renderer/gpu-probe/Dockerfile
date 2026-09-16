FROM nvidia/cuda:13.0.1-base-ubuntu22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends libvulkan1 vulkan-tools libxext6 libegl1 mesa-utils-extra binutils \
  && rm -rf /var/lib/apt/lists/*

COPY probe.sh /usr/local/bin/neonix-gpu-probe
RUN chmod 0755 /usr/local/bin/neonix-gpu-probe

ENTRYPOINT ["/usr/local/bin/neonix-gpu-probe"]
