# V3 Native Source Of Truth Completion Plan

Muc tieu: xoa hoan toan mental model V2 khoi production path. V3 JSON la authoring source of truth duy nhat cho AI, editor, dev, MCP, templates/skills, compiler, preview, playback va render providers.

Khong chi doi comment. Plan nay can dam bao data flow that su la:

```txt
V3 Authoring JSON
  -> V3 normalize/validate
  -> V3-native compile
  -> provider-neutral Runtime IR
  -> Pixi / Remotion / Canvas / Worker / future providers
```

Khong chap nhan data flow:

```txt
V3 Authoring JSON
  -> down-migrate / V2-shaped authoring IR
  -> old compiler pipeline
  -> Runtime IR
```

## Current Problems

- `packages/motion-compiler/src/index.ts` van co comment/API noi ve `Authoring IR v2`, `V2-shaped`, `V2 compile path`, `down-migration`.
- Mot so runtime/protocol files van dung ten `legacy`, `compat`, `V2-specific` trong production-looking paths.
- Runtime protocol path van co file `runtime/animation/clips.ts` giu `component-action`, trong khi V3 da drop component-action khoi timeline clips.
- V3 gate hien tai bat duoc public V2 leak, nhung chua bat het production mental model leak.
- Typecheck package-wide dang co nhieu loi nen chua the dung typecheck lam final gate duy nhat.

## Definitions

`Authoring V3`

- JSON contract cho AI/editor/dev.
- Nam trong `packages/motion-protocol/src/v3`.
- Public docs/schema/readme phai day V3 mental model.

`Runtime IR`

- Artifact duoc compiler tao ra cho providers.
- Co the khac V3 vi phuc vu playback/render deterministic.
- Khong duoc goi la V2-shaped.
- Khong duoc expose concept cu nhu `sceneOrder`, scene-level transition, component-action clip source.

`Legacy/Migration`

- Chi duoc nam trong migration-only path.
- Khong duoc la dependency bat buoc cua V3 production compiler/runtime.
- Comment phai noi ro "migration-only", khong phai source of truth.

## Phase 1 - Audit And Classify All V2/Legacy Surfaces

Muc tieu: phan loai cai nao la test/diagnostic hop le, cai nao la production leak.

Tasks:

- Chay search:

```powershell
rg "V2|v2|legacy|compat|downMigrate|down-migration|V2-shaped|Authoring IR v2|sceneOrder|component-action" packages apps scripts docs -n
```

- Chia ket qua thanh 4 nhom:
  - `allowed-test-guard`: tests intentionally reject V2 fields.
  - `allowed-doc-history`: docs migration notes, neu can giu.
  - `migration-only`: code chi dung de import/convert old project.
  - `production-leak`: compiler/runtime/editor path dang chay hoac public export/comment gay nham.
- Tao allowlist ro trong validation script cho `allowed-test-guard` va `migration-only`.
- Moi ket qua khong nam trong allowlist phai fail gate.

Acceptance:

- Co report ngan trong docs hoac script output liet ke tat ca production leaks can xu ly.
- Khong con "unknown V2/legacy occurrence".

Focused Checks:

```powershell
pnpm run validate:v3-source-of-truth
rg "Authoring IR v2|V2-shaped|down-migration|downMigrate" packages/motion-compiler/src -n
```

## Phase 2 - Rename Compiler Pipeline To V3-Native Runtime Pipeline

Muc tieu: khong con `_compileScenePipeline` duoc mo ta la V2-shaped pipeline.

Tasks:

- Doi ten `_compileScenePipeline` thanh ten neutral:
  - `compileRuntimeScenePipeline`, hoac
  - `compileSceneToRuntime`, hoac
  - `prepareRuntimeScene`.
- Doi input type/comment:
  - Tu "V2-shaped nodes/clips" sang "normalized runtime-ready scene inputs".
  - Tu "down-migration" sang "runtime preparation".
- Neu pipeline van can helper cu, tach helper thanh module neutral:
  - `text-expansion.ts`
  - `layout-resolution.ts`
  - `track-compilation.ts`
  - `runtime-node-normalization.ts`
- `compile-v3.ts` chi import neutral pipeline, khong import/comment V2.

Acceptance:

- `packages/motion-compiler/src/compile-v3.ts` khong co `V2`, `down-migration`, `V2-shaped`.
- `packages/motion-compiler/src/index.ts` neu con legacy compiler thi phai duoc danh dau migration/internal ro rang.
- Public compiler docs noi `compileMotionProjectV3` la V3-native compiler to Runtime IR.

Focused Tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm run validate:v3-source-of-truth
```

## Phase 3 - Remove V2 Clip Source From Runtime Canonical Path

Muc tieu: runtime canonical khong con `component-action` hoac `V2-specific ClipSchema`.

Tasks:

- Kiem tra `packages/motion-protocol/src/runtime/animation/clips.ts`.
- Neu file nay chi phuc vu migration:
  - Move sang `packages/motion-protocol/src/migration/...` hoac `src/runtime/migration/...`.
  - Doi comment thanh `migration-only`.
  - Dam bao runtime canonical import khong dung file nay.
- Neu runtime dang dung:
  - Tao runtime clip schema moi chi gom V3/runtime-supported source kinds.
  - Remove `component-action` khoi runtime production schema.
- Update imports de runtime/project dung canonical runtime clips.

Acceptance:

- Runtime canonical path khong con `component-action`.
- Search `component-action` chi con trong tests/migration guards.
- Runtime schema parse khong chap nhan new runtime IR co component-action.

Focused Tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
pnpm run validate:v3-source-of-truth
```

