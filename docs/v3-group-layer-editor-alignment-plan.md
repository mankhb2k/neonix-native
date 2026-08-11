# V3 Group Layer Editor Alignment Plan

Muc tieu: dua editor timeline/layer-mode ve dung cung ngon ngu voi V3 runtime:

- `timeline track/lane` = scene-level lanes trong `timeline.visualTracks`.
- `timeline layer` = node-level layer ben trong mot scene.
- `group layer` = node `type: "group"` co transform/timing/effects nhu layer binh thuong va co children.
- `node.timing` cua child la parent-relative.
- `node.zIndex` la sibling-local, khong phai global flat order.

Pham vi cua plan nay chi tap trung vao nhung phan con lech voi thiet ke group layer. Khong can chay broad desktop test suite neu no cham cac test layout khong lien quan.

## Current Status

Da dung:

- Protocol da co `group` node, `parentId`, `timing`, `zIndex`.
- Protocol validation da chan child parent khong phai group, cycle, unknown parent, depth.
- Runtime da co `resolveEffectiveTiming` de tinh parent-relative timing.
- Runtime render/snapshot/hit-test da dung `hierarchyRenderOrder`.
- Compiler V3 da preserve `parentId`, `timing`, `zIndex` sang runtime.

Con lech:

- Editor layer-mode dang tinh strip start theo scene-local: `container.startTime + localTiming.start`.
- Editor layer-mode dang sort node flat theo `zIndex desc`.
- Editor helper `resolveNodeGlobalTiming` chua clip child duration theo parent effective end.
- Mot so comment trong compiler/runtime van noi theo cach cu, gay nhieu mental model cho AI/Skill/MCP.

## Phase 1 - Share Timing Semantics For Editor

Muc tieu: editor tinh timing giong runtime, khong tu tao logic gan dung.

Tasks:

- Tao helper editor-side hoac dung lai runtime helper neu dependency cho phep:
  - Input: `nodes`, `containerStartTime`, `containerDuration`.
  - Output map `nodeId -> effectiveStart/effectiveEnd/effectiveDuration/localStart/parentRelativeStart`.
- Neu khong import runtime vao editor duoc, copy logic nho theo cung contract va dat ten ro:
  - `resolveEditorEffectiveNodeTiming`.
  - Comment dan ve V3 group semantics.
- Sua `buildLayerModeView` de strip dung effective global position:
  - Root node: `container.startTime + node.timing.start`.
  - Child node: `container.startTime + parentEffectiveStart + node.timing.start`.
  - Child end: clip boi parent effective end.
- Sua `resolveNodeGlobalTiming` de return clipped `globalStart/globalEnd`.
- Giu `parentRelativeStart` de UI hien thi offset ben trong parent.

Acceptance:

- `group start=5 duration=4`, `child start=1 duration=2` => child strip global `6-8`.
- `group start=5 duration=2`, `child start=1 duration=5` => child strip global `6-7`, bi clip boi parent.
- Missing child timing => full parent effective duration.

Focused Tests:

```powershell
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-mode-view.test.ts
```

## Phase 2 - Hierarchy-Aware Layer Order In Editor

Muc tieu: editor row order va lane order noi cung ngon ngu voi runtime render order.

Tasks:

- Thay `sortNodesForLayerMode` flat sort bang hierarchy-aware top-to-bottom order.
- Root siblings sort theo `zIndex desc`.
- Children chi sort trong cung `parentId`.
- Child rows nam ngay duoi parent group de giong Figma/After Effects layer tree.
- Child `zIndex` cao khong duoc vuot ra ngoai parent group.
- Reuse `build-layer-tree` neu helper do da dung hierarchy, hoac tao shared helper rieng cho layer-mode view.

Acceptance:

- Root:
  - `group.character zIndex=1`
  - `title zIndex=2`
- Child:
  - `head zIndex=99 parentId=group.character`
