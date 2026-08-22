import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import {
  cssColorToRgba,
  matrix4ForQuad,
  packMatrix4F32,
  worldToClipMatrixForPaint,
  gradientUniforms,
} from "./math";
import { mediaLayout } from "./media";
import { createTextAtlas, type TextAtlas } from "./text-atlas";
import { colorAdjustUniforms } from "./effects";
import { buildEffectPassPlan, type EffectPassPlan } from "./effect-pass-plan";
import { blurPyramidPlan } from "./blur-quality";
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
  WebGPUCommandEncoderLike,
} from "./types";

const BUFFER_VERTEX = 0x20;
const BUFFER_INDEX = 0x10;
const BUFFER_UNIFORM = 0x40;
const BUFFER_COPY_DST = 0x08;
const TEXTURE_BINDING = 0x04;
const TEXTURE_COPY_DST = 0x02;
const TEXTURE_RENDER_ATTACHMENT = 0x10;
const MSAA_SAMPLE_COUNT = 4;
type BlendMode = "normal" | "multiply" | "screen" | "add";
const EFFECT_TEXTURE_FORMAT = "rgba16float";
const UNIFORM_FLOATS = 84;
const UNIFORM_BYTES = UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;

const SHADER = `
struct Uniforms {
  projection: mat4x4<f32>,
  model: mat4x4<f32>,
  color: vec4<f32>,
  params: vec4<f32>,
  media: vec4<f32>,
  geometry: vec4<f32>,
  gradientStart: vec4<f32>,
  gradientEnd: vec4<f32>,
  gradientParams: vec4<f32>,
  gradientRadius: vec4<f32>,
  colorAdjustMeta: vec4<f32>,
  colorAdjust0: vec4<f32>,
  colorAdjust1: vec4<f32>,
  colorAdjust2: vec4<f32>,
  colorAdjust3: vec4<f32>,
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
fn applyHueRotate(color: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec3<f32>(
    color.r * (0.213 + c * 0.787 - s * 0.213) + color.g * (0.715 - c * 0.715 - s * 0.715) + color.b * (0.072 - c * 0.072 + s * 0.928),
    color.r * (0.213 - c * 0.213 + s * 0.143) + color.g * (0.715 + c * 0.285 + s * 0.140) + color.b * (0.072 - c * 0.072 - s * 0.283),
    color.r * (0.213 - c * 0.213 - s * 0.787) + color.g * (0.715 - c * 0.715 + s * 0.715) + color.b * (0.072 + c * 0.928 + s * 0.072),
  );
}
fn applyColorAdjust(source: vec4<f32>, effect: vec4<f32>) -> vec4<f32> {
  var color = clamp(source.rgb + vec3<f32>(effect.x), vec3<f32>(0.0), vec3<f32>(1.0));
  color = clamp((color - vec3<f32>(0.5)) * effect.y + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0));
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = mix(vec3<f32>(luma), color, effect.z);
  return vec4<f32>(clamp(applyHueRotate(color, effect.w), vec3<f32>(0.0), vec3<f32>(1.0)), source.a);
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
  let sampled = textureSample(imageTexture, imageSampler, uniforms.media.xy + input.uv * uniforms.media.zw);
  var source = select(uniforms.color, sampled, uniforms.params.y > 0.5);
  if (uniforms.params.y > 1.5) {
    source = vec4<f32>(uniforms.color.rgb, uniforms.color.a * sampled.a);
  }
  if (uniforms.params.y <= 0.5 && uniforms.gradientParams.x > 0.5) {
    var gradientT = 0.0;
    if (uniforms.gradientParams.x < 1.5) {
      let direction = vec2<f32>(cos(uniforms.gradientParams.y), sin(uniforms.gradientParams.y));
      let extent = length(uniforms.geometry.yz) * 0.5;
      let point = (input.uv - vec2<f32>(0.5, 0.5)) * uniforms.geometry.yz;
      gradientT = dot(point, direction) / max(2.0 * extent, 0.0001) + 0.5;
    } else {
      let point = (input.uv - uniforms.gradientParams.zw) * uniforms.geometry.yz;
      gradientT = length(point) / max(uniforms.gradientRadius.x * min(uniforms.geometry.y, uniforms.geometry.z), 0.0001);
    }
    source = mix(uniforms.gradientStart, uniforms.gradientEnd, clamp(gradientT, 0.0, 1.0));
  }
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
  if (uniforms.colorAdjustMeta.x > 0.5) { source = applyColorAdjust(source, uniforms.colorAdjust0); }
  if (uniforms.colorAdjustMeta.x > 1.5) { source = applyColorAdjust(source, uniforms.colorAdjust1); }
  if (uniforms.colorAdjustMeta.x > 2.5) { source = applyColorAdjust(source, uniforms.colorAdjust2); }
  if (uniforms.colorAdjustMeta.x > 3.5) { source = applyColorAdjust(source, uniforms.colorAdjust3); }
  return vec4<f32>(source.rgb, source.a * shapeAlpha * select(1.0, uniforms.color.a, uniforms.params.y > 0.5 && uniforms.params.y < 1.5));
}`;

