# NeonVideo V2 Guides

This directory is the active documentation surface for the V2 render core.
V1 authoring guides were retired with the V2 hard-cut and must not be used as
implementation references.

## Start Here

- [V2 architecture](./v2-architechture.md): the end-to-end path from MCP,
  editor, AI, and CLI input through high-level authoring, Atomic Protocol V2,
  Runtime IR, native preview, Remotion export, and encoded video.
- [V2 audio guide](./audio.md): the project-level audio model, asset sources,
  timing, trim, loop, gain, pan, mute, fade curves, and JSON examples.

## Current Scope

The render core accepts only Atomic Protocol V2. Its certified visual surface
includes groups, rectangle and ellipse shapes, paths, images, video, text,
effects, blend modes, and masks; audio is a separate certified root domain.
See the [V2 architecture](./v2-architechture.md) for the exact capability
catalog and architectural boundaries. High-level authoring remains outside the
V2 protocol and must lower to certified atomic capabilities.
