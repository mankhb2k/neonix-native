import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import {
  cssColorToRgba,
  matrix4ForQuad,
  packMatrix4F32,
  worldToClipMatrixForPaint,
  gradientUniforms,
  webglClipSpaceProjection,
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
} from "./types";

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat4 u_projection;
uniform mat4 u_model;
out vec2 v_uv;
void main() {
  gl_Position = u_projection * u_model * vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
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
uniform vec4 u_color_adjust_meta;
uniform vec4 u_color_adjust[4];
uniform int u_mode;
uniform int u_shape;
in vec2 v_uv;
out vec4 outColor;
float roundedBoxDistance(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - (halfSize - vec2(radius));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
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
vec4 applyColorAdjust(vec4 source, vec4 effect) {
  vec3 color = clamp(source.rgb + vec3(effect.x), 0.0, 1.0);
  color = clamp((color - vec3(0.5)) * effect.y + vec3(0.5), 0.0, 1.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, effect.z);
  return vec4(clamp(applyHueRotate(color, effect.w), 0.0, 1.0), source.a);
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
  vec4 sampled = texture(u_texture, u_uv_rect.xy + v_uv * u_uv_rect.zw);
  vec4 source = u_mode == 0 ? u_color : sampled;
  if (u_mode == 2) source = vec4(u_color.rgb, u_color.a * sampled.a);
  if (u_mode == 0 && u_gradient_params.x > 0.5) {
    float gradientT;
    if (u_gradient_params.x < 1.5) {
      vec2 direction = vec2(cos(u_gradient_params.y), sin(u_gradient_params.y));
      float extent = length(u_geometry.yz) * 0.5;
      vec2 point = (v_uv - vec2(0.5)) * u_geometry.yz;
      gradientT = dot(point, direction) / max(2.0 * extent, 0.0001) + 0.5;
    } else {
      vec2 point = (v_uv - u_gradient_params.zw) * u_geometry.yz;
      gradientT = length(point) / max(u_gradient_radius.x * min(u_geometry.y, u_geometry.z), 0.0001);
    }
    source = mix(u_gradient_start, u_gradient_end, clamp(gradientT, 0.0, 1.0));
  }
  if (u_mode == 0 && u_stroke_extent.x > 0.0 && u_stroke_extent.y > 0.0) {
    float strokeCoverage;
    if (u_shape == 1) {
      vec2 p = v_uv * 2.0 - 1.0;
      vec2 innerRadii = max(vec2(0.0001), vec2(1.0) - u_stroke_extent);
      float innerDistance = length(p / innerRadii);
      float edgeWidth = max(fwidth(innerDistance), 0.0001);
      float innerCoverage = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, innerDistance);
      strokeCoverage = shapeAlpha * innerCoverage;
    } else if (u_geometry.x > 0.0) {
      vec2 halfSize = u_geometry.yz * 0.5;
      vec2 point = (v_uv - vec2(0.5)) * u_geometry.yz;
      float strokeWidth = max(u_stroke_extent.x * u_geometry.y, u_stroke_extent.y * u_geometry.z);
      float halfStroke = strokeWidth * 0.5;
      float innerDistance = roundedBoxDistance(
        point,
        max(halfSize - vec2(halfStroke), vec2(0.0001)),
        max(u_geometry.x - halfStroke, 0.0)
      );
      float edgeWidth = max(fwidth(innerDistance), 0.0001);
      strokeCoverage = shapeAlpha * smoothstep(-edgeWidth, edgeWidth, innerDistance);
    } else {
      vec2 edge = min(v_uv, vec2(1.0) - v_uv);
      vec2 halfStroke = u_stroke_extent * 0.5;
      float distanceToInnerEdge = min(edge.x - halfStroke.x, edge.y - halfStroke.y);
      float edgeWidth = max(fwidth(distanceToInnerEdge), 0.0001);
      strokeCoverage = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToInnerEdge);
    }
    source = mix(source, u_stroke_color, strokeCoverage);
  }
  if (u_color_adjust_meta.x > 0.5) source = applyColorAdjust(source, u_color_adjust[0]);
  if (u_color_adjust_meta.x > 1.5) source = applyColorAdjust(source, u_color_adjust[1]);
  if (u_color_adjust_meta.x > 2.5) source = applyColorAdjust(source, u_color_adjust[2]);
  if (u_color_adjust_meta.x > 3.5) source = applyColorAdjust(source, u_color_adjust[3]);
  outColor = vec4(source.rgb, source.a * shapeAlpha * (u_mode == 1 ? u_color.a : 1.0));
}`;

const BLUR_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
  v_uv = a_uv;
}`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec4 u_post_params;
uniform vec4 u_color_adjust_meta;
uniform vec4 u_color_adjust[4];
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
vec4 applyPostColorAdjust(vec4 source, vec4 effect) {
  if (source.a <= 0.000001) return vec4(0.0);
  vec3 color = clamp(source.rgb / source.a + vec3(effect.x), 0.0, 1.0);
  color = clamp((color - vec3(0.5)) * effect.y + vec3(0.5), 0.0, 1.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, effect.z);
  return vec4(applyPostHueRotate(color, effect.w) * source.a, source.a);
}
void main() {
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
  if (u_color_adjust_meta.x > 0.5) color = applyPostColorAdjust(color, u_color_adjust[0]);
  if (u_color_adjust_meta.x > 1.5) color = applyPostColorAdjust(color, u_color_adjust[1]);
  if (u_color_adjust_meta.x > 2.5) color = applyPostColorAdjust(color, u_color_adjust[2]);
  if (u_color_adjust_meta.x > 3.5) color = applyPostColorAdjust(color, u_color_adjust[3]);
  outColor = u_post_params.w > 0.5 ? encodePremultiplied(color) : color;
}`;

type GL = WebGL2RenderingContext;
type BlendMode = "normal" | "multiply" | "screen" | "add" | "darken" | "lighten" | "overlay";

function shader(gl: GL, type: number, source: string): WebGLShader {
  const result = gl.createShader(type);
  if (!result) throw new Error("preview-renderer: unable to create WebGL shader");
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result) ?? "unknown shader error";
    gl.deleteShader(result);
    throw new Error(`preview-renderer: ${message}`);
  }
  return result;
}

function program(gl: GL, vertexSource = VERTEX_SHADER, fragmentSource = FRAGMENT_SHADER): WebGLProgram {
  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const result = gl.createProgram();
  if (!result) throw new Error("preview-renderer: unable to create WebGL program");
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) ?? "unknown program error";
    gl.deleteProgram(result);
    throw new Error(`preview-renderer: ${message}`);
  }
  return result;
}

function blend(gl: GL, mode: BlendMode): void {
  gl.enable(gl.BLEND);
  if (mode === "add") gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
  else if (mode === "multiply") gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === "screen") gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function blendPremultiplied(gl: GL): void {
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function assetSource(asset: PreviewAsset): TexImageSource {
  return asset.source;
}

export function createWebGL2Backend(
  options: PreviewRendererOptions,
  report: (diagnostic: PreviewDiagnostic) => void,
): PreviewBackend {
  const context = options.canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  }) as WebGL2RenderingContext | null;
  if (!context) throw new Error("preview-renderer: WebGL2 is not available");
  const gl = context;
  const canvas = options.canvas;
  const assets = new Map(options.assets ?? []);
  const textures = new Map<string, WebGLTexture>();
  const textAtlases = new Map<string, TextAtlas>();
  const diagnostics: PreviewDiagnostic[] = [];
  const programHandle = program(gl);
  const blurProgramHandle = program(gl, BLUR_VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
  const vao = gl.createVertexArray();
  const blurVao = gl.createVertexArray();
  const quadBuffer = gl.createBuffer();
  const pathBuffer = gl.createBuffer();
  const pathIndexBuffer = gl.createBuffer();
  if (!vao || !blurVao || !quadBuffer || !pathBuffer || !pathIndexBuffer) throw new Error("preview-renderer: unable to create WebGL buffers");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(programHandle, "a_position");
  const uv = gl.getAttribLocation(programHandle, "a_uv");
  const bindVertexBuffer = (nextBuffer: WebGLBuffer) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, nextBuffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  };
  bindVertexBuffer(quadBuffer);
  gl.bindVertexArray(null);

  gl.bindVertexArray(blurVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const blurPosition = gl.getAttribLocation(blurProgramHandle, "a_position");
  const blurUv = gl.getAttribLocation(blurProgramHandle, "a_uv");
  gl.enableVertexAttribArray(blurPosition);
  gl.vertexAttribPointer(blurPosition, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(blurUv);
  gl.vertexAttribPointer(blurUv, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);

  const projectionLocation = gl.getUniformLocation(programHandle, "u_projection");
  const modelLocation = gl.getUniformLocation(programHandle, "u_model");
  const colorLocation = gl.getUniformLocation(programHandle, "u_color");
  const textureLocation = gl.getUniformLocation(programHandle, "u_texture");
  const modeLocation = gl.getUniformLocation(programHandle, "u_mode");
  const shapeLocation = gl.getUniformLocation(programHandle, "u_shape");
  const uvRectLocation = gl.getUniformLocation(programHandle, "u_uv_rect");
  const strokeColorLocation = gl.getUniformLocation(programHandle, "u_stroke_color");
  const strokeExtentLocation = gl.getUniformLocation(programHandle, "u_stroke_extent");
  const geometryLocation = gl.getUniformLocation(programHandle, "u_geometry");
  const gradientStartLocation = gl.getUniformLocation(programHandle, "u_gradient_start");
  const gradientEndLocation = gl.getUniformLocation(programHandle, "u_gradient_end");
  const gradientParamsLocation = gl.getUniformLocation(programHandle, "u_gradient_params");
  const gradientRadiusLocation = gl.getUniformLocation(programHandle, "u_gradient_radius");
  const colorAdjustMetaLocation = gl.getUniformLocation(programHandle, "u_color_adjust_meta");
  const colorAdjustLocation = gl.getUniformLocation(programHandle, "u_color_adjust[0]");
  const blurTextureLocation = gl.getUniformLocation(blurProgramHandle, "u_texture");
  const blurPostParamsLocation = gl.getUniformLocation(blurProgramHandle, "u_post_params");
  const blurColorAdjustMetaLocation = gl.getUniformLocation(blurProgramHandle, "u_color_adjust_meta");
  const blurColorAdjustLocation = gl.getUniformLocation(blurProgramHandle, "u_color_adjust[0]");
  const setColorAdjust = (adjustments: EffectPassPlan["sourceColorAdjust"] | undefined) => {
    const uniforms = colorAdjustUniforms(adjustments);
    gl.uniform4fv(colorAdjustMetaLocation, uniforms.subarray(0, 4));
    gl.uniform4fv(colorAdjustLocation, uniforms.subarray(4));
  };
  const setPostColorAdjust = (adjustments: EffectPassPlan["sourceColorAdjust"] | undefined) => {
    const uniforms = colorAdjustUniforms(adjustments);
    gl.uniform4fv(blurColorAdjustMetaLocation, uniforms.subarray(0, 4));
    gl.uniform4fv(blurColorAdjustLocation, uniforms.subarray(4));
  };
  let width = (options.width ?? canvas.width) || 1;
  let height = (options.height ?? canvas.height) || 1;
  let dpr = options.devicePixelRatio ?? 1;
  let effectWidth = 0;
  let effectHeight = 0;
  type EffectTarget = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };
  type EffectLevel = { width: number; height: number; a: EffectTarget; b: EffectTarget };
  let effectSourceTarget: EffectTarget | null = null;
  let effectLevels: EffectLevel[] = [];
  let lastStats: PreviewRenderStats = {
    backend: "webgl2",
    drawCalls: 0,
    skippedCommands: 0,
    frameTimeMs: 0,
    diagnostics,
  };

  const pushDiagnostic = (diagnostic: PreviewDiagnostic) => {
    diagnostics.push(diagnostic);
    report(diagnostic);
  };

  const uploadTexture = (assetId: string, asset: PreviewAsset): WebGLTexture | null => {
    const existing = textures.get(assetId);
    const texture = existing ?? gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    if (asset.pixels) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, asset.width, asset.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, asset.pixels);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, assetSource(asset));
    }
    textures.set(assetId, texture);
    return texture;
  };

  const deleteEffectTargets = () => {
    if (effectSourceTarget) {
      gl.deleteTexture(effectSourceTarget.texture);
      gl.deleteFramebuffer(effectSourceTarget.framebuffer);
    }
    for (const level of effectLevels) {
      gl.deleteTexture(level.a.texture);
      gl.deleteTexture(level.b.texture);
      gl.deleteFramebuffer(level.a.framebuffer);
      gl.deleteFramebuffer(level.b.framebuffer);
    }
    effectSourceTarget = null;
    effectLevels = [];
    effectWidth = 0;
    effectHeight = 0;
  };

  const ensureEffectTargets = (targetWidth: number, targetHeight: number) => {
    if (effectSourceTarget && effectLevels.length > 0 && effectWidth === targetWidth && effectHeight === targetHeight) {
      return;
    }
    deleteEffectTargets();
    const supportsFloatTargets = Boolean(
      gl.getExtension("EXT_color_buffer_float")
      && gl.getExtension("OES_texture_float_linear"),
    );
    const createTarget = (targetLevelWidth: number, targetLevelHeight: number, floating = supportsFloatTargets): EffectTarget => {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      if (!texture || !framebuffer) throw new Error("preview-renderer: unable to allocate WebGL effect target");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        floating ? gl.RGBA16F : gl.RGBA8,
        targetLevelWidth,
        targetLevelHeight,
        0,
        gl.RGBA,
        floating ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("preview-renderer: incomplete WebGL effect framebuffer");
      }
      return { texture, framebuffer };
    };
    effectSourceTarget = createTarget(targetWidth, targetHeight, false);
    let levelWidth = targetWidth;
    let levelHeight = targetHeight;
    for (let level = 0; level < 9; level += 1) {
      effectLevels.push({
        width: levelWidth,
        height: levelHeight,
        a: createTarget(levelWidth, levelHeight),
        b: createTarget(levelWidth, levelHeight),
      });
      if (levelWidth === 1 && levelHeight === 1) break;
      levelWidth = Math.max(1, Math.ceil(levelWidth / 2));
      levelHeight = Math.max(1, Math.ceil(levelHeight / 2));
    }
    effectWidth = targetWidth;
    effectHeight = targetHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const paint = (bufferToPaint: PaintCommandBuffer): PreviewRenderStats => {
    const started = performance.now();
    diagnostics.length = 0;
    let drawCalls = 0;
    let skippedCommands = 0;
    let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
    let currentBlend: BlendMode = "normal";
    let activeEffectScope: {
      key: string;
      layerId?: string;
      plan: EffectPassPlan;
      blend: BlendMode;
    } | null = null;
    const sourceColorAdjust = () =>
      activeEffectScope?.plan.requiresOffscreen
        ? undefined
        : activeEffectScope?.plan.sourceColorAdjust;
    const firstCommand = bufferToPaint.commands[0];
    if (!firstCommand || firstCommand.op !== "beginFrame") {
      throw new Error("Preview renderer requires beginFrame as the first command");
    }
    let projection = webglClipSpaceProjection(worldToClipMatrixForPaint(firstCommand));
    const physicalWidth = Math.max(1, Math.round(width * dpr));
    const physicalHeight = Math.max(1, Math.round(height * dpr));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, physicalWidth, physicalHeight);
    gl.clearColor(...cssColorToRgba(bufferToPaint.commands[0]?.op === "beginFrame" ? bufferToPaint.commands[0].background : options.background));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programHandle);
    gl.bindVertexArray(vao);
    for (const command of bufferToPaint.commands) {
      if (command.op === "beginFrame") {
        projection = webglClipSpaceProjection(worldToClipMatrixForPaint(command));
        gl.clearColor(...cssColorToRgba(command.background ?? options.background));
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (command.op === "setTransform") {
        transform = command;
        currentBlend = command.blendMode ?? "normal";
      } else if (command.op === "drawSolid" || command.op === "drawShape") {
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
        blend(gl, currentBlend);
        bindVertexBuffer(quadBuffer);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(modelLocation, false, matrix4ForQuad(baseMatrix, 0, 0, command.width, command.height));
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1);
        gl.uniform4fv(colorLocation, color);
        gl.uniform1i(modeLocation, 0);
        gl.uniform1i(shapeLocation, command.op === "drawShape" && command.shape === "ellipse" ? 1 : 0);
        gl.uniform3f(
          geometryLocation,
          command.op === "drawShape" ? command.cornerRadius ?? 0 : 0,
          command.width,
          command.height,
        );
        const gradients = gradientUniforms(
          command.op === "drawShape" ? command.fillPaint : undefined,
          transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1),
        );
        gl.uniform4fv(gradientStartLocation, gradients.start);
        gl.uniform4fv(gradientEndLocation, gradients.end);
        gl.uniform4fv(gradientParamsLocation, gradients.params);
        gl.uniform4fv(gradientRadiusLocation, gradients.radius);
        const stroke = command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? cssColorToRgba(command.stroke)
          : [0, 0, 0, 0];
        stroke[3] *= transform.alpha * (command.op === "drawShape" ? command.strokeOpacity ?? 1 : 1);
        const strokeWidth = command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? command.strokeWidth ?? 4
          : 0;
        gl.uniform4fv(strokeColorLocation, stroke);
        gl.uniform2f(strokeExtentLocation, strokeWidth / command.width, strokeWidth / command.height);
        gl.uniform4f(uvRectLocation, 0, 0, 1, 1);
        setColorAdjust(sourceColorAdjust());
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        drawCalls += 1;
      } else if (command.op === "drawPath") {
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
        blend(gl, currentBlend);
        bindVertexBuffer(pathBuffer);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(modelLocation, false, packMatrix4F32(transform.matrix4));
        gl.uniform1i(modeLocation, 0);
        gl.uniform1i(shapeLocation, 0);
        gl.uniform2f(strokeExtentLocation, 0, 0);
        gl.uniform3f(geometryLocation, 0, 0, 0);
        gl.uniform4f(gradientStartLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientEndLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientParamsLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientRadiusLocation, 0, 0, 0, 0);
        gl.uniform4f(uvRectLocation, 0, 0, 1, 1);
        setColorAdjust(sourceColorAdjust());
        for (const pathDraw of meshes) {
          const vertexData = new Float32Array(pathDraw.mesh.vertices.length * 2);
          for (let index = 0; index < pathDraw.mesh.vertices.length / 2; index += 1) {
            vertexData[index * 4] = pathDraw.mesh.vertices[index * 2]!;
            vertexData[index * 4 + 1] = pathDraw.mesh.vertices[index * 2 + 1]!;
          }
          gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pathIndexBuffer);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(pathDraw.mesh.indices), gl.DYNAMIC_DRAW);
          pathDraw.color[3] *= transform.alpha * pathDraw.opacity;
          gl.uniform4fv(colorLocation, pathDraw.color);
          gl.uniform4f(strokeColorLocation, 0, 0, 0, 0);
          gl.drawElements(gl.TRIANGLES, pathDraw.mesh.indices.length, gl.UNSIGNED_INT, 0);
          drawCalls += 1;
        }
      } else if (command.op === "drawImage" || command.op === "drawVideo") {
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
        if (command.op === "drawVideo" && typeof HTMLVideoElement !== "undefined" && asset.source instanceof HTMLVideoElement && Number.isFinite(command.mediaTime)) {
          if (Math.abs(asset.source.currentTime - command.mediaTime) > 0.033) asset.source.currentTime = Math.max(0, command.mediaTime);
        }
        const texture = uploadTexture(command.assetId, asset);
        if (!texture) {
          skippedCommands += 1;
          continue;
        }
        blend(gl, currentBlend);
        bindVertexBuffer(quadBuffer);
        const layout = mediaLayout(command.width, command.height, asset.width, asset.height, command.fit, command.op === "drawImage" ? command.crop : undefined);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(modelLocation, false, matrix4ForQuad(baseMatrix, layout.x, layout.y, layout.width, layout.height));
        gl.uniform4fv(colorLocation, [1, 1, 1, transform.alpha]);
        gl.uniform1i(modeLocation, 1);
        gl.uniform1i(shapeLocation, 0);
        gl.uniform4f(strokeColorLocation, 0, 0, 0, 0);
        gl.uniform2f(strokeExtentLocation, 0, 0);
        gl.uniform3f(geometryLocation, 0, 0, 0);
        gl.uniform4f(gradientStartLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientEndLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientParamsLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientRadiusLocation, 0, 0, 0, 0);
        gl.uniform4f(uvRectLocation, layout.uv.x, layout.uv.y, layout.uv.width, layout.uv.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(textureLocation, 0);
        setColorAdjust(sourceColorAdjust());
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        drawCalls += 1;
      } else if (command.op === "drawText") {
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
        const texture = uploadTexture(atlas.id, atlas.asset);
        if (!texture) {
          skippedCommands += 1;
          continue;
        }
        blend(gl, currentBlend);
        bindVertexBuffer(quadBuffer);
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha;
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniform4fv(colorLocation, color);
        gl.uniform1i(modeLocation, 2);
        gl.uniform1i(shapeLocation, 0);
        gl.uniform4f(strokeColorLocation, 0, 0, 0, 0);
        gl.uniform2f(strokeExtentLocation, 0, 0);
        gl.uniform3f(geometryLocation, 0, 0, 0);
        gl.uniform4f(gradientStartLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientEndLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientParamsLocation, 0, 0, 0, 0);
        gl.uniform4f(gradientRadiusLocation, 0, 0, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(textureLocation, 0);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        for (const glyph of atlas.glyphs) {
          gl.uniformMatrix4fv(modelLocation, false, matrix4ForQuad(baseMatrix, glyph.x, glyph.y, glyph.width, glyph.height));
          gl.uniform4f(uvRectLocation, glyph.uv.x, glyph.uv.y, glyph.uv.width, glyph.uv.height);
          setColorAdjust(sourceColorAdjust());
          gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
          drawCalls += 1;
        }
      } else if (command.op === "beginLayer" && command.effectProgram) {
        if (activeEffectScope) {
          pushDiagnostic({ severity: "error", code: "preview_nested_effect_scope_unsupported", message: "Nested effect scopes are not implemented yet", key: command.key, layerId: command.layerId });
          continue;
        }
        const plan = buildEffectPassPlan(command.effectProgram);
        for (const diagnostic of plan.diagnostics) {
          pushDiagnostic({ severity: "error", code: diagnostic.code, message: diagnostic.message, key: command.key, layerId: command.layerId });
        }
        activeEffectScope = { key: command.key, layerId: command.layerId, plan, blend: currentBlend };
        if (!plan.requiresOffscreen || !plan.supported) continue;
        ensureEffectTargets(physicalWidth, physicalHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, effectSourceTarget!.framebuffer);
        gl.viewport(0, 0, physicalWidth, physicalHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (command.op === "endLayer") {
        const scope = activeEffectScope;
        if (!scope || scope.key !== command.key) {
          pushDiagnostic({ severity: "error", code: "preview_effect_scope_invalid", message: "endLayer has no matching effect scope", key: command.key });
          continue;
        }
        if (!scope.plan.requiresOffscreen || !scope.plan.supported) {
          activeEffectScope = null;
          continue;
        }
        if (!effectSourceTarget || effectLevels.length === 0 || !scope.plan.blur) {
          pushDiagnostic({ severity: "error", code: "preview_offscreen_scope_invalid", message: "Offscreen effect scope has no supported blur surface", key: command.key, layerId: scope.layerId });
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          activeEffectScope = null;
          continue;
        }
        const sigma = Math.min(scope.plan.blur.radius * dpr, 256);
        const blurPlan = blurPyramidPlan(sigma, physicalWidth, physicalHeight);
        gl.useProgram(blurProgramHandle);
        gl.bindVertexArray(blurVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(blurTextureLocation, 0);
        const runPost = (
          source: WebGLTexture,
          target: WebGLFramebuffer | null,
          targetWidth: number,
          targetHeight: number,
          stepX: number,
          stepY: number,
          passSigma: number,
          colorMode = 0,
          composite = false,
          adjustments: EffectPassPlan["sourceColorAdjust"] | undefined = undefined,
        ) => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target);
          gl.viewport(0, 0, targetWidth, targetHeight);
          if (composite) blendPremultiplied(gl);
          else gl.disable(gl.BLEND);
          gl.bindTexture(gl.TEXTURE_2D, source);
          gl.uniform4f(blurPostParamsLocation, stepX, stepY, passSigma, colorMode);
          setPostColorAdjust(adjustments);
          gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
          drawCalls += 1;
        };

        const root = effectLevels[0]!;
        // The isolated source is premultiplied sRGB. Blur linear premultiplied
        // samples so transparent edges do not darken or form colored blocks.
        runPost(effectSourceTarget.texture, root.a.framebuffer, root.width, root.height, 0, 0, 0, -1, false, scope.plan.sourceColorAdjust);
        let activeTarget = root.a;
        for (let levelIndex = 1; levelIndex <= blurPlan.levels; levelIndex += 1) {
          const level = effectLevels[levelIndex]!;
          runPost(activeTarget.texture, level.a.framebuffer, level.width, level.height, 0, 0, 0);
          activeTarget = level.a;
        }

        const blurLevel = effectLevels[blurPlan.levels]!;
        const horizontalTarget = activeTarget === blurLevel.a ? blurLevel.b : blurLevel.a;
        runPost(
          activeTarget.texture,
          horizontalTarget.framebuffer,
          blurLevel.width,
          blurLevel.height,
          1 / blurLevel.width,
          0,
          blurPlan.levelSigma,
        );
        const verticalTarget = activeTarget;
        runPost(
          horizontalTarget.texture,
          verticalTarget.framebuffer,
          blurLevel.width,
          blurLevel.height,
          0,
          1 / blurLevel.height,
          blurPlan.levelSigma,
        );
        activeTarget = verticalTarget;

        for (let levelIndex = blurPlan.levels - 1; levelIndex >= 0; levelIndex -= 1) {
          const level = effectLevels[levelIndex]!;
          runPost(activeTarget.texture, level.a.framebuffer, level.width, level.height, 0, 0, 0);
          activeTarget = level.a;
        }

        if (scope.plan.outputColorAdjust.length) {
          const adjustedTarget = activeTarget === root.a ? root.b : root.a;
          runPost(activeTarget.texture, adjustedTarget.framebuffer, root.width, root.height, 0, 0, 0, 0, false, scope.plan.outputColorAdjust);
          activeTarget = adjustedTarget;
        }
        if (scope.blend !== "normal") {
          pushDiagnostic({ severity: "info", code: "preview_blur_blend_normalized", message: "Blur currently composites with premultiplied normal blending", key: scope.key, layerId: scope.layerId });
        }
        runPost(activeTarget.texture, null, physicalWidth, physicalHeight, 0, 0, 0, 1, true);
        gl.useProgram(programHandle);
        gl.bindVertexArray(vao);
        activeEffectScope = null;
      } else if (command.op === "beginLayer" && (command.isolation || command.mask)) {
        pushDiagnostic({ severity: "info", code: "preview_compositing_pending", message: "Isolation and mask scopes are pending in the native preview backend", key: command.key, layerId: command.layerId });
      } else if (command.op === "unsupported") {
        skippedCommands += 1;
        pushDiagnostic({ severity: "error", code: "preview_unsupported_command", message: command.message, key: command.key, layerId: command.layerId });
      }
    }
    if (activeEffectScope) {
      pushDiagnostic({ severity: "error", code: "preview_effect_scope_unclosed", message: "Effect scope was not closed", key: activeEffectScope.key, layerId: activeEffectScope.layerId });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.bindVertexArray(null);
    lastStats = { backend: "webgl2", drawCalls, skippedCommands, frameTimeMs: performance.now() - started, diagnostics: [...diagnostics] };
    return lastStats;
  };

  return {
    kind: "webgl2",
    resize(nextWidth, nextHeight, nextDpr) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      deleteEffectTargets();
    },
    paint,
    stats: () => lastStats,
    setAsset(assetId, asset) {
      assets.set(assetId, asset);
      uploadTexture(assetId, asset);
    },
    removeAsset(assetId) {
      assets.delete(assetId);
      const texture = textures.get(assetId);
      if (texture) gl.deleteTexture(texture);
      textures.delete(assetId);
    },
    diagnostics,
    dispose() {
      for (const texture of textures.values()) gl.deleteTexture(texture);
      textures.clear();
      textAtlases.clear();
      gl.deleteBuffer(quadBuffer);
      gl.deleteBuffer(pathBuffer);
      gl.deleteBuffer(pathIndexBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteVertexArray(blurVao);
      gl.deleteProgram(programHandle);
      gl.deleteProgram(blurProgramHandle);
      deleteEffectTargets();
    },
  };
}
