import { describe, expect, it } from "vitest";
import { createEditorRuntimeSession } from "../src";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";

const document = MotionProtocolV2Schema.parse({
  format: "motion-protocol",
  formatVersion: 2,
  id: "editor-runtime-test",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    colorSpace: "srgb",
    view: {
      projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
      transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
    },
  },
  assets: [],
  layers: [],
  audio: { sampleRate: 48000, tracks: [] },
});

describe("editor runtime session", () => {
  it("compiles one project per document identity and evaluates from that cache", () => {
    const session = createEditorRuntimeSession();
    const first = session.load(document);
    expect(session.load(document)).toBe(first);
    expect(session.generation()).toBe(1);
    expect(session.evaluate(0)).toBeDefined();
    const next = session.update({ ...document, id: "editor-runtime-test-2" });
    expect(next).not.toBe(first);
    expect(session.generation()).toBe(2);
    session.dispose();
  });

  it("evaluates a transient preview without replacing canonical runtime state", () => {
    const session = createEditorRuntimeSession();
    const canonical = session.load(document);
    const preview = session.preview({ ...document, id: "editor-runtime-preview" });

    expect(preview).not.toBe(canonical);
    expect(session.current()).toBe(canonical);
    expect(session.generation()).toBe(1);
    expect(session.evaluate(0, preview)).toBeDefined();

    session.dispose();
  });
});
