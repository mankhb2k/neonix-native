import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import {
  affineToMatrix4,
  cssColorToRgba,
  matrix4ForQuad,
  orthographicProjection,
  webglDepthProjection,
} from "./math";
import { mediaLayout } from "./media";
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
uniform int u_mode;
uniform int u_shape;
in vec2 v_uv;
out vec4 outColor;
void main() {
  float shapeAlpha = 1.0;
  if (u_shape == 1) {
    vec2 p = v_uv * 2.0 - 1.0;
    float distanceToEdge = length(p);
    float edgeWidth = max(fwidth(distanceToEdge), 0.0001);
    shapeAlpha = 1.0 - smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, distanceToEdge);
    if (shapeAlpha <= 0.0) discard;
  }
  vec4 source = u_mode == 0 ? u_color : texture(u_texture, u_uv_rect.xy + v_uv * u_uv_rect.zw);
  if (u_mode == 0 && u_stroke_extent.x > 0.0 && u_stroke_extent.y > 0.0) {
    vec2 edge = min(v_uv, vec2(1.0) - v_uv);
    vec2 halfStroke = u_stroke_extent * 0.5;
    float distanceToInnerEdge = min(edge.x - halfStroke.x, edge.y - halfStroke.y);
    float edgeWidth = max(fwidth(distanceToInnerEdge), 0.0001);
    float strokeCoverage = 1.0 - smoothstep(-edgeWidth, edgeWidth, distanceToInnerEdge);
    source = mix(source, u_stroke_color, strokeCoverage);
  }
  outColor = vec4(source.rgb, source.a * shapeAlpha * (u_mode == 0 ? 1.0 : u_color.a));
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

function program(gl: GL): WebGLProgram {
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
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
  const diagnostics: PreviewDiagnostic[] = [];
  const programHandle = program(gl);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error("preview-renderer: unable to create WebGL buffers");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(programHandle, "a_position");
  const uv = gl.getAttribLocation(programHandle, "a_uv");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
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
  let width = (options.width ?? canvas.width) || 1;
  let height = (options.height ?? canvas.height) || 1;
  let dpr = options.devicePixelRatio ?? 1;
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, assetSource(asset));
    textures.set(assetId, texture);
    return texture;
  };

  const paint = (bufferToPaint: PaintCommandBuffer): PreviewRenderStats => {
    const started = performance.now();
    diagnostics.length = 0;
    let drawCalls = 0;
    let skippedCommands = 0;
    let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
    let currentBlend: BlendMode = "normal";
    let frameWidth = width;
    let frameHeight = height;
    let projection = orthographicProjection(frameWidth, frameHeight);
    gl.viewport(0, 0, Math.max(1, Math.round(width * dpr)), Math.max(1, Math.round(height * dpr)));
    gl.clearColor(...cssColorToRgba(bufferToPaint.commands[0]?.op === "beginFrame" ? bufferToPaint.commands[0].background : options.background));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programHandle);
    gl.bindVertexArray(vao);
    for (const command of bufferToPaint.commands) {
      if (command.op === "beginFrame") {
        frameWidth = command.width;
        frameHeight = command.height;
        const projectionValues = command.projection?.viewProjectionMatrix ?? command.projection?.projectionMatrix;
        projection = projectionValues?.length === 16
          ? webglDepthProjection(projectionValues)
          : webglDepthProjection(orthographicProjection(frameWidth, frameHeight));
        gl.clearColor(...cssColorToRgba(command.background ?? options.background));
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (command.op === "setTransform") {
        transform = command;
        currentBlend = command.blendMode ?? "normal";
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
        blend(gl, currentBlend);
        const baseMatrix = transform.matrix4?.length === 16
          ? new Float32Array(transform.matrix4)
          : affineToMatrix4(transform.matrix);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(modelLocation, false, matrix4ForQuad(baseMatrix, 0, 0, command.width, command.height));
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha;
        gl.uniform4fv(colorLocation, color);
        gl.uniform1i(modeLocation, 0);
        gl.uniform1i(shapeLocation, command.op === "drawShape" && command.shape === "ellipse" ? 1 : 0);
        const stroke = command.op === "drawShape" && command.shape === "rectangle" && command.stroke
          ? cssColorToRgba(command.stroke)
          : [0, 0, 0, 0];
        stroke[3] *= transform.alpha;
        const strokeWidth = command.op === "drawShape" && command.shape === "rectangle" && command.stroke
          ? command.strokeWidth ?? 4
          : 0;
        gl.uniform4fv(strokeColorLocation, stroke);
        gl.uniform2f(strokeExtentLocation, strokeWidth / command.width, strokeWidth / command.height);
        gl.uniform4f(uvRectLocation, 0, 0, 1, 1);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
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
        if (command.op === "drawVideo" && typeof HTMLVideoElement !== "undefined" && asset.source instanceof HTMLVideoElement && Number.isFinite(command.mediaTime)) {
          if (Math.abs(asset.source.currentTime - command.mediaTime) > 0.033) asset.source.currentTime = Math.max(0, command.mediaTime);
        }
        const texture = uploadTexture(command.assetId, asset);
        if (!texture) {
          skippedCommands += 1;
          continue;
        }
        blend(gl, currentBlend);
        const layout = mediaLayout(command.width, command.height, asset.width, asset.height, command.fit, command.op === "drawImage" ? command.crop : undefined);
        const baseMatrix = transform.matrix4?.length === 16
          ? new Float32Array(transform.matrix4)
          : affineToMatrix4(transform.matrix);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(modelLocation, false, matrix4ForQuad(baseMatrix, layout.x, layout.y, layout.width, layout.height));
        gl.uniform4fv(colorLocation, [1, 1, 1, transform.alpha]);
        gl.uniform1i(modeLocation, 1);
        gl.uniform1i(shapeLocation, 0);
        gl.uniform4f(strokeColorLocation, 0, 0, 0, 0);
        gl.uniform2f(strokeExtentLocation, 0, 0);
        gl.uniform4f(uvRectLocation, layout.uv.x, layout.uv.y, layout.uv.width, layout.uv.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(textureLocation, 0);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        drawCalls += 1;
      } else if (command.op === "drawText" || command.op === "drawPath") {
        skippedCommands += 1;
        pushDiagnostic({ severity: "info", code: "preview_op_pending", message: `${command.op} is pending in the native preview backend`, key: command.key, layerId: command.layerId });
      } else if (command.op === "beginLayer" && (command.offscreen || command.isolation || command.mask)) {
        pushDiagnostic({ severity: "info", code: "preview_compositing_pending", message: "offscreen, isolation, and mask scopes are pending in the native preview backend", key: command.key, layerId: command.layerId });
      } else if (command.op === "unsupported") {
        skippedCommands += 1;
        pushDiagnostic({ severity: "error", code: "preview_unsupported_command", message: command.message, key: command.key, layerId: command.layerId });
      }
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
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(programHandle);
    },
  };
}
