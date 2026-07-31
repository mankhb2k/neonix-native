# Phase 10 — Performance hardening (MVP)

## Decisions

- Profile-driven: no blanket `React.memo`
- Playback UI selects **frame index**, not float `currentTime` every RAF
- Clip strips are **display-only** + horizontal visible-range cull (`clipsVisibleWithPins`)
- Wall-clock UI timings stay manual (see Phase 0 baseline); CI asserts DOM-count budgets only

## Checklist

- [x] `playbackFrameIndex` leaf TransportBar (label + scrubber)
- [x] `EditingWorkspace` / `TimelineViewport` do not subscribe to playback `currentTime`
- [x] `useVisibleTimeline` + `ClipStrip` (pointer-events: none)
- [x] Dense fixture mount budget test (500 / 2000)
- [ ] Drag ≤ 16.7 ms/frame (Phase 5 pointer sessions)
- [ ] Scrub long-task budget with playhead DOM (Phase 5 slice 5+)
- [ ] Vertical lane windowing when lane count is large
- [ ] Manual wall-clock fill on `dev:vite` in [Phase 0 baseline](../vite-phase-0/performance-baseline.md)

## Manual smoke

1. `pnpm --filter @motionvideo/desktop dev:vite`
2. Play — React DevTools: `TimelineViewport` should not re-render every frame
3. Open dense project / paste large clips — scroll; clip strip count stays bounded
4. Transport timecode updates at ~fps, not every float tick

## Automated

`pnpm --filter @motionvideo/desktop test` — `performance-virtualization`  
`pnpm --filter @motionvideo/editor-core test` — `virtualization-budget`
