# Protocol V2 Guide

This guide describes the ownership and review rules for
`packages/motion-protocol/src`.

## Ownership

| Area | Responsibility |
| --- | --- |
| `src/index.ts` | V2 public root API and parse/serialize helpers |
| `src/v2/common.ts` | V2 identifiers, finite numbers and colors |
| `src/v2/composition.ts` | Composition dimensions, frame rate and view state |
| `src/v2/layers/` | Atomic layer schemas |
| `src/v2/transform.ts` | 3D transform values including anchor |
| `src/v2/timing.ts` | Active time window |
| `src/v2/view.ts` | View and projection intent required by runtime compilation |
| `src/v2/capabilities.ts` | Certified atoms only |
| `schema/v2.json` | Generated V2 JSON Schema artifact |

Protocol owns the JSON contract. Compiler lowering belongs to
`@motionvideo/motion-compiler`; Runtime IR belongs to
`@motionvideo/motion-runtime`.

## V2 boundary rules

- Root format is `motion-protocol`.
- Root format version is `2`.
- Every object is strict unless explicitly documented otherwise.
- Matrix4 values are compiler/runtime data, not Protocol JSON fields.
- `anchor` is the transform pivot; `origin` is not a Protocol V2 field.
- `translate.z` is the 3D position component; legacy `depth` is not used.
- `zIndex` controls ordering; it is not a camera depth substitute.
- `composition.view` is required. Its projection is either
  `orthographic` (`zoom`, `near`, `far`) or `perspective` (`fov`, `near`,
  `far`), and its transform always uses `translate` and `rotate` Vec3 values.
- A capability must be certified before compiler lowering can use it.
- High-level patterns, presets, templates and components are future authoring
  layers and do not belong in this atomic contract.

## Review sequence

1. Parse with `MotionProtocolV2Schema`.
2. Check strict unknown-key behavior.
3. Check layer/frame/transform/timing invariants.
4. Check capability certification.
5. Check compiler output separately as Runtime IR V2.
6. Verify preview and Remotion consume the same runtime paint commands.

## Schema artifact

Regenerate the committed artifact with:

```bash
pnpm --filter @motionvideo/motion-protocol generate:schema
pnpm --filter @motionvideo/motion-protocol check:schema
```

The artifact must be `schema/v2.json`. No V1 schema or compatibility schema is
maintained.
