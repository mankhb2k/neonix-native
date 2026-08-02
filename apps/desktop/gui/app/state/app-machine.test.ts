import { describe, expect, it } from "vitest";
import {
  createInitialAppState,
  decideClose,
  reduceAppState,
} from "./app-machine";
import { buildBlankDesktopProject } from "../../../shared/project-file/envelope";

describe("app-machine", () => {
  it("boots to home with recent list", () => {
    let state = createInitialAppState();
    state = reduceAppState(state, {
      type: "BOOT_DONE",
      recent: [
        {
          id: "p1",
          name: "One",
          path: "/one.mt",
          openedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(state.phase).toBe("home");
    expect(state.recent).toHaveLength(1);
  });

  it("marks new projects dirty and clears dirty on save", () => {
    const blank = buildBlankDesktopProject({ name: "N", createId: (p) => `${p}_1` });
    let state = reduceAppState(createInitialAppState(), {
      type: "BOOT_DONE",
      recent: [],
    });
    state = reduceAppState(state, {
      type: "NEW_PROJECT",
      projectId: blank.projectId,
      documentJson: blank.documentJson,
      name: blank.envelope.project.metadata.name,
    });
    expect(state.phase).toBe("editing");
    expect(state.dirty).toBe(true);

    state = reduceAppState(state, {
      type: "SAVE_SUCCESS",
      path: "/n.mt",
      documentJson: blank.documentJson,
    });
    expect(state.dirty).toBe(false);
    expect(state.path).toBe("/n.mt");
  });

  it("decideClose requires save when dirty", () => {
    expect(decideClose(false, "clean")).toEqual({ action: "confirm" });
    expect(decideClose(true, "cancel")).toEqual({ action: "abort" });
    expect(decideClose(true, "save")).toEqual({ action: "save" });
    expect(decideClose(true, "discard")).toEqual({ action: "discard" });
  });
});
