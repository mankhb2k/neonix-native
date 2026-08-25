# Editor Core: single Protocol V2 flow plan

## Decision

`@motionvideo/editor-core` will expose one editor domain only: the current
Protocol V2 document model. The package will not keep a `src/v2/` directory,
`@motionvideo/editor-core/v2` export, or `timeline-runtime` compatibility
surface.

This does **not** rename public protocol contracts such as `MotionProtocolV2`,
`compileProtocolV2`, or `RuntimeProjectV2`. Those names identify the persisted
schema version shared with MCP, Supabase revisions, preview, and export. The
cleanup removes the obsolete *parallel editor implementation*, not the schema
version marker.

The final public imports are intentionally domain-based:

```ts
import {
  applyEditorCommand,
  type EditorCommand,
} from "@motionvideo/editor-core";

import {
  projectLayersToTimeline,
  resolveClipMoveDrag,
} from "@motionvideo/editor-core/timeline";

import { createStageSession } from "@motionvideo/editor-core/interactions/stage";
```

There is no `@motionvideo/editor-core/v2` or
`@motionvideo/editor-core/timeline-runtime` import after this migration.

## Current findings

`src/v2/` is a small temporary facade, not a second implementation:

| Current file | Final location | Final public names |
| --- | --- | --- |
| `src/v2/commands.ts` | `src/document/commands/{types,apply,patch}.ts` | `EditorCommand`, `LayerPatch`, `AudioClipPatch`, `EditorDiagnostic`, `applyEditorCommand` |
| `src/v2/selection.ts` | `src/selection/clip-selection.ts` | `EditorSelection`, `selectionNone`, `selectionClips`, `selectedClipIds` |
| `src/v2/index.ts` | deleted | exports are owned by `src/index.ts` and `src/timeline/index.ts` |

The `v2/index.ts` timeline re-exports already have correct homes under
`src/timeline/`; they must not be copied. `src/timeline-runtime.ts` is only a
compatibility barrel and must be dissolved into explicit, versionless timeline
exports.

Before Phase 1/2, the active web editor imported the temporary `/v2` facade and
`/timeline-runtime` in timeline gesture/viewport hooks. Those migration
consumers are now on the canonical document, timeline, and interactions
surfaces; the former web adapter has moved into editor-core.

## Target layout

```text
packages/editor-core/src/
  index.ts                         # small, canonical editor-document API
  document/
    commands/
      types.ts                     # EditorCommand and patch types
      apply.ts                     # immutable atomic command reducer + inverse
      patch.ts                     # DeepPartial and safe patch helpers
    validation.ts                  # Protocol schema/compiler validation boundary
    layer-draft.ts                 # only if app still needs a pure creation draft
  selection/
    clip-selection.ts              # timeline clip selection value object
  timeline/
    index.ts                       # explicit versionless timeline public API
    model/
    projection.ts                  # Protocol V2 -> timeline view-model
    commands/
      types.ts                     # TimelineEdit, not V1 TimelineCommand
      to-document-command.ts       # TimelineEdit -> EditorCommand
    geometry/
    policies/
    selectors/
    interactions/                  # pure move, trim, marquee, seek, auto-scroll
  interactions/
    common/
    pointer/
    stage/                         # emits EditorCommand patches, never V1 property commands
  testing/
    fixtures/
```

`document/commands/` is the correct destination for the current `src/v2`
command reducer because it owns immutable mutations of the persisted document.
It should not be a root `commands/` folder: timeline and stage commands are
intent producers, while document commands are the one mutation contract.

## Ownership rules

| Concern | Owner after migration |
| --- | --- |
| Protocol schema and persisted JSON | `@motionvideo/motion-protocol` |
| Compile/runtime validation | compiler/runtime packages, called from `editor-core/document/validation` |
| Immutable document mutation and inverse | `editor-core/document/commands` |
| Timeline projection and pure interaction math | `editor-core/timeline` |
| Stage geometry and transform command generation | `editor-core/interactions/stage` |
| React state, DOM measurement, pointer listeners, autosave | `apps/web` |
| Supabase project/revision persistence and MCP authorization | app API / server packages |

