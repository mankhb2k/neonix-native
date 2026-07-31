# Vite UI migration

**Default:** `pnpm dev:desktop` launches the Vite renderer. Legacy Next remains via `dev:desktop:legacy` / `MOTIONVIDEO_RENDERER=legacy`.

## Gate A (P0–P2) status

| Area | Status |
|------|--------|
| Create Project `{name, aspectRatio}` | done |
| Library pointer session + drop-zone | done |
| Typed LibraryPayload / shape+image scenes | done |
| Atomic Save snapshot after rename | done |
| Layers min (select/rename/flags) | done |
| Preview StageRendererPort (no React/frame) | done |
| Vite default unified | done |
| Sidebar panel file split | done |

## Parity waves (after Gate A)

| Wave | Focus | Status |
|------|--------|--------|
| N2 | Screenshot baselines + parity contract | contract + baselines folder |
| N3 | Unified chrome / Hub polish | menus via EditorActions |
| N5 | Drop geometry lane/time | wired + ghost/auto-scroll |
| N6 | Layers tree / reorder / marquee / cross-lane | Vite adapters |
| N7 | Pixi port + fixtures 100/500/2000 | fixtures + backend seam (DOM default) |
| N8 | Packaged soak; then delete web desktop | checklist — delete deferred until soak |

See also [PARITY_CONTRACT.md](./PARITY_CONTRACT.md), [N8_QA_CUTOVER.md](./N8_QA_CUTOVER.md).

Do **not** import from `apps/web`. Inspector remains shell-only until deeper property work.
