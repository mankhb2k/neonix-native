import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import { buildClipboardFromSelection } from "../../session/build-clipboard";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
  type TimelineSessionEvent,
  type TimelineSessionState,
} from "../../session/timeline-session";
import { selectionNone } from "@motionvideo/editor-core";

function reduce(
  state: TimelineSessionState,
  event: TimelineSessionEvent,
): TimelineSessionState {
  return reduceTimelineSession(state, event).state;
}

describe("session clipboard", () => {
  it("COPY then paste-clips uses session clipboard (not empty)", () => {
    const blank = buildBlankDesktopProject({
      name: "ClipDoc",
      createId: (p) => `${p}_cb`,
    });
    let session = createInitialTimelineSession();
    session = reduce(session, {
      type: "REPLACE_DOCUMENT",
      documentJson: blank.documentJson,
    });

    let selection = selectionNone();
    let clipboard: ReturnType<typeof buildClipboardFromSelection> = [];

    const addResult = reduceTimelineSession(session, {
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
      selection,
      clipboard,
    });
    session = addResult.state;
    if (addResult.ui?.selection) selection = addResult.ui.selection;
    if (addResult.ui?.clipboard) clipboard = addResult.ui.clipboard;

    expect(session.clips.length).toBeGreaterThan(0);
    const clipId = session.clips[0]!.id;
    selection = { kind: "clips", ids: [clipId], primaryId: clipId };
    clipboard = buildClipboardFromSelection({
      selection,
      clips: session.clips,
      lanes: session.lanes,
      project: session.project,
    });
    expect(clipboard.length).toBe(1);

    const beforeCount = session.clips.length;
    session = reduce(session, {
      type: "EXECUTE_TIMELINE_COMMAND",
      command: { type: "paste-clips", atTime: 5 },
      label: "Paste",
      entryId: "paste_1",
      selection,
      clipboard,
    });
    expect(session.clips.length).toBeGreaterThan(beforeCount);
    expect(session.loadError).toBeNull();
  });
});
