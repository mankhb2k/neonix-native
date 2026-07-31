import { describe, expect, it } from "vitest";
import {
  createHistoryState,
  executePropertyCommand,
  PROPERTY_REGISTRY,
  readUniform,
  replaceOrPushHistory,
  resolvePropertyTargets,
  selectionClips,
  type HistoryEntry,
  type PropertyContext,
  type TimelineDocument,
} from "..";
import { getPropertyDefinition } from "../properties/registry";
import { fixtureMainOnly } from "../testing/fixtures/projects";

describe("property commands", () => {
  it("applies transform.x to focused scene node", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    expect(targets.length).toBeGreaterThan(0);

    const result = executePropertyCommand(doc, {
      type: "set-node-transform",
      targets,
      patch: { x: 120 },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.transform.x).toBe(120);
  });

  it("clamps opacity to 0..1", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-opacity",
      targets,
      opacity: 2.5,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.document.project.scenes[0]!.nodes[0]!.transform.opacity).toBe(
      1,
    );
  });

  it("updates metadata name and visible", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const targets = resolvePropertyTargets(
      selectionClips([clips[0]!.id]),
      project,
      clips,
      lanes,
    );
    const result = executePropertyCommand(doc, {
      type: "set-node-metadata",
      targets,
      patch: { name: "Hero", visible: false },
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const node = result.document.project.scenes[0]!.nodes[0]!;
    expect(node.name).toBe("Hero");
    expect(node.transform.visible).toBe(false);
  });
});

describe("mixed + registry", () => {
  it("readUniform returns mixed for unequal values", () => {
    expect(readUniform([1, 2])).toEqual({ mixed: true });
    expect(readUniform([3, 3])).toBe(3);
  });

  it("registry read/createCommand for transform.x", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const selection = selectionClips([clips[0]!.id]);
    const targets = resolvePropertyTargets(selection, project, clips, lanes);
    const ctx: PropertyContext = {
      project,
      clips,
      lanes,
      selection,
      targets,
    };
    const prop = getPropertyDefinition("transform.x")!;
    expect(prop.read(ctx)).toBe(40);
    const cmd = prop.createCommand(99, ctx);
    expect(cmd.type).toBe("set-node-transform");
    expect(PROPERTY_REGISTRY.length).toBeGreaterThanOrEqual(8);
  });
});

describe("history coalesce", () => {
  it("replaceOrPushHistory keeps a single scrub entry", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const before: TimelineDocument = { project, clips, lanes };
    let after: TimelineDocument = {
      project: {
        ...project,
        scenes: project.scenes.map((s, i) =>
          i === 0
            ? {
                ...s,
                nodes: s.nodes.map((n, j) =>
                  j === 0
                    ? { ...n, transform: { ...n.transform, x: 10 } }
                    : n,
                ),
              }
            : s,
        ),
      },
      clips,
      lanes,
    };

    let state = createHistoryState();
    const entry1: HistoryEntry = {
      id: "h1",
      timestamp: 1,
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clip1",
      before,
      after,
    };
    state = replaceOrPushHistory(state, entry1, {
      coalesceKey: entry1.coalesceKey,
    });

    after = {
      ...after,
      project: {
        ...after.project,
        scenes: after.project.scenes.map((s, i) =>
          i === 0
            ? {
                ...s,
                nodes: s.nodes.map((n, j) =>
                  j === 0
                    ? { ...n, transform: { ...n.transform, x: 50 } }
                    : n,
                ),
              }
            : s,
        ),
      },
    };
    const entry2: HistoryEntry = {
      id: "h2",
      timestamp: 2,
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clip1",
      before: after,
      after,
    };
    state = replaceOrPushHistory(state, entry2, {
      coalesceKey: entry2.coalesceKey,
    });

    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.before).toBe(before);
    expect(state.past[0]!.after.project.scenes[0]!.nodes[0]!.transform.x).toBe(
      50,
    );
  });
});
