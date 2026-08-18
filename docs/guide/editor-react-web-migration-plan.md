# Editor React Web Migration Plan

> Goal: move `@motionvideo/editor-react` into `apps/web` so the web app owns the React layer for editor UI and hooks.
>
> Scope: optimize for web first. Do not change `@motionvideo/editor-core` or `@motionvideo/editor-interactions` semantics unless a web-local rename is needed.
>
> Strategy: keep pure logic in shared packages, move React wrappers and editor UI adapters into web, then delete or reduce the package boundary when imports are gone.

---

## 1. Why this migration exists

Current state:

- `apps/web` depends on `@motionvideo/editor-react` for hooks and some UI components.
- `@motionvideo/editor-react` is already a thin wrapper around `@motionvideo/editor-interactions` and `@motionvideo/editor-core`.
- Desktop is not the immediate target, so keeping a separate React package adds indirection without near-term payoff.

Target state:

- `apps/web` owns the React hooks used by the editor UI.
- Shared logic remains in `editor-core` and `editor-interactions`.
- Web imports become easier to trace because the host app owns its own hooks.

---

## 2. Non-goals

- Do not move protocol logic into `apps/web`.
- Do not merge `editor-core` into web.
- Do not rewrite the editor store into a new architecture during this migration.
- Do not change JSON protocol field names as part of this work.
- Do not remove `editor-interactions` unless a later cleanup proves it is also web-only.

---

## 3. Guiding rules

1. Pure math and gesture state machines stay shared.
2. React hooks belong to the host app unless they are genuinely reusable across hosts.
3. Web-specific DOM, refs, and store wiring should live in `apps/web`.
4. UI components that only render editor chrome should live in `apps/web/components`.
5. Every moved hook must keep behavior identical first, then be refactored for naming or ergonomics.

---

## 4. Recommended target layout

```text
apps/web/
  hooks/editor/
    pointer/
    timeline/
    stage/
  components/editor/
    shared/
    panels/
    timeline/
    stage/
  lib/editor/
    ...store, persistence, preview, export, AI, protocol glue

packages/editor-react/
  (temporary compatibility shim or deprecation-only package)
```

Suggested split:

- `hooks/editor/*` for React hooks.
- `components/editor/*` for presentational React components.
- `lib/editor/*` for state, persistence, and app glue.

---

## 5. File inventory

### Hooks and adapter files to move

| Current file | Suggested web destination | Notes |
| --- | --- | --- |
| `packages/editor-react/src/pointer/use-pointer-session-host.ts` | `apps/web/hooks/editor/pointer/use-pointer-session-host.ts` | React host session and gesture coordination. |
| `packages/editor-react/src/pointer/use-pointer-capture.ts` | `apps/web/hooks/editor/pointer/use-pointer-capture.ts` | Browser pointer capture helper. |
| `packages/editor-react/src/timeline/use-timeline-viewport-metrics.ts` | `apps/web/hooks/editor/timeline/use-timeline-viewport-metrics.ts` | DOM measurement / viewport math wrapper. |
| `packages/editor-react/src/timeline/use-visible-timeline.ts` | `apps/web/hooks/editor/timeline/use-visible-timeline.ts` | Web viewport + overscan hook. |
| `packages/editor-react/src/timeline/use-timeline-seek.ts` | `apps/web/hooks/editor/timeline/use-timeline-seek.ts` | Seek gesture hook. |
| `packages/editor-react/src/timeline/use-timeline-marquee.ts` | `apps/web/hooks/editor/timeline/use-timeline-marquee.ts` | Selection marquee hook. |
| `packages/editor-react/src/timeline/use-clip-move.ts` | `apps/web/hooks/editor/timeline/use-clip-move.ts` | Timeline move hook. |
| `packages/editor-react/src/timeline/use-clip-trim.ts` | `apps/web/hooks/editor/timeline/use-clip-trim.ts` | Timeline trim hook. |
| `packages/editor-react/src/timeline/use-layer-move.ts` | `apps/web/hooks/editor/timeline/use-layer-move.ts` | Layer move hook. |
| `packages/editor-react/src/timeline/use-layer-trim.ts` | `apps/web/hooks/editor/timeline/use-layer-trim.ts` | Layer trim hook. |
| `packages/editor-react/src/timeline/use-timeline-hotkeys.ts` | `apps/web/hooks/editor/timeline/use-timeline-hotkeys.ts` | Hotkey wrapper should wire to web store. |
| `packages/editor-react/src/stage/use-stage-pointer-session.ts` | `apps/web/hooks/editor/stage/use-stage-pointer-session.ts` | Stage pointer gesture host. |
| `packages/editor-react/src/stage/use-node-transform.ts` | `apps/web/hooks/editor/stage/use-node-transform.ts` | Transform gesture hook. |
| `packages/editor-react/src/stage/use-stage-selection.ts` | `apps/web/hooks/editor/stage/use-stage-selection.ts` | Selection gesture hook. |
| `packages/editor-react/src/stage/use-stage-hotkeys.ts` | `apps/web/hooks/editor/stage/use-stage-hotkeys.ts` | Stage hotkeys wrapper. |
| `packages/editor-react/src/timeline/visible-lane-window.ts` | `apps/web/hooks/editor/timeline/visible-lane-window.ts` or `apps/web/lib/editor/timeline/visible-lane-window.ts` | Keep if used only by web. |

### UI components to move

