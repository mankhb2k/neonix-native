import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryCommitPoint } from "../adapters/commit-library-payload";
import type { LibraryPayload } from "../model/library-payload";
import { cancel, dispose, getSession } from "../interactions/library-drag-session";
import { useLibraryPointerGesture } from "./use-library-pointer-gesture";

const mocks = vi.hoisted(() => ({
  resolveLibraryPlacement: vi.fn(),
  autoScrollTimelineNearEdge: vi.fn(),
}));

vi.mock("../../timeline/drop/library-drop", () => ({
  resolveLibraryPlacement: mocks.resolveLibraryPlacement,
}));

vi.mock("../../timeline/drop/auto-scroll", () => ({
  autoScrollTimelineNearEdge: mocks.autoScrollTimelineNearEdge,
}));

const INITIAL: LibraryPayload = {
  kind: "text",
  id: "initial",
  label: "Initial",
  text: "Initial",
};

const UPDATED: LibraryPayload = {
  kind: "text",
  id: "updated",
  label: "Updated",
  text: "Updated",
};

function Harness({
  payload,
  onCommit,
}: {
  payload: LibraryPayload;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const handlers = useLibraryPointerGesture(payload, onCommit);
  return <button {...handlers}>Asset</button>;
}

describe("useLibraryPointerGesture", () => {
  beforeEach(() => {
    dispose();
    cancel();
    mocks.resolveLibraryPlacement.mockReset();
    mocks.autoScrollTimelineNearEdge.mockReset();
    const dropZone = document.createElement("div");
    dropZone.dataset.timelineDropZone = "true";
    document.body.appendChild(dropZone);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(dropZone);
  });

  afterEach(() => {
    cleanup();
    dispose();
    cancel();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("commits a click without resolving timeline placement", () => {
    const onCommit = vi.fn();
    const { getByRole } = render(
      <Harness payload={INITIAL} onCommit={onCommit} />,
    );

    fireEvent.pointerDown(getByRole("button"), {
      button: 0,
      pointerId: 7,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(window, {
      pointerId: 7,
      clientX: 10,
      clientY: 10,
    });

    expect(mocks.resolveLibraryPlacement).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledWith(INITIAL, { mode: "click" });
  });

  it("resolves once with the session payload snapshot and reuses placement", () => {
    const onCommit = vi.fn();
    const placement = {
      track: "overlay" as const,
      laneId: "overlay-1",
      startTime: 1.5,
    };
    mocks.resolveLibraryPlacement.mockReturnValue(placement);
    const { getByRole, rerender } = render(
      <Harness payload={INITIAL} onCommit={onCommit} />,
    );
    const button = getByRole("button");

    fireEvent.pointerDown(button, {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    rerender(<Harness payload={UPDATED} onCommit={onCommit} />);
    fireEvent.pointerMove(window, {
      pointerId: 7,
      clientX: 10,
      clientY: 0,
    });
    fireEvent.pointerUp(window, {
      pointerId: 7,
      clientX: 150,
      clientY: 30,
    });

    expect(mocks.resolveLibraryPlacement).toHaveBeenCalledOnce();
    expect(mocks.resolveLibraryPlacement).toHaveBeenCalledWith(
      150,
      30,
      INITIAL,
    );
    expect(onCommit).toHaveBeenCalledWith(INITIAL, {
      mode: "drag",
      placement,
    });
    expect(getSession().phase).toBe("idle");
  });

  it("cancels a drag when no valid placement is resolved", () => {
    const onCommit = vi.fn();
    mocks.resolveLibraryPlacement.mockReturnValue(undefined);
    const { getByRole } = render(
      <Harness payload={INITIAL} onCommit={onCommit} />,
    );

    fireEvent.pointerDown(getByRole("button"), {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, {
      pointerId: 7,
      clientX: 10,
      clientY: 0,
    });
    fireEvent.pointerUp(window, {
      pointerId: 7,
      clientX: 150,
      clientY: 30,
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(getSession().phase).toBe("idle");
  });

  it("ignores move and up events from a foreign pointer", () => {
    const onCommit = vi.fn();
    const { getByRole } = render(
      <Harness payload={INITIAL} onCommit={onCommit} />,
    );

    fireEvent.pointerDown(getByRole("button"), {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, {
      pointerId: 9,
      clientX: 20,
      clientY: 0,
    });
    fireEvent.pointerUp(window, {
      pointerId: 9,
      clientX: 20,
      clientY: 0,
    });
    fireEvent.pointerCancel(window, { pointerId: 9 });

    expect(getSession().phase).toBe("pressed");
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(window, {
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    expect(onCommit).toHaveBeenCalledWith(INITIAL, { mode: "click" });
  });

  it("cancels the active pointer without committing", () => {
    const onCommit = vi.fn();
    const { getByRole } = render(
      <Harness payload={INITIAL} onCommit={onCommit} />,
    );

    fireEvent.pointerDown(getByRole("button"), {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerCancel(window, { pointerId: 7 });

    expect(getSession().phase).toBe("idle");
    expect(onCommit).not.toHaveBeenCalled();
  });
});
