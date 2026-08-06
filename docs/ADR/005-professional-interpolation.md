# ADR-005: Professional typed interpolation

## Status

Accepted (R2)

## Context

Motion Format v2 previously exposed only named easing enums. AI and authoring need closed, deterministic curves: cubic-bezier handles, parameterized springs, and ValueKind policies (angle unwrap, color, vec2).

## Decision

- `KeyframeEasingV2` is a closed union: named preset | `{type:"cubic-bezier",...}` | `{type:"spring",stiffness,damping,mass?}`.
- Runtime sampling lives in `packages/motion-runtime/src/curve-sampler.ts` and is the single source for `easingValue` / track evaluation.
- Unknown easing fails closed (ADR-003 / R0 fail-loud).
- Marker-relative key times (`{markerId,offset}`) resolve to absolute seconds at compile; Runtime IR keys are always numeric.
- Angle tracks use shortest-path unwrap when `valueKind:"angle"` or property is `transform.rotation`.

## Consequences

Preview and export share the same sampler. Goldens cover cubic/spring + marker resolve. Invalid cubic control points are rejected by schema.
