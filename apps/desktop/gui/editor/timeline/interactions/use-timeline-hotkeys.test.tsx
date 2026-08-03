import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import { useTimelineHotkeys } from "./use-timeline-hotkeys";

type HarnessProps = {
  enabled?: boolean;
  owned?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onExecute?: (command: TimelineCommand, label: string) => void;
};

function Harness({
  enabled = true,
  owned = true,
  onUndo = () => undefined,
  onRedo = () => undefined,
  onCopy,
  onCut,
  onPaste,
  onExecute = () => undefined,
}: HarnessProps) {
  useTimelineHotkeys({
    enabled,
    isTimelineOwned: () => owned,
    getPlayheadTime: () => 2.5,
    onUndo,
    onRedo,
    onCopy,
    onCut,
    onPaste,
    onExecute,
  });
  return <input aria-label="typing-target" />;
}

describe("useTimelineHotkeys", () => {
  beforeEach(() => {
    useTimelineInteractionPrefs.setState({ autoSnapping: true });
  });

  afterEach(() => {
    cleanup();
    useTimelineInteractionPrefs.setState({ autoSnapping: true });
  });

  it("toggles snapping only for an owned, non-repeated key press", () => {
    const { rerender } = render(<Harness owned={false} />);

    fireEvent.keyDown(window, { key: "n" });
    expect(useTimelineInteractionPrefs.getState().autoSnapping).toBe(true);

    rerender(<Harness owned />);
    fireEvent.keyDown(window, { key: "n", repeat: true });
    expect(useTimelineInteractionPrefs.getState().autoSnapping).toBe(true);

    fireEvent.keyDown(window, { key: "n" });
    expect(useTimelineInteractionPrefs.getState().autoSnapping).toBe(false);
  });

  it("keeps undo and redo editor-global but gates timeline actions", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onCopy = vi.fn();
    const onCut = vi.fn();
    const onPaste = vi.fn();
    const onExecute = vi.fn();
    const { rerender } = render(
      <Harness
        owned={false}
        onUndo={onUndo}
        onRedo={onRedo}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onExecute={onExecute}
      />,
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Delete" });

    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onCopy).not.toHaveBeenCalled();
    expect(onCut).not.toHaveBeenCalled();
    expect(onPaste).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();

    rerender(
      <Harness
        owned
        onUndo={onUndo}
        onRedo={onRedo}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onExecute={onExecute}
      />,
    );
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(onCopy).toHaveBeenCalledOnce();
    expect(onCut).toHaveBeenCalledOnce();
    expect(onPaste).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledTimes(2);
    expect(onExecute).toHaveBeenNthCalledWith(
      1,
      { type: "split-selected-clips", time: 2.5 },
      "Split clips",
    );
    expect(onExecute).toHaveBeenNthCalledWith(
      2,
      { type: "delete-selected-clips" },
      "Delete clips",
    );
  });

  it("ignores shortcuts from typing targets or while disabled", () => {
    const onUndo = vi.fn();
    const onExecute = vi.fn();
    const { getByLabelText, rerender } = render(
      <Harness onUndo={onUndo} onExecute={onExecute} />,
    );

    fireEvent.keyDown(getByLabelText("typing-target"), {
      key: "z",
      ctrlKey: true,
    });
    expect(onUndo).not.toHaveBeenCalled();

    rerender(<Harness enabled={false} onUndo={onUndo} onExecute={onExecute} />);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onUndo).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});
