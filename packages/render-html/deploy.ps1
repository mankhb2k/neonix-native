[CmdletBinding()]
param(
  [string]$ProjectId,
  [string]$Region = "asia-southeast1",
  [string]$Repository = "neonix",
  [string]$ImageName = "render-html",
  [string]$Dockerfile = "packages/render-html/Dockerfile",
  [string]$ServiceName = "neonix-render-html",
  [string]$GitSha,
  [switch]$Deploy,
  [string]$RuntimeServiceAccount,
  [string]$InternalWorkerTokenSecret
)

$ErrorActionPreference = "Continue"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
$gcloudCommand = if ($env:OS -eq "Windows_NT" -and (Get-Command gcloud.cmd -ErrorAction SilentlyContinue)) { "gcloud.cmd" } else { "gcloud" }

if (-not $ProjectId) { $ProjectId = (& $gcloudCommand config get-value project 2>&1).Trim() }
if (-not $ProjectId -or $ProjectId -eq "(unset)") { throw "ProjectId is required" }
if (-not $GitSha) { $GitSha = (git rev-parse --short=12 HEAD).Trim() }
if (-not $GitSha) { throw "Unable to determine git SHA" }

$registryHost = "$Region-docker.pkg.dev"
$image = "$registryHost/$ProjectId/$Repository/$ImageName"
$taggedImage = "$image`:$GitSha"

Write-Host "Using project=$ProjectId region=$Region image=$taggedImage"
& $gcloudCommand config set project $ProjectId 2>&1 | Out-Host
& $gcloudCommand services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=$ProjectId 2>&1 | Out-Host

$null = & $gcloudCommand artifacts repositories describe $Repository --location=$Region --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
  & $gcloudCommand artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description="Neonix production images" `
    --project=$ProjectId 2>&1 | Out-Host
}

& $gcloudCommand auth configure-docker $registryHost --quiet 2>&1 | Out-Host
docker build --platform linux/amd64 -f $Dockerfile -t $taggedImage .
docker push $taggedImage

$digest = (& $gcloudCommand artifacts docker images describe $taggedImage --format="value(image_summary.digest)" --project=$ProjectId 2>&1 | Where-Object { $_ -match "^sha256:" } | Select-Object -First 1).Trim()
if (-not $digest -or -not $digest.StartsWith("sha256:")) { throw "Artifact Registry did not return an image digest" }
$immutableImage = "$image@$digest"
Write-Host "Immutable image: $immutableImage"

if (-not $Deploy) {
  Write-Host "Build/publish complete. Re-run with -Deploy after configuring runtime secrets."
  exit 0
}

if (-not $RuntimeServiceAccount) { throw "RuntimeServiceAccount is required with -Deploy" }
if (-not $InternalWorkerTokenSecret) { throw "InternalWorkerTokenSecret is required with -Deploy" }

# Frame-by-frame headless-Chromium rendering is CPU/memory heavy and can take
# several minutes for a single clip (see render_neonix_video.py's benchmark
# notes) -- cpu/memory/timeout here are starting points, tune against a real
# render of your typical clip length before relying on this in production.
& $gcloudCommand run deploy $ServiceName `
  --image=$immutableImage `
  --region=$Region `
  --platform=managed `
  --allow-unauthenticated `
  --service-account=$RuntimeServiceAccount `
  --cpu=4 `
  --memory=4Gi `
  --concurrency=1 `
  --timeout=3540s `
  --max=4 `
  --set-env-vars="IMAGE_DIGEST=$digest,GIT_SHA=$GitSha" `
  --set-secrets="INTERNAL_WORKER_TOKEN=$InternalWorkerTokenSecret`:latest" `
  --project=$ProjectId 2>&1 | Out-Host

Write-Host "Deployed Service=$ServiceName using $immutableImage"
Write-Host "Point apps/web's HTML render dispatch (apps/web/lib/server/render/html-render-worker.ts) at this service's URL once it's wired to call it over HTTP instead of a local subprocess."
