# Timeline architecture

The web timeline is a projection of the `MotionProtocolV2` document. It does
not own a document store or persistence state.

```text
EditorSurfaceProvider
  -> projectLayersToTimeline(document)
  -> TimelineViewport (layout, seek, marquee, drag/trim)
  -> timelineCommandToV2(command)
  -> applyV2EditorCommand(document)
```

Timeline lanes, clips, selection, zoom, and playhead are session projections.
Only the resulting Protocol V2 document is persisted by the project
repository. Undo/redo also remains in `EditorSurfaceProvider`.

Pure conversion lives in `apps/web/lib/editor/timeline/adapter.ts`; browser
gesture code stays under `apps/web/hooks/editor/timeline` and rendering stays
under this directory.
