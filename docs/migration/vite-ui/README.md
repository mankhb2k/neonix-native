# Vite UI phase checklist

Production cutover remains **blocked** until UI-8 + soak. Do not mark phases done before gates.

| Phase | Gate | Status |
|-------|------|--------|
| UI-0 Foundation (P1s, lint, tests, ffmpeg fail-fast) | test + typecheck + lint + export-cli smoke | done |
| UI-1 Design system | primitives + gallery; no `apps/web` imports | done |
| UI-2 Hub chrome | create/open/recent/window controls packaged | done |
| UI-3 Editor layout | resize prefs; single title bar | done |
| UI-4 Timeline visual | move/trim/split tests; Playhead imperative | done (PreviewStage frame React still partial) |
| UI-5 Sidebar slices | Layers/Media; assets from session | done (Elements/Audio disabled) |
| UI-6 Advanced timeline | per-behavior policy + adapter + test | scaffolded |
| UI-7 Inspector shell | chrome + registry only | done |
| UI-8 Hardening | screenshots/smoke/a11y; freeze web desktop | checklist below |

Rules:

- Never import from `apps/web`
- `ui/` primitives have no document/store/IPC knowledge
- Session owns document mutations

## UI-8 hardening checklist

- [ ] Screenshot regression (Hub / workspace / timeline / sidebar)
- [ ] Packaged Electron smoke (`start:prod` + export-cli)
- [ ] Keyboard matrix pass on Vite
- [ ] Large fixture 500/2000 clips profiling
- [ ] React Profiler on drag + playback
- [ ] a11y: focus, keyboard, aria, reduced motion
- [ ] CSP / fonts after Tailwind
- [ ] Freeze or delete `apps/web/components/desktop/**` after stable release
- [ ] Re-open production cutover claim only after soak

Gallery: open Vite renderer with `?gallery=1`.
