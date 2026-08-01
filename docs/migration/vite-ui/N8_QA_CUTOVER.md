# N8 / H5 / P18–P22 QA + cutover checklist

Vite desktop is the default UI. Complete this before deleting `apps/web/components/desktop/**`.

## Automated gate (dev machine)

- [x] `pnpm --filter @motionvideo/editor-core test`
- [x] `pnpm --filter @motionvideo/desktop test` (unit; excludes `test:perf`)
- [x] `pnpm --filter @motionvideo/desktop test:perf` (happy-dom regression only — **not** 60fps acceptance)
- [x] `pnpm --filter @motionvideo/desktop test:perf:electron` (B2: visible window + rAF/drag thresholds — engineering gate, **not** 60fps acceptance)
- [x] `pnpm --filter @motionvideo/desktop typecheck`
- [x] `pnpm --filter @motionvideo/desktop lint`
- [x] `pnpm --filter @motionvideo/desktop build:renderer:release` (via `pnpm run pack`)
- [x] `pnpm --filter @motionvideo/desktop run pack` (**must** use `run pack` — bare `pnpm pack` is npm’s tarball command)
- [x] `pnpm --filter @motionvideo/desktop test:export-cli`
- [x] `pnpm --filter @motionvideo/desktop test:desktop-paths`
- [x] `pnpm --filter @motionvideo/desktop test:web-ban`
- [x] Production UI baselines: `pnpm --filter @motionvideo/desktop capture:baselines` + `compare:baselines`  
  (`VITE_ENABLE_UI_FIXTURES=1` only for fixture seed; release builds ignore `?fixture=`)

## Pack soak (H5 — 2026-08-01)

| Step | Result |
|------|--------|
| `pnpm run pack` (`electron-builder --win dir`) | PASS → `apps/desktop/release/win-unpacked/MotionVideo.exe` |
| export-cli smoke (inside pack) | PASS |
| web-import ban / desktop-paths | PASS |

## P18–P22 status

| Phase | Notes |
|-------|--------|
| P18 | Atomic `moveClipGroup`; `move-clip` omit-track = keep-lane; multi-select time-only on home lanes |
| P19 | Snap index @ gesture start; pin lanes; electron harness with visible window + thresholds (not 60fps) |
| P20 | Production UI seeds + candidate/reference compare (**partial** until soak); promote via `PROMOTE_BASELINES=1` |
| P21 | Backend id `canvas-experimental` (`"pixi"` alias); DOM↔Canvas contract tests; idempotent dispose |
| P22 | This checklist + REFACTOR-VITE status + Inspector seam below |

**Do not delete** `apps/web/components/desktop/**` in this wave.

## Inspector seam (P22 contract)

All Inspector / property edits must go through session commands — **no direct document store mutate**.

| Surface | Contract |
|---------|----------|
| Selection | `EditorSelection` only (`none` / `clips` / `node`) via session `SET_SELECTION` |
| Timeline mutations | `EXECUTE_TIMELINE_COMMAND` → `executeTimelineCommand` in `@motionvideo/editor-core` |
| Property mutations | `EXECUTE_PROPERTY_COMMAND` → `executePropertyCommand` / `DocumentPropertyCommand` (property adapters in editor-core: `resolvePropertyTargets`, `propertiesByGroup`) |
| UI panels | `InspectorPanel` / docks receive selection + `onExecute` / `onSelect` props — they must not write `project` / `clips` / `lanes` locally |

Deep property panels remain out of scope until a later phase; shell + number/boolean/string editors already use the property command path.

## Manual UI / soak checklist

Complete every item before approving legacy delete.

### Chrome / Hub / Editor surfaces

- [ ] Launch `release/win-unpacked/MotionVideo.exe` (create / open / save / reopen / import / export)
- [ ] Hub empty + recent list; create project with name + aspectRatio persists
- [ ] Editor chrome: TitleBar menus, Layers, Timeline, Preview, Inspector shell visible
- [ ] Pixel baselines still match after UI change: `capture:baselines` + `compare:baselines`

### Timeline / group move (P18–P19)

- [ ] Single-select clip drag: cross-lane when compatible; incompatible / outside = no commit
- [ ] Multi-select drag: shared time delta on **home lanes only**; spacing preserved; one undo entry
- [ ] Mixed-family multi-select: time-shift on origin lanes (no forced cross-lane)
- [ ] Snap: group members excluded from snap targets; gesture feels stable (no per-frame snap rebuild jank)
- [ ] Auto-scroll keeps time under cursor; Escape cancels drag

### Keyboard / persistence

- [ ] Undo / Redo; Escape cancel drag/rename; Delete clip; Enter/Space library add
- [ ] Rename focused → Home / Close menu / native close (single flush)
- [ ] Save As after rename uses new suggested filename
- [ ] Unicode project name / long path / large document open+save

### Media / playback / export

- [ ] Library drag → lane/time; wrong family rejects; drop outside cancels
- [ ] Missing media, OS file drag, playback, export, close-with-unsaved
- [ ] Stage remains DOM default; optional `canvas-experimental` only for local soak (not production default)

## Cutover delete (only after soak + one stable release)

1. Confirm FREEZE notice + no open blockers + this checklist green.
2. Explicit user/owner approve for legacy delete.
3. Separate commit: delete `apps/web/components/desktop/**`.
4. Remove `dev:desktop:legacy` / Next desktop routes if unused.
5. Keep `MOTIONVIDEO_RENDERER=legacy` only if a fallback is still required.
