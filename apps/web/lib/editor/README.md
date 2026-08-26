# Editor library contract

The web editor has one document model: `MotionProtocolV2` from
`@motionvideo/motion-protocol/v2`.

All document mutations go through `EditorCommand` and
`applyEditorCommand` from `@motionvideo/editor-core/document/commands`. The React session
state (selection, locks, playhead, and undo/redo) is owned by
`components/editor/EditorSurfaceProvider`; this library must not add a second
document store.

## Boundaries

- `document/` contains V2 document loading and temporary development fixtures.
- `document/project-repository.ts` is the server-only Supabase boundary for
  project list/load/autosave; the browser never talks to Supabase tables
  directly for editor source revisions.
- `library/`, `inspector/`, and `stage/` contain pure V2 domain operations.
- `timeline/` owns the one conversion boundary from timeline interaction
  commands to V2 commands. Timeline UI remains in `components/editor`.
- `selection/` and `interaction-host/` contain browser-neutral interaction
  helpers used by the V2 shell.
- `stage/` may expose only production V2 stage calculations.

Do not add imports from `lib/v2-editor`, the V1 Zustand store, or the
unversioned V1 motion-project model. If a V2 feature needs a compatibility
adapter, put it at an explicit boundary and add a removal issue/test.

ESLint enforces these rules for `app/app/editor`, `components/editor`,
`hooks/editor`, and `lib/editor`. Browser requests belong in `lib/api`; the
editor surface must not call `fetch` directly.
