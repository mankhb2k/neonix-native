# Vite UI phase checklist

Production cutover remains **blocked** until UI-8 + soak. Do not mark phases done before gates.

| Phase | Gate | Status |
|-------|------|--------|
| UI-0 Foundation (P1s, lint, tests, ffmpeg fail-fast) | test + typecheck + lint + export-cli smoke | in progress |
| UI-1 Design system | primitives + gallery; no `apps/web` imports | pending |
| UI-2 Hub chrome | create/open/recent/window controls packaged | pending |
| UI-3 Editor layout | resize prefs; single title bar | pending |
| UI-4 Timeline visual | move/trim/split tests still pass | pending |
| UI-5 Sidebar slices | Layers/Media/…; assets from session | pending |
| UI-6 Advanced timeline | per-behavior policy + adapter + test | pending |
| UI-7 Inspector shell | chrome + registry only | pending |
| UI-8 Hardening | screenshots/smoke/a11y; freeze web desktop | pending |

Rules:

- Never import from `apps/web`
- `ui/` primitives have no document/store/IPC knowledge
- Session owns document mutations
