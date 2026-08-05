# ADR-007: Procedural driver graph & motion recipes

## Status

Accepted (R6)

## Context

AI needs rich motion without hand-keyframing every property. Runtime already had helper types in `procedural-driver.ts` without schema/DAG/commands.

## Decision

- Scene-level `drivers[]` closed union (`ProceduralDriverSchema`) persists in authoring and Runtime IR.
- Drivers evaluate as a DAG with cycle detection; outputs override track samples for the target property.
- Motion recipes (`wiggle`, `float`, `pulse`, `follow`, `counter`, `stagger`, `camera-shake`) bake to drivers and/or tracks via `bakeMotionRecipe`.
- Unknown recipe/driver fails closed; AI enumerates only allowlisted recipe IDs.

## Consequences

`addDriver` / `applyRecipe` are real commands. Preview/export share the same driver evaluation. Recipes stay small until PR-3 kinetic slice passes.
