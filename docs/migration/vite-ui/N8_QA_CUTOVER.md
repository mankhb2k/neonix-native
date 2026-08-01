# N8 QA + cutover checklist

Vite desktop is the default UI. Complete this before deleting `apps/web/components/desktop/**`.

## Smoke

- [ ] `pnpm --filter @motionvideo/desktop test`
- [ ] `pnpm --filter @motionvideo/desktop typecheck`
- [ ] `pnpm --filter @motionvideo/desktop lint`
- [ ] `pnpm --filter @motionvideo/desktop build:renderer:release`
- [ ] `pnpm --filter @motionvideo/desktop pack` (script name is **`pack`**, not `package`)
- [ ] `pnpm --filter @motionvideo/desktop test:export-cli`
- [ ] `pnpm --filter @motionvideo/desktop test:desktop-paths`
- [ ] `pnpm --filter @motionvideo/desktop test:web-ban`

## Manual UI

- [ ] Screenshot Hub + Editor @ 1280 / 1920 → `docs/migration/vite-ui/baselines/` (see baselines README)
- [ ] Keyboard: Undo/Redo, Escape cancel drag/rename, Delete clip, Enter/Space library add
- [ ] Packaged Electron launch via `pnpm --filter @motionvideo/desktop pack`
- [ ] Create project with name + aspectRatio persists
- [ ] Library drag → lane/time; wrong family rejects; drop outside cancels
- [ ] Rename focused → native window close saves new name (EditorSessionHandle)
- [ ] Save after renaming with focus still in name field

## Soak

Run Vite desktop as daily driver for one release cycle. Track regressions in issues.

## Cutover delete (only after soak)

1. Confirm FREEZE notice + no open blockers.
2. Delete `apps/web/components/desktop/**`.
3. Remove `dev:desktop:legacy` / Next desktop routes if unused.
4. Keep `MOTIONVIDEO_RENDERER=legacy` only if a fallback is still required.
