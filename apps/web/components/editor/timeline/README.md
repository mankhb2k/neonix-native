# Timeline architecture

The web timeline is a projection of the `MotionProtocolV2` document. It does
not own a document store or persistence state.

```text
EditorProviders
  -> projectLayersToTimeline(document)
  -> TimelineViewport (layout, seek, marquee, drag/trim)
  -> timelineEditToDocumentCommand(command)
  -> applyEditorCommand(document)
```

Timeline lanes, clips, selection, zoom, and playhead are session projections.
Only the resulting Protocol V2 document is persisted by the project
repository. Undo/redo is exposed through `useEditorActions()`.

Pure conversion lives in `@motionvideo/editor-core/timeline`; browser
gesture code stays under `apps/web/hooks/editor/timeline` and rendering stays
under this directory.