| Current file | Suggested web destination | Notes |
| --- | --- | --- |
| `packages/editor-react/src/panels/LayersTree.tsx` | `apps/web/components/editor/panels/LayersTree.tsx` | Web panel component, likely used by sidebar. |
| `packages/editor-react/src/frame/Breadcrumbs.tsx` | `apps/web/components/editor/frame/Breadcrumbs.tsx` | Breadcrumb UI for group drill-down. |

### Leave in shared packages

| Package / file type | Keep shared? | Reason |
| --- | --- | --- |
| `@motionvideo/editor-core` | Yes | Domain logic, commands, document operations. |
| `@motionvideo/editor-interactions` | Yes | Pure gesture math and pointer state machines. |
| Non-React helpers that only expose math / policy | Yes | These are still reusable and testable. |

---

## 6. Migration phases

### Phase 0: freeze the current public surface

Tasks:

- [ ] Record the current `editor-react` exports from `packages/editor-react/src/index.ts`.
- [ ] Record every current web import of `@motionvideo/editor-react`.
- [ ] Mark which imports are hook-only and which are presentational UI.
- [ ] Confirm `editor-interactions` remains a dependency of the moved hooks.

Done when:

- There is a complete migration inventory.
- No file moves have happened yet.
- The expected web destinations are agreed.

### Phase 1: move React hooks into web

Tasks:

- [ ] Create `apps/web/hooks/editor/pointer`.
- [ ] Create `apps/web/hooks/editor/timeline`.
- [ ] Create `apps/web/hooks/editor/stage`.
- [ ] Move hook files one by one, preserving behavior.
- [ ] Keep the public function names stable during the first pass.
- [ ] Replace `@motionvideo/editor-react` imports in web hook consumers with local imports.
- [ ] Keep tests green after each moved hook group.

Suggested order:

1. Pointer host and capture
2. Timeline viewport and visible window
3. Timeline seek and marquee
4. Clip and layer gesture hooks
5. Stage pointer, transform, selection, and hotkeys

Done when:

- Web no longer imports hook APIs from `@motionvideo/editor-react`.
- All moved hooks still pass existing tests.
- Behavior remains unchanged in the editor UI.

### Phase 2: move UI components into web

Tasks:

- [ ] Move `LayersTree` into `apps/web/components/editor/panels`.
- [ ] Move `Breadcrumbs` into `apps/web/components/editor/frame`.
- [ ] Update `GroupLayersPanel` and any other consumers to use the local copies.
- [ ] Decide whether the component filenames should keep the same names or be renamed to match web conventions.
- [ ] Verify styling and layout do not change.

Done when:

- No web UI component imports remain from `@motionvideo/editor-react`.
- Sidebar and breadcrumb UX still render the same.

### Phase 3: simplify package boundaries

Tasks:

- [ ] Update `apps/web/package.json` to remove `@motionvideo/editor-react` if nothing depends on it anymore.
- [ ] Decide whether `packages/editor-react` becomes a compatibility shim or is removed later.
- [ ] Update workspace docs to say the web app owns the React editor layer.
- [ ] Update lint rules or path aliases if any import path is now obsolete.

Possible end states:

- Option A: keep `packages/editor-react` as a tiny re-export shim for a short transition period.
- Option B: delete the package once the web app is the only consumer.

Recommended choice for web-first work:

- Keep a shim until the migration is stable.
- Remove the shim only after the web app has been exercised end to end.

### Phase 4: cleanup and naming pass

Tasks:

- [ ] Rename local web hooks to match the app’s terminology.
- [ ] Remove old compatibility names only after callers are updated.
- [ ] Simplify `lib/editor/store` imports now that hooks are local.
- [ ] Move any leftover web-specific adapter helpers out of `packages/editor-react`.
- [ ] Update docs/README files so the app structure matches the code structure.

Done when:

- The codebase has one obvious home for web editor hooks.
- `editor-react` is no longer part of the daily editing path.

---

## 7. Web-specific naming policy

Use names that describe the host role, not the package history.

Good:

- `useStagePointerSession`
- `useTimelineViewportMetrics`
- `useTimelineSeek`
- `LayersTree`
- `Breadcrumbs`

Avoid:

- `shared*` unless the file is genuinely shared between hosts.
- `legacy*` in new web code.
- `adapter*` unless the file is a true boundary wrapper.

If a hook becomes web-owned, prefer names that read like part of `apps/web`, not like a package export.

---

## 8. Risk checklist

- [ ] A moved hook still depends on React state from `editor-react` somewhere else.
- [ ] A component move accidentally changes import cycles.
- [ ] Web-only code keeps a stale package import path in one corner.
- [ ] A hook that looked pure actually reaches into store or DOM in a way that needs extra test coverage.
- [ ] The package boundary is removed before the local web version is stable.

Mitigation:

- Move in small batches.
- Keep tests close to each batch.
- Do not rename and relocate in the same commit unless the file is trivial.

---

## 9. Suggested implementation order

1. Freeze the export/import inventory.
2. Move pointer/session hooks.
3. Move timeline hooks.
4. Move stage hooks.
5. Move `LayersTree` and `Breadcrumbs`.
6. Switch web imports to local paths.
7. Remove the package dependency or replace it with a shim.
8. Clean up names and docs.

---

## 10. Definition of done

This migration is complete when all of the following are true:

- `apps/web` no longer imports `@motionvideo/editor-react` for active editor code.
- The web editor renders and behaves the same as before.
- Shared gesture math still lives in `editor-interactions`.
- Domain logic still lives in `editor-core`.
- The remaining file structure makes ownership obvious to a new contributor.

