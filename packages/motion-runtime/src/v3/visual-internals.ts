/**
 * Compiler-internal visual lowering surface.
 *
 * This module is intentionally not re-exported from the package root. It keeps
 * the certified visual evaluator available behind the compiler's visual node
 * lowering, without making the old project/audio shape part of the Runtime V3
 * public API.
 */
export { evaluateVisualRuntimeProject } from "./visual-internals/evaluate";
export {
  assertVisualRuntimeFrame,
  assertVisualRuntimeProject,
  isVisualRuntimeProject,
  normalizeVisualRuntimeProject,
  validateVisualRuntimeProject,
} from "./visual-internals/validate";
export { prepareVisualRuntimeProjectText } from "./visual-internals/text-layout";
export type {
  VisualRuntimeComposition,
  VisualRuntimeFrame,
  VisualRuntimeMask,
  VisualRuntimeNode,
  VisualRuntimeProject,
  VisualRuntimeTextLayout,
  VisualRuntimeView,
} from "./visual-internals/types";
export type {
  VisualRuntimeTextFontResolver,
  VisualRuntimeTextShaperLoader,
} from "./visual-internals/text-layout";
