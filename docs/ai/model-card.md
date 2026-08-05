# AI planner model card (R9)

## Model / tool

- **Default:** deterministic stub `ai-planner/stub-from-scratch@1`
- **Not included:** production LLM provider; R7 critic/repair is rule-based

## Inputs

- `CreativeBriefV1` (aspect, script, brand, constraints)
- Optional seed / industry grammar

## Outputs

- `CreativePlanV1`, `SceneDesignPlanV1`, `MotionProject` via typed commands
- Contact-sheet fingerprints (evaluated transforms)
- Critic score + findings + targeted repairs

## Known limitations

- No pixel visual critic (fingerprint metrics only)
- Recipe catalog intentionally small (PR-3 gate)
- `addComponentInstance` / `addAudioCue` still unsupported
- Desktop packaged soak not part of this freeze slice

## Safety

- Unknown recipe/driver/preset fails closed
- Command batches roll back on error severity diagnostics
- Provenance stored outside Runtime IR
