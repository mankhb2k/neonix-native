# Atomic Protocol V2: Preview E2E Plan

## Goal

Build and certify the Atomic Protocol V2 one render capability at a time before
introducing high-level authoring patterns, presets, templates, or components.

An atom is complete only when this entire path is covered:

```text
Protocol V2 fixture
  -> Compiler B
  -> Runtime / PaintCommandBuffer
  -> WebGL2 preview
  -> WebGPU preview
  -> Browser E2E pixel assertion
  -> /docs/preview fixture
```

High-level authoring may only lower to atoms that are certified by this plan.

## Architecture Boundary

```text
@motionvideo/motion-authoring
  High-level JSON: pattern, preset, component, template
        |
        | lowerAuthoringV2()
        v
@motionvideo/motion-protocol V2
  Atomic JSON: group, text, shape, path, image, video,
               frame, transform, timing, animation, effects, mask, composite,
               composition-level camera/projection when runtime needs it
        |
        | compileProtocolV2()
        v
@motionvideo/motion-runtime
  Runtime IR: evaluated hierarchy, local/world/view/projection mat4,
              backend-neutral geometry/resources, PaintCommandBuffer
        |
        +-- preview-renderer: WebGL2 / WebGPU
        +-- remotion-renderer: export frames -> encoder
```

Runtime IR and Atomic Protocol V2 must not contain GPU device handles, texture
handles, vertex buffers, glyph atlases, or backend-specific pipeline objects.
Those resources belong to each renderer backend.

Components remain a product feature, but `type: "component"` belongs to the
high-level authoring document. Compiler A expands an instance into stable
Protocol V2 atoms and returns a source map back to its author node.

## Global Rules

- Atomic Protocol V2 has no `bone`, `parallax`, `preset`, `pattern`,
  `component`, `template`, raw matrix, or unresolved layout state. Camera and
  projection are allowed only as normalized composition-level view state when
  runtime needs them; high-level camera intent is lowered by Compiler A.
- Transform is 3D-capable from day one: semantic Vec3 translate/scale/rotate
  and anchor, plus XY skew. Runtime owns the resulting column-major mat4.
- During the MVP, `zIndex` is the deterministic painter/compositing order.
  `translate.z` affects perspective placement only; it does not silently
  enable depth-buffer occlusion. A future depth-test policy requires its own
  atomic contract and certification task.
- Shared math and rounding are owned by one deterministic math core. Renderers
  do not call ad hoc rounding functions or reinterpret timing.
- WebGPU is the default preview backend and WebGL2 is the mandatory fallback.
  Both consume the same paint command stream. Each certified visual atom must
  implement both; browser WebGPU pixel tests may be conditionally skipped only
  when the test browser has no usable adapter.
- Unsupported commands must return diagnostics. They must not silently render a
  different primitive or fall back to a separate renderer.
- A new atom is not added to `/docs/preview` until its test gates are green.

## Shared Atom Ticket Template

Every atom or atomic render operator must deliver all items below.

- [ ] Add the strict Protocol V2 schema and invalid-input tests.
- [ ] Add an entry to the V2 capability manifest.
- [ ] Add Compiler B and runtime lowering tests.
- [ ] Add deterministic `PaintCommandBuffer` golden fixtures.
- [ ] Implement the WebGPU backend path and make it selectable in preview.
- [ ] Implement the WebGL2 fallback path and make it selectable in preview.
- [ ] Assert both backends receive equivalent Runtime IR / paint commands.
- [ ] Add one focused `/docs/preview` JSON fixture.
- [ ] Add browser E2E pixel assertions and a regression screenshot.

## Task 0: Preview E2E Harness

- [x] Create a fixed `1920x1080` composition canvas with DPR `1` and an explicit
  background color for deterministic browser E2E pixel tests.
- [ ] Keep production preview canvas backing resolution synchronized with stage
  CSS size and device pixel ratio; test DPR `1` is not the production quality
  policy.
- [x] Add a browser test route for `/docs/preview?case=<fixture-id>`.
- [x] Read pixels directly from the render canvas and expose helpers for color,
  alpha, transparent, and tolerance assertions.
- [x] Keep screenshots as regression artifacts only; pixel assertions are the
  required gate.
- [x] Add a shared test that selects the same fixture through WebGL2 and WebGPU
  when WebGPU is available.
- [x] Default preview selection to WebGPU and expose `Auto`, `WebGPU`, and
  `WebGL2` for explicit backend comparison.
- [x] Add a golden assertion for the emitted `PaintCommandBuffer`.
- [x] Add a capability gate so unverified atoms cannot be emitted by later
  high-level lowering.

Done when a temporary rectangle fixture can render in browser E2E and prove
specific pixels and background pixels deterministically.

## Task 1: Protocol V2 Core

