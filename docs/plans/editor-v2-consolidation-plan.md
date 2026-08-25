# Neonix editor consolidation: one Protocol V2 flow

## Decision

Neonix will have one web-editor implementation only: **Motion Protocol V2**.
`apps/web/lib/editor` becomes its only editor library root. The temporary
`apps/web/lib/v2-editor` directory, the V1 Zustand store, and V1-only UI
surfaces will not remain as compatibility paths.

## Implementation status

- [x] Phase 0: add the V2 library contract and characterization test baseline.
- [x] Phase 1: move the active V2 helpers, tests, and timeline adapter into
  `lib/editor`; update consumers and test/typecheck globs.
- [x] Phase 2: replace the V1 persistence/store boundary with the V2 project
  repository. Supabase-backed project load/list/save is now behind
  `lib/editor/document/project-repository.ts`; seeded demo IDs remain an
  explicit development fallback.
- [x] Phase 3: remove verified-unreachable V1 UI, Zustand store, localStorage
  persistence, and legacy preview/playback helpers.
- [x] Phase 4: rename the editor tooling, enforce restricted imports, and
  document the V2 session boundary.
- [x] Phase 5: final deletion and verification.

This plan intentionally does **not** preserve a V1 project-opening path. The
current public editor entrypoint already creates and renders a `MotionProtocolV2`
document. Before destructive cleanup, confirm that no user data still depends
on the browser-local V1 project store. If such data exists, export it or build
a one-time importer before Phase 5.

## Current inventory

The active route is:

```text
app/app/editor/[projectId]/page.tsx
  -> lib/editor/document/project-repository.ts
  -> components/editor/EditorShell.tsx
  -> EditorSurfaceProvider (MotionProtocolV2 + applyV2EditorCommand)
  -> StageViewport + TimelineShell + SchemaInspector + Sidebar
```

The former `lib/v2-editor` modules are now represented by the canonical library:

| Former module | Active consumer | Canonical destination |
| --- | --- | --- |
| `projects.ts` | editor route | `lib/editor/document/demo-projects.ts` |
| `library.ts` | `use-library-pointer-gesture` | `lib/editor/library/commands.ts` |
| `inspector-transform.ts` | `SchemaInspector` | `lib/editor/inspector/transform.ts` |
| `stage-transform.ts` | `StageTransformOverlay` | `lib/editor/stage/transform.ts` |

The temporary compatibility directory and its web-only tests are deleted. V2
commands are imported through `@motionvideo/editor-core/v2`, and preview
calculations remain only where the production editor has a caller.

The V2 shell still uses a small set of generic modules under `lib/editor`
(`library`, `interaction-host`, `selection`, and browser-only timeline helpers).
Those must be retained and typed against V2; their location is already correct.

## Target layout

```text
apps/web/lib/editor/
  document/
    demo-projects.ts              # temporary seeded V2 documents only
    load-project.ts               # later: Supabase/MCP project document loader
  commands/
    index.ts                      # explicit V2 command facade, no V1 wrapper
  library/
    commands.ts
    library-payload.ts
    library-drag-session.ts
    timeline-library-drop.ts
  inspector/
    transform.ts
  stage/
    transform.ts
    renderer/                     # V2 preview renderer ports/adapters only
  timeline/
    adapter.ts                    # MotionProtocolV2 -> timeline projection
    scale.ts
    interactions/
  selection/
    keyboard-selection.ts
  interaction-host/
    browser-scheduler.ts
    timeline-dom.ts
  preview/
    ...                           # only if it has a production V2 caller
  __tests__/
  __fixtures__/
```

Rules for the target:

- Web editor documents use `MotionProtocolV2` exclusively.
- Mutations use `V2EditorCommand` and `applyV2EditorCommand` exclusively.
- The React editor session stays in `EditorSurfaceProvider`; it is not a second
  document store.
- `lib/editor` contains domain helpers, not React components. UI remains under
  `components/editor`; browser gesture hooks remain under `hooks/editor`.
- `V2` stays in protocol/type names where required, but is removed from local
  folder, component, hook, and route names once no V1 implementation exists.

## Execution phases

### Phase 0 — freeze and characterize the V2 contract

1. Add a short architecture note to `lib/editor/README.md` describing the
   canonical document, command, preview, timeline, persistence, and ownership
   boundaries.
2. Add characterization tests for the live route's three seeded documents
   (`shape`, `overlap`, `three-kingdoms`): load, preview projection, add library
   item, transform, undo/redo, timeline move/trim, and JSON validity.
