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
- [x] Document ownership / two-way sync fixed (Wave A)
- [x] `IpcResult<T>` across real Electron IPC (Wave A)
- [x] FS capability tokens / no arbitrary absolute paths (Wave B)
- [x] Packaged export without repo/`tsx` (Wave C)
- [ ] Timeline interaction MVP (Wave D)
- [ ] Re-enable production cutover only after gates above

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

- Phase 5 timeline interaction still incomplete (display-only clips) — Wave D
- Export presets still hard-coded low-res — Wave F
- No release-level legacy rollback inside packaged artifact

## Automated

```bash
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/desktop typecheck
```