- [x] Add `packages/motion-protocol/src/v2` with a separate format/version.
- [x] Define composition: `width`, `height`, `fps`, `background`, color space,
  and audio sample rate.
- [x] Define common layer base: `id`, `parentLayerId`, `zIndex`, `timing`, and
  `frame`.
- [x] Define the V2 semantic transform contract: Vec3 `translate`, `scale`,
  `rotate`, local-unit Vec3 `anchor`, and XY `skew`.
- [x] Define `opacity` and its canonical range.
- [x] Reject legacy root `bone`, `camera`, `depth`, `space`,
  `activeCameraLayerId`, raw matrix fields, and all other non-V2 fields with
  strict schemas. Accept only the normalized V2 composition-level view/
  projection contract when a runtime camera is required.
- [x] Reuse the existing shared quantization, interpolation, clamp, matrix, and rounding
  behavior into a shared math module without changing results.
- [x] Keep the existing shared math golden tests for negative values, `.5` boundaries, FPS boundaries,
  keyframe boundaries, and nested transforms.

Done when an empty V2 scene compiles into an empty command buffer and all shared
frame/time behavior is locked by tests.

## Task 2: Rectangle Fill

- [x] Add `shape` with only `payload.shape: "rectangle"`.
- [x] Support only solid `style.fill`.
- [x] Emit `setTransform` followed by `drawShape(rectangle)`.
- [x] Implement the draw command in WebGL2 and WebGPU using the same command
  stream.
- [x] Add `/docs/preview?case=primitive.shape.rectangle`.
- [x] Assert center fill color, outside background color, bounds, and absence
  of unexpected pixels in browser E2E.

Done when schema, command golden, WebGL2 pixel test, WebGPU pixel test where
available, and docs fixture all pass.

## Task 3: Shared Rectangle Properties

Complete all common visual semantics on rectangle before adding another
primitive.

- [x] `transform.translate`
- [x] `transform.scale`
- [x] `transform.anchor`
- [x] `transform.rotate.z`
- [x] `transform.skew`
- [x] `timing.start` and `timing.duration`
- [x] `opacity`
- [x] `zIndex`

Each property has a separate Protocol V2 fixture, command golden, and pixel E2E
test. Timing must be tested before, during, and after a layer is active.
Opacity must test resulting composited alpha, not CSS state.

Done when every later visual atom can inherit this base suite unchanged.

## Task 3.5: Shared 3D-Capable Mat4 Rectangle Runtime

Status: accepted. Task 4 is the current active atom.

- [x] Atomic V2 uses semantic Vec3 transforms and local-unit `anchor`; raw
  `origin` and raw matrix fields are rejected at the schema boundary.
- [x] Compiler B owns fixed-order column-major mat4 model composition, including
  X/Y/Z rotation, Z scale/translation, XY skew, and anchor XYZ pivoting.
- [x] Frame-level orthographic and perspective view/projection matrices are
  emitted before rendering; near/far/FOV validation stays in V2 schema.
- [x] WebGL2 consumes `projection mat4 + model mat4` and applies only the
  canonical-depth to WebGL depth adapter.
- [x] WebGPU consumes the same model matrix and uses explicit 176-byte WGSL
  uniform packing: projection, model, color, params, media.
- [x] `/docs/preview` contains rectangle-only anchor-outside and perspective
  fixtures, with WebGL2 pixel assertions and WebGPU draw coverage when the
  browser exposes an adapter.
- [x] Unit coverage is green for Protocol V2 `3/3`, Compiler B `6/6`, preview
  renderer `6/6`, and web fixture parsing `2/2`.
- [ ] Run WebGPU pixel assertions in a browser with WebGPU enabled; the current
  Playwright Chromium environment reports no adapter, so that test is skipped.

No ellipse, path, text, image, video, effect, or mask work belongs to this task.

## Task 4: Ellipse

Status: implemented and waiting for acceptance.

- [x] Add `payload.shape: "ellipse"` to the strict V2 shape schema.
- [x] Reuse the certified rectangle mat4, anchor, timing, opacity, and z-index
  path without introducing ellipse-specific transform semantics.
- [x] Implement ellipse coverage in WebGL2 and WebGPU using analytic fragment
  coverage with derivative-based antialiasing.
- [x] Assert filled center, transparent bounding-box corners, and an edge pixel
  blended between the fill and background in WebGL2 E2E.
- [x] Add a WebGPU uniform-path regression asserting ellipse geometry selection.
- [ ] Run WebGPU pixel assertions in a browser with a usable WebGPU adapter.

Done when ellipse adds geometry coverage only, without new transform or timing
conventions.

## Task 4.5: 3D Preview Quality and Backend Parity

This task closes the gap between deterministic atom tests and the quality of the
interactive stage before more geometry is added. It changes no Atomic Protocol
semantics.

