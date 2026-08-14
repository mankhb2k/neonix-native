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

  it("rejects project binding target.type component (componentLayer only)", () => {
    expect(() =>
      parseMotionProjectV1(
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

  it("rejects project instance payload.props that reference component.variables", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
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
                  default: {
                    ref: { kind: "variable", id: "internal-title" },
                  },
                },
              ],
              variants: [
                {
                  id: "promo",
                  name: "Promo",
                  props: {
                    title: {
                      ref: { kind: "variable", id: "internal-title" },
                    },
                  },
                },
              ],
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
              variables: [
                {
                  id: "internal-title",
                  name: "Internal Title",
                  type: "string",
                  value: "Inside",
                },
              ],
              layers: [
                {
                  id: "nested-btn",
                  type: "component",
                  parentLayerId: null,
                  zIndex: 0,
                  transform: TRANSFORM,
                  payload: {
                    componentId: "child-btn",
                    props: {
                      label: {
                        ref: { kind: "variable", id: "internal-title" },
                      },
                    },
                  },
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
                props: {
                  title: {
                    ref: { kind: "variable", id: "internal-title" },
                  },
                },
              },
            },
          ],
        }),
      ),
    ).toThrow(/unknown variable "internal-title"/);
  });

  it("accepts owner default, variant, and nested payload.props bound to component.variables", () => {
    const project = parseMotionProjectV1(
      baseProject({
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
                default: {
                  ref: { kind: "variable", id: "internal-title" },
                },
              },
            ],
            variants: [
              {
                id: "promo",
                name: "Promo",
                props: {
                  title: {
                    ref: { kind: "variable", id: "internal-title" },
                  },
                },
              },
            ],
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
            variables: [
              {
                id: "internal-title",
                name: "Internal Title",
                type: "string",
                value: "Inside",
              },
            ],
            layers: [
              {
                id: "nested-btn",
                type: "component",
                parentLayerId: null,
                zIndex: 0,
                transform: TRANSFORM,
                payload: {
                  componentId: "child-btn",
                  props: {
                    label: {
                      ref: { kind: "variable", id: "internal-title" },
                    },
                  },
                },
              },
            ],
          },
        ],
      }),
    );
    expect(project.components[1]?.variables[0]?.id).toBe("internal-title");
  });

  it("rejects nested instance props that reference a child component's variables", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
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
              variables: [
                {
                  id: "child-secret",
                  name: "Child Secret",
                  type: "string",
                  value: "nope",
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
                  kind: "text",
                  default: "Card",
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
                  payload: {
                    componentId: "child-btn",
                    props: {
                      label: {
                        ref: { kind: "variable", id: "child-secret" },
                      },
                    },
                  },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/unknown variable "child-secret"/);
  });

  it("rejects component.variables that collide with project.variables", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
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
              variables: [
                {
                  id: "cta-label",
                  name: "Shadowed",
                  type: "string",
                  value: "leak",
                },
              ],
              layers: [textLayer("child-label")],
            },
          ],
          layers: [
            {
              id: "btn-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              transform: TRANSFORM,
              payload: { componentId: "child-btn" },
            },
          ],
        }),
      ),
    ).toThrow(/collides with project.variables/);
  });

  it("rejects duplicate ids inside component.variables", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
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
              variables: [
                {
                  id: "dup-var",
                  name: "A",
                  type: "string",
                  value: "a",
                },
                {
                  id: "dup-var",
                  name: "B",
                  type: "string",
                  value: "b",
                },
              ],
              layers: [textLayer("child-label")],
            },
          ],
          layers: [
            {
              id: "btn-instance",
              type: "component",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              transform: TRANSFORM,
              payload: { componentId: "child-btn" },
            },
          ],
        }),
      ),
    ).toThrow(/Duplicate variable id: dup-var/);
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

  it("rejects propBinding that wires a text prop to a numeric layer property", () => {
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
                  kind: "text",
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
                    property: "transform.x",
                  },
                },
              ],
              variables: [],
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
              transform: TRANSFORM,
              payload: { componentId: "mismatch-card" },
            },
          ],
        }),
      ),
    ).toThrow(/propBinding kind mismatch: prop "title" \(text\) → transform.x \(number\)/);
  });

  it("rejects project layer binding to a property invalid for that layer type", () => {
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
                property: "payload.notAField",
              },
            },
          ],
        }),
      ),
    ).toThrow(/unsupported property "payload.notAField"/);
  });

  it("accepts project layer binding to a public property on that layer", () => {
    const project = parseMotionProjectV1(
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
              type: "layer",
              layerId: "headline",
              property: "payload.content.text",
            },
          },
        ],
      }),
    );
    expect(project.bindings[0]?.target).toEqual({
      type: "layer",
      layerId: "headline",
      property: "payload.content.text",
    });
  });

  it("rejects type layer binding into component payload.props (use componentLayer)", () => {
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
    ).toThrow(/unsupported property "payload.props.title"/);
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
