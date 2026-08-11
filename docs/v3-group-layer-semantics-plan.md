# V3 Group Layer Semantics Plan

> Status: architecture implementation plan
>
> Goal: standardize V3 group layers so a `group` node behaves like a real timeline layer: it has timing, transform, z-order, animation, effects, and child layers whose timing is relative to the group.

## Decision

V3 keeps one authoring model:

```text
Scene
  timeline layer
    nested timeline layer
      nested timeline layer
```

In JSON, a timeline layer inside a scene is a `NodeV3`.

```text
NodeV3 = timeline layer inside a Scene
GroupNodeV3 = timeline layer that can own child layers
```

The scene is the implicit root parent:

```text
parentId: null        -> direct child of Scene
parentId: "group.id"  -> child of that group layer
```

## Terminology

Use these terms consistently in docs, editor UI, MCP prompts, and implementation:

- `timeline track/lane`: scene-level lanes in `timeline.visualTracks`, such as `main` and `overlay`.
- `timeline layer`: node-level layer inside a scene.
- `group layer`: a `type: "group"` node that can contain child timeline layers.
- `root layer`: a node with `parentId: null`, directly under the scene.
- `child layer`: a node whose `parentId` references another node.

Do not use `track`, `lane`, and `layer` interchangeably.

## Target Semantics

### Parent Relationship

```text
Scene
  group.character        parentId: null
    group.upper-body     parentId: group.character
      group.head-rig     parentId: group.upper-body
        head-image       parentId: group.head-rig
```

Rules:

- A node with `parentId: null` is relative to the scene.
- A node with `parentId` is relative to its parent node.
- A `group` node is a real layer, not a passive folder.
- A non-group node may technically have children only if we explicitly allow it later. For now, authoring tools should create children under `group` nodes.

### Timing

Node timing is parent-relative:

```text
root node timing  -> relative to Scene
child timing      -> relative to parent
```

Example:

```text
group start 5 duration 2
child start 1 duration 1
child global time = 6-7
```

Formula:

```text
nodeGlobalStart = parentGlobalStart + node.timing.start
nodeGlobalEnd = min(parentGlobalEnd, nodeGlobalStart + node.timing.duration)
```

Default timing:

```text
If node.timing is missing:
  start = 0
  duration = parent effective duration
```

Visibility:

```text
A child is visible only when scene time is inside every ancestor timing range.
```

### Z Order

`zIndex` is sibling-local:

```text
Only compare zIndex between nodes with the same parentId.
```

Example:

```text
Scene
  group.character zIndex 1
    head          zIndex 99
  title           zIndex 2
```

`head` must not render above `title` just because `head.zIndex` is `99`. The whole `group.character` sits below `title` because the group is the sibling of `title`.

### Transform And Animation

A group layer has the same animation rights as any other node:

- `transform`
- `opacity`
- `visible`
- `timing`
- `zIndex`
- `effects`
- `blendMode`
- `mask`
- `modifiers`
- animation clips targeting `group.id`

When a group transform changes, all child layers move with it.

When a child transform changes, it is evaluated in the group local coordinate space.

### Compositing

Existing group payload:

```json
{
  "compositing": { "mode": "pass-through" }
}
```

Recommended semantics:

- `pass-through`: children are rendered in the parent context, while inheriting parent transform/timing/visibility.
- `isolate`: children are rendered into an offscreen group layer first, then group opacity/effects/blend/mask apply to the whole group.

Initial implementation may fully support `pass-through` first and document `isolate` as a renderer requirement.

## JSON Example: Three Nested Groups