- [x] Make the stage canvas backing store use composition logical size multiplied
  by the actual device pixel ratio, while the composition remains rendered in
  its own logical coordinate system. Stage resize changes CSS fit scale; DPR
  changes resize backend targets.
- [x] Keep `DPR = 1` for deterministic pixel E2E; add a separate visual/E2E
  check for DPR 2 and stable backing dimensions while the stage is resized.
- [x] Keep WebGPU 4x MSAA as the baseline and verify its multisample resolve
  target matches the canvas physical dimensions.
- [x] Record WebGL2 antialias availability/sample information when the browser
  exposes it; do not assume it matches WebGPU sample locations.
- [x] Add native-pixel, 1:1 fixtures for a rectangle under rotate X, rotate Y,
  perspective, and Z translation. Screenshots of a CSS-scaled stage are not a
  pixel-quality gate.
- [x] Compare WebGPU and WebGL2 geometry bounds and interior pixels with an
  explicit edge tolerance: at most 1 physical pixel at DPR 1, equivalent to
  at most 2 physical pixels at DPR 2. Exact edge pixels may differ because
  sample patterns and drivers differ.
- [x] Classify a dark/multi-pixel fringe as an alpha/compositing regression;
  classify a one-pixel partial-coverage edge as normal antialiasing.
- [x] Document that `zIndex` remains paint order and `translate.z` remains a
  perspective value until a later explicit depth-buffer task is accepted.

Done when preview quality is evaluated at physical canvas resolution and the
backend toggle can distinguish a real renderer regression from ordinary raster
coverage differences.

## Task 5: 3D-aware Shape Paint Extensions

Implement each as an independent ticket, in this order.

- [x] Rectangle stroke.
- [x] Ellipse stroke.
- [x] Stroke width.
- [x] Fill and stroke opacity.
- [x] Rounded rectangle.
- [x] Gradients.

Every shape extension uses local composition units for geometry and stroke
width. Compiler B applies the certified model/view/projection mat4 after the
local geometry is defined. Consequently, perspective may change apparent
screen-space stroke thickness; renderers must not re-measure or re-round stroke
width per backend.

For each ticket, add flat-2D coverage plus rotate X, rotate Y, and perspective
fixtures. Test fill/stroke ordering, partial edge coverage, bounds, and an
interior pixel in WebGPU and WebGL2. Gradients must be defined as semantic style
data in Atomic V2, never as backend shader source.

Rounded rectangle geometry is encoded as `payload.cornerRadius` in local
composition units and is clamped to half the frame's shortest side by Compiler
B. It must not silently fall back to a square rectangle.

Gradient fill is semantic Atomic V2 data with exactly two color stops in this
ticket. Compiler B preserves it as `fillPaint`; WebGPU and WebGL2 only receive
the lowered gradient uniforms after Matrix4 geometry has been resolved.

## Task 6: Path Embedded in 3D

**Dependency gate:** Task 6 is locked until Task 5.95 Phase 8 is accepted.
The Matrix4 hard-lock validator, Runtime V2 public-surface cleanup, preview /
Remotion boundary checks, and the final export gates must pass before path
tessellation is added. This keeps path work focused on local-plane geometry
and prevents a second transform contract from entering the renderer.

Implement in this order.

- [x] Closed path with solid fill (local-plane contours; five-point fixture has WebGPU/WebGL2 parity coverage).
- [x] `fillRule: "nonzero"`.
- [x] `fillRule: "evenodd"`.
- [x] Basic stroke (Runtime-resolved local-plane stroke mesh; fixed width and independent opacity).
- [x] Stroke joins, caps, and dashes (miter/bevel/round joins, butt/square/round caps, deterministic dash arrays).
- [x] Multiple contours (donut/hole fixtures cover both fill rules).
- [x] Path morph after static path certification (topology-matched contour interpolation before tessellation).

Path commands remain two-dimensional coordinates in the atom's local plane.
Compiler B/runtime owns parsing, flattening, and tessellation in that local
space; the resulting vertices are then transformed by the same world/view/
projection mat4 contract as every other atom. GPU backends must not independently
flatten, round, or reinterpret a path after projection.

E2E fixtures include a triangle, a donut/hole with two contours, a stroked
closed path, an open capped/dashed path, and a topology-matched morph path. Each
static geometry case also has one rotate X or Y perspective fixture.
Tests assert fill, hole, edge, outside pixels, projected bounds, and consistent
ordering relative to another `zIndex` layer.

Task 6 is complete when the static Path geometry, paint, stroke, and morph
fixtures pass the shared Runtime, WebGPU, WebGL2, and preview E2E gates above.

## Task 7: Group and Parent Transform

- [x] Add `group` after shape and path behavior is stable.
- [x] Implement parent-to-child world mat4 inheritance using the one shared
  documented multiplication order.