- Row/render mental order:
  - `title` o tren `group.character`.
  - `head` nam ben trong `group.character`, khong vuot len tren `title`.

Focused Tests:

```powershell
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-tree.test.ts
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-mode-view.test.ts
```

## Phase 3 - Sibling-Local Reorder And Drop

Muc tieu: drag/drop/reorder trong editor khong pha V3 rule `zIndex` sibling-local.

Tasks:

- Kiem tra `layer-row-reorder.ts`:
  - Reorder trong cung parent thi update sibling `zIndex`.
  - Cross-parent reorder khong duoc ngam hieu la doi zIndex global.
- Neu can support move vao group:
  - Tach thanh command rieng: `move-node-parent`.
  - Command nay update `parentId`, convert timing absolute/relative ro rang.
- Sua library drop vao layer-mode:
  - Drop vao root => `parentId: null`, timing scene-relative.
  - Drop vao group => `parentId: group.id`, timing parent-relative.
- Khong dung global zIndex list khi insert vao group; chi lay siblings cung parent.

Acceptance:

- Keo child trong group chi reorder voi siblings cung group.
- Drop asset vao group tao node child co `parentId` cua group.
- Drop asset vao root tao root layer.

Focused Tests:

```powershell
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/layer-row-reorder.test.ts
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/library/adapters/payload-to-timeline-command.layer.test.ts
```

## Phase 4 - Preview/Stage Parity Check

Muc tieu: preview canvas trong app hien thi cung thu tu va timing voi runtime renderer.

Tasks:

- Xac minh stage preview lay snapshot tu runtime path da co `hierarchyRenderOrder`.
- Neu co DOM preview path rieng:
  - Dam bao no dung snapshot da sort hierarchy-aware.
  - Khong sort DOM node bang flat `zIndex`.
- Them case nested group vao preview fixture/parity neu nhe.
- Khong can test screenshot/visual broad neu chua can; chi can deterministic snapshot/order.

Acceptance:

- Preview khong hien child khi parent inactive.
- Preview khong cho child zIndex vuot ngoai parent.
- Preview layer DOM order khop runtime snapshot order.

Focused Tests:

```powershell
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/playback/stage-playback.test.ts
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
```

## Phase 5 - Compiler/Protocol Naming Polish

Muc tieu: bot cac comment/ten gay nham cho AI/MCP/Skill.

Tasks:

- Sua comment trong `compile-v3.ts` dang noi "V2 project shape" thanh "runtime project shape" hoac "compiled runtime shape".
- Giu lai test V2 leak neu chi la guard, nhung comment phai noi ro day la regression guard.
- Chay source-of-truth validation neu co script dang active.

Acceptance:

- Public protocol root khong expose V2 names.
- `schema/v3.json`, README, docs deu noi V3 la source of truth.
- Comment production khong day AI theo mental model V2.

Focused Tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd exec tsx scripts/validate-v3-source-of-truth.ts
```

## Phase 6 - Final Focused Verification

Chi chay cac test lien quan den plan:

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-tree.test.ts
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-mode-view.test.ts
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/layer-row-reorder.test.ts
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/library/adapters/payload-to-timeline-command.layer.test.ts
```

Khong can chay trong plan nay:

- Full `@motionvideo/desktop test` neu fail o layout/inset khong lien quan group semantics.
- Benchmark/performance tests.
- Broad screenshot/visual tests neu chua co fixture nested group on-purpose.

## Definition Of Done

- `schema/v3.json` la contract cho AI/editor/dev.
- Compiler chi bien V3 thanh runtime artifact, khong doi semantics.
- Runtime la evaluator duy nhat cho timing/render order/hit-test.
- Editor timeline/layer-mode chi la view/command surface cua cung V3 semantics.
- Group layer co timing/transform/effects nhu layer binh thuong.
- Child timing relative theo parent va bi clip boi ancestor.
- `zIndex` sibling-local tren moi cap hierarchy.
- Focused tests trong Phase 6 pass.
