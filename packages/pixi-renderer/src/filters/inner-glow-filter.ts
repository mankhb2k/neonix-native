import { Filter, GlProgram } from "pixi.js";

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uRadius;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 finalColor;

void main(void) {
    vec4 src = texture(uTexture, vTextureCoord);
    vec2 px = max(uRadius, 0.5) / uInputSize.xy;
    float acc = src.a;
    acc += texture(uTexture, vTextureCoord + vec2(-px.x, 0.0)).a;
    acc += texture(uTexture, vTextureCoord + vec2(px.x, 0.0)).a;
    acc += texture(uTexture, vTextureCoord + vec2(0.0, -px.y)).a;
    acc += texture(uTexture, vTextureCoord + vec2(0.0, px.y)).a;
    acc += texture(uTexture, vTextureCoord + vec2(-px.x, -px.y)).a;
    acc += texture(uTexture, vTextureCoord + vec2(px.x, -px.y)).a;
    acc += texture(uTexture, vTextureCoord + vec2(-px.x, px.y)).a;
    acc += texture(uTexture, vTextureCoord + vec2(px.x, px.y)).a;
    float blurred = acc / 9.0;
    float inner = src.a * (1.0 - blurred);
    float mixAmt = clamp(inner * uOpacity * 6.0, 0.0, 1.0);
    vec3 rgb = mix(src.rgb, uColor, mixAmt);
    // Keep source alpha so padding does not inflate the visible silhouette.
    finalColor = vec4(rgb, src.a);
}
`;

function hexToRgb(color: string): [number, number, number] {
  const hex = /^#([\da-f]{6})$/i.exec(color);
  if (!hex) return [1, 1, 1];
  const value = Number.parseInt(hex[1]!, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export function createInnerGlowFilter(opts: {
  radius: number;
  color: string;
  opacity: number;
}): Filter {
  const padding = Math.max(0, Math.ceil(opts.radius));
  const filter = new Filter({
    glProgram: new GlProgram({ vertex, fragment }),
    padding,
    resources: {
      innerGlowUniforms: {
        uRadius: { value: opts.radius, type: "f32" },
        uColor: { value: hexToRgb(opts.color), type: "vec3<f32>" },
        uOpacity: { value: opts.opacity, type: "f32" },
      },
    },
  });
  // Flush-fill rectangles need outside-alpha samples. Padding expands the
  // filter input; the shader still writes src.a so bounds do not grow.
  filter.padding = padding;
  return filter;
}
