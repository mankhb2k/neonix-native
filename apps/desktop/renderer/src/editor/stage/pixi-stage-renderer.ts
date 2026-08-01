/**
 * @deprecated Import from `./stage-renderer-factory` (Logic-4 honesty rename).
 * Re-exports kept so older relative paths keep compiling during cutover.
 */
export {
  STAGE_RENDERER_BACKEND,
  createPixiStageRenderer,
  createStageRenderer,
  createStageRendererLazy,
  prefetchCanvasStageRenderer,
  prefetchPixiStageRenderer,
  resolveStageBackend,
  type StageRendererBackend,
} from "./stage-renderer-factory";