No module in `editor-core` may import React, Next.js, Supabase, browser DOM,
or a renderer. Conversely, app code must not mutate `MotionProtocolV2` directly:
it creates an `EditorCommand` and applies it through the core.

## Migration phases

### Phase 0 — freeze and classify every legacy module

1. Add a dependency report for every source file currently imported from the
   root package, `/v2`, `/timeline-runtime`, and `/interactions/stage`.
2. Classify each old module as **port**, **delete**, or **move to app**. Do not
   preserve a file merely because an old test imports it.
3. Add a CI import gate that rejects:

   ```text
   @motionvideo/editor-core/v2
   @motionvideo/motion-protocol            # unversioned V1 model import
   ```

   The `/timeline-runtime` ban is enabled at the start of Phase 2, after its
   active web consumers are moved. The protocol root may remain only in an explicitly temporary migration test
   until its final deletion.
4. Record the current typecheck failure inventory. It is expected to identify
   V1 imports in `document/`, `properties/`, `export/`, `sugar/`, and legacy
   timeline modules; this becomes the deletion checklist.

Exit criteria: every file in `src/` has one of the three dispositions and no
new code is added to a V1 module.

### Phase 1 — establish the canonical document command API

1. Move `src/v2/commands.ts` into `src/document/commands/` without changing
   behavior. Split command types, patch helper, and reducer only where it makes
   tests easier to read.
2. Rename local-only identifiers:

   ```text
   V2EditorCommand        -> EditorCommand
   V2EditorCommandResult  -> EditorCommandResult
   V2EditorDiagnostic     -> EditorDiagnostic
   V2LayerPatch           -> LayerPatch
   V2AudioClipPatch       -> AudioClipPatch
   applyV2EditorCommand   -> applyEditorCommand
   ```

3. Keep `MotionProtocolV2`, `V2Asset`, `V2AudioClip`, and `V2AudioTrack` from
   the protocol package unchanged. They are schema names, not parallel editor
   paths.
4. Move `src/v2/selection.ts` to `src/selection/clip-selection.ts`, rename its
   API as described above, and remove any duplicate selection representation.
5. Add `./document/commands` and `./timeline` to the package export map. The
   command API uses the focused subpath until Phase 4 removes the legacy root
   barrel; exporting it from `src/index.ts` earlier would eagerly evaluate the
   V1 modules and break consumers at runtime.
6. Update the web editor, its tests, and any MCP consumer from `/v2` to the
   new root/timeline imports. Do not leave a compatibility re-export.

Exit criteria: `src/v2/` and `./v2` package export are gone; all document
mutations use `applyEditorCommand`.

### Phase 2 — remove the legacy timeline adapter (completed)

1. Replace legacy `TimelineCommand` with a versionless `TimelineEdit` whose
   terms match Protocol V2: layer IDs, audio track IDs, timing, and sibling
   order. It must not use `scene`, V1 lane persistence kinds, or V1 project
   nodes.
2. Move the useful conversion logic in
   `apps/web/lib/editor/timeline/adapter.ts` into
   `src/timeline/commands/to-document-command.ts`. Its output is
   `EditorCommand`, not a V2-named command.
3. Make `projectLayersToTimeline` the only Protocol-to-timeline projection.
   Rename `SceneTimelineClip` only if its meaning is actually a Protocol layer;
   otherwise retain it as a UI-neutral timeline term with no V1 type dependency.
4. Update move, trim, reorder, marquee, library-drop, and timeline viewport
   consumers to use `TimelineEdit` and explicit exports from
   `@motionvideo/editor-core/timeline`.
5. Dissolve `timeline-runtime.ts`; move its retained exports into
   `timeline/index.ts` or `interactions/index.ts`, preserving focused import
   paths rather than recreating a large compatibility barrel.

Exit criteria: no app code or core code translates a V1 timeline command into
a Protocol V2 command, and `/timeline-runtime` is deleted.

Completed in `refactor(editor-core): establish versionless timeline edit
boundary`: the translator now lives in `timeline/commands`, active consumers
use `TimelineEdit`, and the compatibility barrel/package export are gone.

### Phase 3 — port or delete active stage and draft logic

