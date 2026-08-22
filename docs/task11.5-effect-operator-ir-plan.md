# Task 11.5: Effect Operator IR

## Objective

Create one backend-neutral, deterministic Runtime Effect Operator IR before
implementing `drop-shadow`, `glow`, or other spatial effects. The work makes
ordered V2 effects executable with the same meaning in WebGPU, WebGL2, and
Remotion export.

This task is a prerequisite for Task 11 shadow work. It starts with rectangle
fixtures only; groups, masks, and additional atom types are certified later.

## Architectural Boundary

```text
Atomic Protocol V2
blur | color-adjust | drop-shadow
        |
        v
Runtime Effect Operator IR
color-adjust | alpha-mask | blur | tint | offset | composite
        |
        v
Backend Pass Plan
capture | decode | downsample | Gaussian X/Y | upsample | composite pass
```

The Atomic Protocol describes visual intent. It must never expose texture
formats, sample counts, Gaussian taps, MSAA, quality switches, or pyramid
levels. The backend pass plan owns these physical GPU decisions.

## Semantic Rules

1. Effects execute in JSON order. The output of one effect is the input of the
   next effect.
2. Spatial effects operate on the already projected layer or group surface.
   Their units are composition/output pixels, not world-space units.
3. Effects do not modify `z`, `zIndex`, or the Matrix4 transform of their
   source. The full result keeps the source paint-order position.
4. A captured source remains immutable until its effect program completes.
5. `radius` and future `blurRadius` mean Gaussian sigma in output pixels.
6. Logical operators do not imply one GPU render pass. The backend is free to
   fuse compatible operations or use a blur pyramid.
7. Runtime must produce one deterministic output surface for every valid
   effect program.

## Initial IR

`SurfaceRef` is a stable runtime-only identifier. It is never serialized into
Atomic Protocol V2 JSON.

```ts
type SurfaceRef = string;

type RuntimeEffectOp =
  | {
      id: string;
      kind: "color-adjust";
      input: SurfaceRef;
      output: SurfaceRef;
      brightness: number;
      contrast: number;
      saturation: number;
      hueRotate: number;
    }
  | {
      id: string;
      kind: "blur";
      input: SurfaceRef;
      output: SurfaceRef;
      radius: number;
    }
  | {
      id: string;
      kind: "alpha-mask";
      input: SurfaceRef;
      output: SurfaceRef;
    }
  | {
      id: string;
      kind: "tint";
      input: SurfaceRef;
      output: SurfaceRef;
      color: string;
      opacity: number;
    }
  | {
      id: string;
      kind: "offset";
      input: SurfaceRef;
      output: SurfaceRef;
      x: number;
      y: number;
    }
  | {
      id: string;
      kind: "composite";
      backdrop: SurfaceRef;
      source: SurfaceRef;
      output: SurfaceRef;
      mode: "source-over";
    };

type RuntimeEffectProgram = {
  input: "source";
  ops: RuntimeEffectOp[];
  output: SurfaceRef;
  requiresOffscreen: boolean;
};
```

`capture`, `decode`, `downsample`, Gaussian passes, and `upsample` remain out
of this IR. They are physical implementation steps selected by each backend.

## Phase 0: Freeze Effect Semantics

- [x] Document that effects are ordered transformations of a projected source
  surface.
- [x] Add two reference examples: `color-adjust -> blur` and
  `blur -> color-adjust`.
- [x] Specify that the two examples must render differently.
- [x] Define output bounds for spatial effects. A future tight surface must
  reserve `spread + 3 * sigma + abs(offset)` on each applicable edge.
- [x] Define the behavior at the composition boundary: pixels outside the
  composition are transparent and the final result is clipped to the frame.

Acceptance: architecture documentation and unit fixtures define the semantic
contract before implementation begins.

### Certified Reference Meaning

Use the same projected rectangle source in both references:

```text
A. color-adjust -> blur
source -> desaturate -> blur the desaturated pixels

B. blur -> color-adjust
source -> blur the original pixels -> desaturate blurred pixels
```

The two programs have different intermediate surfaces and must not be fused or
reordered into the same output. Pixel-level E2E certification is Phase 6; the
Runtime lowering snapshots introduced in Phase 2 certify the distinction now.

## Phase 1: Add Runtime IR Types and Validation

- [x] Add `RuntimeEffectOp`, `RuntimeEffectProgram`, and `SurfaceRef` to
  `@motionvideo/motion-runtime`.
- [x] Create a validator that rejects duplicate operator IDs, duplicate output
  surfaces, missing inputs, cycles, unreachable operators, and invalid final
  outputs.
- [x] Keep all values finite and preserve Atomic Protocol effect IDs in
  generated operator IDs for diagnostics.
- [x] Add tests for valid linear programs, branching programs, cycles, missing
  inputs, duplicate surfaces, and orphan operations.

Acceptance: Runtime can validate any program without importing a GPU backend.

## Phase 2: Lower Existing V2 Effects

- [x] Replace the current classification-only `buildRuntimeEffectPlan()` with
  a lowering function that creates `RuntimeEffectProgram`.
- [x] Lower `color-adjust` and `blur` while threading the current surface ref.
- [x] Preserve exact JSON order in the generated graph.
- [x] Ensure `color-adjust -> blur` and `blur -> color-adjust` produce distinct
  programs. Pixel output distinction is certified in Phase 6.

Example:

```text
source
  -> color-adjust(source, adjusted)
  -> blur(adjusted, blurred)
  -> output = blurred
```

Acceptance: plan snapshots prove that ordered Atomic effects lower to ordered
Runtime operations.