```json
{
  "id": "scene.character-demo",
  "duration": 10,
  "nodes": [
    {
      "id": "group.character",
      "type": "group",
      "parentId": null,
      "zIndex": 3,
      "timing": { "start": 5, "duration": 4 },
      "transform": {
        "x": 540,
        "y": 960,
        "width": 500,
        "height": 700,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1,
        "visible": true,
        "flipX": false,
        "flipY": false
      },
      "payload": {
        "compositing": { "mode": "pass-through" }
      }
    },
    {
      "id": "group.upper-body",
      "type": "group",
      "parentId": "group.character",
      "zIndex": 2,
      "timing": { "start": 1, "duration": 2 },
      "transform": {
        "x": 0,
        "y": -120,
        "width": 360,
        "height": 380,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1,
        "visible": true,
        "flipX": false,
        "flipY": false
      },
      "payload": {
        "compositing": { "mode": "pass-through" }
      }
    },
    {
      "id": "group.head-rig",
      "type": "group",
      "parentId": "group.upper-body",
      "zIndex": 3,
      "timing": { "start": 0.5, "duration": 1.5 },
      "transform": {
        "x": 0,
        "y": -140,
        "width": 180,
        "height": 180,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1,
        "visible": true,
        "flipX": false,
        "flipY": false
      },
      "payload": {
        "compositing": { "mode": "isolate" }
      }
    },
    {
      "id": "head-image",
      "type": "image",
      "parentId": "group.head-rig",
      "zIndex": 0,
      "timing": { "start": 0, "duration": 1 },
      "transform": {
        "x": 0,
        "y": 0,
        "width": 160,
        "height": 160,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1,
        "visible": true,
        "flipX": false,
        "flipY": false
      },
      "payload": {
        "assetId": "asset.head"
      }
    }
  ]
}
```

Timing result:

```text
group.character     local 5-9       global 5-9
group.upper-body    local 1-3       global 6-8
group.head-rig      local 0.5-2     global 6.5-8
head-image          local 0-1       global 6.5-7.5
```

## Phase 1 - Documentation Contract

Purpose: make the architecture visible to AI, editor, devs, and future MCP tools.

Tasks:

- [ ] Add `Group Layer Semantics` to `docs/motion-format-v3.md`.
- [ ] Add a shorter version to `packages/motion-protocol/README.md`.
- [ ] Include the three-level nested group JSON example.
- [ ] State that child timing is parent-relative.
- [ ] State that child visibility is clipped by ancestor timing.
- [ ] State that `zIndex` is sibling-local.
- [ ] State that group is a real animated layer.

Acceptance:

- [ ] A reader can explain the difference between timeline track/lane and timeline layer.
- [ ] A reader can calculate `group start 5 + child start 1 = child global 6`.

## Phase 2 - Protocol Semantic Validation

Purpose: guarantee the node graph is a valid tree.

Tasks:

- [ ] Verify every non-null `parentId` references an existing node.
- [ ] Reject `parentId === node.id`.
- [ ] Reject parent cycles.
- [ ] Enforce maximum hierarchy depth using `MOTION_PROTOCOL_LIMITS.hierarchyDepth`.
- [ ] Decide whether only `group` nodes may have children.
- [ ] If yes, reject children under non-group parents.
- [ ] Add tests for valid three-level nesting.
- [ ] Add tests for missing parent, self parent, cycle, and depth overflow.

Likely files:

