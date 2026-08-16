import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { isLayerPropertyAnimatable } from "../../src/capabilities";

const ATOMS = visualLayerAtoms({ width: 800, height: 120 });

function projectWith(opts: {
  clips?: unknown[];
  extraLayer?: Record<string, unknown>;
}) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "anim", name: "Anim", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    dependencies: { compiler: { range: ">=1.0.0" } },
    assets: [],
    variables: [],
    timeline: { duration: 4, clips: opts.clips ?? [] },
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
      },
      ...(opts.extraLayer ? [opts.extraLayer] : []),
    ],
  };
}

describe("V1 timeline.clips", () => {
  it("parses a translate clip with local t", () => {
    const project = parseMotionProjectV1(
      projectWith({
        clips: [
          {
            id: "slide_x",
            layerId: "title",
            property: "transform.translate.x",
            kind: "keyframes",
            keys: [
              { t: 0, value: 0 },
              { t: 1, value: 80 },
            ],
          },
        ],
      }),
    );
    expect(project.timeline.clips).toHaveLength(1);
    expect(project.timeline.clips?.[0]?.property).toBe("transform.translate.x");
  });

  it("rejects frame, trim, and unsorted keys", () => {
    expect(() =>
      parseMotionProjectV1(
        projectWith({
          clips: [
            {
              id: "grow",
              layerId: "title",
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
          clips: [
            {
              id: "late",
              layerId: "title",
              property: "appearance.opacity",
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
          clips: [
            {
              id: "bad_interp",
              layerId: "title",
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