## Phase 3: Move Effect Ownership to Layer Scope

- [x] Attach `effectProgram` to `beginLayer` or its decoded display-list layer
  node.
- [x] Derive `offscreen` from `effectProgram.requiresOffscreen`.
- [x] Remove `effects` from all drawable paint commands: shape, path, text,
  image, and video.
- [x] Stop preview renderers from discovering an effect by scanning a child
  draw command.
- [x] Preserve a layer's source capture until the entire program finishes.

Acceptance: one layer scope owns one effect program, including when a future
group contains multiple draw commands.

## Phase 4: Build the Backend-Neutral Pass Planner

- [x] Add an `EffectPassPlan` compiler in `@motionvideo/preview-renderer`.
- [x] Map logical operators to surface lifetimes and reusable temporary
  surfaces.
- [x] Fuse pixel-local operations when semantics allow it.
- [x] Keep color adjustment as a source-pass fusion only when its position in
  the operator graph permits that optimization.
- [x] Reuse the current Gaussian quality policy: linear premultiplied RGBA,
  separable blur, and a 2x pyramid for large sigma.
- [x] Expose diagnostics for unsupported operators rather than silently
  changing effect order.

Acceptance: a pass plan contains no Atomic Protocol types and no backend API
objects.

## Phase 5: Execute the Plan in WebGPU and WebGL2

- [x] Refactor the current blur renderer to execute `EffectPassPlan`.
- [x] Keep a dedicated immutable source texture for effects that branch, such
  as future drop shadows.
- [x] Use replace writes for intermediate surfaces and premultiplied blending
  only when compositing into a destination.
- [x] Preserve the existing WebGPU-first, WebGL2-fallback selection behavior.
- [x] Verify resize and disposal release all planned surfaces correctly.

Acceptance: existing blur fixtures retain their visual output and no renderer
contains effect-specific lookup logic in drawable handlers.

## Phase 6: Rectangle E2E Certification

- [x] Certify `color-adjust -> blur`.
- [x] Certify `blur -> color-adjust` and prove it differs from the first case.
- [x] Certify two consecutive blur operations.
- [x] Certify `radius` values `4`, `40`, and `256`.
- [x] Assert an opaque center, a monotonic antialiased edge profile, and no
  dark or colored alpha fringe.
- [x] Compare WebGPU and WebGL2 samples with the existing pixel tolerance.
- [x] Assert that a pixel-local-only program does not allocate an offscreen
  surface.
- [x] Assert no unclosed or nested-offscreen diagnostics.

Acceptance: all cases pass in Chromium WebGPU and WebGL2 before a new effect
atom is introduced.

Certified by `apps/web/e2e/preview-v2-atoms.spec.ts`. WebGPU is compared
against the WebGL2 samples within two 8-bit color values. The renderer unit
fixture also proves that a color-only program does not allocate an HDR effect
surface.

## Phase 7: Remotion Effect-Program Parity

- [x] Make `@motionvideo/remotion-renderer` consume the same
  `RuntimeEffectProgram` from Runtime.
- [x] Do not define a separate CSS-only interpretation of Atomic effects.
- [x] Add preview-versus-export pixel fixtures for the certified rectangle
  cases.
- [x] Use CSS or SVG filters only when they satisfy the agreed visual contract;
  otherwise execute the shared offscreen plan for export.

Acceptance: preview and export share semantic effect ordering and pass the
agreed parity tolerance.

`MotiClipVideo` evaluates Runtime V2 then passes its `RuntimeFrameV2` directly
to `RemotionPreviewCanvas`, which owns the same `createPreviewRenderer` native
WebGPU/WebGL2 path as preview. `buildRemotionPaintTree()` also retains the
same `effectProgram` reference for structural consumers. The paired export
pixel fixture is `pnpm --filter @motionvideo/remotion-site e2e:effects`; it
renders the ordering, chained blur, and radius `4/40/256` cases through
Remotion, decodes the resulting PNGs, and applies the same pixel assertions as
the preview E2E suite. No CSS or SVG filter exists in the V2 export path.

## Phase 8: Drop Shadow Readiness Gate

Do not add `drop-shadow` until all of the following are true:

- [x] Effect ordering is observable and certified end to end.
- [x] Captured sources remain immutable for branching programs.
- [x] Effects are owned by layer scopes, not individual draw commands.
- [x] WebGPU, WebGL2, and Remotion consume the same Runtime Effect Program.
- [x] Existing blur behavior remains certified.

The source capture is physically distinct from the effect pyramid in both GPU
backends (`effectSourceTexture` / `effectSourceTarget`). It is written exactly
once while the layer scope is captured and then used only as an input. The
planner now executes the exact first branch graph for `drop-shadow`; mixed
linear/branched graphs remain diagnosed until their pass topology is explicitly
implemented.

At that point, `drop-shadow` lowers to:

```text
source
  |-> alpha-mask -> blur -> tint -> offset --|
  |                                           |-> composite(source over shadow) -> output
  `-------------------------------------------|
```

`drop-shadow` is a projected screen-space effect. It is not a world-space
lighting or cast-shadow system. A future 3D lighting feature must use a
separate Atomic type and scene-level contract.

## Explicit Non-Goals

- No `spread` field until morphology/SDF behavior has its own implementation
  and E2E certification task.
- No nested effect scopes, masks, or group effects in this initial rectangle
  certification task.
- No texture format, kernel sample count, render scale, or quality field in
  Atomic Protocol V2.
- No world-space light source, shadow map, ray tracing, or 3D cast shadow.
