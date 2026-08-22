# NeonVideo V2 Guides

This directory is the active documentation surface for the V2 render core.
V1 authoring guides were retired with the V2 hard-cut and must not be used as
implementation references.

## Start Here

- [V2 architecture](./v2-architechture.md): the end-to-end path from MCP,
  editor, AI, and CLI input through high-level authoring, Atomic Protocol V2,
  Runtime IR, native preview, Remotion export, and encoded video.

## Current Scope

The render core accepts only Atomic Protocol V2. Rectangle and ellipse are the
currently certified visual atoms. High-level authoring remains a planned layer;
it may be introduced only after it can lower to certified atomic capabilities.

Future guides will be added atom by atom after their protocol, compiler,
runtime, WebGPU, WebGL2, preview E2E, and export parity gates pass.
