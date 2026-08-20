import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import {
  affineToMatrix4,
  cssColorToRgba,
  matrix4ForQuad,
  orthographicProjection,
} from "./math";
import { mediaLayout } from "./media";
import type { PreviewBackend } from "./backend";
import type {
  PreviewAsset,
  PreviewDiagnostic,
  PreviewRendererOptions,
  PreviewRenderStats,
  WebGPUContextLike,
  WebGPUDeviceLike,
  WebGPUInitOptions,
  WebGPURenderPipelineLike,
  WebGPUTextureLike,
  WebGPUBufferLike,
} from "./types";

const BUFFER_VERTEX = 0x20;
const BUFFER_UNIFORM = 0x40;
const BUFFER_COPY_DST = 0x08;
const TEXTURE_BINDING = 0x04;
const TEXTURE_COPY_DST = 0x02;
const TEXTURE_RENDER_ATTACHMENT = 0x10;
const MSAA_SAMPLE_COUNT = 4;

const SHADER = `
struct Uniforms {
  projection: mat4x4<f32>,
  model: mat4x4<f32>,
  color: vec4<f32>,
  params: vec4<f32>,
  media: vec4<f32>,
  geometry: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var imageTexture: texture_2d<f32>;
@group(0) @binding(2) var imageSampler: sampler;
struct VertexInput { @location(0) position: vec2<f32>, @location(1) uv: vec2<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
fn roundedBoxDistance(point: vec2<f32>, halfSize: vec2<f32>, radius: f32) -> f32 {
  let q = abs(point) - (halfSize - vec2<f32>(radius, radius));
  return length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - radius;
}
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.projection * uniforms.model * vec4<f32>(input.position, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var shapeAlpha = 1.0;
  if (uniforms.params.x > 0.5 && uniforms.params.x < 1.5) {
    let distanceToEdge = distance(input.uv, vec2<f32>(0.5, 0.5)) * 2.0;
    let edgeWidth = max(fwidth(distanceToEdge), 0.0001);
    shapeAlpha = 1.0 - smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, distanceToEdge);
    if (shapeAlpha <= 0.0) { discard; }
  } else if (uniforms.geometry.x > 0.0) {
    let halfSize = uniforms.geometry.yz * 0.5;
    let point = (input.uv - vec2<f32>(0.5, 0.5)) * uniforms.geometry.yz;
    let distanceToEdge = roundedBoxDistance(point, halfSize, uniforms.geometry.x);
    let edgeWidth = max(fwidth(distanceToEdge), 0.0001);
    shapeAlpha = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToEdge);
    if (shapeAlpha <= 0.0) { discard; }
  }
  var source = select(uniforms.color, textureSample(imageTexture, imageSampler, uniforms.media.xy + input.uv * uniforms.media.zw), uniforms.params.y > 0.5);
  if (uniforms.params.y <= 0.5 && uniforms.params.z > 0.0 && uniforms.params.w > 0.0) {
    var strokeCoverage = 0.0;
    if (uniforms.params.x > 0.5 && uniforms.params.x < 1.5) {
      let p = input.uv * 2.0 - vec2<f32>(1.0, 1.0);
      let innerRadii = max(vec2<f32>(0.0001, 0.0001), vec2<f32>(1.0, 1.0) - uniforms.params.zw);
      let innerDistance = length(p / innerRadii);
      let edgeWidth = max(fwidth(innerDistance), 0.0001);
      let innerCoverage = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, innerDistance);
      strokeCoverage = shapeAlpha * innerCoverage;
    } else if (uniforms.geometry.x > 0.0) {
      let halfSize = uniforms.geometry.yz * 0.5;
      let point = (input.uv - vec2<f32>(0.5, 0.5)) * uniforms.geometry.yz;
      let strokeWidth = max(uniforms.params.z * uniforms.geometry.y, uniforms.params.w * uniforms.geometry.z);
      let halfStroke = strokeWidth * 0.5;
      let innerDistance = roundedBoxDistance(
        point,
        max(halfSize - vec2<f32>(halfStroke, halfStroke), vec2<f32>(0.0001, 0.0001)),
        max(uniforms.geometry.x - halfStroke, 0.0),
      );
      let edgeWidth = max(fwidth(innerDistance), 0.0001);
      strokeCoverage = shapeAlpha * smoothstep(-edgeWidth, edgeWidth, innerDistance);
    } else {
      let edge = min(input.uv, vec2<f32>(1.0, 1.0) - input.uv);
      let halfStroke = uniforms.params.zw * 0.5;
      let distanceToInnerEdge = min(edge.x - halfStroke.x, edge.y - halfStroke.y);
      let edgeWidth = max(fwidth(distanceToInnerEdge), 0.0001);
      strokeCoverage = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToInnerEdge);
    }
    source = mix(source, uniforms.media, strokeCoverage);
  }
  return vec4<f32>(source.rgb, source.a * shapeAlpha * select(1.0, uniforms.color.a, uniforms.params.y > 0.5));
}`;

