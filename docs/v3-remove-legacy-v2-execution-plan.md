# V3 Remove Legacy And V2 Execution Plan

Muc tieu: dua codebase ve mot nguon su that duy nhat la V3 authoring JSON, sau do compiler tao Runtime IR provider-neutral. Ke hoach nay khong chi rename comment. Moi phase phai xoa duong data cu neu no con anh huong production.

## Target Architecture

Canonical flow:

```txt
V3 Authoring JSON
  -> parseMotionProjectV3
  -> V3 reference/capability validation
  -> V3-native compile preparation
  -> MotionRuntimeProject
  -> Pixi / Remotion / Canvas / Worker / future providers
```

Khong chap nhan production flow:

```txt
V3 Authoring JSON
  -> V2-shaped node/clip/project schema
  -> legacy/compat compiler behavior
  -> Runtime IR
```

## Definitions

- `V3 authoring`: JSON/schema cho AI, editor, dev, MCP, template, skill.
- `Runtime IR`: artifact duoc compiler sinh ra cho playback/render. No co the khac V3, nhung khong duoc chua concept V2 authoring.
- `Migration-only`: code chi dung de import project cu. Neu project chua release thuc te, uu tien xoa han thay vi giu migration.
- `Legacy renderer`: Next/Vite renderer mode cu khong dong nghia voi V2 schema. Khong can xoa trong plan nay neu khong lien quan data protocol.

## Current Findings To Fix

- Root API export `NodeSchema` / `MotionNode` tu `./runtime/nodes`, trong khi V3 authoring node union da nam o `./v3/nodes`.
- V3 component variables van dung `VariableSchema` compat cu thay vi V3 variable schema thong nhat.
- Runtime IR van accept scene-level `transition`.
- `compileSceneToRuntime` van co cua hau `transition?: unknown` va emit scene transition neu duoc truyen.
- `validate-v3-source-of-truth.ts` allowlist nguyen root public API, nen gate co the pass du co public wording/export sai.
- Mot so public comments/docstrings van day mental model `legacy`, `compat`, `V2`.

## Phase 1 - Freeze The Public Language

Muc tieu: mat tien package chi noi V3. AI/dev import tu root khong gap schema compat.

Tasks:

- Review `packages/motion-protocol/src/index.ts`.
- Thay root node exports:
  - `NodeSchema` -> V3 authoring `NodeV3Schema` alias thanh `NodeSchema`.
  - `MotionNode` -> V3 authoring `NodeV3` alias thanh `MotionNode`.
  - `ShapeNodeSchema`, `PathNodeSchema`, `TextNodeSchema`, etc. -> V3 authoring schemas tu `./v3/nodes`.
- Khong export node schemas tu `./runtime/nodes` tren root public API.
- Neu runtime consumers can runtime node types, export qua `@motionvideo/motion-protocol/runtime` thay vi root.
- Doi comment root:
  - Xoa wording `legacy re-exports remain`.
  - Xoa `re-exported for compat` neu dang noi ve public root.
  - Giu V2 wording chi o doan explicit rejection/migration note neu can.

Acceptance:

- `import { NodeSchema } from "@motionvideo/motion-protocol"` parse theo V3 authoring node union.
- Root `NodeSchema` khong chap nhan `type: "component"`.
- Root API khong day agent dung runtime node schema nhu authoring schema.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- root-api-v2-regression capabilities
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 2 - Unify V3 Variable Model

Muc tieu: project variables va component variables dung cung mot ngon ngu V3, khong con hidden compat schema.

Tasks:

- Review `packages/motion-protocol/src/v3/variables.ts`.
- Doi ten/phan tach ro:
  - `ProjectVariableV3Schema` la canonical variable schema.
  - Tao alias public neutral `VariableSchema = ProjectVariableV3Schema` neu can giu ten root.
  - Xoa hoac move block `V2 backward-compat schemas` sang migration-only/test neu that su can.
- Update `packages/motion-protocol/src/v3/components.ts`:
  - `variables: z.array(ProjectVariableV3Schema)` hoac `ComponentVariableV3Schema` neu component can subset rieng.
  - Khong import compat `VariableSchema` cu.
- Kiem tra `PublicParamSchema`, `ComponentBindingSchema`, `ProjectBindingSchema`:
  - Neu la V3 canonical thi rename/comment lai ro.
  - Neu la compat cu thi thay bang V3 schema hoac xoa khoi root.

Acceptance:

- Project va component variables cung support V3 fields, vi du `semantic`.
- Khong con comment `V2 backward-compat schemas` trong V3 production module.
- Root `VariableSchema` neu con thi tro den V3 canonical schema.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files
pnpm.cmd --filter @motionvideo/motion-protocol test -- root-api-v2-regression
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 3 - Remove Scene-Level Transition From Runtime Canonical Path

Muc tieu: transition chi nam tren visual clip: `transitionIn` / `transitionOut`.

Tasks:

- Review `packages/motion-protocol/src/runtime/project.ts`.
- Remove `transition: SceneTransitionSchema.optional()` khoi runtime scene schema.
- Neu can support old runtime IR, tao migration-only parser rieng, khong nam trong `MotionRuntimeProjectSchema`.
- Update tests:
  - Add test runtime rejects scene-level `transition`.
  - Giu tests clip-level transition pass.
- Review provider/render code xem co doc `scene.transition` khong. Neu co, doi sang `timeline.visualTracks[].clips[].transitionIn/transitionOut`.

Acceptance:

