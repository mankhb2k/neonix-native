# V3 Finding Fix Focused Plan

Muc tieu: fix cac finding V3 dang anh huong den source-of-truth behavior. Typecheck package-wide hien dang co nhieu loi test/type phu, nen phase nay chi dung typecheck nhu tin hieu tham khao, khong coi la acceptance bat buoc.

Nguyen tac:

- Fix behavior/schema truoc, khong chi rename.
- Test dung diem, khong chay broad test thua.
- Neu mot field khong nam trong V3 schema thi compiler khong duoc phu thuoc vao field do.
- Neu muon giu feature thi phai dua feature vao V3 schema ro rang, co docs/test.

## Scope

In scope:

- Root `MotionClip` export alias.
- V3 transition capability detection.
- Compiler text pipeline align voi V3 text payload.
- Layout solver `distribute` / `anchor` mismatch voi V3 layout schema.
- Focused regression tests cho root API, capability, compiler V3.

Out of scope for this phase:

- Fix tat ca typecheck test typing trong repo.
- Broad package-wide `pnpm typecheck`.
- Broad app/e2e/render visual tests.
- Refactor lon editor UI.
- Doi public V3 design neu chua co quyet dinh ro.

## Phase 1 - Fix Root MotionClip Alias

Problem:

- `packages/motion-protocol/src/index.ts` export:

```ts
export type { MotionClipV3 as MotionClip };
```

- Type `MotionClipV3` khong nam trong local type scope, nen typecheck fail.

Tasks:

- Doi export thanh:

```ts
export type { MotionClipV3 as MotionClip } from "./v3/animation/clips";
```

- Giu export truc tiep:

```ts
export { type MotionClipV3 } from "./v3/animation/clips";
```

- Them/bo sung root API regression test:
  - root co export runtime value/schemas khong chua `*V2`.
  - type-level alias khong test duoc bang runtime keys, nen chi can test bang focused typecheck sau nay.

Acceptance:

- Search khong con `export type { MotionClipV3 as MotionClip };`.
- Root public API van expose neutral `MotionClip` type.

Focused checks:

```powershell
rg "MotionClipV3 as MotionClip" packages/motion-protocol/src/index.ts -n
pnpm.cmd --filter @motionvideo/motion-protocol test -- root-api-v2-regression
```

Optional signal, not required in this phase:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
```

## Phase 2 - Fix Transition Capability Detection

Problem:

- V3 `TransitionV3Schema` uses discriminator `type`.
- `inspectProjectCapabilities` currently reads `transitionIn?.kind` and `transitionOut?.kind`.
- Result: project using `transitionIn: { type: "crossfade" }` may not declare/detect `transition.crossfade`.

Tasks:

- Update `packages/motion-protocol/src/v3/capabilities.ts`.
- Change local shape:

```ts
transitionIn?: { type?: string };
transitionOut?: { type?: string };
```

- Change lookup:

```ts
const inType = clip.transitionIn?.type;
const outType = clip.transitionOut?.type;
```

- Rename comment `Transition kind` to `Transition type` to match V3 language.
- Update both input type blocks if duplicated.
- Ensure `fade` still maps to `transition.dissolve`.

Tests:

- Update or add focused tests in `packages/motion-protocol/src/v3/__tests__/capabilities.test.ts`:
  - detects `transitionIn: { type: "crossfade" }`.
  - detects `transitionOut: { type: "slide" }`.
  - maps `fade` type to `transition.dissolve`.
  - warns/returns undeclared capability when transition type is not declared.

Acceptance:

- No `transitionIn?.kind` or `transitionOut?.kind` remains in `v3/capabilities.ts`.
- Capability preflight detects real V3 transition JSON.

Focused checks:

```powershell
rg "transitionIn\\?\\.kind|transitionOut\\?\\.kind|kind\\?: string" packages/motion-protocol/src/v3/capabilities.ts -n
pnpm.cmd --filter @motionvideo/motion-protocol test -- capabilities
pnpm.cmd run validate:v3-source-of-truth
```

## Phase 3 - Decide Text Animator And FitText Ownership

Problem:

- Compiler reads `node.textAnimator`.
- V3 text node schema does not define `textAnimator`.
- Layout solver reads `payload.fitText` and `payload.fontWeight`.
- V3 text payload does not expose these fields directly in `TextNodeV3Schema`.

Decision needed:

Choose one path before coding:

### Option A - Remove Unsupported Compiler Paths

Use this if V3 does not want these features yet.

Tasks:

- Remove or bypass `expandTextAnimators` from V3 compile path.
- Keep scene-local motion clips/presets as the only animation source.
- Remove `applyFitText` from V3 compile path or make it no-op unless schema supports it.
- Remove direct `payload.fontWeight` usage; use default text measurement without weight.
- Keep rich text run styles as future work.

Pros:

- Fastest way to make compiler truly follow current V3.
- Avoids hidden authoring fields.

Cons:

- Text animator and fit-text features unavailable until added to V3.

### Option B - Add Features To V3 Schema

Use this if these features are part of the V3 design.

Tasks:

- Add `textAnimator` to V3 text node schema or a general node animation model.
- Add `fitText` to V3 text payload schema.
- Decide where `fontWeight` lives:
  - `payload.fontWeight`, or
  - `payload.content.runs[].style.fontWeight`, or
  - font asset metadata only.
- Update `schema/v3.json` generation.
- Update docs with AI-facing examples.
- Update compiler to read exactly the schema-approved fields.

Pros:

- Keeps feature.
- Makes AI/editor/dev contract explicit.

Cons:

- Bigger schema/design change.
- Requires docs and more tests.

Recommendation for this phase:

- Use Option A unless there is a strong product reason to keep text animator/fit-text now.
- Add a TODO in docs for future V3 text automation if needed.

Acceptance for Option A:

- `compileSceneToRuntime` no longer depends on `node.textAnimator`.
- `applyFitText` is not called in V3 compile path unless V3 schema owns `fitText`.
- `layout-solver.ts` no longer reads `payload.fontWeight` directly.
- Compiler still compiles text nodes and text content normally.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema
```