function webgpuContext(canvas: HTMLCanvasElement | OffscreenCanvas): WebGPUContextLike | null {
  const context = (canvas as unknown as { getContext(contextId: string): unknown }).getContext("webgpu");
  if (!context || typeof context !== "object") return null;
  return context as WebGPUContextLike;
}

function createBackendObjects(device: WebGPUDeviceLike, format: string): {
  pipeline: WebGPURenderPipelineLike;
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
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
        },
      }],
    },
    primitive: { topology: "triangle-strip" },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
  const vertexBuffer = device.createBuffer({ size: 64, usage: BUFFER_VERTEX | BUFFER_COPY_DST });
  device.queue.writeBuffer(vertexBuffer, 0, new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1]));
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  return { pipeline, layout, vertexBuffer, sampler };
}

function writeMatrix4(target: Float32Array, offset: number, matrix: Float32Array | number[]): void {
  for (let index = 0; index < 16; index += 1) target[offset + index] = matrix[index] ?? 0;
}

export function createWebGPUBackend(
  options: PreviewRendererOptions,
  init: WebGPUInitOptions,
  report: (diagnostic: PreviewDiagnostic) => void,
): PreviewBackend {
  const device = init.device as WebGPUDeviceLike;
  const context = (init.context as WebGPUContextLike | undefined) ?? webgpuContext(options.canvas);
  if (!context) throw new Error("preview-renderer: WebGPU context is not available");
  const format = init.format ?? "bgra8unorm";
  context.configure({ device, format, alphaMode: "premultiplied" });
  const objects = createBackendObjects(device, format);
  const assets = new Map(options.assets ?? []);
  const textures = new Map<string, WebGPUTextureLike>();
  const whiteTexture = device.createTexture({
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: TEXTURE_BINDING | TEXTURE_COPY_DST,
  });
  device.queue.writeTexture?.(
    { texture: whiteTexture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1 },
  );
  const transientBuffers = new Set<WebGPUBufferLike>();
  const diagnostics: PreviewDiagnostic[] = [];
  let width = (options.width ?? options.canvas.width) || 1;
  let height = (options.height ?? options.canvas.height) || 1;
  let dpr = options.devicePixelRatio ?? 1;
  let msaaTexture: WebGPUTextureLike | null = null;
  let msaaWidth = 0;
  let msaaHeight = 0;
  let lastStats: PreviewRenderStats = { backend: "webgpu", drawCalls: 0, skippedCommands: 0, frameTimeMs: 0, diagnostics };

  const pushDiagnostic = (diagnostic: PreviewDiagnostic) => {
    diagnostics.push(diagnostic);
    report(diagnostic);
  };

  const textureFor = (assetId: string, asset: PreviewAsset): WebGPUTextureLike | null => {
    if (!device.queue.copyExternalImageToTexture) {
      pushDiagnostic({ severity: "warning", code: "webgpu_external_image_unavailable", message: "This WebGPU device cannot upload texture image assets" });
      return null;
    }
    const texture = textures.get(assetId) ?? device.createTexture({ size: { width: asset.width, height: asset.height }, format: "rgba8unorm", usage: TEXTURE_BINDING | TEXTURE_COPY_DST });
    device.queue.copyExternalImageToTexture({ source: asset.source }, { texture }, { width: asset.width, height: asset.height });
    textures.set(assetId, texture);
    return texture;
  };

  const ensureMsaaTexture = (targetWidth: number, targetHeight: number): WebGPUTextureLike => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (msaaTexture && msaaWidth === nextWidth && msaaHeight === nextHeight) {
      return msaaTexture;
    }
    msaaTexture?.destroy?.();
    msaaTexture = device.createTexture({
      size: { width: nextWidth, height: nextHeight },
      format,
      usage: TEXTURE_RENDER_ATTACHMENT,
      sampleCount: MSAA_SAMPLE_COUNT,
    });
    msaaWidth = nextWidth;
    msaaHeight = nextHeight;
    return msaaTexture;
  };

  const paint = (buffer: PaintCommandBuffer): PreviewRenderStats => {
    const started = performance.now();
    diagnostics.length = 0;
    const frame = buffer.commands.find((command) => command.op === "beginFrame");
    const frameWidth = frame?.op === "beginFrame" ? frame.width : width;
    const frameHeight = frame?.op === "beginFrame" ? frame.height : height;
    const background = cssColorToRgba(
      frame?.op === "beginFrame" ? frame.background ?? options.background : options.background,
    );
    const target = context.getCurrentTexture().createView();
    const multisampleTarget = ensureMsaaTexture(options.canvas.width, options.canvas.height).createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: multisampleTarget, resolveTarget: target, clearValue: { r: background[0], g: background[1], b: background[2], a: background[3] }, loadOp: "clear", storeOp: "discard" }],
    });
    pass.setPipeline(objects.pipeline);
    pass.setVertexBuffer(0, objects.vertexBuffer);
    let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
    let projection = orthographicProjection(frameWidth, frameHeight);
    let drawCalls = 0;
    let skippedCommands = 0;
    for (const command of buffer.commands) {
      if (command.op === "beginFrame") {
        const projectionValues = command.projection?.viewProjectionMatrix ?? command.projection?.projectionMatrix;
        projection = projectionValues?.length === 16
          ? new Float32Array(projectionValues)
          : orthographicProjection(command.width, command.height);
      } else if (command.op === "setTransform") {
        transform = command;
      } else if (command.op === "drawSolid" || command.op === "drawShape") {
        if (!transform || !transform.visible || transform.alpha <= 0) {
          skippedCommands += 1;
          continue;
        }
        if (command.op === "drawShape" && command.shape === "polygon") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "info", code: "preview_op_pending", message: "polygon shape is pending in the native preview backend", key: command.key, layerId: command.layerId });
          continue;
        }
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1);
        const uniform = device.createBuffer({ size: 192, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(48);
        const baseMatrix = transform.matrix4?.length === 16
          ? new Float32Array(transform.matrix4)
          : affineToMatrix4(transform.matrix);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, 0, 0, command.width, command.height));
        data.set(color, 32);
        data[36] = command.op === "drawShape"
          ? command.shape === "ellipse" ? 1 : command.cornerRadius && command.cornerRadius > 0 ? 2 : 0
          : 0;
        data[37] = 0;
        const stroke = command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? cssColorToRgba(command.stroke)
          : [0, 0, 0, 0];
        stroke[3] *= transform.alpha * (command.op === "drawShape" ? command.strokeOpacity ?? 1 : 1);
        const strokeWidth = command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? command.strokeWidth ?? 4
          : 0;
        data[38] = strokeWidth / command.width;
        data[39] = strokeWidth / command.height;
        data.set(stroke, 40);
        data.set([
          command.op === "drawShape" ? command.cornerRadius ?? 0 : 0,
          command.width,
          command.height,
          0,
        ], 44);
        device.queue.writeBuffer(uniform, 0, data);
        const bindGroup = device.createBindGroup({ layout: objects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: whiteTexture.createView() }, { binding: 2, resource: objects.sampler }] });
        pass.setBindGroup(0, bindGroup);
        pass.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawImage" || command.op === "drawVideo") {
        if (!transform || !transform.visible || transform.alpha <= 0 || (command.op === "drawVideo" && command.mediaVisible === false)) {
          skippedCommands += 1;
          continue;
        }
        const asset = assets.get(command.assetId) ?? options.resolveAsset?.({ assetId: command.assetId, uri: command.uri, kind: command.op === "drawVideo" ? "video" : "image" });
        if (!asset) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_asset_missing", message: `Asset ${command.assetId} is not loaded`, key: command.key, layerId: command.layerId });
          continue;
        }
        const image = textureFor(command.assetId, asset);
        if (!image) {
          skippedCommands += 1;
          continue;
        }
        const uniform = device.createBuffer({ size: 192, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(48);
        const layout = mediaLayout(command.width, command.height, asset.width, asset.height, command.fit, command.op === "drawImage" ? command.crop : undefined);
        const baseMatrix = transform.matrix4?.length === 16
          ? new Float32Array(transform.matrix4)
          : affineToMatrix4(transform.matrix);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, layout.x, layout.y, layout.width, layout.height));
        data.set([1, 1, 1, transform.alpha], 32);
        data[36] = 0;
        data[37] = 1;
        data[38] = 0;
        data[39] = 0;
        data.set([layout.uv.x, layout.uv.y, layout.uv.width, layout.uv.height], 40);
        data.set([0, 0, 0, 0], 44);
        device.queue.writeBuffer(uniform, 0, data);
        const bindGroup = device.createBindGroup({ layout: objects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: image.createView() }, { binding: 2, resource: objects.sampler }] });
        pass.setBindGroup(0, bindGroup);
        pass.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawText" || command.op === "drawPath" || command.op === "unsupported") {
        skippedCommands += 1;
        pushDiagnostic({ severity: command.op === "unsupported" ? "error" : "info", code: command.op === "unsupported" ? "preview_unsupported_command" : "preview_op_pending", message: command.op === "unsupported" ? command.message : `${command.op} is pending in the native preview backend`, key: command.key, layerId: command.layerId });
      } else if (command.op === "beginLayer" && (command.offscreen || command.isolation || command.mask)) {
        pushDiagnostic({ severity: "info", code: "preview_compositing_pending", message: "offscreen, isolation, and mask scopes are pending in the native preview backend", key: command.key, layerId: command.layerId });
      }
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    const submittedBuffers = [...transientBuffers];
    transientBuffers.clear();
    if (device.queue.onSubmittedWorkDone) {
      void device.queue.onSubmittedWorkDone().then(() => {
        for (const buffer of submittedBuffers) buffer.destroy?.();
      });
    } else {
      for (const buffer of submittedBuffers) transientBuffers.add(buffer);
    }
    lastStats = { backend: "webgpu", drawCalls, skippedCommands, frameTimeMs: performance.now() - started, diagnostics: [...diagnostics] };
    return lastStats;
  };

  return {
    kind: "webgpu",
    resize(nextWidth, nextHeight, nextDpr) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      options.canvas.width = Math.max(1, Math.round(width * dpr));
      options.canvas.height = Math.max(1, Math.round(height * dpr));
      msaaTexture?.destroy?.();
      msaaTexture = null;
      msaaWidth = 0;
      msaaHeight = 0;
    },
    paint,
    stats: () => lastStats,
    setAsset(assetId, asset) {
      assets.set(assetId, asset);
      textureFor(assetId, asset);
    },
    removeAsset(assetId) {
      assets.delete(assetId);
      textures.get(assetId)?.destroy?.();
      textures.delete(assetId);
    },
    diagnostics,
    dispose() {
      objects.vertexBuffer.destroy?.();
      whiteTexture.destroy?.();
      msaaTexture?.destroy?.();
      msaaTexture = null;
      for (const buffer of transientBuffers) buffer.destroy?.();
      transientBuffers.clear();
      for (const texture of textures.values()) texture.destroy?.();
      textures.clear();
    },
  };
}
