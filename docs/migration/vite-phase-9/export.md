# Phase 9 — Export & long-running jobs (MVP)

## Decisions

- Dev: Main owns jobs via `child_process.spawn` of `render-worker` `cli-export.ts` through `tsx`
- Packaged (Wave C): `ELECTRON_RUN_AS_NODE=1` + `resources/export-cli/cli-export.cjs` (esbuild bundle; no `tsx`)
- Renderer bakes MotionProject (`buildExportProject`) then sends immutable `projectJson`
- Asset base / output path resolved in main (session + Save dialog); per-job work dir under `os.tmpdir()`
- Cancel = kill child + delete temp dir; timeout 10 minutes
- `jobId` returned **before** progress events (subscribe-safe)
- Web HTTP `/api/export` unchanged (rollback)

## Checklist

- [x] Widen `StartExportInput` (`projectJson`, …) + sequenced `ExportEvent`
- [x] Errors: `EXPORT_FAILED`, `OUTPUT_DENIED`
- [x] CLI env: `MOTIONVIDEO_EXPORT_OUT_DIR` / `ASSET_BASE` / `MP4_PATH` + stderr progress lines
- [x] `export-process-manager` + `export-service`
- [x] IPC `export.start` / `cancel` / `event` wired; dispose on quit
- [x] Desktop bake port + `ExportControls` (`EXPORT_ENABLED`)
- [x] Unit tests: overwrite deny, mock complete, cancel, jobId-before-events, missing packaged CLI
- [x] Packaged CLI bundle: `pnpm build:export-cli` → `extraResources/export-cli`
- [ ] Electron `utilityProcess` migration
- [ ] BullMQ / cloud upload
- [ ] Frame-level progress / raw frame IPC
- [ ] Full-res export presets (Wave F)

## Manual smoke

### Dev

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. Open/save a project with scenes → Export… → choose MP4 path
3. Progress updates; file appears on disk
4. Start export → Cancel export → temp cleaned; no orphan node/tsx

### Packaged

1. `pnpm --filter @motionvideo/desktop run pack`
2. Confirm `release/win-unpacked/resources/export-cli/cli-export.cjs` exists
3. Run unpacked app → Export… — must not fail with “missing tsx”
4. Low-res encode completes or fails with typed `EXPORT_FAILED`

## Automated

`pnpm --filter @motionvideo/desktop test` — `export-jobs`, IPC schema  
`pnpm --filter @motionvideo/desktop run build:export-cli`  
`pnpm --filter @motionvideo/render-worker typecheck`
