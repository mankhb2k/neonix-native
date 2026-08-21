# Protocol V2 Review Guide

Review Protocol V2 from the boundary inward:

1. `src/index.ts` exposes only V2.
2. `src/v2/project.ts` enforces the root envelope and strict fields.
3. `src/v2/layers/` defines only certified atomic layers.
4. `src/v2/transform.ts` owns the 3D transform input, including anchor.
5. `src/v2/capabilities.ts` is the allowlist for compiler support.
6. `schema/v2.json` must match the Zod source byte-for-byte.

Reject any change that adds Protocol knowledge of Runtime IR, GPU resources,
Remotion, editor state, high-level patterns, or a V1 compatibility path.

The acceptance command is:

```bash
pnpm --filter @motionvideo/motion-protocol lint
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-protocol check:schema
```
