import {
  assertValidPaintBuffer,
  assertRuntimeFrameV3,
  type PaintCommandBuffer,
  type RuntimeFrameV3,
} from "@motionvideo/motion-runtime";
import { createWebGL2Backend } from "./webgl2";
import { createWebGPUBackend } from "./webgpu";
import type { PreviewBackend } from "./backend";
import type { PreviewDiagnostic, PreviewRenderer, PreviewRendererOptions } from "./shared/types";

function reportDiagnostic(
  options: PreviewRendererOptions,
  diagnostic: PreviewDiagnostic,
): void {
  options.onDiagnostic?.(diagnostic);
}

function webgpuApiAvailable(): boolean {
  const navigatorLike = (globalThis as { navigator?: { gpu?: unknown } }).navigator;
  return Boolean(navigatorLike?.gpu);
}

async function discoverWebGPU(): Promise<{ device: NonNullable<PreviewRendererOptions["webgpu"]>["device"]; format: string } | null> {
  const navigatorLike = (globalThis as {
    navigator?: {
      gpu?: {
        requestAdapter(): Promise<{
          requestDevice(): Promise<NonNullable<PreviewRendererOptions["webgpu"]>["device"]>;
        } | null>;
        getPreferredCanvasFormat?: () => string;
      };
    };
  }).navigator;
  const gpu = navigatorLike?.gpu;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter();
  if (!adapter) return null;
  return {
    device: await adapter.requestDevice(),
    format: gpu.getPreferredCanvasFormat?.() ?? "bgra8unorm",
  };
}

async function createBackend(
  options: PreviewRendererOptions,
  onDiagnostic: (diagnostic: PreviewDiagnostic) => void = (diagnostic) =>
    reportDiagnostic(options, diagnostic),
): Promise<PreviewBackend> {
  const preference = options.backend ?? "auto";
  const report = onDiagnostic;
  if (preference === "webgpu" || preference === "auto") {
    if (options.webgpu || webgpuApiAvailable()) {
      try {
        const init = options.webgpu ?? (await discoverWebGPU());
        if (init) {
          const backend = createWebGPUBackend(options, init, report);
          report({
            severity: "info",
            code: "preview_backend_selected",
            message: `Preview backend selected: ${backend.kind}`,
            key: backend.kind,
          });
          return backend;
        }
      } catch (error) {
        if (preference === "webgpu") throw error;
        report({
          severity: "warning",
          code: "webgpu_unavailable",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (preference === "webgpu") throw new Error("preview-renderer: requested WebGPU but no device is available");
    report({
      severity: "warning",
      code: "webgpu_fallback",
      message: "WebGPU is unavailable; falling back to WebGL2",
    });
  }
  const backend = createWebGL2Backend(options, report);
  report({
    severity: "info",
    code: "preview_backend_selected",
    message: `Preview backend selected: ${backend.kind}`,
    key: backend.kind,
  });
  return backend;
}

export async function createPreviewRenderer(options: PreviewRendererOptions): Promise<PreviewRenderer> {
  const lifecycleDiagnostics: PreviewDiagnostic[] = [];
  const backend = await createBackend(options, (diagnostic) => {
    if (diagnostic.code === "webgpu_fallback" || diagnostic.code === "preview_backend_selected") {
      lifecycleDiagnostics.push(diagnostic);
    }
    reportDiagnostic(options, diagnostic);
  });
  const width = (options.width ?? options.canvas.width) || 1;
  const height = (options.height ?? options.canvas.height) || 1;
  const dpr = options.devicePixelRatio ?? 1;
  backend.resize(width, height, dpr);
  return {
    backend: backend.kind,
    canvas: options.canvas,
    paintFrame(frame: RuntimeFrameV3) {
      assertRuntimeFrameV3(frame);
      assertValidPaintBuffer(frame);
      backend.paint(frame);
    },
    paintCommands(buffer: PaintCommandBuffer) {
      assertValidPaintBuffer(buffer);
      backend.paint(buffer);
    },
    resize(nextWidth, nextHeight, nextDpr = dpr) {
      backend.resize(nextWidth, nextHeight, nextDpr);
    },
    setAsset(assetId, asset) {
      backend.setAsset(assetId, asset);
    },
    removeAsset(assetId) {
      backend.removeAsset(assetId);
    },
    getStats() {
      const stats = backend.stats();
      return {
        ...stats,
        diagnostics: [...lifecycleDiagnostics, ...stats.diagnostics],
      };
    },
    captureImageBitmap() {
      if (typeof createImageBitmap !== "function") return Promise.resolve(null);
      return createImageBitmap(options.canvas);
    },
    dispose() {
      backend.dispose();
    },
  };
}
