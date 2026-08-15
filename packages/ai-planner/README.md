# `@motionvideo/ai-planner`

AI-facing contracts and typed authoring commands for Motion Format V1.

## Pipeline

```text
CreativeBriefV1
      ↓
CreativePlanV1  (deterministic stub; optional template prior)
      ↓
SceneDesignPlanV1
      ↓
ValidatedCommandBatch → executeCommandBatch
      ↓
MotionProject V1 (+ generation provenance, outside Runtime IR)
```

Planner commands may say “scene” internally. **Emitted JSON is layers-only** (`project.layers`, required `zIndex` + `timing`). Do not write `scenes` / `visualTracks` onto the project file.

Default mode is **from-scratch**. Templates are optional retrieval priors (`mode: "template"`).

## API

```ts
import {
  planMotionProject,
  executeCommandBatch,
  parseCreativeBriefV1,
  type PlanRequest,
  type PlanResult,
} from "@motionvideo/ai-planner";

const result = planMotionProject({
  brief: {
    format: "moticlip-creative-brief",
    formatVersion: 1,
    objective: "Promote an offer",
    durationSeconds: 15,
    aspectRatio: "9:16",
    script: "Hook.\nOffer.\nCTA.",
    language: "vi",
    brand: { name: "Brand", primaryColor: "#D9381E" },
  },
  mode: "from-scratch", // default
  seed: "demo",
}) as PlanResult;

// result.project — validated MotionProject
// result.plan / result.sceneDesign — AI artifacts
// result.generation — planId, seed, model, capabilityManifestVersion
```

Legacy `PlanInput` (`brandName` / `industry` / `script`) still returns a filled `MotionProject` via template path for back-compat.

## Commands

Implemented for blank-project: `createProject`, `setArtDirection`, `addScene`, `setSceneTiming`, `reorderScenes`, `addNode`, `removeNode`, `addTrack`, `validateProject`, `compileProject`, `applyRepairPatch`.

Unsupported stubs return `unsupported_capability` (`addComponentInstance`, `addAudioCue`). Recipes/drivers/contact-sheet/critic are implemented (R6–R7).

## Fixtures

- Positive/negative AI artifacts: `docs/fixtures/ai/`
- Validate: `pnpm validate:ai-fixtures`

## Docs

- Roadmap: `v2-refactor.md` §R1 / §5.1–5.3
- Capability ledger: `docs/fixtures/ai/`
