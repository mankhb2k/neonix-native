# Phase 12 — Vite default cutover (BLOCKED)

## Status

**Production cutover blocked** after defect review. Wave 0 reverts unpackaged default to **legacy**. Vite remains opt-in / packaged-only preview until remediation gates (document sync, `IpcResult`, FS capabilities, packaged export, timeline MVP) pass.

See [ADR-002](../../ADR/002-vite-renderer-source-of-truth.md).

## Decisions (current)

- Unpackaged default `MOTIONVIDEO_RENDERER` → **legacy**
- Opt-in Vite: `MOTIONVIDEO_RENDERER=vite` / `pnpm dev:desktop:vite`
- Packaged: Vite `app://` only (no Next) — **not** release-ready
- **Production rollback:** previous installer (not legacy env in packaged app)
- **Freeze:** no new desktop features on Next editor — notice only
- **Deferred cleanup:** delete `apps/web/components/desktop/**` after real cutover

## Checklist

- [x] `getRendererMode()` unpackaged default = `legacy` (Wave 0)
- [x] Packaged still selects Vite when env unset
- [x] `MOTIONVIDEO_RENDERER=vite` opt-in works
- [x] Root `dev:desktop` → legacy; `dev:desktop:vite` → Vite
- [x] Startup log: version / packaged / renderer / startupMs
- [x] ADR-002 amended (cutover blocked)
- [x] Document ownership / rename via session (post-review Wave 2)
- [x] Rename draft commit on blur/Enter (UI-0) — no per-keystroke history
- [x] Single TimelineViewport pointer host (UI-0)
- [x] Strict timeline schema (no soft canonicalize on open/save) (UI-0)
- [x] `IpcResult<T>` across real Electron IPC (Wave A)
- [x] FS capability tokens / no arbitrary absolute paths (Wave B)
- [x] Packaged export natives + CLI smoke (post-review Wave 1)
- [x] Export build fail-fast if ffmpeg binary missing (no mid-pack download) (UI-0)
- [x] Timeline interaction MVP (Wave D)
- [x] Async IO / save validation / asset probe (Wave E)
- [x] Export presets + overlap cull (Wave F)
- [ ] UI visual parity Hub → Inspector (UI-1…UI-7)
- [ ] Re-enable production cutover only after UI-8 + soak

## Rollback steps (dev)

1. Stop Electron.
2. Start Next: `pnpm dev` (web on `:3000`).
3. `pnpm dev:desktop` (legacy default) or `MOTIONVIDEO_RENDERER=legacy`.
4. Confirm window loads `http://localhost:3000/app`.

## Manual smoke

1. `pnpm dev:desktop` + Next — legacy UI
2. `pnpm dev:desktop:vite` — Vite UI (opt-in)
3. `pnpm --filter @motionvideo/desktop run start:prod` — offline `app://` (preview only)

## Known gaps (honest)

- UI port in progress (UI-1…UI-8): Hub/layout/timeline visual/sidebar/inspector not full parity
- Timeline: marquee / lane reorder / library DnD still follow-ups (UI-6)
- Playhead / PreviewStage React clock subscription (UI-4 hot path)
- Export preset `4k` and recovery journal not enabled yet
- No release-level legacy rollback inside packaged artifact
- Production cutover still blocked until UI-8 soak / product sign-off

## Automated

```bash
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/desktop typecheck
pnpm --filter @motionvideo/desktop lint
```
