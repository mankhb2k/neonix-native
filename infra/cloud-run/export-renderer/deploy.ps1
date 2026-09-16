[CmdletBinding()]
param(
  [string]$ProjectId,
  [string]$Region = "asia-southeast1",
  [string]$Repository = "neonix",
  [string]$ImageName = "export-renderer",
  [string]$ServiceName = "neonix-export-renderer",
  [string]$JobName = "neonix-render-job",
  [string]$ChunkJobName = "neonix-render-chunk-job",
  [string]$FinalizerJobName = "neonix-render-finalizer-job",
  [int]$ChunkTaskCapacity = 8,
  [int]$ChunkParallelism = 4,
  [string]$GitSha,
  [switch]$Deploy,
  [string]$RuntimeServiceAccount,
  [string]$SupabaseUrlSecret,
  [string]$SupabaseServiceRoleSecret,
  [string]$R2AccountIdSecret,
  [string]$R2AccessKeySecret,
  [string]$R2SecretKeySecret,
  [string]$InternalWorkerTokenSecret,
  [string]$R2ExportsBucket = "neonix-user-exports",
  [string]$R2AssetsBucket = "neonix-user-assets"
)

$ErrorActionPreference = "Continue"
$maxProductionChunkParallelism = 4
if ($ChunkTaskCapacity -lt 1) { throw "ChunkTaskCapacity must be at least 1" }
if ($ChunkParallelism -lt 1 -or $ChunkParallelism -gt $maxProductionChunkParallelism) {
  throw "ChunkParallelism must be between 1 and $maxProductionChunkParallelism for production"
}
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\..\.."))
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
docker build --platform linux/amd64 -f packages/export-renderer/Dockerfile -t $taggedImage .
docker push $taggedImage

$digest = (& $gcloudCommand artifacts docker images describe $taggedImage --format="value(image_summary.digest)" --project=$ProjectId 2>&1 | Where-Object { $_ -match "^sha256:" } | Select-Object -First 1).Trim()
if (-not $digest -or -not $digest.StartsWith("sha256:")) { throw "Artifact Registry did not return an image digest" }
$immutableImage = "$image@$digest"
Write-Host "Immutable image: $immutableImage"

if (-not $Deploy) {
  Write-Host "Build/publish complete. Re-run with -Deploy after configuring runtime secrets."
  exit 0
}

$required = @{
  RuntimeServiceAccount = $RuntimeServiceAccount
  SupabaseUrlSecret = $SupabaseUrlSecret
  SupabaseServiceRoleSecret = $SupabaseServiceRoleSecret
  R2AccountIdSecret = $R2AccountIdSecret
  R2AccessKeySecret = $R2AccessKeySecret
  R2SecretKeySecret = $R2SecretKeySecret
  InternalWorkerTokenSecret = $InternalWorkerTokenSecret
}
foreach ($entry in $required.GetEnumerator()) {
  if (-not $entry.Value) { throw "$($entry.Key) is required with -Deploy" }
}

$serviceEnv = "EXPORT_RENDERER_OUTPUT_ROOT=/tmp/neonix-export,EXPORT_RENDERER_CONTROL_PLANE_ONLY=1,CLOUD_RUN_PROJECT_ID=$ProjectId,CLOUD_RUN_REGION=$Region,CLOUD_RUN_JOB_NAME=$JobName,CLOUD_RUN_CHUNK_JOB_NAME=$ChunkJobName,CLOUD_RUN_FINALIZER_JOB_NAME=$FinalizerJobName,IMAGE_DIGEST=$digest,GIT_SHA=$GitSha"
& $gcloudCommand run deploy $ServiceName `
  --image=$immutableImage `
  --region=$Region `
  --platform=managed `
  --allow-unauthenticated `
  --service-account=$RuntimeServiceAccount `
  --cpu=2 `
  --memory=4Gi `
  --concurrency=1 `
  --timeout=900s `
  --max=1 `
  --set-env-vars=$serviceEnv `
  --set-secrets="INTERNAL_WORKER_TOKEN=$InternalWorkerTokenSecret`:latest" `
  --project=$ProjectId 2>&1 | Out-Host

$jobEnv = "EXPORT_RENDERER_OUTPUT_ROOT=/tmp/neonix-export,R2_USER_ASSETS_BUCKET=$R2AssetsBucket,R2_USER_EXPORTS_BUCKET=$R2ExportsBucket,IMAGE_DIGEST=$digest,GIT_SHA=$GitSha"
$jobSecrets = @(
  "NEXT_PUBLIC_SUPABASE_URL=$SupabaseUrlSecret`:latest",
  "SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleSecret`:latest",
  "R2_ACCOUNT_ID=$R2AccountIdSecret`:latest",
  "R2_ACCESS_KEY_ID=$R2AccessKeySecret`:latest",
  "R2_SECRET_ACCESS_KEY=$R2SecretKeySecret`:latest"
) -join ","
& $gcloudCommand run jobs deploy $JobName `
  --image=$immutableImage `
  --region=$Region `
  --tasks=1 `
  --parallelism=1 `
  --max-retries=2 `
  --task-timeout=3600s `
  --cpu=2 `
  --memory=4Gi `
  --service-account=$RuntimeServiceAccount `
  --command=pnpm `
  --args='--filter,@motionvideo/export-renderer,render:job' `
  --set-env-vars=$jobEnv `
  --set-secrets=$jobSecrets `
  --project=$ProjectId 2>&1 | Out-Host

& $gcloudCommand run jobs deploy $ChunkJobName `
  --image=$immutableImage `
  --region=$Region `
  --tasks=$ChunkTaskCapacity `
  --parallelism=$ChunkParallelism `
  --max-retries=2 `
  --task-timeout=3600s `
  --cpu=2 `
  --memory=4Gi `
  --service-account=$RuntimeServiceAccount `
  --command=pnpm `
  --args='--filter,@motionvideo/export-renderer,render:chunk-job' `
  --set-env-vars=$jobEnv `
  --set-secrets=$jobSecrets `
  --project=$ProjectId 2>&1 | Out-Host

& $gcloudCommand run jobs deploy $FinalizerJobName `
  --image=$immutableImage `
  --region=$Region `
  --tasks=1 `
  --parallelism=1 `
  --max-retries=2 `
  --task-timeout=3600s `
  --cpu=2 `
  --memory=4Gi `
  --service-account=$RuntimeServiceAccount `
  --command=pnpm `
  --args='--filter,@motionvideo/export-renderer,render:finalizer-job' `
  --set-env-vars=$jobEnv `
  --set-secrets=$jobSecrets `
  --project=$ProjectId 2>&1 | Out-Host

Write-Host "Deployed Service=$ServiceName and Jobs=$JobName,$ChunkJobName,$FinalizerJobName using $immutableImage"
