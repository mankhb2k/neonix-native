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
| Preview StageRendererPort (no React/frame) | **partial** — DOM default; `canvas-experimental` contract (P21); not production |
| Vite default unified | done |
| Sidebar panel file split | done |

## Parity / G waves + P18–P22

| Wave | Focus | Status |
|------|--------|--------|
| N2 / G4 / H4 / P20 / UI-0 | Screenshot baselines + parity contract | **UI-0** — exact sizes + Electron pixel-diff; promote with `PROMOTE_BASELINES=1` |
| N3 / G4 / H4 | Unified chrome / Hub polish | **partial** — menus portal into TitleBar; no menu fallback flash |
| N5 | Drop geometry lane/time | done (typed ghost + auto-scroll near zone) |
| N6 / G3 | Layers tree / reorder / marquee / cross-lane | **partial** — adapters + context menu; lane drag-reorder DOM later |
| N7 / G2 / P14 / P19 / P21 / UI-0 | Stage + fixtures/benchmark | **UI-0** — `test:perf:electron` requires viewport + drag mutation; DOM default |
| P18 | Atomic group move / keep-lane | done |
| N8 / G5 / H5 / P22 | Packaged soak; web desktop protected | pack OK; **never delete** until owner approve; CI blocks deletions |
| UI-0.1 | Honesty + dual baselines + group plan | done |
| CSS-0 | Protected manifest, single gesture, web metrics/refs | **this wave** |
| CSS-1…CSS-7 | Pixel parity port (primitives → chrome → grid → …) | **deferred** |

See [PARITY_CONTRACT.md](./PARITY_CONTRACT.md), [N8_QA_CUTOVER.md](./N8_QA_CUTOVER.md) (includes **Inspector seam**), G1–G5 plan.

Do **not** import from `apps/web`. Inspector: `EditorSelection` + timeline/property commands only — see N8.
