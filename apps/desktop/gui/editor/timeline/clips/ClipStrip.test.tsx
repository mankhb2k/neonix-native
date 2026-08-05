/**
 * ClipStrip — layer mode has no trim handles; track mode keeps them.
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISUAL_POLICY,
  selectionClips,
  selectionNode,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { useEditorUiSession } from "../../session/editor-ui-session";
import { clearPreviewSession } from "../interactions/timeline-preview-session";
import { ClipStrip } from "./ClipStrip";

const LANE: TimelineLane = {
  id: "overlay",
  kind: "visual",
  role: "overlay",
  order: 0,
  name: "Overlay",
  policy: { ...DEFAULT_VISUAL_POLICY },
};

const CLIP: TimelineClip = {
  kind: "scene",
  id: "n1",
  sceneId: "sc1",
  laneId: "overlay",
  startTime: 1,
  duration: 2,
  name: "Node",
};

describe("ClipStrip layer trim flag", () => {
  beforeEach(() => {
    clearPreviewSession();
    useEditorUiSession.getState().resetForProject(null);
  });

  afterEach(() => {
    cleanup();
    clearPreviewSession();
  });

  it("renders trim handles when selected in track mode", () => {
    render(
      <ClipStrip
        clips={[CLIP]}
        lanes={[LANE]}
        lane={LANE}
        pixelsPerSecond={50}
        selection={selectionClips(["n1"])}
        beginGesture={vi.fn()}
        onSelect={vi.fn()}
        onExecute={vi.fn()}
        trimEnabled
      />,
    );
    expect(screen.getByTestId("timeline-clip-trim-left")).toBeTruthy();
    expect(screen.getByTestId("timeline-clip-trim-right")).toBeTruthy();
  });

  it("does not render trim handles in layer mode even when selected", () => {
    render(
      <ClipStrip
        clips={[CLIP]}
        lanes={[LANE]}
        lane={LANE}
        pixelsPerSecond={50}
        selection={selectionNode("sc1", "n1")}
        beginGesture={vi.fn()}
        onSelect={vi.fn()}
        onExecute={vi.fn()}
        onExecuteProperty={vi.fn()}
        trimEnabled={false}
        layerSession={{
          sceneId: "sc1",
          containerStart: 0,
          containerDuration: 10,
          orderedNodeIds: ["n1"],
          orderedLaneIds: ["layer-node:n1"],
        }}
      />,
    );
    expect(screen.getByTestId("timeline-layer-strip")).toBeTruthy();
    expect(screen.queryByTestId("timeline-clip-trim-left")).toBeNull();
    expect(screen.queryByTestId("timeline-clip-trim-right")).toBeNull();
  });
});
