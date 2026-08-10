/**
 * Imperative overlay — selection/interaction feedback rendered directly
 * on the Pixi stage, avoiding React re-render per frame.
 *
 * §Phase 8 Task 8.4 in core-engine-tasks.md
 *
 * The overlay reads an external store (a plain object updated by editor
 * logic) and draws selection boxes, handles, guides imperatively on each
 * paint tick. No React state, no setState per frame.
 */

import { Container, Graphics, type ColorSource } from "pixi.js";

// ── External store ────────────────────────────────────────────────────

export type OverlayStore = {
  /** Currently selected node IDs. */
  selectedNodeIds: string[];
  /** Hovered node ID (null = none). */
  hoveredNodeId: string | null;
  /** Dragged node ID + preview bounds override. */
  draggedNodeId: string | null;
  /** Snapping guides (vertical/horizontal lines). */
  guides: Array<{ axis: "x" | "y"; position: number }>;
  /** Selection box (rubber-band drag). */
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  /** Viewport transform for coordinate conversion. */
  viewport: { panX: number; panY: number; zoom: number };
};

export type OverlayStyle = {
  selectionColor: ColorSource;
  selectionWidth: number;
  handleColor: ColorSource;
  handleSize: number;
  hoverColor: ColorSource;
  guideColor: ColorSource;
  guideWidth: number;
  dragColor: ColorSource;
};

const DEFAULT_STYLE: OverlayStyle = {
  selectionColor: 0x4a90d9,
  selectionWidth: 2,
  handleColor: 0xffffff,
  handleSize: 8,
  hoverColor: 0x88bbee,
  guideColor: 0xff4444,
  guideWidth: 1,
  dragColor: 0x66aa44,
};

// ── Overlay controller ────────────────────────────────────────────────

export type ImperativeOverlay = {
  /** The root container — add to stage once, update imperatively. */
  readonly container: Container;

  /**
   * Paint the overlay from the external store.
   * Called once per frame, imperatively. No React involved.
   */
  paint(store: OverlayStore, bounds: Map<string, { x: number; y: number; width: number; height: number }>): void;

  /** Get last paint statistics. */
  getStats(): { boxesDrawn: number; guidesDrawn: number };

  /** Dispose all resources. */
  dispose(): void;
};

export function createImperativeOverlay(
  style?: Partial<OverlayStyle>,
): ImperativeOverlay {
  const s = { ...DEFAULT_STYLE, ...style };

  const root = new Container();
  root.label = "imperative-overlay";
  root.eventMode = "none"; // don't intercept interaction events

  const boxesGfx = new Graphics();
  boxesGfx.label = "overlay-boxes";
  root.addChild(boxesGfx);

  const guidesGfx = new Graphics();
  guidesGfx.label = "overlay-guides";
  root.addChild(guidesGfx);

  let lastStats = { boxesDrawn: 0, guidesDrawn: 0 };

  function drawSelectionBox(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: ColorSource,
    width: number,
  ): void {
    g.rect(x, y, w, h);
    g.stroke({ color, width, alignment: 0 });
  }

  function drawHandle(
    g: Graphics,
    cx: number,
    cy: number,
    size: number,
    color: ColorSource,
  ): void {
    g.rect(cx - size / 2, cy - size / 2, size, size);
    g.fill({ color: 0x000000, alpha: 0.3 });
    g.rect(cx - size / 2, cy - size / 2, size, size);
    g.stroke({ color, width: 1 });
  }

  function paint(
    store: OverlayStore,
    bounds: Map<string, { x: number; y: number; width: number; height: number }>,
  ): void {
    boxesGfx.clear();
    guidesGfx.clear();

    const { panX, panY, zoom } = store.viewport;
    let boxesDrawn = 0;
    let guidesDrawn = 0;

    // Draw selection boxes + handles
    for (const nodeId of store.selectedNodeIds) {
      const b = bounds.get(nodeId);
      if (!b) continue;

      const sx = b.x * zoom + panX;
      const sy = b.y * zoom + panY;
      const sw = b.width * zoom;
      const sh = b.height * zoom;

      // Selection rect
      drawSelectionBox(boxesGfx, sx, sy, sw, sh, s.selectionColor, s.selectionWidth);
      boxesDrawn++;

      // Corner handles
      for (const [hx, hy] of [
        [sx, sy],
        [sx + sw, sy],
        [sx, sy + sh],
        [sx + sw, sy + sh],
      ]) {
        drawHandle(boxesGfx, hx, hy, s.handleSize, s.handleColor);
      }
    }

    // Draw hover rect
    if (store.hoveredNodeId && !store.selectedNodeIds.includes(store.hoveredNodeId)) {
      const b = bounds.get(store.hoveredNodeId);
      if (b) {
        drawSelectionBox(
          boxesGfx,
          b.x * zoom + panX,
          b.y * zoom + panY,
          b.width * zoom,
          b.height * zoom,
          s.hoverColor,
          1,
        );
        boxesDrawn++;
      }
    }

    // Draw drag preview
    if (store.draggedNodeId) {
      const b = bounds.get(store.draggedNodeId);
      if (b) {
        drawSelectionBox(
          boxesGfx,
          b.x * zoom + panX,
          b.y * zoom + panY,
          b.width * zoom,
          b.height * zoom,
          s.dragColor,
          s.selectionWidth,
        );
        boxesDrawn++;
      }
    }

    // Draw rubber-band selection box
    if (store.selectionBox) {
      const sb = store.selectionBox;
      drawSelectionBox(
        boxesGfx,
        sb.x * zoom + panX,
        sb.y * zoom + panY,
        sb.width * zoom,
        sb.height * zoom,
        s.selectionColor,
        1,
      );
      boxesDrawn++;
    }

    // Draw snapping guides
    for (const guide of store.guides) {
      if (guide.axis === "x") {
        const x = guide.position * zoom + panX;
        guidesGfx.moveTo(x, 0);
        guidesGfx.lineTo(x, 10000);
        guidesGfx.stroke({ color: s.guideColor, width: s.guideWidth });
        guidesDrawn++;
      } else {
        const y = guide.position * zoom + panY;
        guidesGfx.moveTo(0, y);
        guidesGfx.lineTo(10000, y);
        guidesGfx.stroke({ color: s.guideColor, width: s.guideWidth });
        guidesDrawn++;
      }
    }

    lastStats = { boxesDrawn, guidesDrawn };
  }

  function getStats() {
    return { ...lastStats };
  }

  function dispose() {
    root.removeFromParent();
    root.destroy({ children: true });
  }

  return { container: root, paint, getStats, dispose };
}
