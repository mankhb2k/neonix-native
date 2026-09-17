# E2E plan: HTML → MP4 → Cloudflare R2 (5 seconds)

Status: audit complete; implementation not started

## Objective

Verify the real production control-plane flow with one minimal HTML fixture:

```text
API or MCP
  → compile HTML
  → persist project + Protocol V2 revision in Supabase
  → create render_jobs row with immutable runtime manifest
  → enqueue only { schemaVersion, jobId } in Supabase PGMQ
  → queue worker reads job_id and submits Cloud Run Job
  → Cloud Run worker claims render_jobs
  → render 5 seconds / 150 frames
  → ffprobe verification
  → publish MP4 to Cloudflare R2
  → update render_jobs = done
  → API/MCP returns a short-lived signed R2 URL
```

The test must prove the artifact is really present in R2 and playable; a `done`
row alone is not sufficient.

## Audit result before running E2E

### What is already wired

- API project creation exists at `POST /api/v1/projects/html`.
- API export exists at `POST /api/v1/projects/{projectId}/renders`.
- MCP exposes `create_project_html`, `create_export`, `get_export`, and
  `get_export_download_url` through `POST /api/mcp`.
- HTML-first MCP persistence uses the atomic Supabase RPC
  `public.create_html_project`.
- `render_jobs` is the production source of truth.
- The PGMQ message contains only `jobId`; the worker reloads the runtime
  manifest from Supabase.
- Cloud Run Job workers claim the job through Supabase, render to `/tmp`,
  verify with `ffprobe`, publish through an R2 temporary key, verify the final
  key, and then mark the row `done`.
- R2 export publication uses the user exports bucket. The signed download URL
  is generated only after `artifact_path` is an `r2://...` value.

### Important boundary discovered

The API/MCP Cloud Run entrypoint currently runs:

```text
render:job
  → renderRuntimeProjectV3
  → packages/export-renderer/src/render/render.ts
  → CanvasKit WASM raster in Node
  → FFmpeg CLI
```

It does not yet run the separate native Skia/libyuv command-buffer benchmark
worker. The native worker is therefore not part of this E2E unless a separate
backend-routing change is made. This test should record the backend identity so
the result cannot be mistaken for a native Skia benchmark.

### Current likely bottlenecks

1. **Cold start and job provisioning**: the 5-second render is small, so Cloud
   Run Job startup can dominate the wall-clock time.
2. **Compile duplication**: HTML is compiled at project creation and compiled
   again before the project render request; MCP export also reads and compiles
   the saved Protocol V2 revision before creating the job.
3. **Queue polling latency**: the queue consumer polls PGMQ, submits a Cloud Run
   execution, and status is observed through Supabase polling. One-second poll
   intervals add visible latency to a short job.
4. **Runtime preparation before enqueue**: `create_export` prepares the runtime
   before the queue signal is sent. This is correct for immutability but makes
   request latency depend on compilation and asset preparation.
5. **Unused chunk initialization for a simple sequential test**:
   `createRenderJob` initializes the chunk manifest even when
   `RENDER_CHUNK_EXECUTION_ENABLED=false`. This adds database work but should
   not block correctness.
6. **Backend mismatch**: the current API/MCP production path still reports the
   CanvasKit/FFmpeg backend. It cannot validate the native Skia/libyuv path.
7. **Cloudflare media pipeline is not exercised**: a pure HTML fixture has no
   media asset, so the R2 media-event Worker and media-preparer are correctly
   absent from this test. They need a separate media fixture later.

## Fixture contract

Use a dedicated 5-second HTML fixture, not the 60-second benchmark fixture.
The fixture should be deterministic and asset-free:

- composition: `1920x1080`, `30 fps`, `5000 ms`;
- one opaque background;
- one rectangle and one rounded rectangle;
- one short text label using a bundled/default supported font;
- one CSS transform/opacity animation;
- no `<img>`, `<video>`, external URL, audio track, or R2 asset;
- exactly 150 expected video frames;
- expected output: H.264 MP4, `yuv420p`, no audio stream.

The existing `apps/web/public/docs/benchmark/neonix-f0-baseline-shapes-5s.html`
is a suitable visual baseline. Add a separate E2E fixture if its feature set is
too broad; do not mutate the benchmark ladder while measuring the API contract.

## Test lanes

### Lane A: Web API

Authentication for the web API is cookie-based through Supabase SSR, so the
harness must use a real authenticated browser/session or a test login flow. A
bare `Authorization: Bearer` header is not enough for the current project API
context.

