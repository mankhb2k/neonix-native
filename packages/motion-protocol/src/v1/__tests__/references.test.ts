/**
 * V1 reference validation — component props, bindings, layer-local keyframes.
 */
import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../parse";
import { MotionV1ReferenceError } from "../references/types";

const TRANSFORM = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

function textLayer(
  id: string,
  parentLayerId: string | null = null,
  zIndex = 0,
) {
  return {
    id,
    type: "text",
    parentLayerId,
    zIndex,
    transform: TRANSFORM,
    payload: {
      content: { kind: "plain", text: "Label" },
      fontSize: 24,
      color: "#111111",
      alignment: "center",
    },
  };
}

function baseProject(overrides: Record<string, unknown> = {}) {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "refs-test", name: "Refs Test", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [
      {
        id: "cta-label",
        name: "CTA Label",
        type: "string",
        value: "Shop now",
      },
    ],
    assets: [],
    components: [
      {
        id: "child-btn",
        version: "1.0.0",
        integrity: "sha256:child-btn",
        props: [
          {
            id: "label",
            name: "Label",
            kind: "text",
            default: "Click",
          },
        ],
        variants: [],
        propBindings: [
          {
            propId: "label",
            target: {
              kind: "layerProperty",
              layerId: "child-label",
              property: "payload.content.text",
            },
          },
        ],
        variables: [],
        layers: [textLayer("child-label")],
      },
      {
        id: "parent-card",
        version: "1.0.0",
        integrity: "sha256:parent-card",
        props: [
          {
            id: "title",
            name: "Title",
            kind: "text",
            default: "Card",
          },
          {
            id: "fade",
            name: "Fade",
            kind: "number",
            default: 1,
            animatable: true,
          },
        ],
        variants: [],
        propBindings: [
          {
            propId: "title",
            target: {
              kind: "childProp",
              childLayerId: "nested-btn",
              propId: "label",
            },
          },
        ],
        variables: [],
        layers: [
          {
            id: "nested-btn",
            type: "component",
            parentLayerId: null,
            zIndex: 0,
            transform: TRANSFORM,
            payload: { componentId: "child-btn" },
          },
        ],
      },
    ],
    layers: [
      {
        id: "card-instance",
        type: "component",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        transform: TRANSFORM,
        payload: {
          componentId: "parent-card",
          props: { title: "Welcome" },
        },
      },
    ],
    timeline: { duration: 8 },
    bindings: [],
    ...overrides,
  };
}

describe("V1 component / binding / keyframe references", () => {
  it("accepts nested childProp wiring and project componentLayer binding", () => {
    const project = parseMotionProjectV1(
      baseProject({
        bindings: [
          {
            id: "bind-title",
            source: { kind: "variable", variableId: "cta-label" },
            target: {
              type: "componentLayer",
              layerId: "card-instance",
              propId: "title",
            },
          },
        ],
      }),
    );
    expect(project.bindings[0]?.target).toEqual({
      type: "componentLayer",
      layerId: "card-instance",
      propId: "title",
    });
    expect(project.components[1]?.propBindings[0]?.target).toEqual({
      kind: "childProp",
      childLayerId: "nested-btn",
      propId: "label",
    });
  });

  it("accepts project binding target.type component for a declared component prop", () => {
    const project = parseMotionProjectV1(
      baseProject({
        bindings: [
          {
            id: "bind-def",
            source: { kind: "variable", variableId: "cta-label" },
            target: {
              type: "component",
              componentId: "parent-card",
              propId: "title",
            },
          },
        ],
      }),
    );
    expect(project.bindings[0]?.target.type).toBe("component");
  });

  it("rejects prop keyframes whose t exceeds instance layer.timing.duration", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "card-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 2 },
              transform: TRANSFORM,
              payload: {
                componentId: "parent-card",
                props: {
                  fade: {
                    kind: "keyframes",
                    interpolation: "linear",
                    keys: [
                      { t: 0, value: 0 },
                      { t: 2.5, value: 1 },
                    ],
                  },
                },
              },
            },
          ],
        }),
      ),
    ).toThrow(MotionV1ReferenceError);

    try {
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "card-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 2 },
              transform: TRANSFORM,
              payload: {
                componentId: "parent-card",
                props: {
                  fade: {
                    kind: "keyframes",
                    interpolation: "linear",
                    keys: [
                      { t: 0, value: 0 },
                      { t: 2.5, value: 1 },
                    ],
                  },
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(MotionV1ReferenceError);
      const issues = (error as MotionV1ReferenceError).issues;
      expect(
        issues.some((issue) =>
          issue.message.includes("exceeds component layer duration 2"),
        ),
      ).toBe(true);
    }
  });

  it("accepts prop keyframes within instance layer.timing.duration", () => {
    const project = parseMotionProjectV1(
      baseProject({
        layers: [
          {
            id: "card-instance",
            type: "component",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 2 },
            transform: TRANSFORM,
            payload: {
              componentId: "parent-card",
              props: {
                fade: {
                  kind: "keyframes",
                  interpolation: "linear",
                  keys: [
                    { t: 0, value: 0 },
                    { t: 2, value: 1 },
                  ],
                },
              },
            },
          },
        ],
      }),
    );
    expect(project.layers[0]?.type).toBe("component");
  });

  it("rejects childProp pointing at a non-component layer", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          components: [
            {
              id: "broken-parent",
              version: "1.0.0",
              integrity: "sha256:broken",
              props: [
                {
                  id: "title",
                  name: "Title",
                  kind: "text",
                  default: "X",
                },
              ],
              variants: [],
              propBindings: [
                {
                  propId: "title",
                  target: {
                    kind: "childProp",
                    childLayerId: "not-a-component",
                    propId: "label",
                  },
                },
              ],
              variables: [],
              layers: [textLayer("not-a-component")],
            },
          ],
          layers: [
            {
              id: "broken-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              transform: TRANSFORM,
              payload: { componentId: "broken-parent" },
            },
          ],
        }),
      ),
    ).toThrow(/not a component layer/);
  });

  it("rejects stale scenes / visualTracks on authoring projects", () => {
    expect(() =>
      parseMotionProjectV1(baseProject({ scenes: [] })),
    ).toThrow();
    expect(() =>
      parseMotionProjectV1(
        baseProject({ timeline: { duration: 8, visualTracks: [] } }),
      ),
    ).toThrow();
  });
});
