import {
  assertValidPaintBuffer,
  assertRuntimeFrameV2,
  type PaintCommandBuffer,
  type RuntimeFrameV2,
} from "@motionvideo/motion-runtime";
import { createWebGL2Backend } from "./webgl2-backend";
import { createWebGPUBackend } from "./webgpu-backend";
import type { PreviewBackend } from "./backend";
import type { PreviewDiagnostic, PreviewRenderer, PreviewRendererOptions } from "./types";

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

async function createBackend(options: PreviewRendererOptions): Promise<PreviewBackend> {
  const preference = options.backend ?? "auto";
  const report = (diagnostic: PreviewDiagnostic) => reportDiagnostic(options, diagnostic);
  if (preference === "webgpu" || preference === "auto") {
    if (options.webgpu || webgpuApiAvailable()) {
      try {
        const init = options.webgpu ?? (await discoverWebGPU());
        if (init) {
          return createWebGPUBackend(options, init, report);
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
  }
  return createWebGL2Backend(options, report);
}

export async function createPreviewRenderer(options: PreviewRendererOptions): Promise<PreviewRenderer> {
  const backend = await createBackend(options);
  const width = (options.width ?? options.canvas.width) || 1;
  const height = (options.height ?? options.canvas.height) || 1;
  const dpr = options.devicePixelRatio ?? 1;
  backend.resize(width, height, dpr);
  return {
    backend: backend.kind,
    canvas: options.canvas,
    paintFrame(frame: RuntimeFrameV2) {
      assertRuntimeFrameV2(frame);
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
      return backend.stats();
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