1. `POST /api/v1/projects/html`
   - send HTML, title, and a unique idempotency key;
   - record request ID and elapsed time;
   - assert `201`, project ID, `currentRevisionNo=1`, and HTML source format.
2. `GET /api/v1/projects/{id}/html` and
   `GET /api/v1/projects/{id}/revisions/1/json`;
   - assert the stored HTML hash and canonical Protocol V2 revision exist.
3. `POST /api/v1/projects/{id}/renders`
   - request `export-1080p` with a unique export idempotency key;
   - assert `202` and a job ID.
4. Poll `GET /api/v1/renders/{jobId}` until `done`, `failed`, or timeout.
5. `GET /api/v1/renders/{jobId}/download`;
   - assert a signed URL, download the MP4, and verify it locally.

### Lane B: Remote MCP

Use an MCP SDK Streamable HTTP client against `/api/mcp` with a real Supabase
JWT. Do not call application internals directly in this lane.

1. `initialize` and `tools/list`;
   - assert `create_project_html`, `create_export`, `get_export`, and
     `get_export_download_url` are advertised.
2. `tools/call create_project_html` with the same fixture and a unique
   idempotency key;
   - assert the project and linked HTML/Protocol revisions.
3. `tools/call create_export` with a unique idempotency key;
   - assert a job ID and queued state.
4. Poll `tools/call get_export` until terminal state.
5. `tools/call get_export_download_url`;
   - download the signed URL and verify the MP4.
6. Repeat `create_project_html` and `create_export` with the same idempotency
   keys; assert the same project/job is returned and no duplicate job is added.

## Infrastructure preflight

Run these checks before creating any test data:

```text
NEXT_PUBLIC_SUPABASE_URL                 present
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     present on the web app
SUPABASE_SERVICE_ROLE_KEY                present only in worker/queue runtime
R2_ACCOUNT_ID                            present
R2_ACCESS_KEY_ID                         present only in server/worker runtime
R2_SECRET_ACCESS_KEY                     present only in server/worker runtime
R2_USER_EXPORTS_BUCKET                   present
INTERNAL_WORKER_TOKEN                    present on web control plane + renderer service
EXPORT_RENDERER_URL                      points to the Cloud Run control service
RENDER_DISPATCH_MODE                     cloud-run-job
RENDER_QUEUE_ENABLED                     true
CLOUD_RUN_PROJECT_ID                     correct project
CLOUD_RUN_REGION                         correct region
CLOUD_RUN_JOB_NAME                       sequential render Job
CLOUD_RUN_CHUNK_EXECUTION_ENABLED        false for this first 5s test
```

Also verify:

- the Cloud Run control service is deployed with
  `EXPORT_RENDERER_CONTROL_PLANE_ONLY=1`;
- the sequential Job uses the same immutable image digest as the service;
- the runtime service account can read the five required Secret Manager
  secrets;
- the R2 token can write, copy, head, and delete in the exports bucket;
- `render_jobs` PGMQ and all render-job claim/status RPCs are present;
- a queue consumer is running with
  `RENDER_DISPATCH_MODE=cloud-run-job`;
- the queue visibility timeout exceeds the expected Cloud Run execution time.

The first run should be single-flight: one queue consumer, one render job, and
no chunk execution. This isolates correctness and cold start from capacity
testing.

## Assertions and measurements

Every log line and result record must include:

```text
e2eRunId, lane, fixtureId, htmlHash, userIdHash, projectId, revisionNo,
jobId, queueMessageId, cloudRunExecution, imageDigest, outputKey
```

Measure these timestamps independently:

| Stage | Measurement |
| --- | --- |
| Auth/session | session acquisition and first authenticated request |
| HTML API/MCP | request wall time and server request ID |
| HTML compile | compiler duration and diagnostics count |
| Project persistence | Supabase project/revision commit duration |
| Job creation | `render_jobs` insert/idempotency lookup duration |
| Manifest persistence | inline vs chunked, bytes, checksum, duration |
| Queue | enqueue time, first dequeue/read time, message ID |
| Cloud Run | submission response, execution start, worker claim time |
| Render | planning, rendering, encoding/muxing, ffprobe verification |
| Publish | R2 temporary PUT, HEAD, COPY, final HEAD, cleanup |
| End-to-end | first create request to signed URL and to completed download |

Record the existing worker metrics plus:

