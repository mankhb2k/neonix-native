import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import {
  createInitialAppState,
  reduceAppState,
} from "../../renderer/src/app/state/app-machine";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../renderer/src/editor/session/timeline-session";

describe("rename document ownership (Wave 2)", () => {
  it("SET_NAME does not mutate parent documentJson", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_rn`,
    });
    let app = createInitialAppState();
    app = reduceAppState(app, {
      type: "NEW_PROJECT",
      projectId: blank.projectId,
      documentJson: blank.documentJson,
      name: "Original",
    });
    const before = app.documentJson;
    app = reduceAppState(app, { type: "SET_NAME", name: "Renamed UI" });
    expect(app.projectName).toBe("Renamed UI");
    expect(app.documentJson).toBe(before);
  });

  it("session rename emits new name and parent sync does not revert", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_rs`,
    });
    let session = createInitialTimelineSession();
    session = reduceTimelineSession(session, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    expect(session.projectName).toBe("Original");

    session = reduceTimelineSession(session, {
      type: "SET_PROJECT_NAME",
      name: "Session Name",
      entryId: "rename_1",
    });
    expect(session.projectName).toBe("Session Name");
    expect(session.sessionDocumentJson).toContain("Session Name");
    expect(session.project?.metadata.name).toBe("Session Name");
    expect(session.project?.metadata.brand.name).toBe("Session Name");

    let app = createInitialAppState();
    app = reduceAppState(app, {
      type: "NEW_PROJECT",
      projectId: blank.projectId,
      documentJson: blank.documentJson,
      name: "Original",
    });
    // Parent receives session emit (one-way).
    app = reduceAppState(app, {
      type: "SET_DOCUMENT_JSON",
      documentJson: session.sessionDocumentJson!,
    });
    expect(app.projectName).toBe("Session Name");
    expect(app.documentJson).toContain("Session Name");

    // Stale session emit must not overwrite a newer parent doc after projectId-stable load.
    // Simulate: session still holds renamed JSON; if parent had been mutated by old SET_NAME,
    // emitting stale JSON would revert. With session ownership, emit is the source of truth.
    const stale = blank.documentJson;
    expect(stale).toContain("Original");
    // Session keeps renamed JSON; parent sync from session wins.
    app = reduceAppState(app, {
      type: "SET_DOCUMENT_JSON",
      documentJson: session.sessionDocumentJson!,
    });
    expect(app.projectName).toBe("Session Name");
  });
});
