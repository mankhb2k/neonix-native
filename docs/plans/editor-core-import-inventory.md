# Editor-core import inventory

This inventory is the Phase 0 baseline for the single-flow migration. It is
kept next to the implementation plan so a later deletion can be checked against
actual consumers instead of file names alone.

## Migrated in Phase 1

The following consumers now use the versionless editor-core surfaces:

| Consumer group | Canonical import |
| --- | --- |
| Editor surface, inspector, library commands, command tests | `@motionvideo/editor-core/document/commands` |
| Timeline projection, scale, clip model | `@motionvideo/editor-core/timeline` |
| Protocol clip selection facade | `@motionvideo/editor-core/selection` |

The old `@motionvideo/editor-core/v2` path has no production or test import.
The old `src/v2` files are removed. The web ESLint boundary keeps a negative
guard for that path so it cannot be reintroduced.

## Deferred to Phase 2

These consumers still use `@motionvideo/editor-core/timeline-runtime` because
they depend on the legacy timeline interaction vocabulary. They are deliberately
not deleted in Phase 1:

- timeline viewport, lane rows, clip move/trim, marquee, and seek hooks;
- pointer-session and DOM timeline adapters;
- library drop geometry and placement types;
- the web timeline adapter that still translates `TimelineCommand` into a
  document command.

Phase 2 will move these exports into `src/timeline` and
`src/interactions`, replace `TimelineCommand` with `TimelineEdit`, and then
enable the `/timeline-runtime` ESLint ban.

## Legacy core inventory

The root package still eagerly exports the following V1-oriented modules. They
are the reason the canonical command API uses the focused
`/document/commands` entrypoint until Phase 4:

- `document/*` canonical projection and authoring expansion;
- `properties/*` document property commands;
- `export/*` V1 export project builder;
- `sugar/*`, `frame-draft.ts`, and compatibility scene helpers;
- legacy timeline command runner, migrations, internal project sync, and
  history/property tests;
- `patterns` imports of the unversioned protocol package.

These modules remain available only for the Phase 4 port/delete decision. No
new V2 editor code may import them.

## Repeatable audit commands

```powershell
rg -n "editor-core/v2|editor-core/timeline-runtime|applyV2EditorCommand|V2EditorCommand" apps packages/editor-core
rg -n 'from "@motionvideo/motion-protocol"' packages/editor-core/src packages/patterns/src
rg -l '@motionvideo/editor-core/(v2|timeline-runtime)' apps packages
```

The first command must return only the intentional ESLint guard and the
deferred `/timeline-runtime` consumers until Phase 2 is complete. The second
command is the deletion/port checklist for the V1 typecheck debt.
