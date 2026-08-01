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
| Preview StageRendererPort (no React/frame) | **partial** — `pnpm test:perf` happy-dom regression (not 60fps); Pixi not production |
| Vite default unified | done |
| Sidebar panel file split | done |

## Parity / G waves

| Wave | Focus | Status |
|------|--------|--------|
| N2 / G4 / H4 / P15 | Screenshot baselines + parity contract | **partial** — Electron FixtureSurface PNGs; placeholders under `baselines/placeholders/` |
| N3 / G4 / H4 / P15 | Unified chrome / Hub polish | **partial** — menus portal into TitleBar; no menu fallback flash |
| N5 | Drop geometry lane/time | done (typed ghost + auto-scroll near zone) |
| N6 / G3 | Layers tree / reorder / marquee / cross-lane | **partial** — adapters + context menu; lane drag-reorder DOM later |
| N7 / G2 / P14 / P17 / P19 | Pixi + fixtures/benchmark | **partial** — `test:perf` + `test:perf:electron` rAF harness (not 60fps acceptance); DOM default |
| N8 / G5 / H5 / P17 | Packaged soak; delete web desktop | **partial** — pack OK; delete after manual soak + stable release |

See [PARITY_CONTRACT.md](./PARITY_CONTRACT.md), [N8_QA_CUTOVER.md](./N8_QA_CUTOVER.md), G1–G5 plan.

Do **not** import from `apps/web`. Inspector remains shell-only until deeper property work.
