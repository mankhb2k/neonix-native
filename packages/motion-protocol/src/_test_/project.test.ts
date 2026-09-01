import { describe, expect, it } from "vitest";
import { V2EmbeddedVideoAudioSchema } from "../v2/audio";
import { MotionProtocolV2Schema } from "../v2/project";

const RECTANGLE_PROJECT = {
  format: "motion-protocol",
  formatVersion: 2,
  id: "project-v2",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    colorSpace: "srgb",
    view: {
      projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  },
  assets: [],
  layers: [
    {
      type: "shape",
      id: "rectangle",
      parentLayerId: null,
      order: 0,
      frame: { width: 96, height: 64 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 1 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
  ],
  audio: {
    sampleRate: 48000,
    tracks: [],
  },
};

describe("Motion Protocol V2 schema", () => {
  it("accepts the strict rectangle protocol", () => {
    expect(MotionProtocolV2Schema.parse(RECTANGLE_PROJECT)).toEqual(
      RECTANGLE_PROJECT,
    );
  });

  it("accepts an explicit audio domain with trim, gain, pan, and fades", () => {
    const audio = {
      ...RECTANGLE_PROJECT,
      assets: [{
        id: "voice",
        kind: "audio" as const,
        uri: "/audio/voice.wav",
        mimeType: "audio/wav",
        duration: 4,
        sampleRate: 48000,
        channels: 2,
      }],
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          id: "voice-track",
          gainDb: 0,
          pan: -0.25,
          muted: false,
          clips: [{
            id: "voice-clip",
            assetId: "voice",
            timing: { start: 1, duration: 2 },
            trim: { start: 0.5, end: 2.5 },
            playbackRate: 1,
            enabled: true,
            gainDb: -3,
            pan: 0,
            fadeIn: { duration: 0.25, curve: "linear" as const },
            fadeOut: { duration: 0.25, curve: "equal-power" as const },
          }],
        }],
      },
    };
    expect(MotionProtocolV2Schema.parse(audio)).toEqual(audio);
  });

  it("rejects the removed audio loop field", () => {
    const project = {
      ...RECTANGLE_PROJECT,
      assets: [{
        id: "voice",
        kind: "audio" as const,
        uri: "/audio/voice.wav",
        mimeType: "audio/wav",
        duration: 4,
        sampleRate: 48000,
        channels: 2,
      }],
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          id: "voice-track",
          gainDb: 0,
          pan: 0,
          muted: false,
          clips: [{
            id: "voice-clip",
            assetId: "voice",
            timing: { start: 0, duration: 2 },
            trim: { start: 0, end: 2 },
            playbackRate: 1,
            gainDb: 0,
            loop: true,
          }],
        }],
      },
    };
    expect(() => MotionProtocolV2Schema.parse(project)).toThrow();
  });

  it("rejects an audio clip whose duration exceeds its explicit trim range", () => {
    const project = {
      ...RECTANGLE_PROJECT,
      assets: [{
        id: "voice",
        kind: "audio" as const,
        uri: "/audio/voice.wav",
        mimeType: "audio/wav",
        duration: 4,
        sampleRate: 48000,
        channels: 2,
      }],
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          id: "voice-track",
          gainDb: 0,
          pan: 0,
          muted: false,
          clips: [{
            id: "voice-clip",
            assetId: "voice",
            timing: { start: 0, duration: 3 },
            trim: { start: 0, end: 2 },
            playbackRate: 1,
            gainDb: 0,
          }],
        }],
      },
    };
    expect(() => MotionProtocolV2Schema.parse(project)).toThrow(/bounded trim range/);
  });

  it("normalizes omitted audio gain to unity in JSON", () => {
    const project = {
      ...RECTANGLE_PROJECT,
      assets: [{
        id: "voice",
        kind: "audio" as const,
        uri: "/audio/voice.wav",
        mimeType: "audio/wav",
        duration: 4,
        sampleRate: 48000,
        channels: 2,
      }],
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          id: "voice-track",
          pan: 0,
          muted: false,
          clips: [{
            id: "voice-clip",
            assetId: "voice",
            timing: { start: 0, duration: 4 },
            trim: { start: 0 },
            playbackRate: 1,
          }],
        }],
      },
    };

    const parsed = MotionProtocolV2Schema.parse(project);
    expect(parsed.audio.tracks[0]?.gainDb).toBe(0);
    expect(parsed.audio.tracks[0]?.clips[0]?.gainDb).toBe(0);
    expect(V2EmbeddedVideoAudioSchema.parse({ enabled: true })).toEqual({
      enabled: true,
      gainDb: 0,
      pan: 0,
    });
  });

  it("accepts embedded video audio and keeps its timing fields inherited", () => {
    const video = {
      ...RECTANGLE_PROJECT,
      id: "video-with-audio-v2",
      assets: [{
        id: "clip",
        kind: "video" as const,
        uri: "/video/clip.mp4",
        mimeType: "video/mp4",
        duration: 8,
        fps: 30,
      }],
      layers: [{
        id: "video",
        type: "video" as const,
        parentLayerId: null,
        order: 0,
        frame: { width: 320, height: 180 },
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 1,
        timing: { start: 2, duration: 4 },
        payload: {
          assetId: "clip",
          trimStart: 1,
          trimEnd: 5,
          audio: {
            enabled: true,
            gainDb: -3,
            pan: 0,
            fadeIn: { duration: 0.25, curve: "linear" as const },
          },
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(video)).toEqual(video);
    expect(() => MotionProtocolV2Schema.parse({
      ...video,
      layers: [{
        ...video.layers[0],
        payload: {
          ...video.layers[0].payload,
          audio: {
            ...video.layers[0].payload.audio,
            fadeIn: { duration: 4.1, curve: "linear" as const },
          },
        },
      }],
    })).toThrow(/cannot exceed video duration/);
  });

  it("rejects invalid audio references and duplicate audio identities", () => {
    const audio = {
      ...RECTANGLE_PROJECT,
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          id: "track",
          gainDb: 0,
          pan: 0,
          muted: false,
          clips: [{
            id: "clip",
            assetId: "missing",
            timing: { start: 0, duration: 1 },
            trim: { start: 0 },
            playbackRate: 1,
            gainDb: 0,
          }],
        }],
      },
    };
    expect(() => MotionProtocolV2Schema.parse(audio)).toThrow(/Unknown audio asset/);
    expect(() => MotionProtocolV2Schema.parse({
      ...audio,
      assets: [{
        id: "image",
        kind: "image" as const,
        uri: "/image.png",
        mimeType: "image/png",
      }],
      audio: {
        sampleRate: 48000 as const,
        tracks: [{
          ...audio.audio.tracks[0],
          clips: [{ ...audio.audio.tracks[0].clips[0], assetId: "image" }],
        }],
      },
    })).toThrow(/audio or video asset/);
    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      audio: {
        sampleRate: 48000 as const,
        tracks: [
          { id: "track", gainDb: 0, pan: 0, muted: false, clips: [] },
          { id: "track", gainDb: 0, pan: 0, muted: false, clips: [] },
        ],
      },
    })).toThrow(/Duplicate audio track id/);
  });

  it("rejects the legacy composition audioSampleRate location", () => {
    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      composition: {
        ...RECTANGLE_PROJECT.composition,
        audioSampleRate: 48000,
      },
    })).toThrow(/audioSampleRate/);
  });

  it("normalizes omitted layer opacity to one and rejects the legacy percent range", () => {
    const withoutOpacity = {
      ...RECTANGLE_PROJECT,
      layers: [(({ opacity: _opacity, ...layer }) => layer)(RECTANGLE_PROJECT.layers[0])],
    };
    expect(MotionProtocolV2Schema.parse(withoutOpacity).layers[0]).toMatchObject({ opacity: 1 });
    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [{ ...RECTANGLE_PROJECT.layers[0], opacity: 100 }],
    })).toThrow();
  });

  it("accepts ellipse as the second supported shape primitive", () => {
    const ellipse = {
      ...RECTANGLE_PROJECT,
      id: "ellipse-project-v2",
      layers: [
        {
          ...RECTANGLE_PROJECT.layers[0],
          id: "ellipse",
          payload: { shape: "ellipse" },
        },
      ],
    };
    expect(MotionProtocolV2Schema.parse(ellipse)).toEqual(ellipse);
  });

  it("accepts ordered color-adjust effects only on drawable leaves", () => {
    const withEffect = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{
          id: "grade",
          type: "color-adjust" as const,
          brightness: -0.1,
          contrast: 1.2,
          saturation: 0.5,
          hueRotate: 30,
        }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(withEffect)).toEqual(withEffect);
    expect(() => MotionProtocolV2Schema.parse({
      ...withEffect,
      layers: [{
        ...withEffect.layers[0],
        effects: [{ ...withEffect.layers[0].effects[0], brightness: 2 }],
      }],
    })).toThrow();
    expect(() => MotionProtocolV2Schema.parse({
      ...withEffect,
      layers: [{
        ...withEffect.layers[0],
        effects: [
          withEffect.layers[0].effects[0],
          { ...withEffect.layers[0].effects[0] },
        ],
      }],
    })).toThrow(/Duplicate effect id/);
  });

  it("accepts blur with a positive bounded radius", () => {
    const blur = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{ id: "soften", type: "blur" as const, radius: 18 }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(blur)).toEqual(blur);
    expect(() => MotionProtocolV2Schema.parse({
      ...blur,
      layers: [{ ...blur.layers[0], effects: [{ id: "soften", type: "blur", radius: 0 }] }],
    })).toThrow();
  });

  it("accepts ordered box and alpha shadows with CSS spread/inset semantics", () => {
    const shadow = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{
          id: "box-shadow",
          type: "shadow" as const,
          source: "box" as const,
          offset: { x: 18, y: 20 },
          blur: 24,
          spread: 4,
          color: "#ff336640",
          inset: false,
        }, {
          id: "drop-shadow",
          type: "shadow" as const,
          source: "alpha" as const,
          offset: { x: 4, y: 8 },
          blur: 12,
          spread: 0,
          color: "#00000080",
          inset: false,
        }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(shadow)).toEqual(shadow);
    expect(MotionProtocolV2Schema.parse({
      ...shadow,
      layers: [{
        ...shadow.layers[0],
        tracks: [
          {
            id: "shadow-offset-x",
            path: "effects.box-shadow.offset.x",
            keyframes: [{ time: 0, value: { type: "number" as const, value: 18 } }],
          },
          {
            id: "shadow-spread",
            path: "effects.box-shadow.spread",
            keyframes: [{ time: 0, value: { type: "number" as const, value: 4 } }],
          },
          {
            id: "shadow-inset",
            path: "effects.box-shadow.inset",
            keyframes: [{ time: 0, value: { type: "boolean" as const, value: true } }],
          },
        ],
      }],
    }).layers[0]?.tracks).toHaveLength(3);
    expect(() => MotionProtocolV2Schema.parse({
      ...shadow,
      layers: [{ ...shadow.layers[0], effects: [{ ...shadow.layers[0].effects[0], blur: -1 }] }],
    })).toThrow(/Number must be greater than or equal to 0/);
    expect(() => MotionProtocolV2Schema.parse({
      ...shadow,
      layers: [{
        ...shadow.layers[0],
        effects: [{ ...shadow.layers[0].effects[1], spread: 4 }],
      }],
    })).toThrow(/expected 0/);
    expect(() => MotionProtocolV2Schema.parse({
      ...shadow,
      layers: [{
        ...shadow.layers[0],
        effects: [{ ...shadow.layers[0].effects[1], inset: true }],
      }],
    })).toThrow(/expected false/);
  });

  it("accepts a bounded outer glow without offset or spread", () => {
    const glow = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{
          id: "glow",
          type: "outer-glow" as const,
          radius: 24,
          color: "#00e5ff",
          opacity: 0.7,
        }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(glow)).toEqual(glow);
    expect(() => MotionProtocolV2Schema.parse({
      ...glow,
      layers: [{ ...glow.layers[0], effects: [{ ...glow.layers[0].effects[0], radius: 0 }] }],
    })).toThrow();
    expect(() => MotionProtocolV2Schema.parse({
      ...glow,
      layers: [{ ...glow.layers[0], effects: [{ ...glow.layers[0].effects[0], x: 8 }] }],
    })).toThrow();
  });

  it("accepts a bounded inner glow without offset or spread", () => {
    const glow = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{
          id: "glow",
          type: "inner-glow" as const,
          radius: 24,
          color: "#00e5ff",
          opacity: 0.7,
        }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(glow)).toEqual(glow);
    expect(() => MotionProtocolV2Schema.parse({
      ...glow,
      layers: [{ ...glow.layers[0], effects: [{ ...glow.layers[0].effects[0], spread: 1 }] }],
    })).toThrow();
  });

  it("accepts deterministic noise with bounded controls", () => {
    const noise = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{ id: "grain", type: "noise" as const, scale: 4, amount: 0.45, opacity: 0.85, seed: 1337 }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(noise)).toEqual(noise);
    expect(() => MotionProtocolV2Schema.parse({
      ...noise,
      layers: [{ ...noise.layers[0], effects: [{ ...noise.layers[0].effects[0], scale: 0 }] }],
    })).toThrow();
    expect(() => MotionProtocolV2Schema.parse({
      ...noise,
      layers: [{ ...noise.layers[0], effects: [{ ...noise.layers[0].effects[0], seed: 1.5 }] }],
    })).toThrow();
  });

  it("accepts an open stroke-only path with join, cap, and dash semantics", () => {
    const path = {
      ...RECTANGLE_PROJECT,
      id: "open-path-project-v2",
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        id: "open-path",
        type: "path" as const,
        frame: { width: 160, height: 40 },
        payload: {
          contours: [{
            id: "line",
            start: { x: 0, y: 20 },
            segments: [{ kind: "line" as const, to: { x: 160, y: 20 } }],
            closed: false,
          }],
          fillRule: "nonzero" as const,
        },
        style: {
          stroke: "#ff3366",
          strokeWidth: 8,
          strokeJoin: "round" as const,
          strokeCap: "round" as const,
          strokeDash: { array: [12, 6], offset: 2 },
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(path)).toEqual(path);
  });

  it("accepts SVG marker definitions and validates marker references", () => {
    const marker = {
      id: "arrow",
      markerUnits: "userSpaceOnUse" as const,
      refX: 8,
      refY: 5,
      markerWidth: 10,
      markerHeight: 10,
      orient: "auto" as const,
      content: {
        contours: [{
          id: "arrow-head",
          start: { x: 0, y: 0 },
          segments: [
            { kind: "line" as const, to: { x: 10, y: 5 } },
            { kind: "line" as const, to: { x: 0, y: 10 } },
          ],
          closed: false,
        }],
        fill: "#ff3366",
      },
    };
    const path = {
      ...RECTANGLE_PROJECT,
      id: "marker-project-v2",
      markers: [marker],
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        type: "path" as const,
        id: "marker-path",
        payload: {
          contours: [{ id: "line", start: { x: 0, y: 20 }, segments: [{ kind: "line" as const, to: { x: 160, y: 20 } }], closed: false }],
          fillRule: "nonzero" as const,
        },
        style: { stroke: "#00aa88", strokeWidth: 8, markerEnd: "arrow" },
      }],
    };
    expect(MotionProtocolV2Schema.parse(path)).toEqual(path);
    expect(() => MotionProtocolV2Schema.parse({ ...path, layers: [{ ...path.layers[0], style: { ...path.layers[0].style, markerEnd: "missing" } }] })).toThrow(/Unknown marker reference/);
  });

  it("accepts an image asset reference with SVG viewport semantics", () => {
    const image = {
      ...RECTANGLE_PROJECT,
      id: "image-project-v2",
      assets: [{
        id: "photo",
        kind: "image" as const,
        uri: "/docs/preview-image.svg",
        mimeType: "image/svg+xml",
        width: 200,
        height: 100,
      }],
      layers: [{
        id: "image",
        type: "image" as const,
        parentLayerId: null,
        order: 0,
        frame: { width: 320, height: 240 },
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 1,
        timing: { start: 0, duration: 1 },
        payload: {
          assetId: "photo",
          x: 10,
          y: 20,
          width: 320,
          height: 240,
          preserveAspectRatio: { align: "xMidYMid" as const, meetOrSlice: "slice" as const },
          imageRendering: "optimizeQuality" as const,
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(image)).toEqual(image);
    expect(() => MotionProtocolV2Schema.parse({
      ...image,
      layers: [{ ...image.layers[0], payload: { assetId: "photo", width: 0 } }],
    })).toThrow();
  });

  it("accepts a video asset with trim, mute, and frame policy", () => {
    const video = {
      ...RECTANGLE_PROJECT,
      id: "video-project-v2",
      assets: [{
        id: "clip",
        kind: "video" as const,
        uri: "/docs/example-video.mp4",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 60.5,
        fps: 30,
      }],
      layers: [{
        id: "video",
        type: "video" as const,
        parentLayerId: null,
        order: 0,
        frame: { width: 960, height: 540 },
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 1,
        timing: { start: 0, duration: 3 },
        payload: {
          assetId: "clip",
          fit: "cover" as const,
          trimStart: 1,
          trimEnd: 4,
          audio: { enabled: false, gainDb: 0, pan: 0 },
          framePolicy: "floor" as const,
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(video)).toEqual(video);
    expect(() => MotionProtocolV2Schema.parse({
      ...video,
      layers: [{ ...video.layers[0], payload: { ...video.layers[0].payload, trimStart: 4, trimEnd: 1 } }],
    })).toThrow(/trimEnd must be greater/);
    expect(() => MotionProtocolV2Schema.parse({
      ...video,
      layers: [{ ...video.layers[0], payload: { ...video.layers[0].payload, trimEnd: 61 } }],
    })).toThrow(/trimEnd cannot exceed source duration/);
    expect(() => MotionProtocolV2Schema.parse({
      ...video,
      layers: [{ ...video.layers[0], timing: { start: 0, duration: 4 } }],
    })).toThrow(/selected source range/);
  });

  it("accepts shaped glyph runs and validates every selected font asset", () => {
    const text = {
      ...RECTANGLE_PROJECT,
      id: "text-project-v2",
      assets: [{
        id: "roboto-regular",
        kind: "font" as const,
        uri: "/fonts/Roboto-Regular.ttf",
        mimeType: "font/ttf" as const,
        family: "Roboto",
        weight: 400,
        style: "normal" as const,
        integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
      }],
      layers: [{
        id: "headline",
        type: "text" as const,
        parentLayerId: null,
        order: 0,
        frame: { width: 320, height: 100 },
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 1,
        timing: { start: 0, duration: 1 },
        payload: {
          source: { text: "NeonVideo", language: "en" },
          layout: {
            lines: [{ id: "headline-line", baselineY: 56, runIds: ["headline-run"] }],
            runs: [{
              id: "headline-run",
              font: { assetId: "roboto-regular", size: 48, variations: { wght: 700 } },
              fill: "#ffffff",
              glyphs: [
                { glyphId: 49, x: 64, y: 56, advance: { x: 30, y: 0 }, cluster: 0 },
                { glyphId: 72, x: 94, y: 56, advance: { x: 24, y: 0 }, cluster: 1 },
              ],
            }],
          },
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(text)).toEqual(text);
    expect(MotionProtocolV2Schema.parse({
      ...text,
      layers: [{
        ...text.layers[0],
        tracks: [
          {
            id: "headline-color",
            path: "payload.layout.runs.headline-run.fill",
            keyframes: [{ time: 0, value: { type: "color" as const, value: [1, 1, 1, 1] as const } }],
          },
          {
            id: "headline-size",
            path: "payload.layout.runs.headline-run.font.size",
            keyframes: [{ time: 0, value: { type: "number" as const, value: 48 } }],
          },
        ],
      }],
    }).layers[0]?.tracks).toHaveLength(2);
    expect(() => MotionProtocolV2Schema.parse({
      ...text,
      layers: [{
        ...text.layers[0],
        payload: {
          ...text.layers[0].payload,
          layout: {
            ...text.layers[0].payload.layout,
            runs: [{
              ...text.layers[0].payload.layout.runs[0],
              font: { ...text.layers[0].payload.layout.runs[0].font, assetId: "missing" },
            }],
          },
        },
      }],
    })).toThrow(/Unknown font asset/);
    expect(() => MotionProtocolV2Schema.parse({
      ...text,
      assets: [{ ...text.assets[0], kind: "image" as const, width: 10, height: 10 }],
    })).toThrow(/Text glyph run must reference a font asset/);
  });

  it("requires one explicit view projection with complete parameters", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: undefined,
        },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: {
            ...RECTANGLE_PROJECT.composition.view,
            projection: { kind: "orthographic", zoom: 1, near: 1 },
          },
        },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: {
            ...RECTANGLE_PROJECT.composition.view,
            projection: { kind: "perspective", fov: 60, near: 4, far: 1 },
          },
        },
      }),
    ).toThrow(/far must be greater/);
  });

  it("rejects V1 and high-level fields at the protocol boundary", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        formatVersion: 1,
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        bone: { id: "legacy" },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [{ ...RECTANGLE_PROJECT.layers[0], depth: 100 }],
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            matrix4: Array.from({ length: 16 }, () => 0),
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            transform: {
              ...RECTANGLE_PROJECT.layers[0].transform,
              origin: { x: 0.5, y: 0.5 },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts group parents and rejects invalid hierarchy", () => {
    const group = {
      id: "group",
      type: "group" as const,
      parentLayerId: null,
      order: 0,
      frame: RECTANGLE_PROJECT.layers[0].frame,
      transform: RECTANGLE_PROJECT.layers[0].transform,
      opacity: 1,
      timing: RECTANGLE_PROJECT.layers[0].timing,
    };
    const child = {
      ...RECTANGLE_PROJECT.layers[0],
      id: "child",
      parentLayerId: "group",
      order: 1,
    };
    expect(MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [group, child],
    }).layers).toHaveLength(2);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [{ ...RECTANGLE_PROJECT.layers[0], parentLayerId: "missing" }],
    })).toThrow(/Unknown parent layer/);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [
        { ...group, parentLayerId: "child" },
        child,
      ],
    })).toThrow(/cycle/);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [
        { ...RECTANGLE_PROJECT.layers[0], id: "parent", type: "shape" as const },
        { ...RECTANGLE_PROJECT.layers[0], id: "child", parentLayerId: "parent", order: 1 },
      ],
    })).toThrow(/Only group layers/);
  });

  it("rejects duplicate ids and duplicate sibling orders", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          RECTANGLE_PROJECT.layers[0],
          { ...RECTANGLE_PROJECT.layers[0], order: 1 },
        ],
      }),
    ).toThrow(/Duplicate layer id/);

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          RECTANGLE_PROJECT.layers[0],
          { ...RECTANGLE_PROJECT.layers[0], id: "second", order: 0 },
        ],
      }),
    ).toThrow(/Duplicate order/);

    const group = {
      id: "order-group",
      type: "group" as const,
      parentLayerId: null,
      order: 1,
      frame: RECTANGLE_PROJECT.layers[0].frame,
      transform: RECTANGLE_PROJECT.layers[0].transform,
      opacity: 1,
      timing: RECTANGLE_PROJECT.layers[0].timing,
    };
    const child = {
      ...RECTANGLE_PROJECT.layers[0],
      id: "order-child",
      parentLayerId: "order-group",
      order: 0,
    };
    expect(MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [RECTANGLE_PROJECT.layers[0], group, child],
    }).layers).toHaveLength(3);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [
        RECTANGLE_PROJECT.layers[0],
        group,
        child,
        { ...child, id: "order-child-duplicate" },
      ],
    })).toThrow(/Duplicate order/);

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            transform: {
              ...RECTANGLE_PROJECT.layers[0].transform,
              anchor: { x: Number.NaN, y: 0, z: 0 },
            },
          },
        ],
      }),
    ).toThrow();
  });

});
