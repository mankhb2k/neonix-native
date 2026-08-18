import { describe, expect, it } from "vitest";
import { fixtureMainOnly } from "../testing/fixtures/projects";
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../history/history-manager";
import type { CommandContext } from "../ports/command-context";
import { executeTimelineCommand, type TimelineDocument } from "..";

function createDeterministicId(): CommandContext["createId"] {
  const counters = new Map<string, number>();
  return (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}_det_${n}`;
  };
}

describe("deterministic command + history fixtures", () => {
  it("move / trim / split / delete with fixed createId", () => {
    const ctx: CommandContext = { createId: createDeterministicId() };
    const { project, clips, lanes } = fixtureMainOnly();
    let doc: TimelineDocument = { project, clips, lanes };

    const moved = executeTimelineCommand(
      doc,
      {
        type: "move-clip",
        clipId: "clip.main.b",
        patch: { startTime: 6 },
      },
      undefined,
      undefined,
      ctx,
    );
    expect(moved.status).toBe("applied");
    if (moved.status !== "applied") return;
    doc = moved.document;

    const trimmed = executeTimelineCommand(
      doc,
      {
        type: "clip/trim",
        clipId: "clip.main.a",
        duration: 2.5,
      },
      undefined,
      undefined,
      ctx,
    );
    expect(trimmed.status).toBe("applied");
    if (trimmed.status !== "applied") return;
    doc = trimmed.document;
    expect(doc.clips.find((c) => c.id === "clip.main.a")?.duration).toBe(2.5);

    const split = executeTimelineCommand(
      doc,
      { type: "split-selected-clips", time: 1.25 },
      { kind: "clips", ids: ["clip.main.a"], primaryId: "clip.main.a" },
      undefined,
      ctx,
    );
    expect(split.status).toBe("applied");
    if (split.status !== "applied") return;
    doc = split.document;
    const newIds = split.events
      .filter((e) => e.type === "clip-split")
      .flatMap((e) => (e.type === "clip-split" ? e.newClipIds : []));
    expect(
      newIds.some(
        (id) => id.startsWith("layer_det_") || id.startsWith("clip_det_"),
      ),
    ).toBe(true);

    const deleted = executeTimelineCommand(
      doc,
      { type: "delete-selected-clips" },
      {
        kind: "clips",
        ids: [doc.clips[0]!.id],
        primaryId: doc.clips[0]!.id,
      },
      undefined,
      ctx,
    );
    expect(deleted.status).toBe("applied");
  });

  it("undo/redo restores documents around a deterministic add-clip", () => {
    const ctx: CommandContext = { createId: createDeterministicId() };
    const { project, clips, lanes } = fixtureMainOnly();
    const before: TimelineDocument = { project, clips, lanes };

    const added = executeTimelineCommand(
      before,
      {
        type: "add-clip-draft",
        draft: {
          id: "draft.det",
          name: "Det",
          text: "x",
          duration: 3,
        },
        target: { track: "main", startTime: 20 },
      },
      undefined,
      undefined,
      ctx,
    );
    expect(added.status).toBe("applied");
    if (added.status !== "applied") return;

    const after = added.document;
    const layerIds = after.project.layers
      .map((s) => s.id)
      .filter((id) => id.includes("_det_"));
    expect(layerIds.length).toBeGreaterThan(0);
    expect(layerIds[0]).toBe("layer_det_1");

    let history = createHistoryState();
    history = pushHistory(history, {
      id: "h_det_1",
      timestamp: 1,
      label: "add-clip-draft",
      before,
      after,
    });

    const undone = undoHistory(history);
    expect(undone.entry?.before).toBe(before);
    history = undone.state;

    const redone = redoHistory(history);
    expect(redone.entry?.after).toBe(after);
  });
});
