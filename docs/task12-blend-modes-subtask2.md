# Task 12, Subtask 2: Portable Blend Modes

## Status

Completed and certified for drawable leaves.

## Atomic Contract

Blend mode is an Atomic composite property. It shares the layer's single
normalized `opacity` source alpha; it does not define a second blend opacity:

```json
{
  "opacity": 1,
  "composite": { "blendMode": "multiply" }
}
```

Layer `opacity` is within `0..1` and defaults to `1`. Omitting `composite`
means `normal` source-over. The V2 schema accepts exactly:

- `normal`
- `multiply`
- `screen`
- `add`

Compiler B copies the value to Runtime V2. Runtime emits it only through the
backend-neutral `setTransform.blendMode` command; renderers never infer it from
content type or UI state.

## Rendering Policy

The four modes map to portable GPU fixed-function blend state in both backends.
They work for shapes, paths, images, video, and prepared text because they are
properties of the drawable paint command, not individual atom implementations.

`normal` remains source-over. `multiply` darkens source and backdrop, `screen`
lightens them, and `add` accumulates source light with clamping by the output
format.

## Certified Fixtures

The preview lab supplies the following fixtures. The first four use the local
`/docs/example1-1.jpg` image over an identical pink/blue gradient backdrop:

- `composite.blend.normal`
- `composite.blend.multiply`
- `composite.blend.screen`
- `composite.blend.add`

The following four use a concrete two-image stack:
- `composite.blend.stack.normal`
- `composite.blend.stack.multiply`
- `composite.blend.stack.screen`
- `composite.blend.stack.add`

The stack fixtures make ownership explicit: `example1-1.jpg` has `zIndex: 0`
and no composite mode; `tuyet-roi.jpg` has `zIndex: 1` and is the only layer
with `composite.blendMode`.

The Remotion PNG parity gate covers 81 shared V2 fixtures.

E2E requires four distinct WebGL2 pixel results and WebGPU parity within two
output pixels. The shared Remotion PNG parity gate includes every fixture.

## Deliberate Limits

`darken`, `lighten`, and `overlay` are not V2 values yet. Correct portable
semantics for those modes require a destination-sampling compositing pass, so
they must not silently fall back to `normal`.

Groups with a non-normal blend mode, or a drawable that combines an effect with
a non-normal blend mode, fail closed in Runtime. Their interaction belongs to a
later Task 12 render-pass subtask.

## Verification

- Motion Protocol, Runtime, Compiler, and Preview Renderer typechecks pass.
- Compiler V2 blend lowering tests pass.
- Preview-lab fixture tests pass.
- Playwright verifies distinct WebGL2 output and WebGPU parity within two
  channel values for all four blend fixtures.
- The Remotion PNG parity gate covers 81 shared V2 fixtures.
