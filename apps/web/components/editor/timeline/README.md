# Web Timeline Architecture

> **Pure logic lives in packages.** The web timeline is a thin consumer — it picks shared hooks, adapters, and pure functions from `@motionvideo/editor-core`, `@motionvideo/editor-interactions`, and `@motionvideo/editor-react`.

## Architecture

```
┌──────────────────────────────────────────┐
│  TimelineShell.tsx                       │
│  - useEditorStore (Zustand)              │
│  - usePlaybackClock                      │
│  - useTimelineHotkeys (from editor-react)│
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
│  - Visual clip strip with select/move    │
│  - Trim handles (left/right edges)       │
│  - Delegates gestures to parent hooks    │
└──────────────────────────────────────────┘
```

## Shared Packages

| Package                            | What web uses                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@motionvideo/editor-core`         | `computeViewportLayout`, `buildLaneRows`, `sortLanesOverlayBaseAudio`, `computeRulerTickWindow`, `resolveLaneTrackKind`, `visualTracksToTimelineClips`, `selectedClipIdsFrom`, `selectionClips`, `sliderValueToZoomScale`, `executeTimelineCommand`, types |
| `@motionvideo/editor-interactions` | `computePlayheadFollowScroll`, `ensurePlayheadScrubScroll`, `computeAutoScrollNearEdge`, `resolvePlayheadScrubMax`, `timelineTimeToContentLeft`, `resolveClipTrimUpdate`, `resolveClipMoveDrag`, constants                                                 |
| `@motionvideo/editor-react`        | `useTimelineViewportMetrics`, `useVisibleTimeline`, `useTimelineSeek`, `useTimelineMarquee`, `useTimelineHotkeys`, `useClipMove`, `useClipTrim`, `usePointerSessionHost`, `buildLaneHeightPrefix`                                                          |

## Web-only Files (Thin Adapters)

| File                                   | Purpose                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `timeline-scale.ts`                    | Web-specific layout constants (lane heights, gaps, padding) + re-exports `computeRulerTickWindow`           |
| `lanes/timeline-lane-rows.ts`          | Thin adapter — delegates to `buildLaneRows` with web config, adds `buildLayerLaneRows`                      |
| `lanes/track-kind.ts`                  | Re-exports `resolveLaneTrackKind` from core; keeps deprecated `trackKindForRole` for legacy store reads    |
| `clips/use-clip-move.ts`               | Adapter wrapping `useClipMove` from editor-react; supplies web `ClipMoveHost` (auto-scroll, same-lane-only) |
| `clips/use-clip-trim.ts`               | Adapter wrapping `useClipTrim` from editor-react; thin pass-through                                         |
| `interactions/use-timeline-hotkeys.ts` | Adapter wrapping `useTimelineHotkeys` from editor-react; wires Zustand store                                |
| `viewport/TimelineViewport.tsx`        | Chrome: layout, scroll, marquee, seek, playhead; delegates algorithm to packages                            |
| `viewport/TimelineTrackCanvas.tsx`     | Chrome: lane rendering + clip move/trim via per-lane `LaneRowClips` hooks                                   |

## State Wiring

- **Editor document**: `useEditorStore` (Zustand) — `project`, `timelineClips`, `timelineLanes`, `selection`
- **Playback**: `usePlaybackClock` (Zustand) — `currentTime`, `duration`, `mode`, `seek`, `togglePlayback`
- **Commands**: `useEditorStore.getState().executeTimelineCommand(command)` → `executeTimelineCommand` from `@motionvideo/editor-core`
- **History**: undo/redo via `useEditorStore((s) => s.undo/redo)`; hotkeys (Ctrl+Z/Y) wired through `useTimelineHotkeys`
