# Phase 12 — Vite default cutover

## Status

**Vite is the default desktop renderer** (unpackaged and packaged). Legacy Next remains available via `MOTIONVIDEO_RENDERER=legacy` / `pnpm --filter @motionvideo/desktop dev:legacy` for visual reference only.

See [ADR-002](../../ADR/002-vite-renderer-source-of-truth.md) and [`renderer-mode.ts`](../../../apps/desktop/src/shared/renderer-mode.ts).

## Decisions (current)

- Default `MOTIONVIDEO_RENDERER` (unset) → **vite**
- Legacy opt-in: `MOTIONVIDEO_RENDERER=legacy` / `pnpm dev:legacy`
- Packaged: Vite `app://` only (no Next)
- **Freeze:** no new desktop features on Next editor — notice only
- **Deferred cleanup:** `apps/web/components/desktop/**` stays as visual reference — **never** auto-delete; owner approve only. FREEZE.md “delete this tree” is stale.

## Checklist

- [x] `getRendererMode()` default = `vite`
- [x] `MOTIONVIDEO_RENDERER=legacy` opt-in works
- [x] Packaged selects Vite when env unset
- [x] Startup log: version / packaged / renderer / startupMs
- [x] Document ownership / rename via session
- [x] Rename draft commit on blur/Enter — no per-keystroke history
- [x] Single TimelineViewport pointer host
- [x] Strict timeline schema (no soft canonicalize on open/save)
- [x] `IpcResult<T>` across real Electron IPC
- [x] FS capability tokens / no arbitrary absolute paths
- [x] Packaged export natives + CLI smoke
- [x] Export build fail-fast if ffmpeg binary missing
- [x] Timeline interaction MVP
- [x] Async IO / save validation / asset probe
- [x] Export presets + overlap cull
- [x] Crash-recovery journal + autosave (Logic-1)
- [x] Inspector property domain depth (Logic-2)
- [x] Export `uhd`/`4k` preset (Logic-3)
- [x] Stage honesty rename (Logic-4)
- [x] Lifecycle E2E smoke — Vite prod + preload (Logic-5; not full NSIS pack)
- [x] Logic parity matrix (Logic-6) — see [logic-parity-matrix.md](./logic-parity-matrix.md)
- [ ] UI visual parity Hub → Inspector (CSS-1…CSS-7)

## Rollback steps (dev)

1. Stop Electron.
2. Start Next: `pnpm dev` (web on `:3000`).
3. `pnpm --filter @motionvideo/desktop dev:legacy` or `MOTIONVIDEO_RENDERER=legacy`.
4. Confirm window loads `http://localhost:3000/app`.

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev` — Vite UI (default)
2. `pnpm --filter @motionvideo/desktop dev:legacy` — legacy Next UI
3. `pnpm --filter @motionvideo/desktop run start:prod` — offline `app://`

## Known gaps (honest)

- UI port: Hub/layout/sidebar/inspector chrome landed; deep CSS pixel parity open
- Timeline: some advanced behaviors remain `partial` (see `advanced-timeline.ts` scaffold map)
- PreviewStage still React-subscribes frame index (imperative compose follow-up)
- Export UHD/4K preset shipped (Logic-3); deep memory soak optional via `bench:export-split --uhd`
- No release-level legacy rollback inside packaged artifact
- `apps/web/components/desktop/**` frozen / protected — see FREEZE.md + N8_QA_CUTOVER.md
- Logic parity matrix: [logic-parity-matrix.md](./logic-parity-matrix.md)

## Automated

```bash
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/desktop typecheck
pnpm --filter @motionvideo/desktop lint
pnpm --filter @motionvideo/desktop test:web-ban
```