Focused search:

```powershell
rg "textAnimator|payload\\.fitText|payload\\.fontWeight|style\\.fill" packages/motion-compiler/src -n
```

Expected:

- Either no hits in production compiler path, or hits are guarded by V3 schema-owned fields.

## Phase 4 - Resolve LayoutConstraint Mismatch

Problem:

- `layout-solver.ts` handles `distribute` and `anchor`.
- V3 `LayoutConstraintSchema` currently exposes only `stack`, `grid`, `align`.

Decision:

Choose one:

### Option A - Remove Unsupported Cases

Tasks:

- Delete `case "distribute"` and `case "anchor"` from `layout-solver.ts`.
- Keep only `stack`, `grid`, `align`.
- If fixtures/docs mention distribute/anchor, mark as future extension.

### Option B - Add To V3 Layout Schema

Tasks:

- Add `distribute` and `anchor` variants to `packages/motion-protocol/src/v3/layout.ts`.
- Add docs/examples.
- Add schema tests.
- Keep compiler solver cases.

Recommendation:

- Use Option A for now unless editor/AI already generates `distribute` or `anchor`.
- This keeps V3 source-of-truth smaller and avoids phantom features.

Acceptance:

- Compiler solver cases exactly match V3 layout schema variants.
- No TypeScript impossible branch for layout constraints.

Focused tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd --filter @motionvideo/motion-protocol test -- schema
```

Focused search:

```powershell
rg "kind: z\\.literal\\(\"distribute\"\\)|kind: z\\.literal\\(\"anchor\"\\)|case \"distribute\"|case \"anchor\"" packages/motion-protocol/src/v3 packages/motion-compiler/src -n
```

Expected:

- Either both schema and solver contain the feature, or neither production path does.

## Phase 5 - Add Missing Regression Tests

Muc tieu: tests bat dung cac loi da gap, khong test thua.

Tests to add/update:

### Root API Regression

File:

```txt
packages/motion-protocol/src/__tests__/root-api-v2-regression.test.ts
```

Cases:

- `NodeSchema` from root rejects `{ type: "component" }`.
- `VariableSchema` from root accepts a variable with `semantic`.
- Root runtime-visible exports still have no `*V2` names.

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- root-api-v2-regression
```

### Capability Regression

File:

```txt
packages/motion-protocol/src/v3/__tests__/capabilities.test.ts
```

Cases:

- `transitionIn.type` is detected.
- `transitionOut.type` is detected.
- `fade` maps to `transition.dissolve`.

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- capabilities
```

### Compiler V3 Regression

File:

```txt
packages/motion-compiler/src/__tests__/compile-v3.test.ts
```

Cases:

- Basic text node compiles with current V3 text payload.
- Compiler does not require `textAnimator`.
- Compiler does not require `payload.fitText`.
- Scene-level transition remains absent in runtime scene.
- Visual clip `transitionIn/transitionOut` remains preserved.

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
```

## Phase 6 - Focused Verification Loop

Required for this phase:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test -- root-api-v2-regression
pnpm.cmd --filter @motionvideo/motion-protocol test -- capabilities
pnpm.cmd --filter @motionvideo/motion-compiler test -- compile-v3
pnpm.cmd run validate:v3-source-of-truth
pnpm.cmd lint:packages
git diff --check
```

Optional signal only:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
pnpm.cmd --filter @motionvideo/motion-compiler typecheck
```

Do not block this phase on optional typecheck unless the failing error is one of the fixed production findings.

## Definition Of Done

- Root `MotionClip` alias is valid.
- Capability detection uses V3 `transition.type`, not old `kind`.
- Compiler does not depend on fields absent from V3 text schema.
- Layout solver variants match V3 layout schema.
- Focused root/capability/compiler tests pass.
- V3 source-of-truth gate passes.
- Package lint passes.
