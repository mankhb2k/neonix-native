# ADR-006: Layered 2.5D projection

## Status

Accepted (R4)

## Context

R0 demoted `transform.depth` to avoid accept-then-ignore. Product needs layered promo / photo parallax with orthographic camera, without changing draw-order semantics.

## Decision

- Scene `space`: `flat-2d` (default) | `layered-2.5d`.
- Canonical optional `transform.depth`; missing/0 is flat.
- Camera `payload.parallaxStrength` and per-node `parallax` modifier scale screen-space offset:
  `offset = -cameraXY * depth * strength * factor * 0.01`.
- Projection is applied after the 2D world matrix; draw order remains `zIndex` / declaration order (draw order ≠ depth).
- `RenderSnapshot` carries `space`, orthographic `projection`, and per-item `depth` / `projectedOffset`.
- Hit-tests use projected world bounds/matrices.

## Consequences

Capability ledger promotes `transform-depth` and `parallax-modifier` to implemented/public. Depth blur (if any) may consume `transform.depth` after this ADR.