- [x] Implement inherited opacity.
- [x] Implement nested timing.
- [x] Test nested rotation, parent translation, parent/child opacity, sibling
  ordering, child z-index, parent rotate X/Y, and parent/child Z translation.

The V2 Group is a hierarchy-only Protocol atom. Compiler B resolves its local
Matrix4 into each drawable leaf's `worldMatrix`, multiplies parent opacity, and
intersects parent and child active windows. Runtime V2 receives paintable leaves
only, with `parentId: null`; the Group itself never becomes a GPU draw call.

The preview fixture `group.parent-transform` covers a rotated and translated
perspective parent, two overlapping rectangle children, inherited opacity, Z
translation, stable sibling ordering, and equivalent WebGPU/WebGL2 bounds.

Groups establish hierarchy, not implicit cameras or depth-buffer behavior.
Before effects or masks use a group as an offscreen surface, a later task must
define its flattening and composite boundary explicitly.

Masking and clipping are intentionally excluded from this task.

## Task 8: Image

- [x] Define V2 asset descriptor and image atom (`assets[]` + `payload.assetId`).
- [x] Implement `contain`, `cover`, and normalized crop.
- [x] Implement WebGPU/WebGL2 texture upload and asset texture cache behavior.
- [x] Emit a `preview_asset_missing` diagnostic without crashing the frame.
- [x] Test opaque image pixels with a deterministic local JPEG asset.

E2E asserts image pixels and letterbox/crop regions. Tests must not use network
image URLs. Production descriptors may use relative, CDN, or free image URLs
such as Unsplash/Pixabay, but the certification fixture remains local and
deterministic.

## Task 9: Video

- [x] Define video source, trim, loop, mute, and frame policy.
- [x] Implement deterministic seek to the requested media time.
- [x] Add the local `example-video.mp4` fixture.
- [x] Test requested composition frames before testing realtime playback.

Done when a given project frame always selects the expected video frame according
to the shared rounding contract.

## Task 10: Text

- [ ] Require explicit font assets; do not rely on system font fallback.
- [ ] Add renderer-neutral text layout and glyph-run Runtime IR.
- [ ] Keep glyph atlases and GPU buffers inside renderer backends.
- [ ] Add font-missing diagnostics.
- [ ] Test layout metrics before browser pixel baselines.

Text starts only after image/video behavior is certified because font shaping has
separate determinism and asset concerns.

## Task 11: Effects

Effects are atomic render operators, not layer types. Implement one operator per
ticket and retain authoring order.

- [ ] Color adjust.
- [ ] Blur.
- [ ] Shadow.
- [ ] Glow.
- [ ] Noise.
- [ ] Inner glow.

Each effect requires offscreen-target behavior, input/output pixel fixtures, and
effect-chain ordering tests. The offscreen input is the already-projected,
composited atom or group result; effects do not recompute authoring transforms
or change the meaning of Z depth.

## Task 12: Blend Modes and Masks

Masks are last because they depend on group, offscreen targets, and compositing.

Before the first mask, define and certify the flattening boundary: which child
content is rendered to an offscreen target, where the target is placed in the
parent's 3D transform chain, and whether the mask is evaluated before or after
that projection. This policy must be shared by WebGPU, WebGL2, and export.

- [ ] Normal alpha compositing.
- [ ] Blend modes.
- [ ] Clip mask.
- [ ] Alpha mask.
- [ ] Inverse alpha mask.
- [ ] Luma mask.
- [ ] Nested masks and isolation.

Every mask case must assert both masked and unmasked pixels. Visual screenshots
alone are insufficient.

## High-level Authoring Start Gate

Do not begin patterns, presets, templates, or component lowering until all of
the following are certified:

- [ ] Rectangle fill, transform, timing, opacity, and z-index.
- [ ] Ellipse.
- [ ] Task 4.5 3D preview quality and backend parity.
- [ ] Static path fill and stroke.
- [ ] Group and parent transform.
- [x] Image.
- [x] Video.

When this gate is met, create `@motionvideo/motion-authoring` and Compiler A.
It may emit only capability-manifest atoms that have passed this plan.

## V1 Removal Gate

After all application consumers use V2:

- [ ] Delete V1 schema/parser/compiler/runtime paths.
- [ ] Delete V1-only `bone`, legacy camera/depth/2.5D schemas, and V1 evaluator
  code. Retain V2 composition-level camera/projection, semantic Vec3
  transforms, and the shared mat4 runtime contract.
- [ ] Delete V1 capabilities, property sinks, docs, fixtures, and tests.
- [ ] Add CI forbidden-symbol checks for removed V1 vocabulary.
- [ ] Keep any V1 import only in an explicit one-time migration tool, never in
  runtime, preview, or renderer code.
