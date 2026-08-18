import { describe, expect, it } from "vitest";
import { parseOverlayScenes } from "../overlay-scenes";

describe("parseOverlayScenes (legacy)", () => {
  it("parses valid legacy overlay items", () => {
    const items = parseOverlayScenes([
      {
        id: "ov1",
        name: "Overlay A",
        duration: 3,
        startTime: 1,
        layerIndex: 0,
      },
      {
        id: "ov2",
        name: "Overlay B",
        duration: 2,
        startTime: 4,
        layerIndex: 1,
      },
    ]);
    expect(items).toEqual([
      {
        id: "ov1",
        name: "Overlay A",
        duration: 3,
        startTime: 1,
        layerIndex: 0,
      },
      {
        id: "ov2",
        name: "Overlay B",
        duration: 2,
        startTime: 4,
        layerIndex: 1,
      },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(parseOverlayScenes(null)).toEqual([]);
    expect(parseOverlayScenes(undefined)).toEqual([]);
    expect(parseOverlayScenes({})).toEqual([]);
  });

  it("drops malformed rows instead of throwing", () => {
    const items = parseOverlayScenes([
      { id: "ok", name: "Valid", duration: 2, startTime: 0, layerIndex: 0 },
      { id: "bad", name: "Missing duration" },
      "not-an-object",
      null,
      { id: 42, name: "Bad id", duration: 1, startTime: 0, layerIndex: 0 },
    ]);
    expect(items).toEqual([
      { id: "ok", name: "Valid", duration: 2, startTime: 0, layerIndex: 0 },
    ]);
  });
});
