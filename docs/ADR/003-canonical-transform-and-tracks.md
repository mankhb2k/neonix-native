# ADR 003: Canonical Transform and Typed Track Model

## Status
Accepted (Normative for Motion Format v2)

## Context
In Motion Format v2, properties and animation tracks need explicit typing and deterministic interpolation policies to eliminate ambiguous runtime representations, prevent missing property bindings, and support Graph Editor capabilities across preview and export engines.

## Decisions

### 1. Canonical Transform Representation
- The canonical transform structure for spatial nodes continues to support explicit scalar properties (`transform.x`, `transform.y`, `transform.width`, `transform.height`, `transform.rotation`, `transform.scaleX`, `transform.scaleY`, `transform.anchorX`, `transform.anchorY`, `transform.opacity`, `transform.visible`, `transform.flipX`, `transform.flipY`).
- Spatial compound track `transform.position` with `valueKind: "vec2"` is supported as a virtual compound property mapping to `(x, y)` channels. Validation rejects conflicting track declarations targeting both `transform.position` and scalar `transform.x`/`transform.y` in the same clip.

### 2. Typed Property Capabilities (`valueKind`)
Every animatable or bindable property has an explicit `valueKind`:
- `number`: Scalar continuous values (e.g., opacity, width, height, radius).
- `angle`: Angular rotation degrees with shortest/clockwise/counterclockwise wrap policies.
- `vec2`: 2D spatial coordinate vector `[x, y]`.
- `color`: Hex/RGBA color strings with canonical Oklab/sRGB color space interpolation.
- `boolean`: Discrete boolean flags (e.g., visibility, flipX).
- `string`: Discrete string values (e.g., text content).
- `asset`: Asset ID references (e.g., fontAssetId, image assetId).
- `path`: Path contours data for geometry morphing.
- `gradient`: Color gradient definitions.

### 3. Track Extrapolation (`preBehavior` & `postBehavior`)
Tracks support explicit pre/post extrapolation behaviors outside keyframe bounds:
- `clamp`: Holds terminal keyframe value (default).
- `cycle`: Repeats keyframe sequence cyclically.
- `pingpong`: Alternates forward and reverse keyframe playback.
- `offset-cycle`: Cycles keyframes with cumulative terminal value offset.
- `continue`: Extrapolates linearly beyond terminal keyframe based on terminal velocity.

### 4. Closed Keyframe Easing Vocabulary
Keyframes inherit a closed easing union:
- `linear`, `easeIn`, `easeOut`, `easeInOut`, `spring`, `step`, `hold`.
- Runtime evaluators MUST throw an explicit error on unknown easing strings and MUST NOT perform silent fallbacks.
