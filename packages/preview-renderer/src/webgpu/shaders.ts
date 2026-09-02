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
  gradientStops: array<vec4<f32>, 8>,
  gradientOffsets: array<vec4<f32>, 2>,
  gradientMeta: vec4<f32>,
  patternGeometry: array<vec4<f32>, 8>,
  patternColors: array<vec4<f32>, 8>,
  patternMeta: vec4<f32>,
  patternTransform: array<vec4<f32>, 2>,
  colorAdjustMeta: vec4<f32>,
  colorAdjust0: vec4<f32>,
  colorAdjust1: vec4<f32>,
  colorAdjust2: vec4<f32>,
  colorAdjust3: vec4<f32>,
  colorAdjustSpace: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var imageTexture: texture_2d<f32>;
@group(0) @binding(2) var imageSampler: sampler;
@group(0) @binding(3) var gradientLutTexture: texture_2d<f32>;
@group(0) @binding(4) var gradientLutSampler: sampler;
struct VertexInput { @location(0) position: vec2<f32>, @location(1) uv: vec2<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
fn roundedBoxDistance(point: vec2<f32>, halfSize: vec2<f32>, radius: f32) -> f32 {
  let q = abs(point) - (halfSize - vec2<f32>(radius, radius));
  return length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - radius;
}
fn srgbToLinear(color: vec3<f32>) -> vec3<f32> {
  let low = color / vec3<f32>(12.92);
  let high = pow((color + vec3<f32>(0.055)) / vec3<f32>(1.055), vec3<f32>(2.4));
  return select(low, high, color >= vec3<f32>(0.04045));
}
fn linearToSrgb(color: vec3<f32>) -> vec3<f32> {
  let positive = max(color, vec3<f32>(0.0));
  let low = positive * vec3<f32>(12.92);
  let high = vec3<f32>(1.055) * pow(positive, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(low, high, positive >= vec3<f32>(0.0031308));
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
fn applyColorAdjust(source: vec4<f32>, effect: vec4<f32>, colorSpace: f32) -> vec4<f32> {
  var color = select(source.rgb, srgbToLinear(source.rgb), colorSpace > 0.5);
  color = clamp(color + vec3<f32>(effect.x), vec3<f32>(0.0), vec3<f32>(1.0));
  color = clamp((color - vec3<f32>(0.5)) * effect.y + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0));
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = mix(vec3<f32>(luma), color, effect.z);
  color = applyHueRotate(color, effect.w);
  color = select(color, linearToSrgb(color), colorSpace > 0.5);
  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), source.a);
}
fn gradientOffset(index: u32) -> f32 {
  if (index < 4u) { return uniforms.gradientOffsets[0][index]; }
  return uniforms.gradientOffsets[1][index - 4u];
}
fn sampleGradient(t: f32) -> vec4<f32> {
  var clamped = clamp(t, 0.0, 1.0);
  if (uniforms.gradientMeta.y > 1.5) { clamped = fract(t); }
  else if (uniforms.gradientMeta.y > 0.5) {
    let reflected = fract(t * 0.5) * 2.0;
    clamped = select(reflected, 2.0 - reflected, reflected > 1.0);
  }
  if (uniforms.gradientMeta.w > 0.5) { return textureSample(gradientLutTexture, gradientLutSampler, vec2<f32>(clamped, 0.5)); }
  let count = u32(uniforms.gradientMeta.x);
  var result = uniforms.gradientStops[0];
  if (count <= 1u) { return result; }
  for (var i = 0u; i < 7u; i = i + 1u) {
    if (i + 1u >= count) { break; }
    let a = gradientOffset(i);
    let b = gradientOffset(i + 1u);
    if (clamped <= b || i + 2u >= count) {
      result = mix(uniforms.gradientStops[i], uniforms.gradientStops[i + 1u], clamp((clamped - a) / max(b - a, 0.0001), 0.0, 1.0));
      break;
    }
  }
  return result;
}
fn patternPoint(point: vec2<f32>) -> vec2<f32> {
  let transform = uniforms.patternTransform[0];
  let translation = uniforms.patternTransform[1].xy;
  let determinant = transform.x * transform.w - transform.y * transform.z;
  if (abs(determinant) < 0.00001) { return point; }
  let shifted = point - translation;
  return vec2<f32>((transform.w * shifted.x - transform.z * shifted.y) / determinant, (-transform.y * shifted.x + transform.x * shifted.y) / determinant);
}
fn positiveModulo(value: f32, size: f32) -> f32 { return value - floor(value / size) * size; }
fn samplePattern(point: vec2<f32>) -> vec4<f32> {
  let tileOrigin = uniforms.gradientRadius.xy;
  var tileSize = uniforms.gradientRadius.zw;
  if (uniforms.patternMeta.y < 0.5) { tileSize = tileSize * uniforms.geometry.yz; }
  tileSize = max(tileSize, vec2<f32>(0.0001, 0.0001));
  let local = patternPoint(point);
  let tilePoint = vec2<f32>(positiveModulo(local.x - tileOrigin.x, tileSize.x), positiveModulo(local.y - tileOrigin.y, tileSize.y));
  var result = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  let count = u32(uniforms.patternMeta.x);
  for (var i = 0u; i < 8u; i = i + 1u) {
    if (i >= count) { break; }
    let geometry = uniforms.patternGeometry[i];
    var hit = false;
    if (geometry.w < -0.5) {
      let center = select(geometry.xy, geometry.xy * tileSize, uniforms.patternMeta.z > 0.5);
      let radius = select(geometry.z, geometry.z * min(tileSize.x, tileSize.y), uniforms.patternMeta.z > 0.5);
      hit = distance(tilePoint, center) <= radius;
    } else {
      let origin = select(geometry.xy, geometry.xy * tileSize, uniforms.patternMeta.z > 0.5);
      let size = select(geometry.zw, geometry.zw * tileSize, uniforms.patternMeta.z > 0.5);
      hit = tilePoint.x >= origin.x && tilePoint.y >= origin.y && tilePoint.x <= origin.x + size.x && tilePoint.y <= origin.y + size.y;
    }
    if (hit) { result = uniforms.patternColors[i]; }
  }
  return result;
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
  if (uniforms.params.y > 1.5 && uniforms.params.y < 2.5) {
    source = vec4<f32>(uniforms.color.rgb, uniforms.color.a * sampled.a);
  }
  if (uniforms.params.y <= 0.5 && uniforms.gradientParams.x > 0.5) {
    var gradientT = 0.0;
    if (uniforms.gradientParams.x < 1.5) {
      let point = patternPoint(input.uv * uniforms.geometry.yz);
      var gradientStart = uniforms.gradientStart.xy;
      var gradientEnd = uniforms.gradientEnd.xy;
      if (uniforms.gradientMeta.z < 0.5) { gradientStart = gradientStart * uniforms.geometry.yz; gradientEnd = gradientEnd * uniforms.geometry.yz; }
      let direction = gradientEnd - gradientStart;
      gradientT = dot(point - gradientStart, direction) / max(dot(direction, direction), 0.0001);
    } else if (uniforms.gradientParams.x < 2.5) {
      let point = patternPoint(input.uv * uniforms.geometry.yz);
      var center = uniforms.gradientStart.xy;
      var focus = uniforms.gradientStart.zw;
      var radialRadii = uniforms.gradientRadius.xy;
      if (uniforms.gradientMeta.z < 0.5) {
        center = center * uniforms.geometry.yz;
        focus = focus * uniforms.geometry.yz;
        radialRadii = radialRadii * uniforms.geometry.yz;
      }
      gradientT = distance((point - focus) / max(radialRadii, vec2<f32>(0.0001, 0.0001)), vec2<f32>(0.0, 0.0)) + uniforms.gradientRadius.z;
    } else {
      var point = patternPoint(input.uv * uniforms.geometry.yz);
      var center = uniforms.gradientStart.xy;
      if (uniforms.gradientMeta.z < 0.5) { center = center * uniforms.geometry.yz; }
      point = point - center;
      gradientT = fract(atan2(point.y, point.x) / (2.0 * 3.14159265359) - uniforms.gradientParams.y / (2.0 * 3.14159265359));
    }
    source = sampleGradient(gradientT);
  }
  if (uniforms.params.y <= 0.5 && uniforms.gradientParams.x > 3.5) {
    source = samplePattern(input.uv * uniforms.geometry.yz);
  }
  if (uniforms.params.y <= 0.5 && uniforms.params.z > 0.0 && uniforms.params.w > 0.0) {
    // Keep the complete stroke inside the layer frame. This avoids clipping
    // half of a thin stroke at the rotated quad boundary.
    var strokeMix = 0.0;
    if (uniforms.params.x > 0.5 && uniforms.params.x < 1.5) {
      let p = input.uv * 2.0 - vec2<f32>(1.0, 1.0);
      let innerRadii = max(vec2<f32>(0.0001, 0.0001), vec2<f32>(1.0, 1.0) - 2.0 * uniforms.params.zw);
      let innerDistance = length(p / innerRadii);
      let edgeWidth = max(fwidth(innerDistance), 0.0001);
      let innerCoverage = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, innerDistance);
      strokeMix = innerCoverage;
    } else if (uniforms.geometry.x > 0.0) {
      let halfSize = uniforms.geometry.yz * 0.5;
      let point = (input.uv - vec2<f32>(0.5, 0.5)) * uniforms.geometry.yz;
      let strokeWidth = max(uniforms.params.z * uniforms.geometry.y, uniforms.params.w * uniforms.geometry.z);
      let innerDistance = roundedBoxDistance(
        point,
        max(halfSize - vec2<f32>(strokeWidth, strokeWidth), vec2<f32>(0.0001, 0.0001)),
        max(uniforms.geometry.x - strokeWidth, 0.0),
      );
      let edgeWidth = max(fwidth(innerDistance), 0.0001);
      strokeMix = smoothstep(-edgeWidth, edgeWidth, innerDistance);
    } else {
      let edge = min(input.uv, vec2<f32>(1.0, 1.0) - input.uv);
      let distanceToInnerEdge = min(edge.x - uniforms.params.z, edge.y - uniforms.params.w);
      let edgeWidth = max(fwidth(distanceToInnerEdge), 0.0001);
      strokeMix = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToInnerEdge);
    }
    source = mix(source, uniforms.media, clamp(strokeMix, 0.0, 1.0));
  }
  if (uniforms.colorAdjustMeta.x > 0.5) { source = applyColorAdjust(source, uniforms.colorAdjust0, uniforms.colorAdjustSpace.x); }
  if (uniforms.colorAdjustMeta.x > 1.5) { source = applyColorAdjust(source, uniforms.colorAdjust1, uniforms.colorAdjustSpace.y); }
  if (uniforms.colorAdjustMeta.x > 2.5) { source = applyColorAdjust(source, uniforms.colorAdjust2, uniforms.colorAdjustSpace.z); }
  if (uniforms.colorAdjustMeta.x > 3.5) { source = applyColorAdjust(source, uniforms.colorAdjust3, uniforms.colorAdjustSpace.w); }
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
  colorAdjustSpace: vec4<f32>,
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
  if (uniforms.colorAdjustMeta.x > 0.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust0, uniforms.colorAdjustSpace.x); }
  if (uniforms.colorAdjustMeta.x > 1.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust1, uniforms.colorAdjustSpace.y); }
  if (uniforms.colorAdjustMeta.x > 2.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust2, uniforms.colorAdjustSpace.z); }
  if (uniforms.colorAdjustMeta.x > 3.5) { color = applyPostColorAdjust(color, uniforms.colorAdjust3, uniforms.colorAdjustSpace.w); }
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
fn applyPostColorAdjust(source: vec4<f32>, effect: vec4<f32>, colorSpace: f32) -> vec4<f32> {
  if (source.a <= 0.000001) { return vec4<f32>(0.0); }
  var color = source.rgb / source.a;
  color = select(linearToSrgb(color), color, colorSpace > 0.5);
  color = clamp(color + vec3<f32>(effect.x), vec3<f32>(0.0), vec3<f32>(1.0));
  color = clamp((color - vec3<f32>(0.5)) * effect.y + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0));
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = mix(vec3<f32>(luma), color, effect.z);
  color = applyPostHueRotate(color, effect.w);
  color = select(srgbToLinear(color), color, colorSpace > 0.5);
  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)) * source.a, source.a);
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

