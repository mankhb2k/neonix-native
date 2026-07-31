# Phase 6 — Stage preview + playback (Vite)

## Reality check

REFACTOR-VITE mentions “Pixi”; this monorepo has **no PixiJS**. Stage is the legacy **DOM/CSS** `PreviewStage` over `motion-compiler` + `motion-runtime`.

## In scope (this PR)

- [x] Per-instance `createPlaybackClockStore` (Zustand vanilla) + `PlaybackClockContext`
- [x] Pure `playback-driver` + `usePlaybackDriver` RAF wiring
- [x] Port `compose-layers` + `preview-evaluate`
- [x] `PreviewStage` with leaf clock bridge (shell does not re-render every tick)
- [x] ResizeObserver scale fit for stage host
- [x] `TransportBar` play / pause / stop / scrub
- [x] Session exposes parsed `MotionProject`; clock `reset` on document revision
- [x] Cleanup: pause on unmount; driver `dispose` stops RAF

## Deferred

- [ ] Timeline playhead DOM sync (Phase 5 slice 5)
- [ ] Pixi / WebGL stage (not in repo)
- [ ] Texture/media asset pipeline (Phase 7)
- [ ] Visual parity suite vs legacy screenshots

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. New project → empty stage message (no scenes) + timeline
3. Open a `.mt` with scenes/clips → preview layers + Play advances time
4. Scrub slider seeks; Stop resets to 0
5. Leave to Home — no RAF after leave (devtools Performance)

## Automated

`pnpm --filter @motionvideo/desktop test` — driver seek/end/dispose + compose/evaluate smoke.
