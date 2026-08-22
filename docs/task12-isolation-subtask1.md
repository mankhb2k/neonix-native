# Task 12, Subtask 1: Group Isolation Boundary

## Status

Completed and certified for normal source-over alpha compositing of one
isolated group subtree.

## Contract

`Group` remains a hierarchy-only Atomic Protocol V2 node. It is not a draw
primitive and does not own a second transform representation.

Compiler B resolves every child local transform into its Matrix4 `worldMatrix`
as before. Runtime V2 now retains the group node and its `parentId` tree so it
can determine a compositing boundary. A group with `opacity < 1` produces:

1. `beginLayer({ isolation: true, offscreen: true, compositeAlpha })`
2. Child commands in sibling `zIndex` order, each with its own local opacity
3. `endLayer`

The native renderer captures that subtree in a full-composition offscreen
surface after world-to-clip projection. It decodes the captured premultiplied
sRGB source into linear working color, then encodes and source-over composites
the result once with `compositeAlpha`.

Therefore an opaque front child has the same result in an overlap and in its
front-only region. Parent opacity is never multiplied into every child.

## Backend Boundary

WebGPU is the default backend; WebGL2 follows the same command contract.
Remotion export reaches the same `preview-renderer` backend implementation, so
export consumes the same Runtime frame and isolation commands.

This subtask intentionally has no Atomic `isolation` field. Isolation is a
Runtime-derived execution detail triggered by existing group opacity semantics.

## Certified Fixture

`group.isolation.opacity` contains two overlapping opaque rectangles inside a
50% opacity group. E2E samples the overlap and front-only pixels and requires
them to match, then checks WebGL2/WebGPU parity. The shared Remotion PNG parity
gate renders this fixture too.

## Deliberate Limits

The evaluator fails closed when a group requiring isolation contains an effect,
or when a second isolated group would be nested inside it. Masking, blend modes,
and nested isolation remain later Task 12 subtasks. This prevents unsupported
content from silently receiving the old per-child-opacity behavior.

## Verification

- Runtime unit tests: 9 passed
- Compiler unit tests: 30 passed
- Preview fixture tests: 2 passed
- Focused Playwright group isolation tests: 2 passed
- Preview-to-Remotion PNG parity: 81/81 fixtures passed
