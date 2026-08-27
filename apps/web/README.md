# Neonix Web

`apps/web` is the Next.js host for the Neonix landing page, protocol docs,
authenticated workspace, Protocol V2 editor, MCP OAuth surface, and export
BFF routes.

## Editor boundary

The editor has one document model: `MotionProtocolV2` from
`@motionvideo/motion-protocol/v2`.

```text
Supabase project revision
  -> app.neonix.video/editor/[projectId]
  -> internal app/app/editor/[projectId]
  -> EditorSurfaceProvider
  -> V2 commands + timeline adapter
  -> PreviewStage + timeline projection
  -> PATCH /api/projects/[projectId]
```

`EditorSurfaceProvider` owns session state such as selection, locks, playhead,
and undo/redo. Only the Protocol V2 document and server revision are persisted.
The browser calls project BFF clients from `lib/api`; UI components do not
call `fetch` directly.

The canonical editor library is `lib/editor`:

- `document/` — Supabase repository and temporary seeded demo documents.
- `commands/` — V2 command facade.
- `library/`, `inspector/`, `stage/` — pure V2 operations.
- `timeline/` — the single timeline-to-V2 conversion boundary.
- `preview/` — backend-neutral V2 frame/time calculations.

Legacy V1 editor UI, Zustand store, browser-local persistence, and V1 tests
are intentionally not part of the web package.

## Local development

```bash
pnpm install
pnpm --filter @motionvideo/web dev
```

Useful commands:

```bash
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web typecheck:editor
pnpm --filter @motionvideo/web build
pnpm --filter @motionvideo/web e2e
```

See [`components/editor/timeline/README.md`](./components/editor/timeline/README.md)
for the timeline projection details and
[`lib/editor/README.md`](./lib/editor/README.md) for the library contract.
