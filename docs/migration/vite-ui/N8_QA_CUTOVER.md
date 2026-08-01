# N8 / H5 QA + cutover checklist

Vite desktop is the default UI. Complete this before deleting `apps/web/components/desktop/**`.

## Automated gate (dev machine)

- [x] `pnpm --filter @motionvideo/desktop test` (135+)
- [x] `pnpm --filter @motionvideo/desktop typecheck`
- [x] `pnpm --filter @motionvideo/desktop lint`
- [x] `pnpm --filter @motionvideo/desktop build:renderer:release` (via `pnpm run pack`)
- [x] `pnpm --filter @motionvideo/desktop run pack` (**must** use `run pack` — bare `pnpm pack` is npm’s tarball command)
- [x] `pnpm --filter @motionvideo/desktop test:export-cli`
- [x] `pnpm --filter @motionvideo/desktop test:desktop-paths`
- [x] `pnpm --filter @motionvideo/desktop test:web-ban`

## Pack soak (H5 — 2026-08-01)

| Step | Result |
|------|--------|
| `pnpm run pack` (`electron-builder --win dir`) | PASS → `apps/desktop/release/win-unpacked/MotionVideo.exe` |
| export-cli smoke (inside pack) | PASS |
| web-import ban / desktop-paths | PASS |

Manual create/open/save/reopen/import/export in the unpacked build still required before cutover delete.

Unicode / long path / large project: keep on the manual checklist below.

## Manual UI

- [x] Baseline PNG fixtures @ 1280 / 1920 via `node apps/desktop/scripts/capture-parity-baselines.mjs` (solid fixtures — replace with Playwright)
- [ ] Keyboard: Undo/Redo, Escape cancel drag/rename, Delete clip, Enter/Space library add
- [ ] Launch `release/win-unpacked/MotionVideo.exe` (packaged create/open/save/reopen/import/export)
- [ ] Create project with name + aspectRatio persists
- [ ] Library drag → lane/time; wrong family rejects; drop outside cancels
- [ ] Rename focused → Home / Close menu / native close (single flush via `closeProject` + `EditorSessionHandle`)
- [ ] Save As after rename uses new suggested filename
- [ ] Unicode project name / long path / large document open+save

## Soak

Run Vite desktop as daily driver for one release cycle. Track regressions in issues.

**H5 status:** automated pack + smokes PASS on Windows (`release/win-unpacked`). Manual UI soak + one release cycle still required. **Do not delete** `apps/web/components/desktop/**` until after that soak.

## Cutover delete (only after soak)

1. Confirm FREEZE notice + no open blockers.
2. Delete `apps/web/components/desktop/**`.
3. Remove `dev:desktop:legacy` / Next desktop routes if unused.
4. Keep `MOTIONVIDEO_RENDERER=legacy` only if a fallback is still required.
