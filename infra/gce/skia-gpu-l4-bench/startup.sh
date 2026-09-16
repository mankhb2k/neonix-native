#!/usr/bin/env bash
set -Eeuo pipefail

STATE_DIR=/var/lib/neonix-skia-l4
mkdir -p "${STATE_DIR}"
exec > >(tee -a "${STATE_DIR}/startup.log") 2>&1

echo "neonix_gce_l4_bootstrap_started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ! -f "${STATE_DIR}/driver-ready" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl python3
  installer_dir=/opt/google/cuda-installer
  mkdir -p "${installer_dir}"
  curl -fSsL https://storage.googleapis.com/compute-gpu-installation-us/installer/latest/cuda_installer.pyz \
    -o "${installer_dir}/cuda_installer.pyz"
  set +e
  python3 "${installer_dir}/cuda_installer.pyz" install_driver \
    --installation-mode=repo --installation-branch=prod
  installer_status=$?
  set -e
  if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
    touch "${STATE_DIR}/driver-ready"
    echo "neonix_gce_driver_install=complete,status=${installer_status}"
  else
    echo "neonix_gce_driver_install=pending,status=${installer_status}"
    reboot
    exit 0
  fi
fi

if [[ ! -f "${STATE_DIR}/docker-ready" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends docker.io gnupg2 ca-certificates curl

  distribution=$(. /etc/os-release; echo "${ID}${VERSION_ID}")
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /etc/apt/keyrings/nvidia-container-toolkit.gpg
  curl -fsSL "https://nvidia.github.io/libnvidia-container/${distribution}/libnvidia-container.list" \
    | sed 's#deb https://#deb [signed-by=/etc/apt/keyrings/nvidia-container-toolkit.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update
  apt-get install -y --no-install-recommends nvidia-container-toolkit vulkan-tools libvulkan1
  nvidia-ctk runtime configure --runtime=docker
  systemctl enable --now docker
  systemctl restart docker
  touch "${STATE_DIR}/docker-ready"
  echo "neonix_gce_docker_toolkit=complete"
fi

echo "neonix_gce_l4_bootstrap_complete=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
