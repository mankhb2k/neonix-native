# Task 12, Subtask 7: Nested Masks and Isolation

## Status

Completed and certified for nested Runtime V2 layer scopes in WebGPU,
WebGL2, and Remotion export.

## Contract

Runtime emits balanced `beginLayer`/`endLayer` commands for every isolated
group. A renderer keeps a stack of layer scopes rather than one global scope.
Each scope owns:

- a content surface;
- an optional mask surface;
- the parent surface that was active when the scope began;
- the current target, content or mask.

The child scope is projected and composited into the parent surface before the
parent scope is composited into its own parent. A masked child therefore keeps
its mask local to that group, while an outer opacity is applied once to the
already flattened child result.

The protocol remains unchanged: isolation is a Runtime execution detail
derived from group opacity or a group mask. No `depth`, `bone`, or renderer-
specific field is added to Atomic Protocol V2.

## Certified Fixtures

- `group.isolation.nested` contains an opacity group containing another
  opacity group and two opaque overlapping rectangles. The overlap and
  front-only pixels must match after both opacity boundaries.
- `composite.mask.nested` contains an alpha-masked inner group inside an outer
  isolated group. The center remains visible and the outside sample remains
  composition background.

Both fixtures use the same command buffer for WebGPU, WebGL2, and Remotion.
Their expected draw counts differ only where a backend needs an explicit
decode pass for a mask surface.

## Renderer Details

WebGL2 and WebGPU allocate per-scope surfaces from the shared render-target
factory. WebGL2 explicitly unbinds a layer texture before drawing into its
framebuffer so a shape cannot create a texture feedback loop. WebGPU keeps
temporary layer textures alive until submitted work completes.

Effects inside isolated groups remain fail-closed until a dedicated effect
scope composition policy is certified. Nested masks and nested isolation do
not silently fall back to per-child opacity.

## Verification

- Preview-lab command tests prove balanced nested scopes and mask ownership.
- Playwright verifies WebGL2/WebGPU pixels and diagnostics for both fixtures.
- Remotion PNG parity verifies the same center, outside, and overlap behavior.
