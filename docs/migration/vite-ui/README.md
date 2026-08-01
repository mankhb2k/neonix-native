# Vite UI migration

**Default:** `pnpm dev:desktop` launches the Vite renderer. Legacy Next remains via `dev:desktop:legacy` / `MOTIONVIDEO_RENDERER=legacy`.

## Gate A (P0–P2) status

| Area | Status |
|------|--------|
| Create Project `{name, aspectRatio}` | done |
| Library pointer session + drop-zone | done |
| Typed LibraryPayload / shape+image scenes | done |
| Atomic Save snapshot after rename | **partial** — toolbar/export done; native close via `EditorSessionHandle` (G1) |
| Layers min (select/rename/flags) | done |
| Preview StageRendererPort (no React/frame) | **partial** — G2/H2 CI regression gate (not Electron 60fps acceptance); Pixi not production |
| Vite default unified | done |
| Sidebar panel file split | done |

## Parity / G waves

| Wave | Focus | Status |
|------|--------|--------|
| N2 / G4 / H4 | Screenshot baselines + parity contract | **partial** — solid PNG fixtures @ 1280/1920; Playwright captures later |
| N3 / G4 / H4 | Unified chrome / Hub polish | **partial** — menus portal into TitleBar (`#desktop-titlebar-menu-portal`) |
| N5 | Drop geometry lane/time | done (typed ghost + auto-scroll near zone) |
| N6 / G3 | Layers tree / reorder / marquee / cross-lane | **partial** — adapters + context menu; lane drag-reorder DOM later |
| N7 / G2 | Pixi + fixtures/benchmark | **partial** — G2/H2 StageRenderer CI gate (not Electron 60fps); Pixi post-baseline |
| N8 / G5 / H5 | Packaged soak; delete web desktop | **partial** — `pnpm run pack` OK (`win-unpacked`); delete after manual soak |

See [PARITY_CONTRACT.md](./PARITY_CONTRACT.md), [N8_QA_CUTOVER.md](./N8_QA_CUTOVER.md), G1–G5 plan.

Do **not** import from `apps/web`. Inspector remains shell-only until deeper property work.
