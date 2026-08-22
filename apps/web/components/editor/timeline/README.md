# Web Timeline Architecture

> **Pure logic lives in packages.** The web timeline is a thin consumer — it picks shared logic from `@motionvideo/editor-core` and DOM adapters from local hooks under `apps/web/hooks/editor`.

**Chrome words** (float, ghost, playhead, insert line, snap guide): [`docs/web/editor-vocabulary.md`](../../../../../docs/web/editor-vocabulary.md) §9.

## Architecture

```
┌──────────────────────────────────────────┐
│  TimelineShell.tsx                       │
│  - useEditorStore (Zustand)              │
│  - usePlaybackClock                      │
│  - useTimelineHotkeys (local hook)   │
│  - Passes onExecute, onSelect, zoom      │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│  TimelineViewport.tsx                    │
│  - useTimelineViewportMetrics            │
│  - useTimelineSeek / useTimelineMarquee  │
│  - Computes layout, rows, clipsByLaneMap │
│  - Passes all context to TrackCanvas     │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│  TimelineTrackCanvas.tsx                 │
│  - LaneRowClips per lane (hooks)         │
│  - useVisibleTimeline (virtualization)   │
│  - useClipMove / useClipTrim per lane    │
│  - Renders ClipStrip with move/trim      │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│  ClipStrip.tsx                           │
│  - pointerdown → beginMove (no capture)  │
│  - Trim handles (left/right edges)       │
│  - Double-click drills into real groups  │
└──────────────────────────────────────────┘
```

## Shared Packages

| Package                            | What web uses                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@motionvideo/editor-core`         | `computeViewportLayout`, `buildLaneRows`, `sortLanesOverlayBaseAudio`, `computeRulerTickWindow`, `resolveLaneTrackKind`, `visualTracksToTimelineClips`, `selectedClipIdsFrom`, `selectionClips`, `sliderValueToZoomScale`, `executeTimelineCommand`, types |
| `@motionvideo/editor-core` | `computePlayheadFollowScroll`, `computeAutoScrollNearEdge`, `resolvePlayheadScrubMax`, `timelineTimeToContentLeft`, `resolveClipTrimUpdate`, `resolveClipMoveDrag`, constants |
| `apps/web/hooks/editor`            | `useTimelineViewportMetrics`, `useVisibleTimeline`, `useTimelineSeek`, `useTimelineMarquee`, `useTimelineHotkeys`, `useClipMove`, `useClipTrim`, `usePointerSessionHost`, `buildLaneHeightPrefix`                                                          |

## Web-only Files (Thin Adapters)

| File                                   | Purpose                                                                                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeline-scale.ts`                    | Web-specific layout constants (lane heights, gaps, padding) + re-exports `computeRulerTickWindow`                                                                                                  |
| `lanes/timeline-lane-rows.ts`          | Thin adapter — delegates to `buildLaneRows` with web config, adds `buildLayerLaneRows`                                                                                                             |
| `lanes/track-kind.ts`                  | Re-exports `resolveLaneTrackKind` from core; keeps deprecated `trackKindForRole` for legacy store reads                                                                                            |
| `clips/use-clip-move.ts`               | Adapter wrapping `useClipMove` from hooks/editor. Host: gutter `tracksOriginX`, `clipsByLane` + `laneHitLayout`, CapCut Y targeting (Main / overlay / audio). `exclusiveRows` when inside a group. |
| `clips/ClipStrip.tsx`                  | `pointerdown` calls `beginMove` immediately (desktop parity). `clipVisualClass` is shared with the drag **float**. Do not capture on the strip — `beginGesture` owns pointer capture. |
| `clips/use-clip-trim.ts`               | Adapter wrapping `useClipTrim` from hooks/editor; thin pass-through                                                                                                                                |
| `interactions/use-timeline-hotkeys.ts` | Adapter wrapping `useTimelineHotkeys` from hooks/editor; wires Zustand store                                                                                                                       |
| `viewport/TimelineViewport.tsx`        | Chrome: layout, scroll, marquee, seek, playhead; delegates algorithm to packages                                                                                                                   |
| `viewport/TimelineTrackCanvas.tsx`     | Chrome: lane rendering + clip move/trim via per-lane `LaneRowClips` hooks                                                                                                                          |
| `viewport/TimelineClipFloat.tsx`       | Drag **float** — clip replica, `position: fixed`, same fill as `ClipStrip`                                                                                                                         |
| `viewport/ClipMoveOverlays.tsx`        | Ghost + insert/snap + float while moving a timeline clip                                                                                                                                           |
| `viewport/LibraryDropGhostOverlay.tsx` | Library → timeline: gray ghost at drop target + colored float on the pointer                                                                                                                       |

## Protocol vs view

- **Document:** `project.layers` with unique sibling `zIndex`. No `laneId` in JSON.
- **Main:** pack non-overlapping roots onto shared lanes. Write-back is Canva order — Main then overlays, **right → left** then up (`2|1|0` then `4|3`).
- **Group:** one child per row. Cross-row drop swaps; insert gap creates a row. Never pack two children on one lane.

## State Wiring

- **Editor document**: `useEditorStore` (Zustand) — `project`, `timelineClips`, `timelineLanes`, `selection`
- **Playback**: `usePlaybackClock` (Zustand) — `currentTime`, `duration`, `mode`, `seek`, `togglePlayback`
- **Commands**: `useEditorStore.getState().executeTimelineCommand(command)` → `executeTimelineCommand` from `@motionvideo/editor-core`
- **History**: undo/redo via `useEditorStore((s) => s.undo/redo)`; hotkeys (Ctrl+Z/Y) wired through `useTimelineHotkeys`
