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

describe("rename document ownership (UI-0)", () => {
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
    app = reduceAppState(app, {
      type: "SET_DOCUMENT_JSON",
      documentJson: session.sessionDocumentJson!,
    });
    expect(app.projectName).toBe("Session Name");
    expect(app.documentJson).toContain("Session Name");

    const stale = blank.documentJson;
    expect(stale).toContain("Original");
    app = reduceAppState(app, {
      type: "SET_DOCUMENT_JSON",
      documentJson: session.sessionDocumentJson!,
    });
    expect(app.projectName).toBe("Session Name");
  });

  it("one SET_PROJECT_NAME creates a single history entry", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_hist`,
    });
    let session = createInitialTimelineSession();
    session = reduceTimelineSession(session, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    const before = session.history.past.length;
    session = reduceTimelineSession(session, {
      type: "SET_PROJECT_NAME",
      name: "Final Name",
      entryId: "rename_commit",
    });
    expect(session.history.past.length).toBe(before + 1);
    expect(session.projectName).toBe("Final Name");
  });

  it("UNDO/REDO syncs projectName from document metadata", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_undo`,
    });
    let session = createInitialTimelineSession();
    session = reduceTimelineSession(session, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });
    session = reduceTimelineSession(session, {
      type: "SET_PROJECT_NAME",
      name: "Renamed",
      entryId: "rename_undo",
    });
    expect(session.projectName).toBe("Renamed");
    session = reduceTimelineSession(session, { type: "UNDO" });
    expect(session.projectName).toBe("Original");
    expect(session.project?.metadata.name).toBe("Original");
    session = reduceTimelineSession(session, { type: "REDO" });
    expect(session.projectName).toBe("Renamed");
  });
});
