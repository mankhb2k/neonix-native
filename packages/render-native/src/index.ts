export * from "./errors";
export * from "./render/types";
export * from "./render/render";
export { verifyRenderOutput, type VerifiedRenderOutput } from "./render/verify";
export * from "./render/frame-range-scheduler";
// Kept even though the distributed chunk-render Cloud Run Job entrypoints
// were deleted (render-chunk-job.ts/render-finalizer-job.ts/runtime-
// manifest.ts/retry-policy.ts - unshipped, RENDER_CHUNK_EXECUTION_ENABLED
// false everywhere): apps/web's lib/server/render/job-store.ts still builds
// and validates a chunk manifest independent of whether it's ever dispatched
// in chunk mode. Confirm apps/web has actually dropped this before deleting
// it here too.
export * from "./render/chunk-manifest";
export { resolveFfmpegAudioMix, resolveProjectAudioMix } from "./render/audio-filter";
export {
  resolveLocalPreviewAssetPath,
  SkiaFrameAssetResolver,
  loadRuntimeFontAssets,
  type SkiaAssetResolverStats,
} from "./render/skia-assets";
export * from "./contracts/index";
export { paintCommandsToSvg, rasterizeSvgToRgba, encodeRgbaToPng } from "./render/svg-rasterizer";
export * from "./media/media-probe-v3";
export * from "./media/media-resource-provider-v3";
export * from "./media/media-worker";
