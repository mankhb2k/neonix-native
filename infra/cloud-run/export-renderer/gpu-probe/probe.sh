#!/usr/bin/env bash
set -u

started_ns=$(date +%s%N)
gpu_ok=0
vulkan_ok=0
echo "neonix_gpu_probe_version=1"
echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "hostname=$(hostname)"
echo "kernel=$(uname -a)"
echo "ld_library_path=${LD_LIBRARY_PATH:-}"
echo "nvidia_driver_capabilities=${NVIDIA_DRIVER_CAPABILITIES:-unset}"

echo "nvidia_library_inventory="
find /usr/local/nvidia -maxdepth 3 -type f \( -name 'libnvidia*' -o -name 'libGLX*' -o -name 'libEGL*' -o -name 'libvulkan*' -o -name '*icd*.json' \) -print 2>/dev/null | sort | head -120 || true
echo "nvidia_driver_libraries_all="
find /usr/local/nvidia/lib64 -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | sort | head -240 || true
echo "vulkan_icd_inventory="
find /usr/share/vulkan /etc/vulkan /usr/local/nvidia -type f \( -iname '*icd*.json' -o -iname '*nvidia*.json' \) -print 2>/dev/null | sort | head -120 || true
echo "vulkan_linker_inventory="
ldconfig -p 2>/dev/null | grep -E 'libvulkan|libnvidia|libGLX|libEGL' | head -120 || true

if command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia_smi=available"
  if nvidia-smi --query-gpu=name,driver_version,memory.total,compute_cap --format=csv,noheader 2>&1; then
    gpu_ok=1
  fi
else
  echo "nvidia_smi=unavailable"
fi

if [ -e /proc/driver/nvidia/version ]; then
  echo "nvidia_proc_driver=available"
  sed 's/[[:space:]]\+/ /g' /proc/driver/nvidia/version
else
  echo "nvidia_proc_driver=unavailable"
fi

if ls /dev/nvidia* >/dev/null 2>&1; then
  echo "nvidia_devices=$(ls -1 /dev/nvidia* | tr '\n' ' ')"
else
  echo "nvidia_devices=unavailable"
fi

if command -v vulkaninfo >/dev/null 2>&1; then
  echo "vulkaninfo=available"
  if vulkaninfo --summary 2>&1; then
    vulkan_ok=1
  fi
  # Probe only libraries that could plausibly be an NVIDIA Vulkan ICD. A
  # successful vulkaninfo is required; merely finding a driver .so is not a
  # pass. This also catches naming changes in the managed Cloud Run mount.
  nvidia_vulkan_candidates=$(find /usr/local/nvidia/lib64 -maxdepth 1 -type f \( \
    -name 'libGLX_nvidia.so.*' -o \
    -name 'libnvidia-vulkan*.so*' -o \
    -name 'libvulkan_nvidia.so*' -o \
    -name 'libnvidia-vksc*.so*' \) -print 2>/dev/null | sort -V)
  if [ -n "${nvidia_vulkan_candidates:-}" ]; then
    candidate_index=0
    while IFS= read -r nvidia_vulkan_library; do
      [ -n "$nvidia_vulkan_library" ] || continue
      candidate_index=$((candidate_index + 1))
      dynamic_icd="/tmp/neonix-nvidia_icd-${candidate_index}.json"
      printf '{"file_format_version":"1.0.0","ICD":{"library_path":"%s","api_version":"1.3.0"}}\n' \
        "$nvidia_vulkan_library" > "$dynamic_icd"
      echo "vulkan_dynamic_icd=$dynamic_icd"
      echo "vulkan_dynamic_icd_library=$nvidia_vulkan_library"
      if VK_ICD_FILENAMES="$dynamic_icd" vulkaninfo --summary 2>&1; then
        vulkan_ok=1
      fi
    done <<< "$nvidia_vulkan_candidates"
  else
    echo "vulkan_dynamic_icd=unavailable:nvidia_vulkan_candidate_missing"
  fi
  for icd in /usr/local/nvidia/share/vulkan/icd.d/nvidia_icd.json /usr/share/vulkan/icd.d/nvidia_icd.json /etc/vulkan/icd.d/nvidia_icd.json; do
    if [ -f "$icd" ]; then
      echo "vulkaninfo_icd=$icd"
      if VK_ICD_FILENAMES="$icd" vulkaninfo --summary 2>&1; then
        vulkan_ok=1
      fi
    fi
  done
else
  echo "vulkaninfo=unavailable"
fi

if command -v eglinfo >/dev/null 2>&1; then
  echo "eglinfo=available"
  eglinfo --display surfaceless 2>&1 | head -80 || true
else
  echo "eglinfo=unavailable"
fi

if [ -f /usr/local/nvidia/lib64/libvulkan.so.1 ]; then
  echo "cloud_run_vulkan_driver_mount=available"
else
  echo "cloud_run_vulkan_driver_mount=unavailable"
fi

finished_ns=$(date +%s%N)
awk -v start="$started_ns" -v end="$finished_ns" 'BEGIN { printf "probe_duration_ms=%.3f\n", (end-start)/1000000 }'

if [ "$gpu_ok" -ne 1 ]; then
  echo "probe_result=fail:gpu_device_not_available"
  exit 10
fi
if [ "$vulkan_ok" -ne 1 ]; then
  echo "probe_result=fail:vulkan_context_unavailable"
  exit 11
fi
echo "probe_result=pass"