const POST_SHADER = `
struct PostUniforms {
  step: vec4<f32>,
  colorAdjustMeta: vec4<f32>,
  colorAdjust0: vec4<f32>,
  colorAdjust1: vec4<f32>,
  colorAdjust2: vec4<f32>,
  colorAdjust3: vec4<f32>,
  shadowColor: vec4<f32>,
  shadowOffset: vec4<f32>,
  noiseParams: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: PostUniforms;
@group(0) @binding(1) var imageTexture: texture_2d<f32>;
@group(0) @binding(2) var imageSampler: sampler;
struct VertexInput { @location(0) position: vec2<f32>, @location(1) uv: vec2<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // WebGPU textures have a top-left origin. Keep that convention when a
  // fullscreen pass copies an offscreen texture into another render target.
  output.position = vec4<f32>(
    input.position.x * 2.0 - 1.0,
    1.0 - input.position.y * 2.0,
    0.0,
    1.0,
  );
  output.uv = input.uv;
  return output;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  if (uniforms.step.w > 1.5 && uniforms.step.w < 2.5) {
    let alpha = readColor(input.uv - uniforms.shadowOffset.xy).a * uniforms.shadowColor.a;
    return vec4<f32>(srgbToLinear(uniforms.shadowColor.rgb) * alpha, alpha);
  }
  var color = readColor(input.uv);
  let sigma = uniforms.step.z;
  if (sigma > 0.0) {
    let support = ceil(3.0 * sigma);
    var totalWeight = 1.0;
    for (var i = 1; i <= 12; i = i + 1) {
      let offset = f32(i);
      if (offset <= support) {
        let weight = exp(-0.5 * offset * offset / (sigma * sigma));
        color += readColor(input.uv + uniforms.step.xy * offset) * weight;
        color += readColor(input.uv - uniforms.step.xy * offset) * weight;
        totalWeight += 2.0 * weight;
      }
    }
    color /= totalWeight;
  }
  if (uniforms.colorAdjustMeta.x > 0.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust0); }
  if (uniforms.colorAdjustMeta.x > 1.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust1); }
  if (uniforms.colorAdjustMeta.x > 2.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust2); }
  if (uniforms.colorAdjustMeta.x > 3.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust3); }
  if (color.a > 0.000001 && uniforms.noiseParams.x > 0.0) {
    let resolution = vec2<f32>(textureDimensions(imageTexture));
    let cell = floor(input.uv * resolution / max(uniforms.noiseParams.x, 0.25));
    let noiseValue = noiseHash(cell + vec2<f32>(uniforms.noiseParams.w, uniforms.noiseParams.w * 1.37));
    let delta = (noiseValue - 0.5) * 2.0 * uniforms.noiseParams.y * uniforms.noiseParams.z;
    let colorValue = clamp(color.rgb / color.a + vec3<f32>(delta), vec3<f32>(0.0), vec3<f32>(1.0));
    color = vec4<f32>(colorValue * color.a, color.a);
  }
  if (uniforms.step.w > 0.5) { return encodePremultiplied(color * uniforms.shadowOffset.z); }
  return color;
}
fn srgbToLinear(color: vec3<f32>) -> vec3<f32> {
  let low = color / 12.92;
  let high = pow((color + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(low, high, color >= vec3<f32>(0.04045));
}
fn linearToSrgb(color: vec3<f32>) -> vec3<f32> {
  let positive = max(color, vec3<f32>(0.0));
  let low = positive * 12.92;
  let high = 1.055 * pow(positive, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(low, high, positive >= vec3<f32>(0.0031308));
}
fn decodePremultiplied(color: vec4<f32>) -> vec4<f32> {
  if (color.a <= 0.000001) { return vec4<f32>(0.0); }
  return vec4<f32>(srgbToLinear(clamp(color.rgb / color.a, vec3<f32>(0.0), vec3<f32>(1.0))) * color.a, color.a);
}
fn encodePremultiplied(color: vec4<f32>) -> vec4<f32> {
  if (color.a <= 0.000001) { return vec4<f32>(0.0); }
  return vec4<f32>(linearToSrgb(color.rgb / color.a) * color.a, color.a);
}
fn readColor(uv: vec2<f32>) -> vec4<f32> {
  let color = textureSample(imageTexture, imageSampler, uv);
  return select(color, decodePremultiplied(color), uniforms.step.w < -0.5);
}
fn applyPostHueRotate(color: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec3<f32>(
    color.r * (0.213 + c * 0.787 - s * 0.213) + color.g * (0.715 - c * 0.715 - s * 0.715) + color.b * (0.072 - c * 0.072 + s * 0.928),
    color.r * (0.213 - c * 0.213 + s * 0.143) + color.g * (0.715 + c * 0.285 + s * 0.140) + color.b * (0.072 - c * 0.072 - s * 0.283),
    color.r * (0.213 - c * 0.213 - s * 0.787) + color.g * (0.715 - c * 0.715 + s * 0.715) + color.b * (0.072 + c * 0.928 + s * 0.072),
  );
}
fn applyPostColorAdjust(source: vec4<f32>, effect: vec4<f32>) -> vec4<f32> {
  if (source.a <= 0.000001) { return vec4<f32>(0.0); }
  var color = clamp(source.rgb / source.a + vec3<f32>(effect.x), vec3<f32>(0.0), vec3<f32>(1.0));
  color = clamp((color - vec3<f32>(0.5)) * effect.y + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0));
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = mix(vec3<f32>(luma), color, effect.z);
  return vec4<f32>(applyPostHueRotate(color, effect.w) * source.a, source.a);
}
fn noiseHash(point: vec2<f32>) -> f32 {
  var value = fract(vec3<f32>(point.x, point.y, point.x + point.y) * 0.1031);
  value = value + dot(value, value.yzx + vec3<f32>(33.33));
  return fract((value.x + value.y) * value.z);
}`;

const CLIP_MASK_POST_SHADER = `
struct ClipMaskUniforms { compositeAlpha: vec4<f32> };
@group(0) @binding(0) var<uniform> uniforms: ClipMaskUniforms;
@group(0) @binding(1) var contentTexture: texture_2d<f32>;
@group(0) @binding(2) var coverageTexture: texture_2d<f32>;
@group(0) @binding(3) var imageSampler: sampler;
struct VertexInput { @location(0) position: vec2<f32>, @location(1) uv: vec2<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position.x * 2.0 - 1.0, 1.0 - input.position.y * 2.0, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}
fn linearToSrgb(color: vec3<f32>) -> vec3<f32> {
  let positive = max(color, vec3<f32>(0.0));
  let low = positive * 12.92;
  let high = 1.055 * pow(positive, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(low, high, positive >= vec3<f32>(0.0031308));
}
fn srgbToLinear(color: vec3<f32>) -> vec3<f32> {
  let low = color / 12.92;
  let high = pow((color + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(low, high, color >= vec3<f32>(0.04045));
}
fn decodePremultiplied(color: vec4<f32>) -> vec4<f32> {
  if (color.a <= 0.000001) { return vec4<f32>(0.0); }
  return vec4<f32>(srgbToLinear(clamp(color.rgb / color.a, vec3<f32>(0.0), vec3<f32>(1.0))) * color.a, color.a);
}
fn encodePremultiplied(color: vec4<f32>) -> vec4<f32> {
  if (color.a <= 0.000001) { return vec4<f32>(0.0); }
  return vec4<f32>(linearToSrgb(color.rgb / color.a) * color.a, color.a);
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let content = textureSample(contentTexture, imageSampler, input.uv);
  let mask = decodePremultiplied(textureSample(coverageTexture, imageSampler, input.uv));
  var coverage = mask.a;
  if (uniforms.compositeAlpha.z > 0.5 && mask.a > 0.000001) {
    coverage = dot(mask.rgb / mask.a, vec3<f32>(0.2126, 0.7152, 0.0722)) * mask.a;
  }
  if (uniforms.compositeAlpha.y > 0.5) { coverage = 1.0 - coverage; }
  return encodePremultiplied(content * coverage * uniforms.compositeAlpha.x);
}`;

