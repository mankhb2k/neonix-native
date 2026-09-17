# MCP E2E export flow check — 2026-09-17

## Scope

Checked the MCP contract, OAuth protected-resource discovery, live MCP
endpoint, and the current Cloud Run renderer health endpoint. No user access
token or service-role token was used in the test.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `@motionvideo/motion-mcp` typecheck | PASS | `tsc --noEmit` |
| Remote MCP contract tests | PASS | 3 files, 6 tests passed |
| Tool registration/output schemas | PASS | authoring, assets, export, HTML tools registered |
| OAuth unauthenticated challenge | PASS | `https://www.neonix.video/api/mcp` returns `401` |
| Protected-resource metadata | PASS | resource, issuer and bearer-header metadata match |
| Live Cloud Run renderer health | OLD DEPLOYMENT | returns `renderer: skia-wasm-ffmpeg` |
| Authenticated live tool call | PASS | Codex OAuth session called `list_workspaces`; 1 workspace returned |
| HTML project creation | PASS | Shape/gradient/animation fixture compiled and persisted as Protocol V2 revision 1 |
| Export creation (first run) | BLOCKED | `RENDER_QUEUE_REQUIRED`: live web environment was not enabling Supabase PGMQ |
| Export creation (queue retry) | BLOCKED | `TOOL_ERROR`: live web runtime cannot create the Supabase database client |
| MP4 artifact / R2 URL | NOT RUN | no render job was created because export creation stopped before `render_jobs` insert |

## Verified live endpoints

- MCP endpoint: `https://www.neonix.video/api/mcp`
- Protected-resource metadata: `https://www.neonix.video/.well-known/oauth-protected-resource`
- OAuth issuer: `https://wroefbhcrrqvrdcbkhib.supabase.co/auth/v1`
- Cloud Run health: `https://neonix-export-renderer-o2p6pmyt5a-as.a.run.app/health`

The live MCP challenge advertises the correct metadata URL and the metadata
advertises the exact MCP resource. The local remote-server tests also verified
tool listing, output schemas, resources, prompts, a successful
`list_workspaces` call, and structured validation errors.

## Authenticated E2E attempt

The Codex OAuth session was completed successfully on 2026-09-17. A real MCP
call returned one accessible workspace. The final HTML smoke fixture used
640x360, 30 fps, 5 seconds, two animated shapes, a solid color, and a linear
gradient. The following project was created successfully:

- `project_id`: `b21b4dea-b86a-461a-bd8f-08c612c6e491`
- `public_ref`: `prj_fabc06a6c367f556574b`
- `protocol_revision_no`: `1`
- `source_format`: `html`
- compiler diagnostics: none
- compiled duration: 5000 ms

The Supabase queue contract was checked separately and is present: the PGMQ
extension, `pgmq.q_render_jobs`, and the `render_queue_send/read/delete/archive`
functions all exist. This confirms the database queue migration is present.

`create_export` then failed before creating a job with:

```text
RENDER_QUEUE_REQUIRED
Production render entrypoints require Supabase PGMQ
```

After `RENDER_QUEUE_ENABLED=true` was added and deployed, the retry passed the
queue guard but failed before inserting `render_jobs` with:

```text
TOOL_ERROR
Supabase is required for database-backed render jobs
```

`apps/web/lib/server/render/job-store.ts` creates this client only when both
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in the
Vercel runtime. The current public MCP path proves user-authenticated Supabase
access, but does not prove that the server-only service-role variables are
available to the production function.

The guard is implemented in `apps/web/lib/mcp/exports.ts` and rejects the
production path when `RENDER_QUEUE_ENABLED` is not `true`. This proves OAuth,
MCP authentication, HTML compilation, and project persistence, but does not
yet prove queue dispatch, Cloud Run rendering, MP4 encoding, or R2 upload.

During fixture reduction, the compiler also exposed three independent authoring
constraints before the final shape-only fixture passed: `ease-in-out` timing
was unsupported, `box-shadow` with `rgba()` was unsupported, and the live
font catalog did not contain the requested Inter/default sans-serif weights.
These are compiler/font-parity findings, not queue failures.

## Current blockers for full authenticated E2E

First, add the server-only Supabase variables to the Vercel Production
environment and redeploy the web app:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RENDER_QUEUE_ENABLED=true
```

The first two values must be available to the server runtime; they must not be
exposed through a `NEXT_PUBLIC_` secret. Then rerun `create_export` for the
existing project/revision.

The native-only code and Docker image are present locally, but the live Cloud
Run service has not been redeployed. Its health response still identifies the
old `skia-wasm-ffmpeg` renderer. A complete live flow must be run after the
native image is deployed:

```text
OAuth bearer token
  -> MCP create_project_html
  -> MCP create_export
  -> Supabase render_jobs
  -> Cloud Run native Skia worker
  -> native MP4 verification
  -> R2 publication
  -> MCP get_export
  -> MCP get_export_download_url
