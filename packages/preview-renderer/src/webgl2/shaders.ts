export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat4 u_projection;
uniform mat4 u_model;
out vec2 v_uv;
void main() {
  gl_Position = u_projection * u_model * vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;

export const FRAGMENT_SHADER = `#version 300 es
// Shape distance fields are evaluated in composition pixels. High precision
// keeps a thin rotated stroke stable on large canvases (for example 1920px).
precision highp float;
uniform vec4 u_color;
uniform sampler2D u_texture;
uniform vec4 u_uv_rect;
uniform vec4 u_stroke_color;
uniform vec2 u_stroke_extent;
uniform vec3 u_geometry;
uniform vec4 u_gradient_start;
uniform vec4 u_gradient_end;
uniform vec4 u_gradient_params;
uniform vec4 u_gradient_radius;
uniform vec4 u_gradient_stops[8];
uniform vec4 u_gradient_offsets[2];
uniform vec4 u_gradient_meta;
uniform sampler2D u_gradient_lut;
uniform vec4 u_pattern_geometry[8];
uniform vec4 u_pattern_colors[8];
uniform vec4 u_pattern_meta;
uniform vec4 u_pattern_transform[2];
uniform vec4 u_color_adjust_meta;
uniform vec4 u_color_adjust[4];
uniform vec4 u_color_adjust_space;
uniform int u_mode;
uniform int u_shape;
in vec2 v_uv;
out vec4 outColor;
float roundedBoxDistance(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - (halfSize - vec2(radius));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}
vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + vec3(0.055)) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), color));
}
vec3 linearToSrgb(vec3 color) {
  vec3 low = color * 12.92;
  vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - vec3(0.055);
  return mix(low, high, step(vec3(0.0031308), max(color, vec3(0.0))));
}
vec3 applyHueRotate(vec3 color, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(
    color.r * (0.213 + c * 0.787 - s * 0.213) + color.g * (0.715 - c * 0.715 - s * 0.715) + color.b * (0.072 - c * 0.072 + s * 0.928),
    color.r * (0.213 - c * 0.213 + s * 0.143) + color.g * (0.715 + c * 0.285 + s * 0.140) + color.b * (0.072 - c * 0.072 - s * 0.283),
    color.r * (0.213 - c * 0.213 - s * 0.787) + color.g * (0.715 - c * 0.715 + s * 0.715) + color.b * (0.072 + c * 0.928 + s * 0.072)
  );
}
vec4 applyColorAdjust(vec4 source, vec4 effect, float colorSpace) {
  vec3 color = colorSpace > 0.5 ? srgbToLinear(source.rgb) : source.rgb;
  color = clamp(color + vec3(effect.x), 0.0, 1.0);
  color = clamp((color - vec3(0.5)) * effect.y + vec3(0.5), 0.0, 1.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, effect.z);
  if (colorSpace > 0.5) color = linearToSrgb(applyHueRotate(color, effect.w));
  else color = applyHueRotate(color, effect.w);
  return vec4(clamp(color, 0.0, 1.0), source.a);
}
float gradientOffset(int index) {
  return index < 4 ? u_gradient_offsets[0][index] : u_gradient_offsets[1][index - 4];
}
vec4 sampleGradient(float t) {
  float clamped = clamp(t, 0.0, 1.0);
  if (u_gradient_meta.y > 1.5) clamped = fract(t);
  else if (u_gradient_meta.y > 0.5) {
    float reflected = fract(t * 0.5) * 2.0;
    clamped = reflected > 1.0 ? 2.0 - reflected : reflected;
  }
  if (u_gradient_meta.w > 0.5) return texture(u_gradient_lut, vec2(clamped, 0.5));
  int count = int(u_gradient_meta.x + 0.5);
  vec4 result = u_gradient_stops[0];
  for (int i = 0; i < 7; i++) {
    if (i + 1 >= count) break;
    float a = gradientOffset(i);
    float b = gradientOffset(i + 1);
    if (clamped <= b || i + 2 >= count) {
      result = mix(u_gradient_stops[i], u_gradient_stops[i + 1], clamp((clamped - a) / max(b - a, 0.0001), 0.0, 1.0));
      break;
    }
  }
  return result;
}
vec2 patternPoint(vec2 point) {
  vec2 translation = u_pattern_transform[1].xy;
  mat2 linear = mat2(u_pattern_transform[0].xy, u_pattern_transform[0].zw);
  vec2 shifted = point - translation;
  float determinant = linear[0][0] * linear[1][1] - linear[0][1] * linear[1][0];
  if (abs(determinant) < 0.00001) return point;
  return inverse(linear) * shifted;
}
float positiveModulo(float value, float size) {
  return value - floor(value / size) * size;
}
vec4 samplePattern(vec2 point) {
  vec2 tileOrigin = u_gradient_radius.xy;
  vec2 tileSize = u_gradient_radius.zw;
  if (u_pattern_meta.y < 0.5) tileSize *= u_geometry.yz;
  tileSize = max(tileSize, vec2(0.0001));
  vec2 local = patternPoint(point);
  vec2 tilePoint = vec2(positiveModulo(local.x - tileOrigin.x, tileSize.x), positiveModulo(local.y - tileOrigin.y, tileSize.y));
  vec4 result = vec4(0.0);
  int count = int(u_pattern_meta.x + 0.5);
  for (int i = 0; i < 8; i++) {
    if (i >= count) break;
    vec4 geometry = u_pattern_geometry[i];
    vec2 contentPoint = tilePoint;
    vec4 content = geometry;
    if (u_pattern_meta.z > 0.5) {
      contentPoint /= tileSize;
      content = geometry;
    }
    bool hit = false;
    if (geometry.w < -0.5) {
      vec2 center = u_pattern_meta.z > 0.5 ? geometry.xy * tileSize : geometry.xy;
      float radius = u_pattern_meta.z > 0.5 ? geometry.z * min(tileSize.x, tileSize.y) : geometry.z;
      hit = distance(contentPoint, center) <= radius;
    } else {
      vec2 origin = u_pattern_meta.z > 0.5 ? geometry.xy * tileSize : geometry.xy;
      vec2 size = u_pattern_meta.z > 0.5 ? geometry.zw * tileSize : geometry.zw;
      hit = contentPoint.x >= origin.x && contentPoint.y >= origin.y && contentPoint.x <= origin.x + size.x && contentPoint.y <= origin.y + size.y;
    }
    if (hit) result = u_pattern_colors[i];
  }
  return result;
}
void main() {
  float shapeAlpha = 1.0;
  if (u_shape == 1) {
    vec2 p = v_uv * 2.0 - 1.0;
    float distanceToEdge = length(p);
    float edgeWidth = max(fwidth(distanceToEdge), 0.0001);
    shapeAlpha = 1.0 - smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, distanceToEdge);
    if (shapeAlpha <= 0.0) discard;
  } else if (u_geometry.x > 0.0) {
    vec2 halfSize = u_geometry.yz * 0.5;
    vec2 point = (v_uv - vec2(0.5)) * u_geometry.yz;
    float distanceToEdge = roundedBoxDistance(point, halfSize, u_geometry.x);
    float edgeWidth = max(fwidth(distanceToEdge), 0.0001);
    shapeAlpha = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToEdge);
    if (shapeAlpha <= 0.0) discard;
  }
  vec4 source = u_color;
  if (u_mode > 0) {
    vec4 sampled = texture(u_texture, u_uv_rect.xy + v_uv * u_uv_rect.zw);
    source = u_mode == 2 ? vec4(u_color.rgb, u_color.a * sampled.a) : sampled;
  }
  if (u_mode == 0 && u_gradient_params.x > 0.5) {
    float gradientT;
    if (u_gradient_params.x < 1.5) {
      vec2 point = patternPoint(v_uv * u_geometry.yz);
      vec2 gradientStart = u_gradient_start.xy;
      vec2 gradientEnd = u_gradient_end.xy;
      if (u_gradient_meta.z < 0.5) { gradientStart *= u_geometry.yz; gradientEnd *= u_geometry.yz; }
      vec2 direction = gradientEnd - gradientStart;
      gradientT = dot(point - gradientStart, direction) / max(dot(direction, direction), 0.0001);
    } else if (u_gradient_params.x < 2.5) {
      vec2 point = patternPoint(v_uv * u_geometry.yz);
      vec2 center = u_gradient_start.xy;
      vec2 focus = u_gradient_start.zw;
      vec2 radialRadii = u_gradient_radius.xy;
      if (u_gradient_meta.z < 0.5) {
        center *= u_geometry.yz;
        focus *= u_geometry.yz;
        radialRadii *= u_geometry.yz;
      }
      gradientT = length((point - focus) / max(radialRadii, vec2(0.0001))) + u_gradient_radius.z;
    } else {
      vec2 point = patternPoint(v_uv * u_geometry.yz);
      vec2 center = u_gradient_start.xy;
      if (u_gradient_meta.z < 0.5) center *= u_geometry.yz;
      point -= center;
      gradientT = fract(atan(point.y, point.x) / (2.0 * 3.14159265359) - u_gradient_params.y / (2.0 * 3.14159265359));
    }
    source = sampleGradient(gradientT);
  }
  if (u_mode == 0 && u_gradient_params.x > 3.5) {
    source = samplePattern(v_uv * u_geometry.yz);
  }
  if (u_mode == 0 && u_stroke_extent.x > 0.0 && u_stroke_extent.y > 0.0) {
    // Strokes are deliberately painted *inside* the layer frame. The old
    // implementation inset by half the requested width, then clipped the
    // other half at the quad boundary. That made a 3px stroke visibly thinner
    // and uneven when the quad was rotated. Keep the full width inside the
    // frame and use a separate AA transition for its inner boundary.
    float strokeMix;
    if (u_shape == 1) {
      vec2 p = v_uv * 2.0 - 1.0;
      vec2 innerRadii = max(vec2(0.0001), vec2(1.0) - 2.0 * u_stroke_extent);
      float innerDistance = length(p / innerRadii);
      float edgeWidth = max(fwidth(innerDistance), 0.0001);
      float innerCoverage = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, innerDistance);
      strokeMix = innerCoverage;
    } else if (u_geometry.x > 0.0) {
      vec2 halfSize = u_geometry.yz * 0.5;
      vec2 point = (v_uv - vec2(0.5)) * u_geometry.yz;
      float strokeWidth = max(u_stroke_extent.x * u_geometry.y, u_stroke_extent.y * u_geometry.z);
      float innerDistance = roundedBoxDistance(
        point,
        max(halfSize - vec2(strokeWidth), vec2(0.0001)),
        max(u_geometry.x - strokeWidth, 0.0)
      );
      float edgeWidth = max(fwidth(innerDistance), 0.0001);
      strokeMix = smoothstep(-edgeWidth, edgeWidth, innerDistance);
    } else {
      vec2 edge = min(v_uv, vec2(1.0) - v_uv);
      float distanceToInnerEdge = min(edge.x - u_stroke_extent.x, edge.y - u_stroke_extent.y);
      float edgeWidth = max(fwidth(distanceToInnerEdge), 0.0001);
      strokeMix = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToInnerEdge);
    }
    source = mix(source, u_stroke_color, clamp(strokeMix, 0.0, 1.0));
  }
  if (u_color_adjust_meta.x > 0.5) source = applyColorAdjust(source, u_color_adjust[0], u_color_adjust_space.x);
  if (u_color_adjust_meta.x > 1.5) source = applyColorAdjust(source, u_color_adjust[1], u_color_adjust_space.y);
  if (u_color_adjust_meta.x > 2.5) source = applyColorAdjust(source, u_color_adjust[2], u_color_adjust_space.z);
  if (u_color_adjust_meta.x > 3.5) source = applyColorAdjust(source, u_color_adjust[3], u_color_adjust_space.w);
  outColor = vec4(source.rgb, source.a * shapeAlpha * (u_mode == 1 ? u_color.a : 1.0));
}`;

export const BLUR_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
  v_uv = a_uv;
}`;

export const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec4 u_post_params;
uniform vec4 u_shadow_color;
uniform vec2 u_shadow_offset;
uniform vec4 u_noise_params;
uniform float u_composite_alpha;
uniform vec4 u_color_adjust_meta;
uniform vec4 u_color_adjust[4];
uniform vec4 u_color_adjust_space;
in vec2 v_uv;
out vec4 outColor;
vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + vec3(0.055)) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), color));
}
vec3 linearToSrgb(vec3 color) {
  vec3 low = color * 12.92;
  vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - vec3(0.055);
  return mix(low, high, step(vec3(0.0031308), color));
}
vec4 decodePremultiplied(vec4 color) {
  if (color.a <= 0.000001) return vec4(0.0);
  return vec4(srgbToLinear(clamp(color.rgb / color.a, 0.0, 1.0)) * color.a, color.a);
}
vec4 encodePremultiplied(vec4 color) {
  if (color.a <= 0.000001) return vec4(0.0);
  return vec4(linearToSrgb(max(color.rgb / color.a, vec3(0.0))) * color.a, color.a);
}
vec4 readColor(vec2 uv) {
  vec4 color = texture(u_texture, uv);
  return u_post_params.w < -0.5 ? decodePremultiplied(color) : color;
}
vec3 applyPostHueRotate(vec3 color, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(
    color.r * (0.213 + c * 0.787 - s * 0.213) + color.g * (0.715 - c * 0.715 - s * 0.715) + color.b * (0.072 - c * 0.072 + s * 0.928),
    color.r * (0.213 - c * 0.213 + s * 0.143) + color.g * (0.715 + c * 0.285 + s * 0.140) + color.b * (0.072 - c * 0.072 - s * 0.283),
    color.r * (0.213 - c * 0.213 - s * 0.787) + color.g * (0.715 - c * 0.715 + s * 0.715) + color.b * (0.072 + c * 0.928 + s * 0.072)
  );
}
vec4 applyPostColorAdjust(vec4 source, vec4 effect, float colorSpace) {
  if (source.a <= 0.000001) return vec4(0.0);
  vec3 color = clamp(source.rgb / source.a + vec3(effect.x), 0.0, 1.0);
  if (colorSpace <= 0.5) color = linearToSrgb(color);
  color = clamp((color - vec3(0.5)) * effect.y + vec3(0.5), 0.0, 1.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, effect.z);
  color = applyPostHueRotate(color, effect.w);
  if (colorSpace <= 0.5) color = srgbToLinear(color);
  return vec4(clamp(color, 0.0, 1.0) * source.a, source.a);
}
float noiseHash(vec2 point) {
  vec3 value = fract(vec3(point.x, point.y, point.x + point.y) * 0.1031);
  value += dot(value, value.yzx + 33.33);
  return fract((value.x + value.y) * value.z);
}
vec4 applyPostNoise(vec4 source) {
  if (source.a <= 0.000001 || u_noise_params.x <= 0.0) return source;
  vec2 resolution = vec2(textureSize(u_texture, 0));
  // WebGL fullscreen UVs run bottom-to-top; Protocol noise coordinates are top-to-bottom.
  vec2 protocolUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 cell = floor(protocolUv * resolution / max(u_noise_params.x, 0.25));
  float noiseValue = noiseHash(cell + vec2(u_noise_params.w, u_noise_params.w * 1.37));
  float delta = (noiseValue - 0.5) * 2.0 * u_noise_params.y * u_noise_params.z;
  vec3 color = clamp(source.rgb / source.a + vec3(delta), 0.0, 1.0);
  return vec4(color * source.a, source.a);
}
void main() {
  if (u_post_params.w > 1.5 && u_post_params.w < 2.5) {
    float alpha = readColor(v_uv - u_shadow_offset).a * u_shadow_color.a;
    outColor = vec4(srgbToLinear(u_shadow_color.rgb) * alpha, alpha);
    return;
  }
  float sigma = u_post_params.z;
  vec4 color = readColor(v_uv);
  if (sigma > 0.0) {
    float totalWeight = 1.0;
    float support = ceil(3.0 * sigma);
    for (int i = 1; i <= 12; i++) {
      float offset = float(i);
      if (offset <= support) {
        float weight = exp(-0.5 * offset * offset / (sigma * sigma));
        color += readColor(v_uv + u_post_params.xy * offset) * weight;
        color += readColor(v_uv - u_post_params.xy * offset) * weight;
        totalWeight += 2.0 * weight;
      }
    }
    color /= totalWeight;
  }
  if (u_color_adjust_meta.x > 0.5) color = applyPostColorAdjust(color, u_color_adjust[0], u_color_adjust_space.x);
  if (u_color_adjust_meta.x > 1.5) color = applyPostColorAdjust(color, u_color_adjust[1], u_color_adjust_space.y);
  if (u_color_adjust_meta.x > 2.5) color = applyPostColorAdjust(color, u_color_adjust[2], u_color_adjust_space.z);
  if (u_color_adjust_meta.x > 3.5) color = applyPostColorAdjust(color, u_color_adjust[3], u_color_adjust_space.w);
  color = applyPostNoise(color);
  outColor = u_post_params.w > 0.5 ? encodePremultiplied(color * u_composite_alpha) : color;
}`;

