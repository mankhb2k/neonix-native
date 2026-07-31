# N8 QA + cutover checklist

Vite desktop is the default UI. Complete this before deleting `apps/web/components/desktop/**`.

## Smoke

- [ ] `pnpm --filter @motionvideo/desktop test`
- [ ] `pnpm --filter @motionvideo/desktop typecheck`
- [ ] `pnpm --filter @motionvideo/desktop lint`
- [ ] `pnpm --filter @motionvideo/desktop build:renderer:release`
- [ ] `node apps/desktop/scripts/smoke-export-cli.mjs` (when export fixtures available)
- [ ] `node apps/desktop/scripts/smoke-desktop-paths.mjs`
- [ ] `node apps/desktop/scripts/probe-web-import-ban.mjs`

## Manual UI

- [ ] Screenshot Hub + Editor @ 1280 / 1920 → `docs/migration/vite-ui/baselines/`
- [ ] Keyboard: Undo/Redo, Escape cancel drag/rename, Delete clip
- [ ] Packaged Electron launch (`pnpm --filter @motionvideo/desktop package` or release script)
- [ ] Create project with name + aspectRatio persists
- [ ] Library drag → lane/time placement; drop outside cancels
- [ ] Save after renaming with focus still in name field

## Soak

Run Vite desktop as daily driver for one release cycle. Track regressions in issues.

## Cutover delete (only after soak)

1. Confirm FREEZE notice + no open blockers.
2. Delete `apps/web/components/desktop/**`.
3. Remove `dev:desktop:legacy` / Next desktop routes if unused.
4. Keep `MOTIONVIDEO_RENDERER=legacy` only if a fallback is still required.