/** Full SVG/CSS blend-mode compositor. Inputs and output are premultiplied. */
export const BLEND_POST_SHADER = `
struct BlendUniforms {
  compositeAlpha: f32,
  blendMode: f32,
  encodeSrgb: f32,
  _padding: f32,
};
@group(0) @binding(0) var<uniform> uniforms: BlendUniforms;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var backdropTexture: texture_2d<f32>;
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
  let low = color / vec3<f32>(12.92);
  let high = pow((color + vec3<f32>(0.055)) / vec3<f32>(1.055), vec3<f32>(2.4));
  return select(low, high, color >= vec3<f32>(0.04045));
}
fn linearToSrgb(color: vec3<f32>) -> vec3<f32> {
  let positive = max(color, vec3<f32>(0.0));
  let low = positive * vec3<f32>(12.92);
  let high = vec3<f32>(1.055) * pow(positive, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(low, high, positive >= vec3<f32>(0.0031308));
}
fn luminance(color: vec3<f32>) -> f32 { return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722)); }
fn saturation(color: vec3<f32>) -> f32 { return max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b)); }
fn clipColor(color: vec3<f32>) -> vec3<f32> {
  var result = color;
  let l = luminance(result);
  let n = min(result.r, min(result.g, result.b));
  if (n < 0.0) { result = vec3<f32>(l) + ((result - vec3<f32>(l)) * l) / max(l - n, 0.000001); }
  let x = max(result.r, max(result.g, result.b));
  if (x > 1.0) { result = vec3<f32>(l) + ((result - vec3<f32>(l)) * (1.0 - l)) / max(x - l, 0.000001); }
  return clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
}
fn setLum(color: vec3<f32>, l: f32) -> vec3<f32> { return clipColor(color + vec3<f32>(l - luminance(color))); }
fn setSat(color: vec3<f32>, s: f32) -> vec3<f32> {
  let low = min(color.r, min(color.g, color.b));
  let high = max(color.r, max(color.g, color.b));
  if (high <= low + 0.000001) { return vec3<f32>(0.0); }
  return (color - vec3<f32>(low)) * s / (high - low);
}
fn blendColor(backdrop: vec3<f32>, source: vec3<f32>, mode: f32) -> vec3<f32> {
  if (mode == 0.0) { return source; }
  if (mode == 1.0) { return min(backdrop, source); }
  if (mode == 2.0) { return backdrop * source; }
  if (mode == 3.0) { return select(vec3<f32>(0.0), 1.0 - min(vec3<f32>(1.0), (1.0 - backdrop) / max(source, vec3<f32>(0.000001))), source >= vec3<f32>(0.000001)); }
  if (mode == 4.0) { return max(backdrop, source); }
  if (mode == 5.0) { return backdrop + source - backdrop * source; }
  if (mode == 6.0) { return select(min(vec3<f32>(1.0), backdrop / max(vec3<f32>(1.0) - source, vec3<f32>(0.000001))), vec3<f32>(1.0), source >= vec3<f32>(0.999999)); }
  if (mode == 7.0) { return mix(2.0 * backdrop * source, 1.0 - 2.0 * (1.0 - backdrop) * (1.0 - source), select(vec3<f32>(0.0), vec3<f32>(1.0), backdrop >= vec3<f32>(0.5))); }
  if (mode == 8.0) {
    let low = backdrop - (1.0 - 2.0 * source) * backdrop * (1.0 - backdrop);
    let high = backdrop + (2.0 * source - 1.0) * (sqrt(max(backdrop, vec3<f32>(0.0))) - backdrop);
    let cubic = backdrop + (2.0 * source - 1.0) * (((16.0 * backdrop - 12.0) * backdrop + 4.0) * backdrop);
    return mix(low, mix(cubic, high, select(vec3<f32>(0.0), vec3<f32>(1.0), backdrop >= vec3<f32>(0.25))), select(vec3<f32>(0.0), vec3<f32>(1.0), source >= vec3<f32>(0.5)));
  }
  if (mode == 9.0) { return mix(2.0 * backdrop * source, 1.0 - 2.0 * (1.0 - backdrop) * (1.0 - source), select(vec3<f32>(0.0), vec3<f32>(1.0), source >= vec3<f32>(0.5))); }
  if (mode == 10.0) { return abs(backdrop - source); }
  if (mode == 11.0) { return backdrop + source - 2.0 * backdrop * source; }
  if (mode == 12.0) { return setLum(setSat(source, saturation(backdrop)), luminance(backdrop)); }
  if (mode == 13.0) { return setLum(setSat(backdrop, saturation(source)), luminance(backdrop)); }
  if (mode == 14.0) { return setLum(source, luminance(backdrop)); }
  return setLum(backdrop, luminance(source));
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let sourceSample = textureSample(sourceTexture, imageSampler, input.uv);
  let backdropSample = textureSample(backdropTexture, imageSampler, input.uv);
  let sourceAlpha = clamp(sourceSample.a * uniforms.compositeAlpha, 0.0, 1.0);
  let backdropAlpha = clamp(backdropSample.a, 0.0, 1.0);
  let sourceColor = select(vec3<f32>(0.0), clamp(sourceSample.rgb / sourceSample.a, vec3<f32>(0.0), vec3<f32>(1.0)), sourceSample.a > 0.000001);
  let backdropColor = select(vec3<f32>(0.0), clamp(srgbToLinear(backdropSample.rgb / backdropSample.a), vec3<f32>(0.0), vec3<f32>(1.0)), backdropSample.a > 0.000001);
  let blended = blendColor(backdropColor, sourceColor, uniforms.blendMode);
  let outputAlpha = sourceAlpha + backdropAlpha * (1.0 - sourceAlpha);
  var outputPremultiplied = sourceAlpha * blended + backdropAlpha * (1.0 - sourceAlpha) * backdropColor;
  if (uniforms.encodeSrgb > 0.5 && outputAlpha > 0.000001) { outputPremultiplied = linearToSrgb(outputPremultiplied / outputAlpha) * outputAlpha; }
  return vec4<f32>(max(outputPremultiplied, vec3<f32>(0.0)), outputAlpha);
}`;
