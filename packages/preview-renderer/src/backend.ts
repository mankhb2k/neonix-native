import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import type {
  PreviewAsset,
  PreviewDiagnostic,
  PreviewRenderStats,
  PreviewRendererOptions,
} from "./types";

export type PreviewBackend = {
  readonly kind: "webgl2" | "webgpu";
  resize(width: number, height: number, devicePixelRatio: number): void;
  paint(buffer: PaintCommandBuffer): PreviewRenderStats;
  stats(): PreviewRenderStats;
  setAsset(assetId: string, asset: PreviewAsset): void;
  removeAsset(assetId: string): void;
  diagnostics: PreviewDiagnostic[];
  dispose(): void;
};

export type BackendFactory = (
  options: PreviewRendererOptions,
  report: (diagnostic: PreviewDiagnostic) => void,
) => PreviewBackend;

export function reportBackendDiagnostic(
  report: (diagnostic: PreviewDiagnostic) => void,
  diagnostic: PreviewDiagnostic,
): void {
  report(diagnostic);
}