## Phase 4 - Tighten V3 Source-Of-Truth Gate

Muc tieu: gate khong chi bat public V2 export, ma bat production mental-model leak.

Tasks:

- Update `scripts/validate-v3-source-of-truth.ts`.
- Them forbidden patterns trong production code:
  - `Authoring IR v2`
  - `V2-shaped`
  - `down-migration`
  - `downMigrate`
  - `component-action` outside migration/tests
  - `sceneOrder` outside V3 rejection diagnostics/tests
- Dinh nghia allowlist ro:
  - `packages/motion-protocol/src/v3/__tests__/**`
  - `packages/motion-protocol/src/__tests__/**`
  - `packages/motion-protocol/src/v3/mcp.ts` neu chi explain invalid V2 input
  - migration-only folder
- Fail neu production file co V2 wording ma khong nam allowlist.

Acceptance:

- Gate fail neu them comment "V2-shaped" vao compiler production.
- Gate pass voi tests rejection V2 fields.

Focused Checks:

```powershell
pnpm run validate:v3-source-of-truth
```

## Phase 5 - V3-Native Runtime Preparation Contract

Muc tieu: compiler khong "translate to old authoring shape", ma "prepare runtime artifact".

Tasks:

- Tao/lam ro contract:

```txt
MotionProjectV3
  -> NormalizedMotionProjectV3
  -> RuntimePreparationPlan
  -> MotionRuntimeProject
```

- `RuntimePreparationPlan` gom:
  - visual track plan
  - scene instances
  - component instance expansion
  - asset bindings
  - variable bindings
  - source map/provenance
- Khong dung ten `V2`, `legacy`, `downMigrate`.
- Neu component clip can synthesize scene, goi la `synthesizeRuntimeSceneFromComponent`.

Acceptance:

- Compiler docs/code doc noi cung mot ngon ngu.
- AI/MCP doc co the noi: "V3 compiles directly to Runtime IR".

Focused Tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
```

## Phase 6 - Editor/Core Runtime Alignment Cleanup

Muc tieu: editor khong con API/comment "v2|v3 project" neu project hien tai chi V3.

Tasks:

- Kiem tra:
  - `packages/editor-core/src/timeline/internal/scene-utils.ts`
  - `packages/editor-core/src/timeline/migrations/*`
  - `apps/desktop/gui/editor/stage/*`
- Doi comment/API:
  - `v2|v3 project` -> `MotionProject`
  - `legacy aspect label from v3` -> `aspect label from composition`
- Migration parser co the giu legacy wording, nhung phai nam trong migration-only path.
- Editor production path chi noi V3/timeline/layer/scene/node.

Acceptance:

- Editor production code khong day mental model V2.
- Migration code duoc isolate va allowlist.

Focused Tests:

```powershell
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-mode-view.test.ts gui/editor/timeline/drop/library-drop.test.ts
pnpm.cmd --filter @motionvideo/editor-core test -- command-runner build-layer-tree
```

## Phase 7 - Public API And Docs Freeze

Muc tieu: nguoi dung/AI/doc chi thay V3 la ngon ngu chinh.

Tasks:

- Review public exports:
  - `packages/motion-protocol/src/index.ts`
  - package `exports`
  - README files
- Deprecated aliases neu con thi:
  - Remove neu chua co user production.
  - Hoac move sang migration-only entrypoint.
- Update docs:
  - `packages/motion-protocol/README.md`
  - `docs/motion-format-v3.md`
  - `docs/ai-first-editor-architecture.md`
- Them section "There is no V2 authoring/runtime path in production".

Acceptance:

- Root public API khong expose V2-shaped names.
- README noi ro V3 JSON la source of truth.
- Runtime IR la derived artifact, not source of truth.

Focused Tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm run validate:v3-source-of-truth
```

## Phase 8 - Final Verification Loop

Muc tieu: kiem tra dung thu can kiem, khong bi nhieu boi broad typecheck/test dang fail nen.

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
pnpm.cmd --filter @motionvideo/editor-core test -- command-runner build-layer-tree
pnpm.cmd --dir apps/desktop exec vitest run --project dom gui/editor/timeline/layer-mode/build-layer-mode-view.test.ts gui/editor/timeline/drop/library-drop.test.ts gui/editor/library/adapters/payload-to-timeline-command.layer.test.ts
pnpm run validate:v3-source-of-truth
```

Rerun search:

```powershell
rg "Authoring IR v2|V2-shaped|down-migration|downMigrate|component-action|sceneOrder" packages apps scripts docs -n
```

Expected:

- Only tests/diagnostics/migration allowlist contain old terms.
- No compiler/runtime/editor production path mentions V2 as active model.

## Definition Of Done

- `schema/v3.json` la authoring JSON contract duy nhat.
- Compiler V3 khong down-migrate sang V2-shaped IR.
- Runtime IR la derived artifact provider-neutral.
- No production path accepts or emits V2 authoring concepts.
- No production comment/API teaches AI/MCP that V2 is still part of normal flow.
- V3 gate enforces this continuously.
- Focused verification loop passes.
