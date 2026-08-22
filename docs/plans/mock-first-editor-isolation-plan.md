# Mock-first editor-core isolation plan

## Decision

Preserve every editor component and its visual design. Consolidate all pure
editor logic in `@motionvideo/editor-core`, including pointer, timeline, and
stage interaction algorithms. The web app owns all React, DOM, PointerEvent,
canvas, animation-frame, and localStorage code.

The editor works on deterministic mock data first. It must not directly parse
Protocol V2, compile, evaluate the runtime, or construct renderer objects.
Those bridges are deferred until V2 capabilities are certified.

This follows [V2 architecture](../guide/v2-architechture.md): the editor owns
authoring intent, selection, timeline state, and interaction policy; it does
not own atomic protocol parsing, Matrix4/GPU math, runtime evaluation, or
paint commands.

## Target dependency graph

```text
apps/web/components/editor + hooks + lib
          |
          | plain data, commands, ports
          v
@motionvideo/editor-core
  src/model          editor-facing document, timeline, selection, commands
  src/interactions   pure pointer/timeline/stage geometry and sessions
  src/mock           deterministic fixtures and mock reducers
  src/ports          repository, preview, export interfaces
          |
          +---- no Protocol / Compiler / Runtime / Renderer imports

apps/web/lib/editor/interaction-host
  browser scheduler, DOM metrics, scroll writes, canvas and storage adapters

Future only:
@motionvideo/editor-v2-adapter
  -> motion-protocol -> motion-compiler -> motion-runtime -> renderer
```

`editor-interactions` is retired. There is one editor-domain package:
`@motionvideo/editor-core`.

## Boundaries

1. Do not delete `apps/web/components/editor/**` or change its design merely
   to achieve isolation.
2. `editor-core` contains only deterministic TypeScript and plain data. It
   must not use React, DOM types, `window`, `document`, `PointerEvent`, canvas,
   localStorage, requestAnimationFrame, Protocol, Compiler, Runtime, Preview,
   or renderer imports.
3. `apps/web/hooks/editor/**` and `apps/web/lib/editor/**` may implement host
   concerns. They call core through plain input/output types.
4. A browser adapter reads DOM state, calls a pure core function, then applies
   its returned intent. For example, the app measures scroll metrics, core
   computes the next scroll position, and the app writes `scrollLeft`.
5. Mock data uses core model types. It is never a partial Protocol V2 object
   and never uses `any` to resemble a runtime frame.
6. Unsupported mock operations return an explicit result. They must not fall
   through to a V1 path.
7. The future adapter is the only approved Protocol/Compiler/Runtime bridge.

## Execution plan

### P0 — Consolidate interaction logic (in progress)

- [x] Move pure pointer, timeline, marquee, drag/drop, transform, and stage
  session algorithms from `editor-interactions` to `editor-core/src/interactions`.
- [x] Move interaction tests with the pure source.
- [x] Move browser scheduler and DOM seek/scroll wrappers to
  `apps/web/lib/editor/interaction-host`.
- [x] Keep runtime-bound V1 stage hit testing in a web legacy adapter rather
  than importing Runtime in core.
- [x] Remove the obsolete `packages/editor-interactions` workspace and web
  dependency.
- [ ] Replace the remaining legacy stage hit adapter with mock node bounds.

Exit: all consumers use `@motionvideo/editor-core` for pure interaction logic;
the obsolete standalone interaction package and its imports are gone.

### P1 — Establish core-owned mock model and ports

- [x] Add `src/model` types for `EditorDocument`, nodes, lanes, clips,
  selection, commands, command results, preview state, and export requests.
- [x] Add `src/ports` for repository, preview, and export operations.
- [x] Add `src/mock` deterministic fixtures: blank, rectangle, overlap, long
  timeline, missing preview, and unsupported action.
- [x] Add pure mock command reducer and unit tests for fixture ids, commands,
  and unsupported results.
- [x] Ensure these new folders import no legacy editor modules or render stack.

Exit: core exposes a complete mock-facing surface without a separate contracts
package.

### P2 — Create web host adapters

- [ ] Add in-memory/localStorage repository adapter under
  `apps/web/lib/editor-mock` using a new mock-only storage key.
- [ ] Add mock preview and export adapters with explicit `mock` or
  `unavailable` status.
- [ ] Move DOM/canvas measurements, browser scheduling, and scroll effects to
  `apps/web/lib/editor/interaction-host` or hooks as appropriate.
- [ ] Add host tests for DOM metric conversion and storage parsing.

Exit: browser-only APIs occur only in web host code.

### P3 — Rewire the existing editor UI in vertical slices

- [ ] Shell/header: title, save state, undo/redo, and mock export status.
- [ ] Timeline: mock lanes/clips, seek, selection, move/trim previews, and
  command results while retaining current JSX/CSS.
- [ ] Layers/inspector: mock nodes and fields, disabled unsupported controls,
  and model inspection.
- [ ] Stage: replace Runtime V1 snapshot selection with a mock bounds board.
- [ ] Library/AI: issue core commands or explicit unsupported results only.

Exit: the preserved editor UI works end-to-end using mock state and no V1
imports in its active route.

### P4 — Remove legacy dependencies from editor-core

- [ ] Replace V1 document, properties, export, timeline, selection, and
  fixture modules with the core mock model incrementally.
- [ ] Remove `motion-protocol`, `motion-runtime`, `patterns`, and
  render-contracts dependencies once no remaining core module uses them.
- [ ] Split or delete obsolete V1 compatibility exports only after every web
  consumer has migrated; do not delete visual components.
- [ ] Make full `@motionvideo/editor-core` typecheck green.

Exit: editor-core is dependency-free apart from language-level utility
dependencies and has no render-stack import.

### P5 — Guard and integrate V2 later

- [ ] Add an isolation validator for active editor roots and editor-core.
- [ ] Make CI run mock tests, core tests, V2 boundary validators, and the
  complete typecheck.
- [ ] Create `editor-v2-adapter` only after certified V2 features exist.
- [ ] Map core commands to Protocol V2, then compile/evaluate only inside that
  adapter; keep renderer objects private.

Exit: changing mock preview to V2 preview changes an adapter, not the UI or
editor-core model.

## Verification commands

```text
pnpm.cmd --filter @motionvideo/editor-core test
pnpm.cmd --filter @motionvideo/editor-core typecheck
pnpm.cmd --filter @motionvideo/web typecheck
pnpm.cmd typecheck:v2
node scripts/validate-arch-deps.ts
```

Until P4 completes, a full editor-core typecheck is expected to reveal legacy
V1 Protocol errors. That failure is tracked work, not evidence that the new
interaction module is coupled to the render stack. The interaction-only tests
and forbidden-import validator are the P0 gate.
