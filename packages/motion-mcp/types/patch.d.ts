// Hand-maintained declaration for the "./patch" subpath's CJS build (see
// scripts/build-remote-cjs.mjs for why this isn't tsc-generated - same OOM
// reason as "./remote", triggered from a plain-Node consumer like apps/api
// rather than from patch.ts's own tool-schema complexity). Copied verbatim
// into dist/patch.d.ts by that script - edit this file, not the copy. Must
// stay in sync with the real exported surface of src/patch.ts; keep it
// narrow (only what apps/api actually consumes) rather than mirroring every
// internal patch-op type.
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type V2PatchDiagnostic = { path: string; message: string; severity: "error" | "warning" };
export type V2PatchResult = { project: MotionProtocolV2 | null; diagnostics: V2PatchDiagnostic[] };

export declare function applyMotionProtocolV2Patch(project: MotionProtocolV2, patchInput: unknown): V2PatchResult;
