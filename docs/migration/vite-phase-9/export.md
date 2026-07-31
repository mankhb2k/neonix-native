# Phase 9 — Export & long-running jobs (MVP)

## Decisions

- Main owns jobs via `child_process.spawn` of `render-worker` `cli-export.ts` (not Electron `utilityProcess` yet)
- Renderer bakes MotionProject (`buildExportProject`) then sends immutable `projectJson`
- `projectPath` → asset base dir; Save dialog when `outputPath` omitted
- Cancel = kill child + delete temp dir; timeout 10 minutes
- Web HTTP `/api/export` unchanged (rollback)

## Checklist

- [x] Widen `StartExportInput` (`projectJson`, `projectPath`, `overwrite`) + sequenced `ExportEvent`
- [x] Errors: `EXPORT_FAILED`, `OUTPUT_DENIED`
- [x] CLI env: `MOTIONVIDEO_EXPORT_OUT_DIR` / `ASSET_BASE` / `MP4_PATH` + stderr progress lines
- [x] `export-process-manager` + `export-service`
- [x] IPC `export.start` / `cancel` / `event` wired; dispose on quit
- [x] Desktop bake port + `ExportControls` (`EXPORT_ENABLED`)
- [x] Unit tests: overwrite deny, mock complete, cancel
- [ ] Electron `utilityProcess` migration
- [ ] BullMQ / cloud upload
- [ ] Frame-level progress / raw frame IPC

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. Open/save a project with scenes → Export… → choose MP4 path
3. Progress updates; file appears on disk
4. Start export → Cancel export → temp cleaned; no orphan node/tsx
5. Close app during export → job killed on quit

## Automated

`pnpm --filter @motionvideo/desktop test` — `export-jobs`, IPC schema  
`pnpm --filter @motionvideo/render-worker typecheck`
