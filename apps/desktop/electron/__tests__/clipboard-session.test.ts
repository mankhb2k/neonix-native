import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../shared/project-file/envelope";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../renderer/src/editor/session/timeline-session";

describe("session clipboard", () => {
  it("COPY then paste-clips uses session clipboard (not empty)", () => {
    const blank = buildBlankDesktopProject({
      name: "ClipDoc",
      createId: (p) => `${p}_cb`,
    });
    let session = createInitialTimelineSession();
    session = reduceTimelineSession(session, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });

    session = reduceTimelineSession(session, {
      type: "EXECUTE_TIMELINE_COMMAND",
      command: {
        type: "add-clip-draft",
        draft: {
          id: "d1",
          name: "Title",
          duration: 2,
          text: "Hello",
        },
        target: { track: "main" },
      },
      label: "Add",
      entryId: "add_1",
    });
    expect(session.clips.length).toBeGreaterThan(0);
    const clipId = session.clips[0].id;

    session = reduceTimelineSession(session, {
      type: "SET_SELECTION",
      selection: { kind: "clips", ids: [clipId], primaryId: clipId },
    });
    session = reduceTimelineSession(session, { type: "COPY_SELECTION" });
    expect(session.clipboard.length).toBe(1);

    const beforeCount = session.clips.length;
    session = reduceTimelineSession(session, {
      type: "EXECUTE_TIMELINE_COMMAND",
      command: { type: "paste-clips", atTime: 5 },
      label: "Paste",
      entryId: "paste_1",
    });
    expect(session.clips.length).toBeGreaterThan(beforeCount);
    expect(session.loadError).toBeNull();
  });
});
