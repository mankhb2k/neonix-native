# N8 / H5 / P17 QA + cutover checklist

Vite desktop is the default UI. Complete this before deleting `apps/web/components/desktop/**`.

## Automated gate (dev machine)

- [x] `pnpm --filter @motionvideo/desktop test` (unit; excludes `test:perf`)
- [x] `pnpm --filter @motionvideo/desktop test:perf` (happy-dom regression only)
- [x] `pnpm --filter @motionvideo/desktop typecheck`
- [x] `pnpm --filter @motionvideo/desktop lint`
- [x] `pnpm --filter @motionvideo/desktop build:renderer:release` (via `pnpm run pack`)
- [x] `pnpm --filter @motionvideo/desktop run pack` (**must** use `run pack` — bare `pnpm pack` is npm’s tarball command)
- [x] `pnpm --filter @motionvideo/desktop test:export-cli`
- [x] `pnpm --filter @motionvideo/desktop test:desktop-paths`
- [x] `pnpm --filter @motionvideo/desktop test:web-ban`
- [x] Electron fixture baselines via `node apps/desktop/scripts/capture-parity-baselines.mjs --electron`

## Pack soak (H5 — 2026-08-01)

| Step | Result |
|------|--------|
| `pnpm run pack` (`electron-builder --win dir`) | PASS → `apps/desktop/release/win-unpacked/MotionVideo.exe` |
| export-cli smoke (inside pack) | PASS |
| web-import ban / desktop-paths | PASS |

## P17 status

- Canvas2D stage backend behind Pixi seam (`createStageRendererLazy` + `canvas-stage-renderer`); default remains DOM.
- Prefetch canvas chunk after editor mount.
- Manual packaged soak still required. **Do not delete** `apps/web/components/desktop/**`.

## Manual UI / soak checklist

- [x] Baseline PNGs @ 1280 / 1920 — Electron `FixtureSurface` captures (not solid placeholders)
- [ ] Keyboard: Undo/Redo, Escape cancel drag/rename, Delete clip, Enter/Space library add
- [ ] Launch `release/win-unpacked/MotionVideo.exe` (create/open/save/reopen/import/export)
- [ ] Create project with name + aspectRatio persists
- [ ] Library drag → lane/time; wrong family rejects; drop outside cancels
- [ ] Clip drag: incompatible / outside = no commit; auto-scroll keeps time under cursor
- [ ] Rename focused → Home / Close menu / native close (single flush)
- [ ] Save As after rename uses new suggested filename
- [ ] Unicode project name / long path / large document open+save
- [ ] Missing media, OS file drag, playback, export, close-with-unsaved

## Cutover delete (only after soak + one stable release)

1. Confirm FREEZE notice + no open blockers.
2. Delete `apps/web/components/desktop/**`.
3. Remove `dev:desktop:legacy` / Next desktop routes if unused.
4. Keep `MOTIONVIDEO_RENDERER=legacy` only if a fallback is still required.
