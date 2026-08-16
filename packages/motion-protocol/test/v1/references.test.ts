/**
 * V1 reference validation — component props, bindings, layer-local keyframes.
 */
import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1/parse";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";
import { MotionV1ReferenceError } from "../../src/v1/references/types";

const ATOMS = visualLayerAtoms({ width: 100, height: 100 });

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
    timing: { start: 0, duration: 4 },
    ...ATOMS,
    payload: {
      text: "Label" ,
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
            kind: "string",
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
              property: "payload.text",
            },
          },
        ],
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
            kind: "string",
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
        layers: [
          {
            id: "nested-btn",
            type: "component",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 4 },
            ...ATOMS,
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
        ...ATOMS,
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
  it("accepts nested childProp wiring and project prop binding", () => {
    const project = parseMotionProjectV1(
      baseProject({
        bindings: [
          {
            id: "bind-title",
            source: { kind: "variable", variableId: "cta-label" },
            target: {
              type: "prop",
              layerId: "card-instance",
              propId: "title",
            },
          },
        ],
      }),
    );
    expect(project.bindings[0]?.target).toEqual({
      type: "prop",
      layerId: "card-instance",
      propId: "title",
    });
    expect(project.components[1]?.propBindings[0]?.target).toEqual({
      kind: "childProp",
      childLayerId: "nested-btn",
      propId: "label",
    });
  });

  it("rejects project binding that is not type prop", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          bindings: [
            {
              id: "bind-def",
              source: { kind: "variable", variableId: "cta-label" },
              target: {
                type: "componentLayer",
                layerId: "card-instance",
                propId: "title",
              },
            },
          ],
        }),
      ),
    ).toThrow();
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
              ...ATOMS,
              payload: {
                componentId: "parent-card",
                props: {
                  fade: {
                    kind: "keyframes",
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
              ...ATOMS,
              payload: {
                componentId: "parent-card",
                props: {
                  fade: {
                    kind: "keyframes",
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
            ...ATOMS,
            payload: {
              componentId: "parent-card",
              props: {
                fade: {
                  kind: "keyframes",
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

  it("rejects inline variable refs on payload.props", () => {
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
              ...ATOMS,
              payload: {
                componentId: "parent-card",
                props: {
                  title: { ref: { kind: "variable", id: "cta-label" } },
                },
              },
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("rejects component.variables on a definition", () => {
    const child = baseProject().components[0] as Record<string, unknown>;
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          components: [
            {
              ...child,
              variables: [
                {
                  id: "internal",
                  name: "Internal",
                  type: "string",
                  value: "x",
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow();
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
                  kind: "string",
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
              ...ATOMS,
              payload: { componentId: "broken-parent" },
            },
          ],
        }),
      ),
    ).toThrow(/not a component layer/);
  });

  it("rejects propBinding that wires a string prop to a numeric layer property", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          components: [
            {
              id: "mismatch-card",
              version: "1.0.0",
              integrity: "sha256:mismatch",
              props: [
                {
                  id: "title",
                  name: "Title",
                  kind: "string",
                  default: "Hello",
                },
              ],
              variants: [],
              propBindings: [
                {
                  propId: "title",
                  target: {
                    kind: "layerProperty",
                    layerId: "label",
                    property: "transform.translate.x",
                  },
                },
              ],
              layers: [textLayer("label")],
            },
          ],
          layers: [
            {
              id: "mismatch-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              payload: { componentId: "mismatch-card" },
            },
          ],
        }),
      ),
    ).toThrow(/not a V1 string sink/);
  });

  it("rejects project binding to a layer field", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              ...textLayer("headline", null, 1),
              timing: { start: 0, duration: 2 },
            },
          ],
          bindings: [
            {
              id: "bind-bad-path",
              source: { kind: "variable", variableId: "cta-label" },
              target: {
                type: "layer",
                layerId: "headline",
                property: "payload.text",
              },
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("rejects project binding onto a non-component layer", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              ...textLayer("headline", null, 1),
              timing: { start: 0, duration: 2 },
            },
          ],
          bindings: [
            {
              id: "bind-text",
              source: { kind: "variable", variableId: "cta-label" },
              target: {
                type: "prop",
                layerId: "headline",
                propId: "title",
              },
            },
          ],
        }),
      ),
    ).toThrow(/not a component layer/);
  });

  it("rejects type layer binding into component payload.props", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          bindings: [
            {
              id: "bind-leak",
              source: { kind: "variable", variableId: "cta-label" },
              target: {
                type: "layer",
                layerId: "card-instance",
                property: "payload.props.title",
              },
            },
          ],
        }),
      ),
    ).toThrow();
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