- total wall-clock and cold-start estimate;
- 150 expected vs verified frames;
- duration tolerance: `4.95–5.05 s` for a 5-second, 30 fps fixture;
- codec, pixel format, dimensions, frame rate, audio stream count;
- output bytes and SHA-256 from local download vs R2 HEAD/stream;
- R2 temporary-key cleanup result;
- peak RSS, CPU time/utilization if available;
- queue read count, retries, lease recovery, and DLQ/archive count;
- status transition timestamps: `queued → planning → rendering → publishing → done`.

## Supabase and R2 verification

Use a service-role assertion client only in the test runner or a protected
diagnostic script; never expose it to browser or MCP logs.

For each completed job, assert:

```text
render_jobs.public_ref = jobId
render_jobs.status = done
render_jobs.runtime_json OR runtime_manifest_chunk_count > 0
render_jobs.output_key = expected user/job MP4 key
render_jobs.artifact_path starts with r2://
render_jobs.metrics_json.verifiedFrames = 150
render_jobs.metrics_json.audioStreams = 0
```

For R2, assert:

```text
HEAD expected output key succeeds
Content-Length equals worker metrics
Content-Type = video/mp4
temporary __tmp__/render object is absent after publication
signed URL returns HTTP 200 and a complete MP4
ffprobe on downloaded bytes succeeds
```

Do not count a Cloudflare media-event message as part of this HTML-only test;
there should be no source asset and no media-preparation job.

## MP4 verification contract

Run `ffprobe` on the downloaded artifact and assert:

```text
video codec       = h264
pixel format      = yuv420p
width/height      = 1920x1080
fps               = 30/1
frames            = 150
duration          ≈ 5.0 seconds
audio streams     = 0
```

Also decode selected frames (0, 75, 149) and compare their dimensions and
non-empty pixel checksum. Exact pixel parity belongs to the separate CanvasKit
versus native Skia benchmark; this E2E primarily verifies the production
contract and artifact integrity.

## Failure classification

Classify failures before changing code:

- `AUTH`: cookie/JWT/session or MCP resource metadata;
- `COMPILE`: HTML diagnostics or Protocol V2 conversion;
- `PERSIST`: project/revision/job/manifest Supabase writes;
- `QUEUE`: PGMQ enqueue/read/delete/archive or stale visibility;
- `DISPATCH`: control service, Google auth, Cloud Run Job configuration;
- `RENDER`: CanvasKit/asset/font/frame evaluation;
- `ENCODE`: FFmpeg, pixel format, duration, frame count;
- `PUBLISH`: R2 PUT/COPY/HEAD/delete;
- `VERIFY`: ffprobe or checksum mismatch;
- `IDEMPOTENCY`: duplicate project/job or inconsistent result.

The report must preserve the first failing stage, request IDs, job ID, Cloud Run
execution name, image digest, and the last Supabase status row.

## Execution order

1. Run local compiler/fixture validation only.
2. Run API lane against a non-production/staging deployment with the Cloud Run
   sequential Job and real R2 exports bucket.
3. Run MCP lane with the same fixture and a separate idempotency namespace.
4. Repeat each lane once warm to separate cold start from steady-state time.
5. Repeat each lane with the same idempotency keys to test replay safety.
6. Inspect Supabase queue/archive and R2 temporary-prefix cleanup.
7. Write the result to `docs/benchmark/e2e-html-to-mp4-r2-5s-<date>.md` and
   raw JSON to `docs/benchmark/results/e2e-html-to-mp4-r2-5s-<date>.json`.

## Acceptance gates

The first E2E is green only if all of the following pass:

- both API and MCP lanes create the expected project/revision;
- exactly one render job is created per unique idempotency key;
- PGMQ message contains only the job ID and is deleted after success;
- Cloud Run claims the job and reaches `done` without retry/DLQ;
- MP4 passes the 150-frame/5-second/1080p/H.264/yuv420p/no-audio contract;
- R2 final object exists, checksum/size match, and temporary object is removed;
- signed download URL returns the verified artifact;
- no media-preparer or asset event is incorrectly triggered;
- backend identity is recorded as CanvasKit/FFmpeg for the current path, or as
  native Skia/libyuv only after an explicit routing change.

## Follow-up after this test

If the E2E is correct but slow, optimize in this order:

1. split cold-start, queue, and render timings;
2. remove duplicate HTML/runtime compilation where the persisted revision is
   already validated;
3. avoid initializing unused chunk rows for sequential jobs;
4. reduce status polling latency only after correctness is stable;
5. connect the native Skia/libyuv backend behind an explicit export backend
   flag and rerun the exact same API/MCP fixture;
6. add a second E2E with R2 video/audio assets to exercise media preparation,
   audio finalization, and Cloudflare event handling.
