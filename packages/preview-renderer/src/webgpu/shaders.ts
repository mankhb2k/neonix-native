export const SHADER = `
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

export const POST_SHADER = `
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

export const CLIP_MASK_POST_SHADER = `
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

export const INNER_GLOW_POST_SHADER = `
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