```

The test must use a short visual-only HTML fixture until native image/video/
audio/effect parity is implemented. CanvasKit must not be used as a fallback.

## Recheck after Supabase variables were added

The existing project was retried without creating a new project:

- `project_id`: `b21b4dea-b86a-461a-bd8f-08c612c6e491`
- `protocol_revision_no`: `1`
- `create_export`: accepted
- `job_id`: `rnd_mu5i6941_kajgrb`
- initial status: `queued`

This proves the live MCP/Vercel runtime now passes the queue guard and can
create a database-backed render job. The first status read failed with the
non-retryable configuration error:

```text
TOOL_ERROR
EXPORT_RENDERER_URL is not configured
```

Therefore no Cloud Run render, MP4 encode, or R2 upload occurred in this
attempt. The next required production variable is:

```text
EXPORT_RENDERER_URL=https://neonix-export-renderer-o2p6pmyt5a-as.a.run.app
```

It must be set in the same Vercel project and environment that serves the MCP
endpoint, followed by a production redeploy. The value should point to the
Cloud Run control service and must not include a trailing slash requirement;
the application normalizes it. After redeploy, rerun the same 5-second
fixture and verify the sequence `queued -> running -> completed`, an MP4
artifact in R2, and a working download URL.

## Full E2E rerun after native image deployment

Run completed on 2026-09-17 after deploying the native Skia CPU image to Cloud
Run. This is the first successful MCP-to-R2 export through the control-plane
only service and the native sequential Cloud Run Job.

| Check | Result | Evidence |
| --- | --- | --- |
| MCP authentication and workspace discovery | PASS | Personal workspace returned by `list_workspaces` |
| HTML project creation | PASS | `create_project_html`, no compiler diagnostics |
| Animation duration | PASS | Three CSS animations at 5,000 ms; 150 expected frames |
| Export job creation | PASS | `rnd_mu5juaks_12eexz`, initial status `queued` |
| Queue dispatch | PASS after IAM fix | PGMQ message 40 dispatched to Cloud Run execution |
| Native renderer health | PASS | `/health` returned `renderer: skia-native-raster` |
| Cloud Run Job execution | PASS | `neonix-render-job-sszx2`, succeeded count 1 |
| MP4 publication to R2 | PASS | Final output key present and signed URL returned |
| Local MP4 download and ffprobe | PASS | 1920x1080, H.264, yuv420p, 30 fps, 150 frames |

### Identifiers and deployment

- `project_id`: `15961c11-a08a-4687-893f-eac0ff39d61a`
- `public_ref`: `prj_0d9d3bd2dcbdc64fa364`
- `protocol_revision_no`: `1`
- `job_id`: `rnd_mu5juaks_12eexz`
- `cloud_run_execution`: `neonix-render-job-sszx2`
- Cloud Run revision: `neonix-export-renderer-00021-j4v`
- image reference: `skia-command-cpu-native@sha256:6fe59cb081cdf26ae05ea8a4ac0c334f3f00fcf72774bec16f7887be16e24c1b`
- `GIT_SHA`: `0e24fee4db16`
- output key: `0f04ec69-9ced-4b5c-9b5e-a1b1f5248b6e/rnd_mu5juaks_12eexz.mp4`

### Measured timings and artifact

| Measurement | Value |
| --- | ---: |
| MCP job created | 2026-09-17T13:12:18.094Z |
| Job completed | 2026-09-17T13:19:54.411Z |
| Create-to-done wall clock | 456.317 s |
| Cloud Run execution start | 2026-09-17T13:19:28.105Z |
| Cloud Run execution completion | 2026-09-17T13:19:56.599Z |
| Cloud Run execution wall clock | 28.494 s |
| Cloud Run provisioning before task start | about 11.3 s |
| Native render/encode process command start | 2026-09-17T13:19:41.789Z |
| Worker process exit | 2026-09-17T13:19:54.522Z |
| Rendered / verified frames | 150 / 150 |
| Verified duration | 4.967 s |
| Codec / pixel format | H.264 / yuv420p |
| Resolution / frame rate | 1920x1080 / 30 fps |
| Audio streams | 0 |
| MP4 size | 64,185 bytes |
| Local SHA-256 | `59406A98C5303FBF8F43002C5E0852E97410FBB9A004BB215423D4820650D5FA` |
| Native pipe writes | 0 ms reported |
| Native backpressure wait | 0 ms reported |
| Encode finalization | 32.872 ms |

The MCP response did not expose the native worker's separate Skia render and
encode durations for this job; only frame verification and encode breakdown
were persisted. The next instrumentation task is to persist those two fields
in `render_jobs.metrics` so Cloud Run wall time can be split into provisioning,
native rendering, encoding, verification, and R2 publication.

### Queue incident and fix

The first local consumer attempt read an older queue message and failed with:

```text
Permission 'run.jobs.runWithOverrides' denied on resource
projects/neonix-506607/locations/asia-southeast1/jobs/neonix-render-job
```

The sequential job had `roles/run.jobsExecutor` but was missing
`roles/run.jobsExecutorWithOverrides`. That binding was added for
`neonix-renderer@neonix-506607.iam.gserviceaccount.com`. The next consumer run
successfully dispatched message 40 and the current job completed. The deploy
script should be updated to apply this binding on every deployment; otherwise
a future recreation of the sequential job can regress to `queued` indefinitely.

### E2E conclusion

The complete control flow now passes:

```text
OAuth MCP
  -> create_project_html
  -> create_export
  -> Supabase render_jobs / PGMQ
  -> queue consumer
  -> Cloud Run native Skia Job
  -> 150-frame MP4 verification
  -> R2 publication
  -> signed MCP download URL
```

The remaining operational gap is not rendering correctness: the production
queue consumer must run continuously, and the IAM binding must be encoded in
deployment automation. The 456.317-second end-to-end time is dominated by the
queue consumer not running during the first part of this test; the actual
Cloud Run execution completed in 28.494 seconds, including approximately
11.3 seconds of provisioning.
