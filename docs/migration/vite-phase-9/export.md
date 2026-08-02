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
- [x] Native canvas platform package + `ffmpeg.exe` copied beside CLI (hard-fail if missing)
- [x] Packaged runtime smoke: `pnpm test:export-cli` (ELECTRON_RUN_AS_NODE + encode)
- [x] `ffmpeg-static` binary must already exist from install/CI cache — build does **not** run `install.js`
- [x] Export presets (`preview` / `fhd` / `fhd24`) via `MOTIONVIDEO_EXPORT_FPS` / `SCALE`
- [ ] Electron `utilityProcess` migration
- [ ] BullMQ / cloud upload
- [ ] Frame-level progress / raw frame IPC

## Manual smoke

### Dev

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. Open/save a project with scenes → Export… → choose MP4 path
3. Progress updates; file appears on disk
4. Start export → Cancel export → temp cleaned; no orphan node/tsx

### Packaged

1. `pnpm --filter @motionvideo/desktop run test:export-cli` — must PASS (canvas + ffmpeg + encode)
2. `pnpm --filter @motionvideo/desktop run pack`
3. Confirm `release/win-unpacked/resources/export-cli/` has `cli-export.cjs`, `ffmpeg.exe`, and `@napi-rs/canvas-win32-*`
4. Run unpacked app → Export… — must not fail with missing tsx / native binding

## Automated

`pnpm --filter @motionvideo/desktop test` — `export-jobs`, IPC schema  
`pnpm --filter @motionvideo/desktop run test:export-cli` — natives + encode smoke  
`pnpm --filter @motionvideo/render-worker typecheck`