export const INNER_GLOW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform sampler2D u_blurred;
uniform vec4 u_tint;
in vec2 v_uv;
out vec4 outColor;
vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + vec3(0.055)) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), color));
}
void main() {
  float coverage = max(texture(u_source, v_uv).a - texture(u_blurred, v_uv).a, 0.0) * u_tint.a;
  outColor = vec4(srgbToLinear(u_tint.rgb) * coverage, coverage);
}`;

export const CLIP_MASK_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_content;
uniform sampler2D u_mask;
uniform float u_composite_alpha;
uniform float u_invert_mask;
uniform float u_luma_mask;
in vec2 v_uv;
out vec4 outColor;
vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + vec3(0.055)) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), color));
}
vec3 linearToSrgb(vec3 color) {
  vec3 low = color * 12.92;
  vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - vec3(0.055);
  return mix(low, high, step(vec3(0.0031308), color));
}
vec4 decodePremultiplied(vec4 color) {
  if (color.a <= 0.000001) return vec4(0.0);
  return vec4(srgbToLinear(clamp(color.rgb / color.a, 0.0, 1.0)) * color.a, color.a);
}
vec4 encodePremultiplied(vec4 color) {
  if (color.a <= 0.000001) return vec4(0.0);
  return vec4(linearToSrgb(max(color.rgb / color.a, vec3(0.0))) * color.a, color.a);
}
void main() {
  vec4 content = decodePremultiplied(texture(u_content, v_uv));
  vec4 mask = decodePremultiplied(texture(u_mask, v_uv));
  float coverage = mask.a;
  if (u_luma_mask > 0.5 && mask.a > 0.000001) {
    coverage = dot(mask.rgb / mask.a, vec3(0.2126, 0.7152, 0.0722)) * mask.a;
  }
  if (u_invert_mask > 0.5) coverage = 1.0 - coverage;
  outColor = encodePremultiplied(content * coverage * u_composite_alpha);
}`;
