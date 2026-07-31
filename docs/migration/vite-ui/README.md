# Vite UI correctness → parity

Default `dev:desktop` / `@motionvideo/desktop` `dev` now launches the **Vite** renderer. Legacy Next remains via `dev:desktop:legacy` / `dev:legacy`.

| Area | Status |
|------|--------|
| DesktopPaths (no `__dirname` depth walks) | done |
| Rename Escape / undo name / AssetPanel cache | done |
| Design tokens single source + Dialog/Select | done |
| EditorHeader + EditorActions facade | done |
| Hub create `{ name, aspectRatio }` + sort/grid | done |
| Sidebar Layers/Media/Text/Elements/Audio | done (commands only) |
| Library drag session | done |
| Session clipboard + Ctrl+C/X/V | done |
| Preview frame-gated React updates | done (Pixi still follow-up) |
| Web `components/desktop` | frozen — not deleted |

Do **not** import from `apps/web`. Inspector remains shell-only.

## Soak / remaining

- Screenshot baselines, packaged smoke, large fixtures, full Pixi stage
- After soak: delete `apps/web/components/desktop/**`
