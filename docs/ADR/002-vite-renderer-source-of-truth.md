# ADR-002: Vite desktop renderer is the source of truth

- **Status:** Accepted
- **Date:** 2026-07-31
- **Context:** Phases 0–11 delivered a Vite Electron shell with project I/O, timeline/stage MVP, assets, inspector, export jobs, perf hardening, and Windows packaging. Unpackaged default was still Next (`legacy`) until Phase 12.

## Decision

1. **Desktop product path uses the Vite renderer by default** (`getRendererMode()` → `vite` when `MOTIONVIDEO_RENDERER` is unset).
2. **Packaged apps** continue to load `app://bundle` (offline Vite bundle).
3. **Legacy Next-in-Electron remains opt-in** via `MOTIONVIDEO_RENDERER=legacy` for canary / rollback during the freeze window — not the production default.
4. **`apps/web` product surfaces stay**; this ADR does **not** remove the web editor.
5. **Desktop-only UI under `apps/web/components/desktop/**` is frozen** for new desktop features; cleanup/deletion is a **separate follow-up PR** after canary stability (REFACTOR: cutover ≠ delete legacy).

## Rollback

- Dev / unpackaged: set `MOTIONVIDEO_RENDERER=legacy` and run Next on `:3000` (`pnpm dev:desktop:legacy`).
- Release: ship or reinstall the previous installer; project files keep atomic-write backups / migration safety from earlier phases.

## Consequences

- Root `pnpm dev:desktop` boots Vite + Electron.
- Support logs should include `version`, `packaged`, `renderer` (and startup timing where available).
- Do not gate new desktop UX on the Next desktop tree; implement in `apps/desktop/renderer` + `packages/editor-core`.