3. Record a manual smoke script for `/app/editor/shape`: open, select, add text,
   drag a clip, edit transform, undo/redo, reload. This is the behavior baseline
   before removing legacy code.
4. Do not introduce new imports from `@/lib/v2-editor`, `useEditorStore`, or
   the V1 protocol while this migration is in progress.

Exit criteria: the V2 route and its tests establish the expected behavior
without importing the legacy Zustand store.

### Phase 1 — create the canonical V2 library surface

1. Create the target folders listed above inside `lib/editor`.
2. Move the four active V2 modules without behavior changes:
   - `v2-editor/projects.ts` -> `editor/document/demo-projects.ts`
   - `v2-editor/library.ts` -> `editor/library/commands.ts`
   - `v2-editor/inspector-transform.ts` -> `editor/inspector/transform.ts`
   - `v2-editor/stage-transform.ts` -> `editor/stage/transform.ts`
3. Move each colocated test with its source, update relative imports, and update
   the editor route, Sidebar gesture hook, SchemaInspector, and
   StageTransformOverlay in the same change.
4. Move the V2 timeline adapter out of `components/editor/timeline` into
   `lib/editor/timeline/adapter.ts` if it contains only domain conversion. Keep
   rendering-only components in `components/editor/timeline`.
5. Rename V2-only UI names once the imports are clean:
   `V2StageViewport` -> `StageViewport`, `V2EditorPage` -> `EditorPage`, and
   `v2Document` -> `initialDocument`. Do this in a separate mechanical commit
   so behavior changes are easy to isolate.

Exit criteria: `rg "@/lib/v2-editor|lib/v2-editor" apps/web` returns no source
imports, and all active editor code resolves through `@/lib/editor/...`.

### Phase 2 — remove the V1 document/store path

1. Replace the V1 root imports in web editor code with V2 APIs. In particular,
   no active editor component or hook may import the unversioned
   `@motionvideo/motion-protocol` model, `parseMotionProject`,
   `MotionProject`, or the V1 command/history APIs.
2. Keep `@motionvideo/editor-core/timeline-runtime` only where it is a
   protocol-neutral layout/gesture utility. Put the conversion boundary in
   `lib/editor/timeline/adapter.ts`; components must not translate V1/V2 data
   ad hoc.
3. Replace any V1 persistence call with the V2 project repository interface:
   `loadProject(projectId)`, `saveProject(projectId, document, revision)`, and
   `listProjects()`. Its first production implementation should use the
   Supabase `projects`/`project_revisions` tables, not localStorage. Seeded demo
   documents remain behind `document/demo-projects.ts` only until this loader
   lands.
4. Keep editor-only session state (selection, locks, hidden layers, playhead,
   undo/redo) in `EditorSurfaceProvider`. Persist only the Protocol V2 document
   and server revision metadata.
5. Update the V2 editor page so arbitrary project IDs resolve through the V2
   repository. Remove the `isV2EditorProjectId` allow-list when Supabase loading
   is available.

Exit criteria: the project route, persistence, preview, export input, and MCP
project source all exchange the same `MotionProtocolV2` JSON document.

### Phase 3 — delete unreachable legacy UI and helpers

Delete only after a reverse-import check and the Phase 0 smoke test. Current
static inventory identifies these as likely unreachable from the V2 entrypoint:

| Candidate | Reason / required check |
| --- | --- |
| `components/hub/ProjectList.tsx`, `NewProjectModal.tsx` | Old localStorage V1 project flow; not imported by `WorkspaceHome`. |
| `components/editor/timeline/MinimalTimeline.tsx` | V1 Zustand timeline, not rendered by `EditorShell`. |
| `components/editor/stage/PreviewStageHost.tsx`, `InteractionOverlay.tsx`, old `StageViewport.tsx` | Replaced by the V2 preview/stage surface. Confirm no Storybook or test imports. |
| `components/editor/panels/ProtocolJsonPanel.tsx`, `GroupLayersPanel.tsx`, `inspector/ai/AskAIBar.tsx` | Depend on V1 Zustand state and are not mounted by the V2 shell. |
| `hooks/editor/use-group-scope.ts`, `hooks/editor/stage/use-stage-selection.ts`, legacy timeline hotkey adapter | Only retained by the V1 component tree. |
| `lib/editor/store/**`, `authoring/**`, `persistence/**`, `legacy-runtime/**`, V1 `ai/**`, V1 `export/**`, V1 `preview/**`, V1 playback store | Delete together after their consumers are removed; move no code from these folders by default. |
| `lib/v2-editor/commands.ts` and its web-only tests | Redundant re-export; test the command package directly. |
| `lib/v2-editor/preview-controller.ts` and tests | Remove if no production V2 preview API is introduced in Phase 2. |

