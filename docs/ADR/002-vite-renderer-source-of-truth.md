# ADR-002: Vite desktop renderer direction (cutover blocked)

- **Status:** Accepted direction; **production cutover blocked** (2026-07-31 review remediation)
- **Date:** 2026-07-31
- **Amended:** Wave 0 — unpackaged default reverted to `legacy` until remediation gates pass

## Context

Phases 0–12 delivered a Vite Electron shell, `editor-core`, packaging, and a temporary default-Vite cutover. A defect review found release blockers: packaged export (tsx/repo paths), document two-way sync, typed IPC over Electron, read-only timeline, and FS capability width.

## Decision

1. **Direction:** Vite + `editor-core` remain the long-term desktop source of truth.
2. **Unpackaged default:** `getRendererMode()` → **`legacy`** when `MOTIONVIDEO_RENDERER` is unset (developer machines with Next).
3. **Vite opt-in (unpackaged):** `MOTIONVIDEO_RENDERER=vite` / `pnpm dev:desktop:vite`.
4. **Packaged apps** still load `app://bundle` (no Next in the artifact) but are **not** production-ready until remediation waves A–D gates pass.
5. **Production rollback** = reinstall the **previous verified installer**, not legacy env inside the current package.
6. **`apps/web` product surfaces stay**; desktop-only web cleanup remains a later PR.

## Rollback

- Dev: default legacy + Next `:3000`, or explicit `MOTIONVIDEO_RENDERER=legacy`.
- Release: previous installer; project atomic-write backups unchanged.

## Consequences

- Root `pnpm dev:desktop` boots legacy Electron + Next.
- Do not claim Phase 12 production cutover until timeline MVP, packaged export, `IpcResult`, and FS capabilities land.
- New desktop UX continues in `apps/desktop/renderer` + `packages/editor-core`.
