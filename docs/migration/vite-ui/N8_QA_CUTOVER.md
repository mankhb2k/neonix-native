# N8 / H5 / P18–P22 / UI-0 / UI-0.1 QA + cutover checklist

Vite desktop is the default UI.

**Legacy delete:** `apps/web/components/desktop/**` must **never** be deleted until the product owner explicitly approves — not after soak alone, not as part of UI-0…UI-6. There is **no** automatic “legacy cleanup” phase.

**FREEZE.md note:** [`apps/web/components/desktop/FREEZE.md`](../../apps/web/components/desktop/FREEZE.md) still contains a stale line about deleting the tree after soak — treat that as **outdated**. Do not edit that file while the tree is protected; this doc and CI (`test:web-ban` → `probe-legacy-desktop-protected`) are the source of truth.

## Automated gate (dev machine)

- [x] `pnpm --filter @motionvideo/editor-core test`
- [x] `pnpm --filter @motionvideo/desktop test` (unit; excludes `test:perf`)
- [x] `pnpm --filter @motionvideo/desktop test:perf` (happy-dom regression only — **not** 60fps acceptance)
- [x] `pnpm --filter @motionvideo/desktop test:perf:electron` (UI-0.1: **real** pointer gesture on timeline clip strip + viewport + mutation — engineering gate, **not** 60fps; probe is read-only)
- [x] `pnpm --filter @motionvideo/desktop typecheck`
- [x] `pnpm --filter @motionvideo/desktop lint` (includes `scripts/**` QA gates)
- [x] `pnpm --filter @motionvideo/desktop build:renderer:release` (via `pnpm run pack`)
- [x] `pnpm --filter @motionvideo/desktop run pack` (**must** use `run pack` — bare `pnpm pack` is npm’s tarball command)
- [x] `pnpm --filter @motionvideo/desktop test:export-cli`
- [x] `pnpm --filter @motionvideo/desktop test:desktop-paths`
- [x] `pnpm --filter @motionvideo/desktop test:web-ban` (import ban + **manifest filesystem** gate for 68 files under `apps/web/components/desktop/**`)
- [x] Production UI baselines: `capture:baselines` + `compare:baselines`
  (Vite regression goldens only. Web parity: `reference-web/` + `capture:geometry` / `compare:geometry`.)
- [x] CSS-0: `test:perf:electron` single `reactPointerHandler` path + `historyDepth` +1

**Note:** main renderer bundle still warns >500 kB minified — tracked; UI-0.1 lazy-loads `EditingWorkspace` so Hub does not pull the editor chunk. DOM remains default stage backend.

## UI-0 exit gate (foundation)

- [x] Desktop typecheck green (`CanvasStageRendererPort` local type)
- [x] Viewport lock — timeline + clips in view at capture/perf
- [x] Capture fails if actual size ≠ requested
- [x] Pixel-diff uses tolerance (not SHA-only tautology)
- [x] `resolveClipGroupMove` uses `clipById` Map
- [x] Perf drag requires in-viewport + startTime/left mutation (UI-0; probe mutation was honesty gap — fixed in UI-0.1)

## UI-0.1 exit gate (honesty)

- [x] `test:perf:electron` — `pointerDragOk` + `commandMutationOk` via real pointer events on `[data-testid=timeline-clip-strip]` (not fixture nudge)
- [x] Group move plan/index + RAF scroll cleanup
- [x] `reference-web/` folder (manual UX parity); Vite `baselines/` remain regression-only
- [x] Lazy `EditingWorkspace`; legacy-desktop delete probe in `test:web-ban`

## Pack soak (H5 — 2026-08-01)

| Step | Result |
|------|--------|
| `pnpm run pack` (`electron-builder --win dir`) | PASS → `apps/desktop/release/win-unpacked/MotionVideo.exe` |
| export-cli smoke (inside pack) | PASS |
| web-import ban / desktop-paths | PASS |

## P18–P22 / UI status

| Phase | Notes |
|-------|--------|
| P18–P22 | Group move, snap, baselines, canvas-experimental, docs |
| UI-0 | Viewport + typecheck + exact-size baselines + real pixel-diff + perf mutation |
| UI-0.1 | QA honesty (real pointer drag), group-move plan, RAF cleanup, dual baselines, protected legacy CI |
| UI-1…UI-6 | Deferred visual port (tokens → chrome → timeline → hub → inspector → soak) — **no legacy delete** |

**Do not delete** `apps/web/components/desktop/**` until owner approve. CI fails on deletions under that path.

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

Complete every item before the owner may approve a future delete. Until then the tree stays forever in parallel.

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

## Legacy web desktop (protected — no automatic delete)

1. Keep `apps/web/components/desktop/**` as the visual/keyboard specification.
2. Do **not** schedule or automate deletion after soak or UI-6.
3. Only an **explicit owner approve** (separate decision, separate PR) may remove it later.
4. Until then: `probe-legacy-desktop-protected` must stay green; FREEZE.md’s “delete this tree” line is **stale**.
5. Optional later (owner-driven only): remove `dev:desktop:legacy` / Next desktop routes if unused.
