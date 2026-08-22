import {
  FRAGMENT_SHADER,
  VERTEX_SHADER,
} from "./shaders";
import type { PreviewAsset } from "../shared/types";

export type GL = WebGL2RenderingContext;
type BlendMode = "normal" | "multiply" | "screen" | "add";

export function shader(gl: GL, type: number, source: string): WebGLShader {
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

export function program(gl: GL, vertexSource = VERTEX_SHADER, fragmentSource = FRAGMENT_SHADER): WebGLProgram {
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


export function assetSource(asset: PreviewAsset): TexImageSource {
  return asset.source;
}
