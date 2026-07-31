# Phase 5 — Slice 01: Timeline viewport / scroll / zoom / ruler

Parity checklist for Vite desktop renderer (no Tracks / Pixi / playhead seek).

## In scope

- [x] Hydrate `.mt` envelope → clips / lanes / fps via `@motionvideo/editor-core` parsers
- [x] Per-instance session: zoom slider, fit mode, fit revision (scroll reset)
- [x] `TimelineViewport`: ResizeObserver, RAF-coalesced scrollLeft/scrollTop
- [x] Canvas width from `computeViewportLayout` (fit pps × zoom scale × extent)
- [x] CapCut-style `TimeRuler` with visible-window tick culling (no seek handler)
- [x] Zoom controls (slider + Fit) in editor toolbar
- [x] Read-only lane name column + empty lane bands (no flags / clips / drag)
- [x] Document JSON behind `<details>` debug panel — not primary surface

## Out of scope (later slices)

- [ ] Lane flags / reorder (slice 2)
- [ ] Clip rendering / virtualization (slice 3)
- [ ] Selection / marquee (slice 4)
- [ ] Playhead seek/scrub (slice 5)
- [ ] Drag / resize / clipboard / undo / hotkeys / stage sync (slices 6–11)

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. New project → see ruler + Main lane band
3. Zoom slider → ruler tick density changes; Fit resets
4. Horizontal / vertical scroll syncs ruler labels column
5. Dirty rename still prompts on close; zoom does not mark dirty

## Automated

`pnpm --filter @motionvideo/desktop test` — hydrate, session zoom/fit, ruler scale, viewport layout.
