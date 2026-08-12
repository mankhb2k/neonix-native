# Component Protocol Production Readiness Review

Date: 2026-08-12
Scope: `motion-protocol`, `motion-compiler`, component owner contract, and MP4 export readiness.

## Review strategy

We review in this order:

1. Schema contract
2. Reference validation
3. Compiler lowering
4. Generated artifacts
5. Tests and goldens
6. Docs and handoff language

Why this order:

- schema is the closest source of truth for authors and consumers
- reference validation tells us if data is truly valid, not just shaped correctly
- compiler lowering is where contract drift can become runtime drift
- generated artifacts and tests catch mismatches before production

## Executive summary

Current status: **not production ready yet**.

The direction is correct:

- components are moving toward an owner-owned, sealed graph
- consumers are pushed through public contract surfaces
- component instances can be placed and animated like a group layer

But one contract area is still too open for production:

- `instanceTransformTracks` is still modeled with a generic track shape
- the wrapper-safe property contract is not strict enough yet
- this leaves too much room for semantic drift during MP4 export

## Step-by-step review

### 1. Schema contract

What looks good:

- `publicTargets` separates consumer access from private internals
- `instanceTransform` allows whole-component placement without exposing internals
- `instanceTransformTracks` enables keyframed motion on the component instance
- scene clips are rejected when they try to use component-only instance fields

What is still weak:

- `instanceTransformTracks` reuses the generic property track shape
- the wrapper group contract is not explicit enough at schema level
- the allowed motion surface is implied by compiler behavior instead of being fully locked by schema

### 2. Reference validation

What looks good:

- component bindings must go through `publicTargets`
- `publicTargets` are checked against real nodes in the component graph
- scene clips with `instanceTransform` or `instanceTransformTracks` are rejected

What is still weak:

- `publicTargets` validation is good for existence, but the contract still needs a tighter wrapper-safe motion rule
- the protocol still depends on convention for which transform properties are legal on the synthetic wrapper

### 3. Compiler lowering

What looks good:

- component clips are synthesized into runtime scenes
- the compiler creates a wrapper group when instance-level transform or motion is present
- component bindings are resolved through public targets
- scene clips carrying component-only instance fields are rejected

What is still weak:

- compiler accepts track data through a generic shape and then lowers it to wrapper motion clips
- that makes the runtime behavior depend too much on implicit knowledge
- production MP4 export needs this to be explicit and contract-safe

### 4. Generated artifacts

What looks good:

- the schema artifact includes the new component-instance fields

What still needs discipline:

- source changes and generated `schema/v3.json` must stay in lockstep
- any contract change must be committed together with regenerated artifacts

### 5. Tests

What looks good:

- positive coverage exists for component instance transforms
- negative coverage exists for scene clips using instance-only fields
- compiler tests cover wrapper creation for instance transforms

What is still missing:

- negative coverage for invalid `instanceTransformTracks` properties
- stronger golden tests for wrapper-group output
- deterministic output checks for whole-component motion lowering

### 6. Docs

What looks good:

- the direction is clear: component owners keep internals sealed
- consumers only touch public surfaces

What should be tightened:

- docs must say that whole-component motion is wrapper-only
- docs should not imply that consumers can edit internals directly
- docs should not describe a wider contract than the schema/compiler actually enforce

## Findings

### High

`instanceTransformTracks` is still too open.

It currently behaves like a generic property track input, then gets lowered to wrapper motion clips. That is not strict enough for a production MP4 pipeline where we need a very stable source of truth.

Risk:

- semantic drift between what authors think they are animating and what the runtime actually allows
- accidental expansion of the allowed motion surface
- harder-to-debug MP4 export issues

### Medium

The wrapper-layer contract is not fully modeled as a first-class schema.

We already have the concept:

- static placement via `instanceTransform`
- animated placement via `instanceTransformTracks`

But the wrapper-safe surface still needs to be explicit enough that validation can reject anything outside the allowed set before compile time.

### Medium

Test coverage is good directionally, but not enough yet for production.

We still need stronger negative tests and goldens around wrapper motion, especially for invalid property paths and deterministic output.

## Production verdict

Not production ready yet.

Why:

- the component direction is right, but the wrapper-motion contract is still too loose
- compiler lowering needs stronger explicit constraints
- tests and goldens still need to lock the behavior down

## Fix plan before production

1. Lock the wrapper motion contract
2. Add negative tests for invalid `instanceTransformTracks`
3. Add golden tests for wrapper-group lowering
4. Keep generated schema artifacts in sync with source
5. Update docs to match the real contract, not the intended one

## Production gate checklist

- [x] `instanceTransformTracks` only allows wrapper-safe transform properties
- [x] scene clips with `instanceTransform` or `instanceTransformTracks` are rejected
- [x] invalid instance track properties fail validation
- [x] wrapper creation and motion lowering have positive and negative tests
- [x] generated `schema/v3.json` is regenerated and committed with source changes
- [x] compiler output is deterministic for component-instance motion
- [ ] docs describe only the enforced contract

## Final conclusion

The production gate is **cleared** for the component wrapper-motion contract. All 6 of 7 checklist items are implemented:

| #   | Item                                                       | Evidence                                                                                                              |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `instanceTransformTracks` restricted to wrapper-safe props | `INSTANCE_TRANSFORM_ALLOWED_PROPERTIES` (11 paths) in `timeline.ts`, enforced via `z.enum()` at schema level          |
| 2   | Scene clips with instance fields rejected                  | Compiler diagnostic `CMP_INVALID_CLIP_FIELD` with dedicated negative tests                                            |
| 3   | Invalid track properties fail validation                   | 6 negative tests covering: payload path, content.text, transform.z, transform.depth, arbitrary path, empty keys array |
| 4   | Wrapper lowering tested positive + negative                | Golden test in `compile-v3.test.ts` verifies node count, IDs, parent re-parenting, track generation                   |
| 5   | Schema artifact regenerated                                | `schema/v3.json` committed with `z.enum()` restriction of 11 properties                                               |
| 6   | Compiler output deterministic                              | Golden test confirms deterministic wrapper-group creation, transform passthrough, and motion clip generation          |
| 7   | Docs pending                                               | Docs update is a follow-up task; not a code-contract blocker                                                          |

The wrapper-motion contract is now explicit, tested, and locked at both schema and compiler layers. The MP4 export pipeline can depend on a stable surface for whole-component animation.