- `packages/motion-protocol/src/v3/references/node-graph.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Acceptance:

- [ ] Invalid layer trees fail validation before compile/render.
- [ ] Valid nested groups parse and validate.

## Phase 3 - Runtime Effective Timing

Purpose: make runtime evaluate child timing relative to parent timing.

Tasks:

- [ ] Add an effective timing resolver for scene nodes.
- [ ] Treat scene duration as the root timing window.
- [ ] For `parentId: null`, compute timing relative to scene.
- [ ] For child nodes, compute timing relative to parent effective start.
- [ ] Clip child end by parent effective end.
- [ ] Treat missing timing as full parent duration.
- [ ] Skip evaluating/rendering nodes outside their effective timing range.
- [ ] Evaluate child animation using node-local time.

Likely files:

- `packages/motion-runtime/src/evaluator.ts`
- `packages/motion-runtime/src/evaluated-frame.test.ts`

Acceptance tests:

- [ ] Group `5-7`, child `1-2` is visible at global `6-7`.
- [ ] Moving group from `5` to `2` moves the child from `6-7` to `3-4`.
- [ ] Three-level group timing resolves correctly.
- [ ] Child duration cannot visually exceed parent duration.
- [ ] Missing child timing means full parent duration.

## Phase 4 - Runtime Render Order

Purpose: make nested groups render with sibling-local `zIndex`.

Tasks:

- [ ] Build a hierarchy-aware render order helper.
- [ ] Sort root siblings by `zIndex`.
- [ ] Sort children only against siblings with the same parent.
- [ ] Prevent child `zIndex` from escaping the parent group.
- [ ] Update flat `scene.nodes.sort(zIndex)` render paths.
- [ ] Keep deterministic tie-breaks by declaration order or id.
- [ ] Add tests where a high-z child inside a low-z group must not draw above a higher-z root sibling.

Likely files:

- `packages/motion-runtime/src/render-plan.ts`
- `packages/motion-runtime/src/render-snapshot.ts`
- `apps/render-worker/src/runtime/draw.ts`
- `packages/motion-runtime/src/hit-test.ts`

Acceptance:

- [ ] Rendering and hit-testing respect group stacking context.
- [ ] Root sibling order and child sibling order are deterministic.

## Phase 5 - Animation Semantics

Purpose: make group animation behave like normal layer animation.

Tasks:

- [ ] Add a test where animation targets a group transform.
- [ ] Confirm children inherit animated group transform.
- [ ] Add a test where child local animation combines with parent animation.
- [ ] Keep scene clip schedules scene-local for now.
- [ ] Document a possible future `schedule.space: "scene" | "parent"` only if needed.

Acceptance:

- [ ] Animating `group.character.transform.x` moves all descendants.
- [ ] Animating `head.transform.rotation` rotates the head inside the group.

## Phase 6 - Compiler Preservation

Purpose: ensure compiler does not flatten away group semantics.

Tasks:

- [ ] Confirm `prepareRuntimeNode` preserves `parentId`, `timing`, `zIndex`, `transform`, effects, blend, mask, and modifiers.
- [ ] Add a V3 fixture with three-level nested groups.
- [ ] Compile the fixture and verify runtime IR keeps the tree.
- [ ] Update runtime compile goldens if the project uses them for this path.

Likely files:

- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`
- `packages/motion-protocol/src/v3/__fixtures__/`

Acceptance:

- [ ] Compiled runtime keeps group layer identity and child parent relationships.

## Phase 7 - Editor Layer Mode

Purpose: make the editor display and edit the model naturally.

Tasks:

- [ ] Layer tree shows `Scene -> root layers -> group children`.
- [ ] Group rows can expand/collapse.
- [ ] Group timing strip contains child timing strips.
- [ ] Child strip positions are parent-local in the UI.
- [ ] Moving a group strip moves children globally by inheritance.
- [ ] Resizing a group clips child visibility.
- [ ] Adding a layer inside a group sets `parentId` to the group id.
- [ ] Reordering layers changes `zIndex` among siblings only.

Likely files:

- `apps/desktop/gui/editor/timeline/layer-mode/build-layer-tree.ts`
- `apps/desktop/gui/editor/timeline/layer-mode/build-layer-mode-view.ts`
- `apps/desktop/gui/editor/timeline/layer-mode/layer-row-reorder.ts`
- `apps/desktop/gui/editor/sidebar/LayersPanel/`

Acceptance:

- [ ] Editor layer tree matches the JSON tree.
- [ ] Editing group timing behaves like a parent container.

## Phase 8 - Provider Compositing

Purpose: align Pixi, Remotion, Canvas, and future providers.

Tasks:

- [ ] Define provider render contract for `pass-through`.
- [ ] Define provider render contract for `isolate`.
- [ ] Decide whether `isolate` is required in first implementation.
- [ ] If `isolate` is required, render group children to an offscreen surface before applying group effects/blend/mask.
- [ ] Add provider-neutral render tests where possible.

Acceptance:

- [ ] Providers agree on group stacking, timing, and transform inheritance.

## Phase 9 - Verification

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-workspace test
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

Add focused checks:

```powershell
rg -n "scene\\.transition|timeline\\.sceneOrder|\\b[A-Za-z0-9_]+V2\\b" packages apps scripts -S
```

Definition of done:

- [ ] Group is a real layer.
- [ ] Child timing is parent-relative.
- [ ] Child visibility is clipped by ancestor timing.
- [ ] `zIndex` is sibling-local.
- [ ] Group animation affects descendants.
- [ ] Editor layer mode shows and edits nested groups naturally.
- [ ] Renderers do not flatten child `zIndex` across parent groups.
