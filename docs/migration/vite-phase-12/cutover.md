# Phase 12 — Vite default cutover (MVP)

## Decisions

- Default `MOTIONVIDEO_RENDERER` → **vite** ([ADR-002](../../ADR/002-vite-renderer-source-of-truth.md))
- Rollback: `MOTIONVIDEO_RENDERER=legacy` + Next `:3000`
- **Freeze:** no new desktop features on Next editor (`apps/web` desktop tree) — notice only, no CI gate
- **Deferred:** delete `apps/web/components/desktop/**`, packaged export worker, deep-links, full Phase 5 interaction parity

## Checklist

- [x] `getRendererMode()` defaults to `vite`
- [x] `MOTIONVIDEO_RENDERER=legacy` still selects Next URL
- [x] Root `dev:desktop` → Vite; `dev:desktop:legacy` → legacy
- [x] Desktop `dev` = concurrent Vite + Electron; `dev:legacy` opt-in
- [x] Startup log: version / packaged / renderer / startupMs
- [x] `app.getInfo` exposes version / packaged / renderer
- [x] ADR-002 Vite SoT
- [ ] Manual canary: crash / save failure / export failure / startup time (ops note — no telemetry pipeline)
- [ ] Follow-up PR: remove desktop-only web components after stability

## Rollback steps

1. Stop Electron.
2. Start Next: `pnpm dev` (web on `:3000`).
3. `pnpm dev:desktop:legacy` or `MOTIONVIDEO_RENDERER=legacy` + Electron.
4. Confirm window loads `http://localhost:3000/app`.

## Manual smoke

1. `pnpm dev:desktop` — Vite UI on cold start (no Next required)
2. Open / save a `.mt` project
3. Diagnostics / main log shows `renderer=vite`
4. `pnpm dev:desktop:legacy` with Next up — legacy shell still works
5. `pnpm --filter @motionvideo/desktop run start:prod` — offline `app://` load

## Known gaps (honest)

- Phase 5 timeline interaction slices (drag/resize/split keyboard parity) still incomplete vs legacy goldens
- Packaged export may fail without repo/`tsx` (Phase 9/11 note)
- No CI wall-clock monitoring for crash/save/export

## Automated

```bash
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/desktop typecheck
```