const INNER_GLOW_POST_SHADER = `
struct InnerGlowUniforms { tint: vec4<f32> };
@group(0) @binding(0) var<uniform> uniforms: InnerGlowUniforms;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var blurredTexture: texture_2d<f32>;
@group(0) @binding(3) var imageSampler: sampler;
struct VertexInput { @location(0) position: vec2<f32>, @location(1) uv: vec2<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position.x * 2.0 - 1.0, 1.0 - input.position.y * 2.0, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}
fn srgbToLinear(color: vec3<f32>) -> vec3<f32> {
  let low = color / 12.92;
  let high = pow((color + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(low, high, color >= vec3<f32>(0.04045));
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let sourceAlpha = textureSample(sourceTexture, imageSampler, input.uv).a;
  let blurredAlpha = textureSample(blurredTexture, imageSampler, input.uv).a;
  let coverage = max(sourceAlpha - blurredAlpha, 0.0) * uniforms.tint.a;
  return vec4<f32>(srgbToLinear(uniforms.tint.rgb) * coverage, coverage);
}`;

function webgpuContext(canvas: HTMLCanvasElement | OffscreenCanvas): WebGPUContextLike | null {
  const context = (canvas as unknown as { getContext(contextId: string): unknown }).getContext("webgpu");
  if (!context || typeof context !== "object") return null;
  return context as WebGPUContextLike;
}

