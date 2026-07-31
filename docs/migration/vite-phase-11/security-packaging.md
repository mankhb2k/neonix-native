# Phase 11 — Security, packaging & release readiness (MVP)

## Decisions

- **Packager:** electron-builder (Windows `dir` / optional NSIS) — not Electron Forge
- **Packaged renderer:** always Vite via `app://bundle` (`setPackagedHint` → prod bundle)
- **Default renderer (Phase 12):** `vite` unpackaged and packaged; rollback with `MOTIONVIDEO_RENDERER=legacy`
- **Deferred:** auto-update, OS `.mt` association / deep links, packaged export CLI worker, macOS/Linux installers, code signing, strict https domain allowlist

## Artifact hardening checklist

- [x] Vite release build: `MOTIONVIDEO_RELEASE=1` → no sourcemaps (`build:renderer:release`)
- [x] Main/preload release: `tsconfig.*.release.json` with `sourceMap: false`
- [x] Packaged `files` ignore `**/*.map`
- [x] `app://` refuses `.map` when packaged / `MOTIONVIDEO_RELEASE=1`
- [x] Built `index.html` meta CSP via Vite `transformIndexHtml` (`PROD_RENDERER_CSP` — no `:5173`, no script `unsafe-inline`)
- [x] Session CSP prod path matches (`applyRendererCsp` uses `PROD_RENDERER_CSP`)
- [x] Shell: `contextIsolation`, `nodeIntegration: false`, `sandbox`
- [x] IPC sender validation + navigation / window-open policy
- [x] `app://` / `mvmedia://` path containment
- [ ] Strict https domain allowlist for `openExternal` (MVP still allows any `https:` / `mailto:`)
- [ ] Auto-update compatibility
- [ ] Code signing

## Packaging

```bash
# Use `run` — bare `pnpm pack` is pnpm's tarball command, not electron-builder
pnpm --filter @motionvideo/desktop run pack   # Windows unpacked dir → apps/desktop/release/
pnpm --filter @motionvideo/desktop run dist   # Windows NSIS installer
# aliases: electron:pack / electron:dist
```

- `rendererRoot` for asar: `configurePackagedRendererRoot(app.getAppPath())` → `dist-renderer` inside asar
- **Export:** still needs repo/`tsx` in unpackaged/dev; packaged export may fail until a follow-up ships a bundled worker — does **not** block shell smoke

### Lightweight secrets / artifact note

Before shipping a build, spot-check `release/**` (or asar extract) for:

- `*.map` sourcemaps
- Accidental `.env`, tokens, or private keys
- No requirement for a CI wall-clock secrets scanner in this MVP

## Manual smoke (packaged Vite offline)

1. `pnpm --filter @motionvideo/desktop run pack`
2. Run the unpacked binary under `apps/desktop/release/win-unpacked/` (or product name equivalent)
3. Confirm Vite UI loads **without** Vite (`5173`) or Next (`3000`) servers
4. Open / save a `.mt` project
5. DevTools: no Node/`require` in renderer; CSP has no `unsafe-eval`
6. Export may error in packaged builds — expected for this MVP

## Automated

```bash
pnpm --filter @motionvideo/desktop test
pnpm --filter @motionvideo/desktop typecheck
```

Coverage added: `resolve-bundle-path`, `navigation-policy`.
