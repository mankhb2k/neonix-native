/**
 * LayerTreeRow — Figma-style row chrome (depth, chevron, eye/lock).
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayerTreeRowView } from "./LayerTreeRow";

afterEach(() => {
  cleanup();
});

const baseRow = {
  id: "g",
  name: "Group",
  type: "group",
  depth: 1,
  zIndex: 0,
  visible: true,
  hasChildren: true,
  parentLayerId: null as string | null,
};

const dragNop = {
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDrop: vi.fn(),
  onDragEnd: vi.fn(),
};

describe("LayerTreeRowView", () => {
  it("exposes depth and chevron only when hasChildren", () => {
    const { rerender } = render(
      <LayerTreeRowView
        row={baseRow}
        selected={false}
        expanded
        locked={false}
        dragging={false}
        dropEdge={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onToggleVisible={vi.fn()}
        onToggleLock={vi.fn()}
        {...dragNop}
      />,
    );
    expect(screen.getByTestId("layer-tree-row").getAttribute("data-depth")).toBe(
      "1",
    );
    expect(screen.getByTestId("layer-tree-chevron")).toBeTruthy();

    rerender(
      <LayerTreeRowView
        row={{
          ...baseRow,
          id: "leaf",
          name: "Leaf",
          type: "text",
          depth: 2,
          hasChildren: false,
        }}
        selected={false}
        expanded={false}
        locked={false}
        dragging={false}
        dropEdge={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onToggleVisible={vi.fn()}
        onToggleLock={vi.fn()}
        {...dragNop}
      />,
    );
    expect(screen.queryByTestId("layer-tree-chevron")).toBeNull();
    expect(screen.getByTestId("layer-tree-row").getAttribute("data-depth")).toBe(
      "2",
    );
  });

  it("toggles expand and visible without selecting when chrome clicked", () => {
    const onSelect = vi.fn();
    const onToggleExpand = vi.fn();
    const onToggleVisible = vi.fn();
    render(
      <LayerTreeRowView
        row={baseRow}
        selected
        expanded={false}
        locked={false}
        dragging={false}
        dropEdge={null}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
        onToggleVisible={onToggleVisible}
        onToggleLock={vi.fn()}
        {...dragNop}
      />,
    );
    fireEvent.click(screen.getByTestId("layer-tree-chevron"));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("layer-tree-eye"));
    expect(onToggleVisible).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows cyan drop line when dropEdge is set", () => {
    render(
      <LayerTreeRowView
        row={baseRow}
        selected={false}
        expanded
        locked={false}
        dragging={false}
        dropEdge="before"
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onToggleVisible={vi.fn()}
        onToggleLock={vi.fn()}
        {...dragNop}
      />,
    );
    expect(screen.getByTestId("layer-tree-drop-line")).toBeTruthy();
  });
});