- Runtime canonical schema reject scene-level transition.
- Clip-level transition van parse va compile dung.
- Search `scene.transition` chi con trong negative tests/diagnostics/docs.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- runtime
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 4 - Remove Compiler Transition Backdoor

Muc tieu: compiler V3 va helper runtime scene compile khong con co duong emit scene transition.

Tasks:

- Review `packages/motion-compiler/src/index.ts`.
- Remove `transition?: unknown` khoi input cua `compileSceneToRuntime`.
- Remove spread `...(input.transition ? { transition: input.transition } : {})`.
- Doi comment helper thanh:
  - `compileSceneToRuntime` chi compile nodes/clips/markers/drivers cua mot scene.
  - Timeline-level visual clip data do `compile-v3.ts` xu ly.
- Search:

```powershell
rg "compileSceneToRuntime\\(|transition:" packages/motion-compiler/src -n
```

- Neu co call site truyen transition, sua call site sang clip-level transition hoac xoa.

Acceptance:

- Compiler khong the emit scene-level transition bang public/internal helper.
- `compile-v3.ts` van preserve `transitionIn` / `transitionOut`.
- Compile tests co assertion `compiledScene.transition` undefined hoac runtime schema khong co field.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 5 - Split Authoring Schemas From Runtime Schemas

Muc tieu: runtime schemas phuc vu runtime only; authoring schemas phuc vu AI/editor/dev only.

Tasks:

- Audit `packages/motion-protocol/src/runtime/nodes/*`.
- Doi comment `V2-specific` thanh runtime-specific neu schema that su can cho runtime.
- Neu runtime node schema con chua component node hoac field cu khong duoc runtime dung:
  - Remove khoi `RuntimeNodeSchema`.
  - Hoac move vao migration-only parser.
- Dam bao public root khong import tu `runtime/nodes`.
- Dam bao `runtime/project.ts` khong expose authoring-only fields nhu `repeat`, `textAnimator`, scene-level transition.

Acceptance:

- V3 authoring node union nam o `v3/nodes`.
- Runtime node union nam o `runtime/project.ts` hoac `runtime/nodes`, nhung chi dung trong runtime IR.
- Khong con confusion `runtime node schema = authoring node schema`.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 6 - Tighten Source-Of-Truth Gate

Muc tieu: gate pass moi co nghia la production code thuc su sach V3.

Tasks:

- Review `scripts/validate-v3-source-of-truth.ts`.
- Remove allowlist nguyen file `packages/motion-protocol/src/index.ts`.
- Neu root can co message reject V2, allowlist theo line/pattern cu the, khong allowlist ca file.
- Them forbidden patterns production:
  - `legacy re-exports`
  - `re-exported for compat`
  - `V2 backward-compat schemas`
  - `V2-specific`
  - `component-action` outside negative tests/migration docs
  - `scene.transition` outside negative tests/diagnostics/docs
- Them hard gate:
  - `packages/motion-protocol/src/compat` must not exist.
  - `packages/motion-protocol/src/legacy` must not exist.
  - root public API must not export from `./runtime/nodes`.

Acceptance:

- Gate fail neu root index export `NodeSchema` tu runtime.
- Gate fail neu V3 production module co `V2 backward-compat schemas`.
- Gate pass voi negative tests intentionally rejecting V2 fields.

Focused tests:

```powershell
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 7 - Update Docs And AI/MCP Contract

Muc tieu: docs day dung ngon ngu cho AI, MCP, skills va user tu code JSON.

Tasks:

- Update `packages/motion-protocol/README.md` neu ton tai.
- Update `docs/motion-format-v3.md`.
- Update `docs/ai-first-editor-architecture.md`.
- Them section:
  - V3 JSON la authoring source of truth.
  - Runtime IR la derived artifact.
  - Providers la plugin-like consumers cua Runtime IR.
  - Khong co V2 authoring/runtime production path.
- Them examples:
  - Project variable va component variable cung mot schema.
  - Root `NodeSchema` la V3 authoring schema.
  - Transition chi tren visual clip.

Acceptance:

- Agent doc khong can biet V2 de sinh JSON moi.
- README khong huong dan import compat/legacy.
- Docs co noi ro khi nao dung V3, khi nao dung Runtime IR.

## Phase 8 - Final Verification Loop

Run focused verification:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-protocol test -- runtime
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd --filter @motionvideo/motion-runtime test -- effective-timing
pnpm.cmd run validate:v3-source-of-truth
git diff --check
```

Run final search:

```powershell
rg "V2|v2|legacy|compat|downMigrate|down-migration|V2-shaped|Authoring IR v2|sceneOrder|component-action|scene\\.transition" packages apps scripts docs -n
```

Expected:

- Old terms chi con trong:
  - negative tests,
  - docs explaining rejection,
  - renderer-mode legacy unrelated to protocol,
  - explicit migration-only folder neu duoc quyet dinh giu.
- Compiler production khong con emit V2 authoring concepts.
- Root protocol API chi expose V3 authoring schemas va runtime IR schemas o namespace/path ro rang.

## Definition Of Done

- `schema/v3.json` va `packages/motion-protocol/src/v3` la authoring source of truth duy nhat.
- Root public API maps neutral authoring names to V3 schemas, not runtime/legacy schemas.
- Project/component variables use one V3 variable model.
- Runtime IR has no scene-level transition and no V2 authoring concepts.
- Compiler has no transition backdoor and no V2-shaped intermediate.
- Source-of-truth gate catches the exact regressions found in this review.
- Focused verification loop passes.
