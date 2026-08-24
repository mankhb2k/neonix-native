# Protocol V2 Guide

This guide describes the ownership and review rules for
`packages/motion-protocol/src`.

## Ownership

| Area | Responsibility |
| --- | --- |
| `src/index.ts` | V2 public root API and parse/serialize helpers |
| `src/v2/common.ts` | V2 identifiers, finite numbers and colors |
| `src/v2/composition.ts` | Composition dimensions, frame rate and view state |
| `src/v2/audio.ts` | Audio tracks, clips, timing and mix intent |
| `src/v2/audio-capabilities.ts` | Certified audio capability ledger |
| `src/v2/audio-fixtures.ts` | Named V2 audio contract fixtures used by docs and tests |
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
- `order` controls ordering; it is not a camera depth substitute.
- `order` is a non-negative integer unique among layers with the same
  `parentLayerId`; higher values paint later. A root layer and a child layer
  may reuse the same number because they belong to different sibling scopes.

For example, the root scope and the group scope can both start at `9`:

```json
[
  { "id": "background", "parentLayerId": null, "order": 9 },
  { "id": "group", "parentLayerId": null, "order": 10 },
  { "id": "title", "parentLayerId": null, "order": 11 },
  { "id": "child-a", "parentLayerId": "group", "order": 9 },
  { "id": "child-b", "parentLayerId": "group", "order": 10 },
  { "id": "child-c", "parentLayerId": "group", "order": 11 }
]
```
- `composition.view` is required. Its projection is either
  `orthographic` (`zoom`, `near`, `far`) or `perspective` (`fov`, `near`,
  `far`), and its transform always uses `translate` and `rotate` Vec3 values.
- `assets` and `audio` are required root domains. A silent project uses
  `audio: { sampleRate: 48000, tracks: [] }`.
- Audio is parallel to visual layers, not part of the Matrix4 scene graph.
  `AudioClipV2.assetId` may reference only an `audio` or `video` asset.
- Audio timing is expressed in composition seconds. Clip `trim` is source
  time, while `timing.duration` is the duration on the composition timeline.
- Audio clip and track IDs are unique within the project. Track pan is in the
  range `-1..1`, and audio sample rate is fixed at `48000` in V2.
- Audio capabilities are `certified` only after protocol, compiler, runtime,
  preview, and export coverage pass.
- The compiler lowers only capabilities marked `certified`.
- High-level patterns, presets, templates and components are future authoring
  layers and do not belong in this atomic contract.

## Review sequence

1. Parse with `MotionProtocolV2Schema`.
2. Check strict unknown-key behavior.
3. Check layer/frame/transform/timing/audio invariants.
4. Check capability certification.
5. Check compiler output separately as Runtime IR V2.
6. Verify preview and Remotion consume the same visual paint commands and the
   same Runtime Audio Mix Plan.

## Schema artifact

Regenerate the committed artifact with:

```bash
pnpm --filter @motionvideo/motion-protocol generate:schema
pnpm --filter @motionvideo/motion-protocol check:schema
```

The artifact must be `schema/v2.json`. No V1 schema or compatibility schema is
maintained.
