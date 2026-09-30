# Editor library contract

The web editor has one document model: `MotionProtocolV2` from
`@motionvideo/motion-protocol/v2`.

All document mutations go through `EditorCommand`, `applyEditorCommand` or
`applyEditorCommands` from `@motionvideo/editor-core`. The React session
state (selection, locks, playhead, and stack storage) is owned by
`components/editor/EditorProviders`; command transactions, inverse commands,
and history policy are owned by `@motionvideo/editor-core`. This library must
not add a second document store or history policy.

## Boundaries

- `document/` contains V2 document loading and temporary development fixtures.
- `document/` contains document fixtures and browser-side loading helpers.
- `library/` contains browser/resource adapters; pure placement and interaction
  policies belong to `@motionvideo/editor-core`.
- `inspector/` contains UI-specific measurement and binding; alignment, anchor,
  transform and keyframe policies belong to `@motionvideo/editor-core`.
- Stage geometry, hit-testing and keyframe patch construction belong to
  `@motionvideo/editor-core/interactions/stage`; `StageRenderer` only paints
  authoritative playback frames.
- `timeline/` and `interaction-host/` are DOM hosts for the browser-neutral
  policies in `@motionvideo/editor-core`.
- `selection/` contains only UI subscription glue; keyboard selection policy is
  owned by `@motionvideo/editor-core`.

Do not add imports from `lib/v2-editor`, the V1 Zustand store, or the
unversioned V1 motion-project model. If a V2 feature needs a compatibility
adapter, put it at an explicit boundary and add a removal issue/test.

ESLint enforces these rules for `app/app/editor`, `components/editor`,
`hooks/editor`, and `lib/editor`. Browser requests belong in `lib/api`; the
editor surface must not call `fetch` directly.