function createBackendObjects(
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
  const blend = blendMode === "add"
    ? {
        color: { srcFactor: "src-alpha", dstFactor: "one" },
        alpha: { srcFactor: "one", dstFactor: "one" },
      }
    : blendMode === "multiply"
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

function createPostObjects(device: WebGPUDeviceLike, format: string, sampleCount = 1, premultiplied = false): {
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

function createClipMaskPostObjects(device: WebGPUDeviceLike, format: string, sampleCount = MSAA_SAMPLE_COUNT): {
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

function createInnerGlowPostObjects(device: WebGPUDeviceLike, format: string): {
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

function writeMatrix4(target: Float32Array, offset: number, matrix: Float32Array): void {
  target.set(matrix, offset);
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
  const singleSampleObjects = createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1);
  const blendObjects = new Map<BlendMode, ReturnType<typeof createBackendObjects>>([
    ["normal", objects],
    ["multiply", createBackendObjects(device, format, MSAA_SAMPLE_COUNT, "multiply")],
    ["screen", createBackendObjects(device, format, MSAA_SAMPLE_COUNT, "screen")],
    ["add", createBackendObjects(device, format, MSAA_SAMPLE_COUNT, "add")],
  ]);
  const singleSampleBlendObjects = new Map<BlendMode, ReturnType<typeof createBackendObjects>>([
    ["normal", singleSampleObjects],
    ["multiply", createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1, "multiply")],
    ["screen", createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1, "screen")],
    ["add", createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1, "add")],
  ]);
  const postObjects = createPostObjects(device, format);
  const postMsaaObjects = createPostObjects(device, format, MSAA_SAMPLE_COUNT);
  const postMsaaPremultipliedObjects = createPostObjects(device, format, MSAA_SAMPLE_COUNT, true);
  const clipMaskPostMsaaObjects = createClipMaskPostObjects(device, format);
  const effectPostObjects = createPostObjects(device, EFFECT_TEXTURE_FORMAT);
  const effectPostPremultipliedObjects = createPostObjects(device, EFFECT_TEXTURE_FORMAT, 1, true);
  const innerGlowPostObjects = createInnerGlowPostObjects(device, EFFECT_TEXTURE_FORMAT);
  const clipMaskPostEffectObjects = createClipMaskPostObjects(device, EFFECT_TEXTURE_FORMAT, 1);
  const assets = new Map(options.assets ?? []);
  const textures = new Map<string, WebGPUTextureLike>();
  const textAtlases = new Map<string, TextAtlas>();
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
  let stageTextures: [WebGPUTextureLike, WebGPUTextureLike] | null = null;
  type EffectLevel = { width: number; height: number; a: WebGPUTextureLike; b: WebGPUTextureLike };
  let effectSourceTexture: WebGPUTextureLike | null = null;
  let effectLevels: EffectLevel[] = [];
  let createLayerTexture: ((targetWidth: number, targetHeight: number) => WebGPUTextureLike) | null = null;
  let stageWidth = 0;
  let stageHeight = 0;
  let effectWidth = 0;
  let effectHeight = 0;
  let lastStats: PreviewRenderStats = { backend: "webgpu", drawCalls: 0, skippedCommands: 0, frameTimeMs: 0, diagnostics };

  const pushDiagnostic = (diagnostic: PreviewDiagnostic) => {
    diagnostics.push(diagnostic);
    report(diagnostic);
  };

  const textureFor = (assetId: string, asset: PreviewAsset): WebGPUTextureLike | null => {
    if (!asset.pixels && !device.queue.copyExternalImageToTexture) {
      pushDiagnostic({ severity: "warning", code: "webgpu_external_image_unavailable", message: "This WebGPU device cannot upload texture image assets" });
      return null;
    }
    const texture = textures.get(assetId) ?? device.createTexture({
      size: { width: asset.width, height: asset.height },
      format: "rgba8unorm",
      // Chromium/Dawn requires RenderAttachment for copyExternalImageToTexture
      // when the source is an HTMLVideoElement.
      usage: TEXTURE_BINDING | TEXTURE_COPY_DST | TEXTURE_RENDER_ATTACHMENT,
    });
    if (asset.pixels && device.queue.writeTexture) {
      device.queue.writeTexture(
        { texture },
        asset.pixels,
        { bytesPerRow: asset.width * 4, rowsPerImage: asset.height },
        { width: asset.width, height: asset.height },
      );
    } else {
      device.queue.copyExternalImageToTexture?.({ source: asset.source }, { texture }, { width: asset.width, height: asset.height });
    }
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

  const disposeStageTargets = () => {
    stageTextures?.[0].destroy?.();
    stageTextures?.[1].destroy?.();
    stageTextures = null;
    stageWidth = 0;
    stageHeight = 0;
  };

  const disposeEffectTargets = () => {
    effectSourceTexture?.destroy?.();
    for (const level of effectLevels) {
      level.a.destroy?.();
      level.b.destroy?.();
    }
    effectSourceTexture = null;
    effectLevels = [];
    effectWidth = 0;
    effectHeight = 0;
  };

  const disposeRenderTargets = () => {
    disposeStageTargets();
    disposeEffectTargets();
  };

  const ensureStageTargets = (targetWidth: number, targetHeight: number) => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (stageTextures && stageWidth === nextWidth && stageHeight === nextHeight) return;
    disposeStageTargets();
    const createStageTexture = () => device.createTexture({
      size: { width: nextWidth, height: nextHeight },
      format,
      usage: TEXTURE_BINDING | TEXTURE_RENDER_ATTACHMENT,
    });
    stageTextures = [createStageTexture(), createStageTexture()];
    stageWidth = nextWidth;
    stageHeight = nextHeight;
  };

  const ensureEffectTargets = (targetWidth: number, targetHeight: number) => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (effectSourceTexture && effectLevels.length > 0 && effectWidth === nextWidth && effectHeight === nextHeight) return;
    disposeEffectTargets();
    const createEffectTexture = (levelWidth: number, levelHeight: number) => device.createTexture({
      size: { width: levelWidth, height: levelHeight },
      format: EFFECT_TEXTURE_FORMAT,
      usage: TEXTURE_BINDING | TEXTURE_RENDER_ATTACHMENT,
    });
    createLayerTexture = (layerWidth, layerHeight) => createEffectTexture(layerWidth, layerHeight);
    effectSourceTexture = createEffectTexture(nextWidth, nextHeight);
    let levelWidth = nextWidth;
    let levelHeight = nextHeight;
    for (let level = 0; level < 9; level += 1) {
      effectLevels.push({
        width: levelWidth,
        height: levelHeight,
        a: createEffectTexture(levelWidth, levelHeight),
        b: createEffectTexture(levelWidth, levelHeight),
      });
      if (levelWidth === 1 && levelHeight === 1) break;
      levelWidth = Math.max(1, Math.ceil(levelWidth / 2));
      levelHeight = Math.max(1, Math.ceil(levelHeight / 2));
    }
    effectWidth = nextWidth;
    effectHeight = nextHeight;
  };

  const paint = (buffer: PaintCommandBuffer): PreviewRenderStats => {
    const started = performance.now();
    diagnostics.length = 0;
    const frame = buffer.commands.find((command) => command.op === "beginFrame");
    const background = cssColorToRgba(
      frame?.op === "beginFrame" ? frame.background ?? options.background : options.background,
    );
    const encoder = device.createCommandEncoder();
    const target = context.getCurrentTexture().createView();
    const physicalWidth = Math.max(1, options.canvas.width);
    const physicalHeight = Math.max(1, options.canvas.height);
    ensureStageTargets(physicalWidth, physicalHeight);
    const stages = stageTextures!;
    const multisampleTarget = ensureMsaaTexture(physicalWidth, physicalHeight).createView();
    const post = (
      nextPass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]>,
      texture: WebGPUTextureLike,
      params: readonly [number, number, number, number] = [0, 0, 0, 0],
      postPipeline = postObjects,
      adjustments: EffectPassPlan["sourceColorAdjust"] | undefined = undefined,
      shadow?: { color: readonly [number, number, number, number]; offsetX: number; offsetY: number; compositeAlpha?: number },
      noiseEffect?: { scale: number; amount: number; opacity: number; seed: number },
    ) => {
      const uniform = device.createBuffer({ size: 144, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
      transientBuffers.add(uniform);
      const data = new Float32Array(36);
      data.set(params, 0);
      data.set(colorAdjustUniforms(adjustments), 4);
      data.set(shadow?.color ?? [0, 0, 0, 0], 24);
      data.set([shadow?.offsetX ?? 0, shadow?.offsetY ?? 0, shadow?.compositeAlpha ?? 1, 0], 28);
      data.set([noiseEffect?.scale ?? 0, noiseEffect?.amount ?? 0, noiseEffect?.opacity ?? 0, noiseEffect?.seed ?? 0], 32);
      device.queue.writeBuffer(uniform, 0, data);
      const bindGroup = device.createBindGroup({ layout: postPipeline.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: texture.createView() }, { binding: 2, resource: objects.sampler }] });
      nextPass.setPipeline(postPipeline.pipeline);
      nextPass.setVertexBuffer(0, objects.vertexBuffer);
      nextPass.setBindGroup(0, bindGroup);
      nextPass.draw(4);
    };
    const postClipMask = (
      nextPass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]>,
      content: WebGPUTextureLike,
      coverage: WebGPUTextureLike,
      compositeAlpha: number,
      mode: "clip" | "alpha" | "inverse-alpha" | "luma",
      pipelineObjects = clipMaskPostMsaaObjects,
    ) => {
      const uniform = device.createBuffer({ size: 16, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
      transientBuffers.add(uniform);
      device.queue.writeBuffer(uniform, 0, new Float32Array([compositeAlpha, mode === "inverse-alpha" ? 1 : 0, mode === "luma" ? 1 : 0, 0]));
      const bindGroup = device.createBindGroup({
        layout: pipelineObjects.layout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          { binding: 1, resource: content.createView() },
          { binding: 2, resource: coverage.createView() },
          { binding: 3, resource: objects.sampler },
        ],
      });
      nextPass.setPipeline(pipelineObjects.pipeline);
      nextPass.setVertexBuffer(0, objects.vertexBuffer);
      nextPass.setBindGroup(0, bindGroup);
      nextPass.draw(4);
    };
    const beginStagePass = (output: WebGPUTextureLike, source?: WebGPUTextureLike) => {
      const nextPass = encoder.beginRenderPass({
        colorAttachments: [{ view: multisampleTarget, resolveTarget: output.createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: background[3] }, loadOp: "clear", storeOp: "discard" }],
      });
      if (source) post(nextPass, source, [0, 0, 0, 0], postMsaaObjects);
      return nextPass;
    };
    let stageIndex = 0;
    let pass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]> | null = beginStagePass(stages[stageIndex]);
    let activeObjects = objects;
    let activeEffectScope: { key: string; layerId?: string; plan: EffectPassPlan } | null = null;
    type LayerSurface = { content: WebGPUTextureLike; mask?: WebGPUTextureLike };
    type LayerScope = {
      key: string;
      layerId?: string;
      surface: LayerSurface;
      parentTarget: WebGPUTextureLike | null;
      target: "content" | "mask";
      mode?: "clip" | "alpha" | "inverse-alpha" | "luma";
      sourceKey?: string;
      compositeAlpha: number;
    };
    const isLayerMaskMode = (mode: string): mode is NonNullable<LayerScope["mode"]> =>
      mode === "clip" || mode === "alpha" || mode === "inverse-alpha" || mode === "luma";
    const layerScopes: LayerScope[] = [];
    const sourceColorAdjust = () =>
      activeEffectScope?.plan.requiresOffscreen
        ? undefined
        : activeEffectScope?.plan.sourceColorAdjust;
    const closePass = () => {
      pass?.end();
      pass = null;
    };
    const ensureStagePass = () => {
      if (pass) return;
      stageIndex = stageIndex === 0 ? 1 : 0;
      pass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
      activeObjects = objects;
    };
    const ensureClipMaskPass = (sourceKey: string) => {
      const scope = layerScopes.at(-1);
      if (!scope) return null;
      const target = scope.sourceKey === sourceKey && scope.surface.mask ? "mask" : "content";
      if (scope.target === target && pass) return target === "mask" ? scope.mode ?? null : null;
      closePass();
      const targetTexture = target === "mask" ? scope.surface.mask! : scope.surface.content;
      pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: targetTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: target === "mask" ? "clear" : "load",
          storeOp: "store",
        }],
      });
      scope.target = target;
      activeObjects = singleSampleObjects;
      return target === "mask" ? scope.mode ?? null : null;
    };
    const objectsForTransform = (nextTransform: Extract<PaintCommand, { op: "setTransform" }>) => {
      const mode = nextTransform.blendMode ?? "normal";
      const table = activeObjects === singleSampleObjects
        ? singleSampleBlendObjects
        : blendObjects;
      return table.get(mode) ?? table.get("normal")!;
    };
    let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
    const firstCommand = buffer.commands[0];
    if (!firstCommand || firstCommand.op !== "beginFrame") {
      throw new Error("Preview renderer requires beginFrame as the first command");
    }
    let projection = worldToClipMatrixForPaint(firstCommand);
    let drawCalls = 0;
    let skippedCommands = 0;
    const transientLayerTextures: WebGPUTextureLike[] = [];
    for (const command of buffer.commands) {
      if (command.op === "beginFrame") {
        projection = worldToClipMatrixForPaint(command);
      } else if (command.op === "setTransform") {
        transform = command;
      } else if (command.op === "drawSolid" || command.op === "drawShape") {
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0) {
          skippedCommands += 1;
          continue;
        }
        if (command.op === "drawShape" && command.shape === "polygon") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "info", code: "preview_op_pending", message: "polygon shape is pending in the native preview backend", key: command.key, layerId: command.layerId });
          continue;
        }
        const maskMode = ensureClipMaskPass(command.key);
        const isMaskSource = maskMode !== null;
        const isClipMaskSource = maskMode === "clip";
        const drawObjects = isMaskSource ? singleSampleObjects : objectsForTransform(transform);
        const color = isClipMaskSource ? [1, 1, 1, transform.alpha] : cssColorToRgba(command.fill);
        if (!isClipMaskSource) color[3] *= transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1);
        const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(UNIFORM_FLOATS);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, 0, 0, command.width, command.height));
        data.set(color, 32);
        data[36] = command.op === "drawShape"
          ? command.shape === "ellipse" ? 1 : command.cornerRadius && command.cornerRadius > 0 ? 2 : 0
          : 0;
        data[37] = 0;
        const stroke = !isClipMaskSource && command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? cssColorToRgba(command.stroke)
          : [0, 0, 0, 0];
        if (!isClipMaskSource) stroke[3] *= transform.alpha * (command.op === "drawShape" ? command.strokeOpacity ?? 1 : 1);
        const strokeWidth = !isClipMaskSource && command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
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
        const gradients = isClipMaskSource ? gradientUniforms(undefined, 1) : gradientUniforms(
          command.op === "drawShape" ? command.fillPaint : undefined,
          transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1),
        );
        data.set(gradients.start, 48);
        data.set(gradients.end, 52);
        data.set(gradients.params, 56);
        data.set(gradients.radius, 60);
        data.set(colorAdjustUniforms(isMaskSource ? undefined : sourceColorAdjust()), 64);
        device.queue.writeBuffer(uniform, 0, data);
        const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: whiteTexture.createView() }, { binding: 2, resource: drawObjects.sampler }] });
        pass!.setPipeline(drawObjects.pipeline);
        pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
        pass!.setBindGroup(0, bindGroup);
        pass!.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawPath") {
        const maskMode = ensureClipMaskPass(command.key);
        if (maskMode === "clip") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "error", code: "preview_clip_mask_source_invalid", message: "Clip-mask sources must render as a rectangle or ellipse shape", key: command.key, layerId: command.layerId });
          continue;
        }
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0) {
          skippedCommands += 1;
          continue;
        }
        const meshes = [
          command.fill && command.mesh
            ? { mesh: command.mesh, color: cssColorToRgba(command.fill), opacity: command.fillOpacity ?? 1 }
            : null,
          command.stroke && command.strokeMesh
            ? { mesh: command.strokeMesh, color: cssColorToRgba(command.stroke), opacity: command.strokeOpacity ?? 1 }
            : null,
        ].filter((entry) => entry !== null).map((entry) => entry!);
        if (meshes.length === 0) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_path_mesh_missing", message: "drawPath requires a Runtime-resolved fill or stroke mesh", key: command.key, layerId: command.layerId });
          continue;
        }
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        for (const pathDraw of meshes) {
          const vertexData = new Float32Array(pathDraw.mesh.vertices.length * 2);
          for (let index = 0; index < pathDraw.mesh.vertices.length / 2; index += 1) {
            vertexData[index * 4] = pathDraw.mesh.vertices[index * 2]!;
            vertexData[index * 4 + 1] = pathDraw.mesh.vertices[index * 2 + 1]!;
          }
          const vertexBuffer = device.createBuffer({ size: vertexData.byteLength, usage: BUFFER_VERTEX | BUFFER_COPY_DST });
          const indexData = new Uint32Array(pathDraw.mesh.indices);
          const indexBuffer = device.createBuffer({ size: indexData.byteLength, usage: BUFFER_INDEX | BUFFER_COPY_DST });
          transientBuffers.add(vertexBuffer);
          transientBuffers.add(indexBuffer);
          device.queue.writeBuffer(vertexBuffer, 0, vertexData);
          device.queue.writeBuffer(indexBuffer, 0, indexData);
          const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          const data = new Float32Array(UNIFORM_FLOATS);
          pathDraw.color[3] *= transform.alpha * pathDraw.opacity;
          writeMatrix4(data, 0, projection);
          writeMatrix4(data, 16, packMatrix4F32(transform.matrix4));
          data.set(pathDraw.color, 32);
          data.set([0, 0, 0, 0], 36);
          data.set([0, 0, 0, 0], 40);
          data.set([0, 0, 0, 0], 44);
          data.set([0, 0, 0, 0], 48);
          data.set([0, 0, 0, 0], 52);
          data.set([0, 0, 0, 0], 56);
          data.set([0, 0, 0, 0], 60);
          data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 64);
          device.queue.writeBuffer(uniform, 0, data);
          const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: whiteTexture.createView() }, { binding: 2, resource: drawObjects.sampler }] });
          pass!.setPipeline(drawObjects.pathPipeline);
          pass!.setVertexBuffer(0, vertexBuffer);
          pass!.setIndexBuffer(indexBuffer, "uint32");
          pass!.setBindGroup(0, bindGroup);
          pass!.drawIndexed(indexData.length);
          drawCalls += 1;
        }
      } else if (command.op === "drawImage" || command.op === "drawVideo") {
        const maskMode = ensureClipMaskPass(command.key);
        if (maskMode === "clip") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "error", code: "preview_clip_mask_source_invalid", message: "Clip-mask sources must render as a rectangle or ellipse shape", key: command.key, layerId: command.layerId });
          continue;
        }
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
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
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(UNIFORM_FLOATS);
        const layout = mediaLayout(command.width, command.height, asset.width, asset.height, command.fit, command.op === "drawImage" ? command.crop : undefined);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, layout.x, layout.y, layout.width, layout.height));
        data.set([1, 1, 1, transform.alpha], 32);
        data[36] = 0;
        data[37] = 1;
        data[38] = 0;
        data[39] = 0;
        data.set([layout.uv.x, layout.uv.y, layout.uv.width, layout.uv.height], 40);
        data.set([0, 0, 0, 0], 44);
        data.set([0, 0, 0, 0], 48);
        data.set([0, 0, 0, 0], 52);
        data.set([0, 0, 0, 0], 56);
        data.set([0, 0, 0, 0], 60);
        data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 64);
        device.queue.writeBuffer(uniform, 0, data);
        const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: image.createView() }, { binding: 2, resource: drawObjects.sampler }] });
        pass!.setPipeline(drawObjects.pipeline);
        pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
        pass!.setBindGroup(0, bindGroup);
        pass!.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawText") {
        const maskMode = ensureClipMaskPass(command.key);
        if (maskMode === "clip") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "error", code: "preview_clip_mask_source_invalid", message: "Clip-mask sources must render as a rectangle or ellipse shape", key: command.key, layerId: command.layerId });
          continue;
        }
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0 || !command.glyphs?.length) {
          skippedCommands += 1;
          if (!command.glyphs?.length) pushDiagnostic({ severity: "warning", code: "preview_text_layout_missing", message: "drawText requires Runtime-resolved glyph outlines", key: command.key, layerId: command.layerId });
          continue;
        }
        const atlas = textAtlases.get(command.key) ?? createTextAtlas(command);
        if (!atlas) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_text_atlas_failed", message: "Unable to build the text glyph atlas", key: command.key, layerId: command.layerId });
          continue;
        }
        textAtlases.set(command.key, atlas);
        const image = textures.get(atlas.id) ?? textureFor(atlas.id, atlas.asset);
        if (!image) {
          skippedCommands += 1;
          continue;
        }
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha;
        const baseMatrix = packMatrix4F32(transform.matrix4);
        for (const glyph of atlas.glyphs) {
          const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          const data = new Float32Array(UNIFORM_FLOATS);
          writeMatrix4(data, 0, projection);
          writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, glyph.x, glyph.y, glyph.width, glyph.height));
          data.set(color, 32);
          data.set([0, 2, 0, 0], 36);
          data.set([glyph.uv.x, glyph.uv.y, glyph.uv.width, glyph.uv.height], 40);
          data.set([0, 0, 0, 0], 44);
          data.set([0, 0, 0, 0], 48);
          data.set([0, 0, 0, 0], 52);
          data.set([0, 0, 0, 0], 56);
          data.set([0, 0, 0, 0], 60);
          data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 64);
          device.queue.writeBuffer(uniform, 0, data);
          const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: image.createView() }, { binding: 2, resource: drawObjects.sampler }] });
          pass!.setPipeline(drawObjects.pipeline);
          pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
          pass!.setBindGroup(0, bindGroup);
          pass!.draw(4);
          drawCalls += 1;
        }
      } else if (command.op === "unsupported") {
        skippedCommands += 1;
        pushDiagnostic({ severity: "error", code: "preview_unsupported_command", message: command.message, key: command.key, layerId: command.layerId });
      } else if (command.op === "beginLayer" && command.effectProgram) {
        if (activeEffectScope) {
          pushDiagnostic({ severity: "error", code: "preview_nested_effect_scope_unsupported", message: "Nested effect scopes are not implemented yet", key: command.key, layerId: command.layerId });
          continue;
        }
        const plan = buildEffectPassPlan(command.effectProgram);
        for (const diagnostic of plan.diagnostics) {
          pushDiagnostic({ severity: "error", code: diagnostic.code, message: diagnostic.message, key: command.key, layerId: command.layerId });
        }
        activeEffectScope = { key: command.key, layerId: command.layerId, plan };
        if (!plan.requiresOffscreen || !plan.supported) continue;
        ensureEffectTargets(physicalWidth, physicalHeight);
        closePass();
        pass = encoder.beginRenderPass({
          colorAttachments: [{ view: effectSourceTexture!.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
        });
        activeObjects = singleSampleObjects;
      } else if (command.op === "endLayer" && activeEffectScope) {
        const scope = activeEffectScope;
        if (!scope || scope.key !== command.key) {
          pushDiagnostic({ severity: "error", code: "preview_effect_scope_invalid", message: "endLayer has no matching effect scope", key: command.key });
          continue;
        }
        if (!scope.plan.requiresOffscreen || !scope.plan.supported) {
          activeEffectScope = null;
          continue;
        }
        if ((!scope.plan.shadow && !scope.plan.outerGlow && !scope.plan.innerGlow && scope.plan.blurs.length === 0 && scope.plan.sourceNoise.length === 0 && scope.plan.outputNoise.length === 0) || !effectSourceTexture) {
          pushDiagnostic({ severity: "error", code: "preview_offscreen_scope_invalid", message: "Offscreen effect scope has no supported blur surface", key: command.key, layerId: scope.layerId });
          activeEffectScope = null;
          continue;
        }
        closePass();
        const runEffectPost = (
          source: WebGPUTextureLike,
          targetTexture: WebGPUTextureLike,
          params: readonly [number, number, number, number],
          adjustments: EffectPassPlan["sourceColorAdjust"] | undefined = undefined,
          shadow?: { color: readonly [number, number, number, number]; offsetX: number; offsetY: number },
          noiseEffect?: { scale: number; amount: number; opacity: number; seed: number },
        ) => {
          const effectPass = encoder.beginRenderPass({
            colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(effectPass, source, params, effectPostObjects, adjustments, shadow, noiseEffect);
          effectPass.end();
          drawCalls += 1;
        };
        const runInnerGlowPost = (
          source: WebGPUTextureLike,
          blurred: WebGPUTextureLike,
          targetTexture: WebGPUTextureLike,
          tint: readonly [number, number, number, number],
        ) => {
          const uniform = device.createBuffer({ size: 16, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          device.queue.writeBuffer(uniform, 0, new Float32Array(tint));
          const effectPass = encoder.beginRenderPass({
            colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          const bindGroup = device.createBindGroup({
            layout: innerGlowPostObjects.layout,
            entries: [
              { binding: 0, resource: { buffer: uniform } },
              { binding: 1, resource: source.createView() },
              { binding: 2, resource: blurred.createView() },
              { binding: 3, resource: objects.sampler },
            ],
          });
          effectPass.setPipeline(innerGlowPostObjects.pipeline);
          effectPass.setVertexBuffer(0, objects.vertexBuffer);
          effectPass.setBindGroup(0, bindGroup);
          effectPass.draw(4);
          effectPass.end();
          drawCalls += 1;
        };

        const root = effectLevels[0]!;
        const alphaBranch = scope.plan.shadow ?? scope.plan.outerGlow;
        const innerGlow = scope.plan.innerGlow;
        const blurs = alphaBranch ? [alphaBranch.blur] : innerGlow ? [innerGlow.blur] : scope.plan.blurs;
        // Convert the isolated premultiplied sRGB source once. Pyramid and
        // Gaussian passes stay linear and premultiplied until composition.
        runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1], scope.plan.sourceColorAdjust, undefined, scope.plan.sourceNoise[0]);
        let activeTexture = root.a;
        for (const blur of blurs) {
          const sigma = Math.min(blur.radius * dpr, 256);
          const blurPlan = blurPyramidPlan(sigma, physicalWidth, physicalHeight);
          for (let levelIndex = 1; levelIndex <= blurPlan.levels; levelIndex += 1) {
            const level = effectLevels[levelIndex]!;
            runEffectPost(activeTexture, level.a, [0, 0, 0, 0]);
            activeTexture = level.a;
          }

          const blurLevel = effectLevels[blurPlan.levels]!;
          const horizontalTexture = activeTexture === blurLevel.a ? blurLevel.b : blurLevel.a;
          runEffectPost(activeTexture, horizontalTexture, [1 / blurLevel.width, 0, blurPlan.levelSigma, 0]);
          const verticalTexture = activeTexture;
          runEffectPost(horizontalTexture, verticalTexture, [0, 1 / blurLevel.height, blurPlan.levelSigma, 0]);
          activeTexture = verticalTexture;

          for (let levelIndex = blurPlan.levels - 1; levelIndex >= 0; levelIndex -= 1) {
            const level = effectLevels[levelIndex]!;
            runEffectPost(activeTexture, level.a, [0, 0, 0, 0]);
            activeTexture = level.a;
          }
        }

        if (alphaBranch) {
          const branchColor = cssColorToRgba(alphaBranch.tint.color);
          branchColor[3] *= alphaBranch.tint.opacity;
          runEffectPost(
            activeTexture,
            root.b,
            [0, 0, 0, 2],
            undefined,
            {
              color: branchColor,
              offsetX: scope.plan.shadow ? (scope.plan.shadow.offset.x * dpr) / physicalWidth : 0,
              offsetY: scope.plan.shadow ? (scope.plan.shadow.offset.y * dpr) / physicalHeight : 0,
            },
          );
          stageIndex = stageIndex === 0 ? 1 : 0;
          let previousStage = stages[stageIndex === 0 ? 1 : 0];
          let compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.b, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;

          runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1]);
          stageIndex = stageIndex === 0 ? 1 : 0;
          previousStage = stages[stageIndex === 0 ? 1 : 0];
          compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        } else if (innerGlow) {
          const tint = cssColorToRgba(innerGlow.tint.color);
          tint[3] *= innerGlow.tint.opacity;
          runInnerGlowPost(effectSourceTexture, activeTexture, root.b, tint);

          runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1]);

          stageIndex = stageIndex === 0 ? 1 : 0;
          let previousStage = stages[stageIndex === 0 ? 1 : 0];
          let compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;

          stageIndex = stageIndex === 0 ? 1 : 0;
          previousStage = stages[stageIndex === 0 ? 1 : 0];
          compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.b, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        } else if (scope.plan.outputColorAdjust.length) {
          const adjustedTexture = activeTexture === root.a ? root.b : root.a;
          runEffectPost(activeTexture, adjustedTexture, [0, 0, 0, 0], scope.plan.outputColorAdjust, undefined, scope.plan.outputNoise[0]);
          activeTexture = adjustedTexture;
        } else if (scope.plan.outputNoise.length) {
          const adjustedTexture = activeTexture === root.a ? root.b : root.a;
          runEffectPost(activeTexture, adjustedTexture, [0, 0, 0, 0], undefined, undefined, scope.plan.outputNoise[0]);
          activeTexture = adjustedTexture;
        }

        if (!alphaBranch && !innerGlow) {
          stageIndex = stageIndex === 0 ? 1 : 0;
          const previousStage = stages[stageIndex === 0 ? 1 : 0];
          const compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, activeTexture, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        }
        activeEffectScope = null;
        activeObjects = objects;
      } else if (command.op === "beginLayer" && command.isolation && command.offscreen && command.compositeAlpha !== undefined && (!command.mask || isLayerMaskMode(command.mask.mode))) {
        if (activeEffectScope) {
          pushDiagnostic({ severity: "error", code: "preview_nested_layer_unsupported", message: "Nested effect scopes are not supported by the layer surface path", key: command.key, layerId: command.layerId });
          continue;
        }
        ensureEffectTargets(physicalWidth, physicalHeight);
        if (!createLayerTexture) {
          pushDiagnostic({ severity: "error", code: "preview_layer_surface_unavailable", message: "Layer surface factory is unavailable", key: command.key, layerId: command.layerId });
          continue;
        }
        const parent = layerScopes.at(-1);
        const parentTarget = parent
          ? parent.target === "mask" ? parent.surface.mask! : parent.surface.content
          : null;
        const surface: LayerSurface = {
          content: createLayerTexture(physicalWidth, physicalHeight),
          ...(command.mask ? { mask: createLayerTexture(physicalWidth, physicalHeight) } : {}),
        };
        closePass();
        pass = encoder.beginRenderPass({
          colorAttachments: [{ view: surface.content.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
        });
        activeObjects = singleSampleObjects;
        layerScopes.push({
          key: command.key,
          layerId: command.layerId,
          surface,
          parentTarget,
          target: "content",
          mode: command.mask && isLayerMaskMode(command.mask.mode) ? command.mask.mode : undefined,
          sourceKey: command.mask?.sourceKey,
          compositeAlpha: command.compositeAlpha,
        });
      } else if (command.op === "endLayer") {
        const scope = layerScopes.at(-1);
        if (!scope || scope.key !== command.key || !effectLevels[0]) {
          if (scope) {
            pushDiagnostic({ severity: "error", code: "preview_layer_scope_invalid", message: "endLayer has no matching layer scope", key: command.key });
          }
          continue;
        }
        layerScopes.pop();
        closePass();
        const root = effectLevels[0]!;
        const beginTargetPass = (targetTexture: WebGPUTextureLike) => encoder.beginRenderPass({
          colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "load", storeOp: "store" }],
        });
        if (scope.surface.mask && scope.mode && scope.sourceKey) {
          const decodePass = encoder.beginRenderPass({
            colorAttachments: [{ view: root.b.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(decodePass, scope.surface.content, [0, 0, 0, -1], effectPostObjects);
          decodePass.end();
          drawCalls += 1;
          if (scope.parentTarget) {
            const compositePass = beginTargetPass(scope.parentTarget);
            postClipMask(compositePass, root.b, scope.surface.mask, scope.compositeAlpha, scope.mode, clipMaskPostEffectObjects);
            compositePass.end();
          } else {
            stageIndex = stageIndex === 0 ? 1 : 0;
            const compositePass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
            postClipMask(compositePass, root.b, scope.surface.mask, scope.compositeAlpha, scope.mode);
            compositePass.end();
          }
          drawCalls += 1;
        } else {
          const decodePass = encoder.beginRenderPass({
            colorAttachments: [{ view: root.a.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(decodePass, scope.surface.content, [0, 0, 0, -1], effectPostObjects);
          decodePass.end();
          drawCalls += 1;
          if (scope.parentTarget) {
            const compositePass = beginTargetPass(scope.parentTarget);
            post(compositePass, root.a, [0, 0, 0, 1], effectPostPremultipliedObjects, undefined, { color: [0, 0, 0, 0], offsetX: 0, offsetY: 0, compositeAlpha: scope.compositeAlpha });
            compositePass.end();
          } else {
            stageIndex = stageIndex === 0 ? 1 : 0;
            const compositePass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
            post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects, undefined, { color: [0, 0, 0, 0], offsetX: 0, offsetY: 0, compositeAlpha: scope.compositeAlpha });
            compositePass.end();
          }
          drawCalls += 1;
        }
        transientLayerTextures.push(scope.surface.content);
        if (scope.surface.mask) transientLayerTextures.push(scope.surface.mask);
        activeObjects = layerScopes.length === 0 ? objects : singleSampleObjects;
      } else if (command.op === "beginLayer" && (command.isolation || command.mask)) {
        pushDiagnostic({ severity: "info", code: "preview_compositing_pending", message: "Isolation and mask scopes are pending in the native preview backend", key: command.key, layerId: command.layerId });
      }
    }
    if (activeEffectScope) {
      pushDiagnostic({ severity: "error", code: "preview_effect_scope_unclosed", message: "Effect scope was not closed", key: activeEffectScope.key, layerId: activeEffectScope.layerId });
    }
    if (layerScopes.length > 0) {
      for (const scope of layerScopes) {
        pushDiagnostic({ severity: "error", code: "preview_layer_scope_unclosed", message: "Layer scope was not closed", key: scope.key, layerId: scope.layerId });
      }
    }
    closePass();
    const presentPass = encoder.beginRenderPass({
      colorAttachments: [{ view: target, clearValue: { r: background[0], g: background[1], b: background[2], a: background[3] }, loadOp: "clear", storeOp: "store" }],
    });
    post(presentPass, stages[stageIndex]);
    presentPass.end();
    device.queue.submit([encoder.finish()]);
    const submittedLayerTextures = [...transientLayerTextures];
    const submittedBuffers = [...transientBuffers];
    transientBuffers.clear();
    if (device.queue.onSubmittedWorkDone) {
      void device.queue.onSubmittedWorkDone().then(() => {
        for (const texture of submittedLayerTextures) texture.destroy?.();
        for (const buffer of submittedBuffers) buffer.destroy?.();
      });
    } else {
      for (const texture of submittedLayerTextures) texture.destroy?.();
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
      disposeRenderTargets();
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
      singleSampleObjects.vertexBuffer.destroy?.();
      whiteTexture.destroy?.();
      msaaTexture?.destroy?.();
      msaaTexture = null;
      disposeRenderTargets();
      for (const buffer of transientBuffers) buffer.destroy?.();
      transientBuffers.clear();
      for (const texture of textures.values()) texture.destroy?.();
      textures.clear();
      textAtlases.clear();
    },
  };
}
