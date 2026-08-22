import { CLIP_MASK_POST_SHADER, INNER_GLOW_POST_SHADER, POST_SHADER } from "./shaders";
import { MSAA_SAMPLE_COUNT } from "./resources";
import type { WebGPUDeviceLike, WebGPURenderPipelineLike } from "../shared/types";

export function createPostObjects(device: WebGPUDeviceLike, format: string, sampleCount = 1, premultiplied = false): {
  pipeline: WebGPURenderPipelineLike;
  layout: ReturnType<WebGPUDeviceLike["createBindGroupLayout"]>;
} {
  const shader = device.createShaderModule({ code: POST_SHADER });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 3, buffer: { type: "uniform" } },
      { binding: 1, visibility: 2, texture: { sampleType: "float" } },
      { binding: 2, visibility: 2, sampler: { type: "filtering" } },
    ],
  });
  const pipeline = device.createRenderPipeline({
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
        ...(premultiplied ? {
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        } : {}),
      }],
    },
    primitive: { topology: "triangle-strip" },
    multisample: { count: sampleCount },
  });
  return { pipeline, layout };
}

export function createClipMaskPostObjects(device: WebGPUDeviceLike, format: string, sampleCount = MSAA_SAMPLE_COUNT): {
  pipeline: WebGPURenderPipelineLike;
  layout: ReturnType<WebGPUDeviceLike["createBindGroupLayout"]>;
} {
  const shader = device.createShaderModule({ code: CLIP_MASK_POST_SHADER });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 3, buffer: { type: "uniform" } },
      { binding: 1, visibility: 2, texture: { sampleType: "float" } },
      { binding: 2, visibility: 2, texture: { sampleType: "float" } },
      { binding: 3, visibility: 2, sampler: { type: "filtering" } },
    ],
  });
  const pipeline = device.createRenderPipeline({
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
        blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
        },
      }],
    },
    primitive: { topology: "triangle-strip" },
    multisample: { count: sampleCount },
  });
  return { pipeline, layout };
}

export function createInnerGlowPostObjects(device: WebGPUDeviceLike, format: string): {
  pipeline: WebGPURenderPipelineLike;
  layout: ReturnType<WebGPUDeviceLike["createBindGroupLayout"]>;
} {
  const shader = device.createShaderModule({ code: INNER_GLOW_POST_SHADER });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 3, buffer: { type: "uniform" } },
      { binding: 1, visibility: 2, texture: { sampleType: "float" } },
      { binding: 2, visibility: 2, texture: { sampleType: "float" } },
      { binding: 3, visibility: 2, sampler: { type: "filtering" } },
    ],
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: {
      module: shader,
      entryPoint: "vertexMain",
      buffers: [{ arrayStride: 16, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }, { shaderLocation: 1, offset: 8, format: "float32x2" }] }],
    },
    fragment: { module: shader, entryPoint: "fragmentMain", targets: [{ format }] },
    primitive: { topology: "triangle-strip" },
  });
  return { pipeline, layout };
}

