# Cloud Run L4 capacity probe

This image is a P1 capacity smoke only. It verifies that a Cloud Run Job can
see an NVIDIA L4 and Vulkan-related runtime libraries. It does not render a
Neonix frame and must not be used as evidence that native Skia is working.

Build with Cloud Build when Docker Desktop is unavailable:

```powershell
gcloud builds submit infra/cloud-run/export-renderer/gpu-probe `
  --tag asia-southeast1-docker.pkg.dev/neonix-506607/neonix/gpu-probe:probe-3 `
  --project neonix-506607
```

Deploy and execute the isolated job:

```powershell
gcloud run jobs deploy neonix-render-chunk-l4-bench `
  --image asia-southeast1-docker.pkg.dev/neonix-506607/neonix/gpu-probe:probe-3 `
  --region asia-southeast1 `
  --tasks 1 `
  --parallelism 1 `
  --max-retries 0 `
  --task-timeout 300s `
  --cpu 4 `
  --memory 16Gi `
  --gpu 1 `
  --gpu-type nvidia-l4 `
  --no-gpu-zonal-redundancy `
  --project neonix-506607

gcloud run jobs execute neonix-render-chunk-l4-bench `
  --region asia-southeast1 `
  --wait `
  --project neonix-506607
```

Record the execution name, Cloud Run timestamps, full task log, device name,
driver, Vulkan summary and exit code in
`docs/render-benchmark-comprehensive-assessment.md`.