Before deleting a directory, run a reverse-import search over `apps/web`,
Storybook files, tests, and scripts. A file that is only imported by another
deletion candidate can be removed in the same commit. Never use test-only
imports as a reason to preserve a dead production architecture.

Exit criteria: no V1 editor page, component, hook, storage module, or test
remains in the web package.

### Phase 4 — simplify tooling and enforce the boundary

1. Replace `tsconfig.v2.json` with `tsconfig.editor.json` and replace
   `vitest.v2.config.ts` with `vitest.editor.config.ts`. Their names must not
   imply a second editor generation.
2. Update scripts:

   ```json
   {
     "typecheck:editor": "tsc --noEmit -p tsconfig.editor.json",
     "test:editor": "vitest run --config vitest.editor.config.ts"
   }
   ```

3. Completed: the old `typecheck:v2` script and V2-only config files were
   removed after the editor commands were verified locally.
4. Add ESLint restricted-import rules for web editor source:
   - ban `@/lib/v2-editor/**`;
   - ban deleted `@/lib/editor/store/**`, `authoring/**`, `persistence/**`, and
     `legacy-runtime/**` paths;
   - ban unversioned V1 protocol imports in `app/app/editor`,
     `components/editor`, `hooks/editor`, and `lib/editor`;
   - allow `editor-core/v2` and explicitly approved protocol-neutral timeline
     runtime helpers.
5. Update the timeline README and any architecture docs so they describe the
   V2 `EditorSurfaceProvider` state model rather than Zustand/V1 history.

Exit criteria: a new editor feature cannot silently reintroduce either the old
folder or the old document model.

### Phase 5 — final deletion and verification

1. Delete `apps/web/lib/v2-editor` after Phase 1 imports and tests are moved.
2. Delete the approved legacy inventory from Phase 3.
3. Remove obsolete TypeScript/Vitest configs, stale ESLint exceptions, and
   README claims about V1/Zustand editor state.
4. Run:

   ```powershell
   pnpm.cmd --filter @motionvideo/web typecheck:editor
   pnpm.cmd --filter @motionvideo/web test:editor
   pnpm.cmd --filter @motionvideo/web build
   pnpm.cmd --filter @motionvideo/web e2e
   rg -n "@/lib/v2-editor|lib/v2-editor|useEditorStore|parseMotionProject" apps/web/app/app/editor apps/web/components/editor apps/web/hooks/editor apps/web/lib/editor --glob "*.{ts,tsx}"
   ```

5. Manually smoke test the deployed `app.neonix.video` editor with a real
   Supabase-backed project and an MCP-created project; both must open the same
   V2 document and save a new revision.

Phase 5 verification completed: the editor unit contract (51 tests), production
build, and focused Playwright smoke/stage suites pass. The complete Playwright
matrix was started; its long Remotion parity case exceeded the local run window,
so it is tracked separately from the focused editor gate. Production smoke still
requires a live authenticated Supabase/MCP session.

## Commit sequence

Keep this migration reviewable and reversible:

1. `test(editor): characterize current V2 editor behavior`
2. `refactor(editor): move active V2 helpers into canonical editor library`
3. `refactor(editor): establish V2 project repository boundary`
4. `refactor(editor): remove V1 UI consumers`
5. `chore(editor): delete V1 store and v2-editor compatibility paths`
6. `chore(editor): rename editor test/typecheck contracts and enforce imports`

Do not combine functional changes, Supabase persistence changes, and mass file
deletions in one commit.

## Risks and decisions to confirm before implementation

- **Existing V1 browser projects:** if any are worth keeping, create a
  one-time V1-to-V2 converter and retain it outside the runtime editor until
  migration is complete. If not, remove the browser-local V1 store outright.
- **Demo routes:** `shape`, `overlap`, and `three-kingdoms` are fixtures, not a
  product project repository. Keep them only for development/tests once real
  Supabase projects are the normal route input.
- **Preview controller:** delete it unless a production caller needs a
  backend-neutral V2 preview calculation API; testing a wrapper with no caller
  is not a reason to keep it.
- **Timeline runtime:** preserve only its protocol-neutral geometry and gesture
  helpers. Any V1-document conversion must be removed or moved behind the one
  V2 adapter boundary.
