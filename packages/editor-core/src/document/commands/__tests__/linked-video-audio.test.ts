import { describe, expect, it } from "vitest";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { applyEditorCommand } from "../apply";

const TRANSFORM = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

function fixture(): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: "linked-video-audio",
    composition: {
      width: 320,
      height: 180,
      fps: 30,
      background: "#000000",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [
      {
        id: "video-source",
        kind: "video",
        uri: "/video.mp4",
        mimeType: "video/mp4",
        duration: 20,
        fps: 30,
        audio: { uri: "/video-audio.m4a", mimeType: "audio/mp4", duration: 20, sampleRate: 48000, channels: 2 },
      },
    ],
    layers: [
      {
        id: "video-layer",
        type: "video",
        parentLayerId: null,
        order: 0,
        frame: { width: 320, height: 180 },
        transform: TRANSFORM,
        opacity: 1,
        timing: { start: 5, duration: 4 },
        payload: {
          assetId: "video-source",
          trimStart: 2,
          trimEnd: 6,
          audio: {
            enabled: true,
            gainDb: -6,
            pan: 0,
            fadeIn: { duration: 0.25, curve: "linear" },
            fadeOut: { duration: 0.5, curve: "equal-power" },
          },
        },
      },
    ],
    audio: { sampleRate: 48000, tracks: [] },
  };
}

describe("linked video audio commands", () => {
  it("updates embedded audio without creating an audio lane", () => {
    const project = fixture();
    const result = applyEditorCommand(project, {
      type: "set-embedded-video-audio",
      layerId: "video-layer",
      audio: { enabled: false, gainDb: -12 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers[0]).toMatchObject({
      type: "video",
      payload: { audio: { enabled: false, gainDb: -12 } },
    });
    expect(result.document.audio.tracks).toHaveLength(0);

    const undone = applyEditorCommand(result.document, result.inverse);
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.document).toEqual(project);
  });

  it("detaches audio with inherited timing and one-document undo", () => {
    const project = fixture();
    const result = applyEditorCommand(project, {
      type: "detach-video-audio",
      layerId: "video-layer",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers[0]).toMatchObject({
      type: "video",
      payload: { assetId: "video-source" },
    });
    const track = result.document.audio.tracks[0]!;
    expect(track).toMatchObject({ id: "audio-detached:video-layer", muted: false });
    expect(track.clips[0]).toMatchObject({
      id: "audio-detached:video-layer:clip",
      assetId: "video-source",
      timing: { start: 5, duration: 4 },
      trim: { start: 2, end: 6 },
      playbackRate: 1,
      gainDb: -6,
      pan: 0,
      fadeIn: { duration: 0.25, curve: "linear" },
      fadeOut: { duration: 0.5, curve: "equal-power" },
    });

    const undone = applyEditorCommand(result.document, result.inverse);
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.document).toEqual(project);
  });

  it("extracts a derivative asset and reuses an existing asset on retry", () => {
    const project = fixture();
    const audioAsset = {
      id: "video-source-audio",
      kind: "audio" as const,
      uri: "/video-audio.m4a",
      mimeType: "audio/mp4",
      duration: 20,
      sampleRate: 48000,
      channels: 2,
    };
    const first = applyEditorCommand(project, {
      type: "extract-video-audio",
      layerId: "video-layer",
      audioAsset,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.document.assets.filter((asset) => asset.id === audioAsset.id)).toHaveLength(1);
    expect(first.document.audio.tracks[0]?.clips[0]?.assetId).toBe(audioAsset.id);

    const second = applyEditorCommand(
      { ...project, assets: [...project.assets, audioAsset] },
      { type: "extract-video-audio", layerId: "video-layer", audioAsset },
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.document.assets.filter((asset) => asset.id === audioAsset.id)).toHaveLength(1);
    }
  });

  it("rejects detaching when the video has no embedded audio", () => {
    const project = fixture();
    const layer = project.layers[0]!;
    if (layer.type === "video") delete layer.payload.audio;
    const result = applyEditorCommand(project, {
      type: "detach-video-audio",
      layerId: "video-layer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe("command_invalid");
  });
});
