# Package Lint Rollout Plan

Muc tieu: moi package co script `lint` rieng, root co script orchestration, va cac rule kien truc V3 source-of-truth van duoc check bang custom gate rieng thay vi nhoi het vao ESLint.

## Current Setup

Shared package lint config:

```txt
eslint.package.mjs
```

Root scripts:

```txt
pnpm lint
pnpm lint:packages
pnpm lint:web
pnpm lint:desktop
pnpm validate:v3-source-of-truth
```

Package script pattern:

```json
{
  "lint": "eslint src -c ../../eslint.package.mjs --max-warnings 0"
}
```

Packages with local architecture-specific ESLint config:

- `packages/editor-core`
- `packages/editor-interactions`
- `packages/editor-react`
- `packages/render-contracts`

These keep their own `eslint.config.mjs` because they already encode package boundaries such as no React in core packages or no app imports.

Packages using shared config:

- `packages/ai-planner`
- `packages/asset-registry`
- `packages/motion-compiler`
- `packages/motion-protocol`
- `packages/motion-runtime`
- `packages/motion-workspace`
- `packages/pixi-renderer`
- `packages/playback-engine`
- `packages/remotion-renderer`

## Why ESLint Is Not The V3 Architecture Gate

ESLint should catch code-quality and package-boundary mistakes:

- unsafe JS patterns,
- unused variables,
- bad TypeScript patterns,
- accidental app/UI imports in pure packages,
- obvious unsafe syntax.

V3 source-of-truth rules should stay in:

```txt
scripts/validate-v3-source-of-truth.ts
```

That gate is better for semantic architecture rules:

- no V2/legacy/compat production paths,
- no `sceneOrder`,
- no `scene.transition`,
- no `component-action`,
- no root protocol export from runtime authoring-shaped modules,
- no `src/legacy` or `src/compat`.

## Phase 1 - Baseline Package Lint

Tasks:

- Add root shared config `eslint.package.mjs`.
- Add root dev dependencies:
  - `eslint`
  - `@eslint/js`
  - `typescript-eslint`
- Replace `echo "no lint yet"` with real lint scripts.
- Add lint script to packages that had only `test` and `typecheck`.
- Keep existing package-specific configs unchanged.

Acceptance:

- Every package under `packages/*` has a `lint` script.
- `pnpm lint:packages` has a concrete command path for every package.
- Packages with special boundary rules continue to use local configs.

Check:

```powershell
pnpm lint:packages
```

## Phase 2 - Fix Baseline Lint Errors

Tasks:

- Run lint package by package so failures stay readable:

```powershell
pnpm --filter @motionvideo/motion-protocol lint
pnpm --filter @motionvideo/motion-compiler lint
pnpm --filter @motionvideo/motion-runtime lint
pnpm --filter @motionvideo/editor-core lint
pnpm --filter @motionvideo/render-contracts lint
```

- Fix real issues first.
- If a rule is too noisy for migration code or test code, add a narrow override.
- Do not add broad `eslint-disable` comments to production files.

Acceptance:

- `motion-protocol`, `motion-compiler`, and `motion-runtime` lint pass first.
- Renderer/editor packages can be fixed after protocol/compiler are stable.

## Phase 3 - Add V3-Specific Lint Guards Where They Fit

Only add ESLint rules for import-boundary mistakes. Keep semantic checks in the custom gate.

Recommended package-specific rules:

`packages/motion-protocol`

- Root `src/index.ts` must not import/export from `./runtime/nodes`.
- `src/v3/**` must not import from `src/runtime/**` except explicitly allowed type-only helpers.
- `src/v3/**` must not import from `src/legacy/**` or `src/compat/**`.

`packages/motion-compiler`

- Must not import from app packages.
- Must not import renderer packages directly.
- Should import authoring schemas from `@motionvideo/motion-protocol` or `@motionvideo/motion-protocol/v3`, not runtime node modules.

`packages/motion-runtime`

- Must not import editor, compiler, Pixi, Remotion, or app packages.
- Runtime should depend on protocol/runtime contracts, not authoring/editor internals.

Acceptance:

- ESLint catches wrong imports early.
- `validate:v3-source-of-truth` still owns V2/legacy semantic checks.

## Phase 4 - CI Order

Run checks from cheapest and most architectural to heaviest:

```powershell
pnpm validate:v3-source-of-truth
pnpm lint:packages
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-compiler typecheck
pnpm --filter @motionvideo/motion-protocol test -- schema-files root-api-v2-regression
pnpm --filter @motionvideo/motion-compiler test -- compile-v3
```

Later, when the repo is cleaner:

```powershell
pnpm typecheck
pnpm test
```

## Phase 5 - Definition Of Done

- Every package has `lint`.
- Root has `lint:packages`.
- Shared config exists for normal packages.
- Special packages keep local configs.
- V3 architecture gate remains separate and mandatory.
- Protocol/compiler lint, typecheck, and focused tests pass before broader repo checks become required.
