import { SHADER } from "./shaders";
import type {
  WebGPUContextLike,
  WebGPUDeviceLike,
  WebGPURenderPipelineLike,
} from "../shared/types";

export const BUFFER_VERTEX = 0x20;
export const BUFFER_INDEX = 0x10;
export const BUFFER_UNIFORM = 0x40;
export const BUFFER_COPY_DST = 0x08;
export const TEXTURE_BINDING = 0x04;
export const TEXTURE_COPY_DST = 0x02;
export const TEXTURE_RENDER_ATTACHMENT = 0x10;
export const MSAA_SAMPLE_COUNT = 4;
export type BlendMode =
  | "normal" | "darken" | "multiply" | "color-burn" | "lighten" | "screen"
  | "color-dodge" | "overlay" | "soft-light" | "hard-light" | "difference"
  | "exclusion" | "hue" | "saturation" | "color" | "luminosity";
export const EFFECT_TEXTURE_FORMAT = "rgba16float";
export const UNIFORM_FLOATS = 208;
export const UNIFORM_BYTES = UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export function webgpuContext(canvas: HTMLCanvasElement | OffscreenCanvas): WebGPUContextLike | null {
  const context = (canvas as unknown as { getContext(contextId: string): unknown }).getContext("webgpu");
  if (!context || typeof context !== "object") return null;
  return context as WebGPUContextLike;
}

export function createBackendObjects(
  device: WebGPUDeviceLike,
  format: string,
  sampleCount = MSAA_SAMPLE_COUNT,
  blendMode: BlendMode = "normal",
): {
  pipeline: WebGPURenderPipelineLike;
  pathPipeline: WebGPURenderPipelineLike;
  layout: ReturnType<WebGPUDeviceLike["createBindGroupLayout"]>;
  vertexBuffer: ReturnType<WebGPUDeviceLike["createBuffer"]>;
  sampler: ReturnType<WebGPUDeviceLike["createSampler"]>;
} {
  const shader = device.createShaderModule({ code: SHADER });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 3, buffer: { type: "uniform" } },
      { binding: 1, visibility: 2, texture: { sampleType: "float" } },
      { binding: 2, visibility: 2, sampler: { type: "filtering" } },
    ],
  });
  const blend = blendMode === "multiply"
      ? {
          color: { srcFactor: "dst", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
        }
      : blendMode === "screen"
        ? {
            color: { srcFactor: "one", dstFactor: "one-minus-src" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          }
        : {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          };
  const pipelineOptions = {
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: {
      module: shader,
      entryPoint: "vertexMain",
      buffers: [{ arrayStride: 16, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }, { shaderLocation: 1, offset: 8, format: "float32x2" }] }],
    },
    fragment: {
      module: shader,
      entryPoint: "fragmentMain",
      targets: [{
        format,
        blend,
      }],
    },
    multisample: { count: sampleCount },
  };
  const pipeline = device.createRenderPipeline({
    ...pipelineOptions,
    primitive: { topology: "triangle-strip" },
  });
  const pathPipeline = device.createRenderPipeline({
    ...pipelineOptions,
    primitive: { topology: "triangle-list" },
  });
  const vertexBuffer = device.createBuffer({ size: 64, usage: BUFFER_VERTEX | BUFFER_COPY_DST });
  device.queue.writeBuffer(vertexBuffer, 0, new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1]));
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  return { pipeline, pathPipeline, layout, vertexBuffer, sampler };
}


export function writeMatrix4(target: Float32Array, offset: number, matrix: Float32Array): void {
  target.set(matrix, offset);
}
