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
uniform float uAmount;
uniform float uScale;
uniform float uOpacity;
uniform float uSeed;
out vec4 finalColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
}

void main(void) {
    vec4 src = texture(uTexture, vTextureCoord);
    float n = hash(floor(vTextureCoord * 240.0 / max(uScale, 0.25)));
    float grain = (n - 0.5) * (uAmount / 50.0);
    vec3 rgb = src.rgb + grain * uOpacity;
    finalColor = vec4(rgb, src.a);
}
`;

export function createNoiseFilter(opts: {
  amount: number;
  scale: number;
  opacity: number;
  seed: number;
}): Filter {
  return new Filter({
    glProgram: new GlProgram({ vertex, fragment }),
    resources: {
      noiseUniforms: {
        uAmount: { value: opts.amount, type: "f32" },
        uScale: { value: opts.scale, type: "f32" },
        uOpacity: { value: opts.opacity, type: "f32" },
        uSeed: { value: opts.seed, type: "f32" },
      },
    },
  });
}
