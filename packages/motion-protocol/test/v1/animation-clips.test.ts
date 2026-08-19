import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { isLayerPropertyAnimatable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 800, height: 120 });

function projectWith(opts: {
  animations?: unknown[];
  extraLayer?: Record<string, unknown>;
}) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "anim", name: "Anim", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    assets: [],
    layers: [
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 4 },
        ...ATOMS,
        payload: {
          text: "Hello",
          fontSize: 48,
          color: "#111111",
          alignment: "left",
          wrap: "word",
          overflow: "clip",
        },
        ...(opts.animations ? { animations: opts.animations } : {}),
      },
      ...(opts.extraLayer ? [opts.extraLayer] : []),
    ],
  };
}

describe("V1 layer.animations", () => {
  it("parses a translate animation with local t", () => {
    const project = parseMotionProjectV1(
      projectWith({
        animations: [
          {
            property: "transform.translate.x",
            keys: [
              { t: 0, value: 0 },
              { t: 1, value: 80 },
            ],
          },
        ],
      }),
    );
    const layer = project.layers[0];
    expect(layer && "animations" in layer ? layer.animations : []).toHaveLength(
      1,
    );
    expect(
      layer && "animations" in layer ? layer.animations?.[0]?.property : undefined,
    ).toBe("transform.translate.x");
  });

  it("parses a project with no timeline field", () => {
    const project = parseMotionProjectV1(projectWith({}));
    expect(project).not.toHaveProperty("timeline");
  });

  it("rejects leftover timeline", () => {
    expect(() =>
      parseMotionProjectV1({
        ...projectWith({}),
        timeline: { duration: 4 },
      }),
    ).toThrow(/timeline/);
  });

  it("rejects keyframe t beyond layer duration", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWith({
          animations: [
            {
              property: "opacity",
              keys: [{ t: 5, value: 100 }],
            },
          ],
        }),
      ),
    ).toThrow(/exceeds layer duration/);
  });

  it("rejects animations on audio layers", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWith({
          extraLayer: {
            id: "bgm",
            type: "audio",
            parentLayerId: null,
            zIndex: -1,
            timing: { start: 0, duration: 4 },
            payload: { assetId: "a" },
            animations: [
              {
                id: "vol",
                property: "payload.volume",
                keys: [{ t: 0, value: 100 }],
              },
            ],
          },
        }),
      ),
    ).toThrow();
  });

  it("rejects frame, trim, and unsorted keys", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWith({
          animations: [
            {
              property: "frame.width",
              keys: [{ t: 0, value: 100 }],
            },
          ],
        }),
      ),
    ).toThrow(/not animatable/);

    expect(() =>
      parseMotionProjectV1(
        projectWith({
          animations: [
            {
              property: "opacity",
              keys: [
                { t: 2, value: 100 },
                { t: 0, value: 0 },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/sorted/);
  });

  it("locks the animatable allowlist and rejects interpolation field", () => {
    expect(isLayerPropertyAnimatable("text", "transform.translate.x")).toBe(
      true,
    );
    expect(isLayerPropertyAnimatable("text", "frame.width")).toBe(false);
    expect(isLayerPropertyAnimatable("video", "payload.trimStart")).toBe(false);
    expect(isLayerPropertyAnimatable("image", "payload.fit")).toBe(false);
    expect(isLayerPropertyAnimatable("svg", "style.fill")).toBe(true);
    expect(isLayerPropertyAnimatable("text", "payload.color")).toBe(true);
    expect(isLayerPropertyAnimatable("text", "style.fill")).toBe(false);
    expect(isLayerPropertyAnimatable("shape", "style.fill")).toBe(true);

    expect(() =>
      parseMotionProjectV1(
        projectWith({
          animations: [
            {
              id: "bad_interp",
              property: "payload.color",
              keys: [
                { t: 0, value: "#000000" },
                { t: 1, value: "#ffffff" },
              ],
              interpolation: "linear",
            },
          ],
        }),
      ),
    ).toThrow(/interpolation/);
  });
});