1. Rewrite `interactions/stage/commit.ts` to emit `patch-layer`/
   `patch-layers` `EditorCommand` values. It must no longer import
   `properties/property-commands` or produce `DocumentPropertyCommand`.
2. Replace active `FrameDraft` usage with a minimal Protocol V2 `LayerDraft`
   helper under `document/layer-draft.ts`, or move UI-only catalog metadata to
   `apps/web`. Delete deprecated `sceneFromFrameDraft` and
   `cloneSceneWithNewIds` aliases rather than carrying them forward.
3. Retain only pure stage/pointer/timeline geometry that is used by the V2
   editor. Move browser scheduling, scroll writes, element measurement, and
   pointer capture to `apps/web/lib/editor/interaction-host` and hooks.
4. Add tests proving stage move/resize/rotate and timeline move/trim each
   produce and apply an `EditorCommand` to the same Protocol V2 document.

Exit criteria: stage, header creation, library drop, and timeline edits share
one document mutation API.

### Phase 4 — delete the V1 implementation

Delete only after the reverse-import audit confirms no remaining consumers.
The initial deletion candidates are:

```text
document/canonical-projection.ts
document/document.ts
document/expand-authoring-to-core.ts
document/finalize-document-mutation.ts
document/group*.ts
document/sanitize-editor-project.ts
export/**
properties/**
sugar/**
model/**
mock/**
operations/**
overlay-scenes.ts
timeline/commands/**                  # legacy runner and V1 command types
timeline/internal/**                  # legacy placement/project-sync helpers
timeline/migrations/**
timeline/layer-mode/**                # if it has no Protocol V2 caller
history/**                            # UI session history already owns undo/redo
playback/**                            # keep only pure time helpers if still imported
```

For each candidate, either delete it with its tests or port its smallest
protocol-neutral algorithm into the target layout. Do not retain deprecated
aliases, V1 fixtures, V1 migration parsers, or test-only compatibility exports.

Exit criteria: `packages/editor-core` typechecks against only
`@motionvideo/motion-protocol/v2`; all V1 type errors disappear because their
source modules are gone, not because TypeScript exclusions hide them.

### Phase 5 — simplify public API and verify

1. Reduce `src/index.ts` to the canonical document command, selection, and
   deliberately shared interaction exports. It must not export a legacy
   compatibility surface.
2. Update `package.json` exports to only:

   ```json
   {
     ".": "./src/index.ts",
     "./timeline": "./src/timeline/index.ts",
     "./interactions/stage": "./src/interactions/stage/index.ts"
   }
   ```

   Keep another subpath only when it has a real, documented non-web consumer.
3. Rewrite `README.md` around the single document command flow and remove V1,
   compatibility, and deprecated alias claims.
4. Run the verification gate:

   ```powershell
   pnpm.cmd --filter @motionvideo/editor-core typecheck
   pnpm.cmd --filter @motionvideo/editor-core test
   pnpm.cmd --filter @motionvideo/web typecheck:editor
   pnpm.cmd --filter @motionvideo/web test:editor
   pnpm.cmd --filter @motionvideo/web build
   pnpm.cmd --filter @motionvideo/web exec playwright test e2e/smoke.spec.ts e2e/stage-transform-selection.spec.ts
   rg -n "editor-core/v2|editor-core/timeline-runtime|applyV2EditorCommand|V2EditorCommand|parseMotionProject|MotionProjectV1" apps packages/editor-core
   ```

5. Smoke test a real Supabase project and an MCP-created project: open both in
   the same web editor, make a timeline or stage edit, reload, and confirm the
   resulting revision is valid Protocol V2 JSON.

Exit criteria: one document command flow works for web, MCP project creation,
preview, and export input; there is no V1 or `/v2` editor implementation left.

## Commit sequence

1. `test(editor-core): freeze single-flow dependency inventory`
2. `refactor(editor-core): move document command API out of v2 facade`
3. `refactor(editor-core): establish versionless timeline edit boundary`
4. `refactor(editor-core): make stage commands protocol-native`
5. `refactor(editor-core): remove legacy V1 modules and exports`
6. `docs(editor-core): document the single editor flow`

Do not combine the Phase 4 deletion with MCP/Supabase behavior changes. Every
commit must build from the immediately preceding verified contract.
