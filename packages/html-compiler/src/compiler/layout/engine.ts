import { collapseVerticalMargins } from "../layout";
import type { Node, Style } from "../model";
import type { LayoutBox, LayoutRect } from "../layout-ir";
import type { LayoutState } from "../compile-context";

export type FlowState = {
  flowY: number;
  previousBottomMargin: number;
  hasFlowChild: boolean;
};

export type LayoutPlacement = {
  node: Node;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutResult = {
  boxes: Map<Node, LayoutBox>;
  origins: Map<Node, { x: number; y: number }>;
  sizes: Map<Node, { width: number; height: number }>;
  anchors: Map<string, LayoutRect>;
};

export type LayoutEngine = {
  readonly state: LayoutState;
  record(node: Node, layoutBox: LayoutBox, normalX: number, normalY: number): void;
  registerAnchor(name: string, layoutBox: LayoutBox): boolean;
  setOverride(node: Node, placement: LayoutPlacement): void;
  clearOverride(node: Node): void;
  result(): LayoutResult;
};

export function createLayoutEngine(state: LayoutState): LayoutEngine {
  return {
    state,
    record: (node, layoutBox, normalX, normalY) => {
      state.layoutBoxes.set(node, layoutBox);
      state.origins.set(node, { x: layoutBox.x, y: layoutBox.y });
      state.sizes.set(node, { width: layoutBox.width, height: layoutBox.height });
      state.flowOrigins.set(node, { x: normalX, y: normalY });
    },
    registerAnchor: (name, layoutBox) => {
      if (state.anchorBoxes.has(name)) return false;
      state.anchorBoxes.set(name, layoutBox);
      return true;
    },
    setOverride: (node, placement) => state.layoutOverrides.set(node, placement),
    clearOverride: (node) => state.layoutOverrides.delete(node),
    result: () => ({
      boxes: state.layoutBoxes,
      origins: state.origins,
      sizes: state.sizes,
      anchors: state.anchorBoxes,
    }),
  };
}

export type FlowLayoutArgs = {
  children: Node[];
  parent: Node | null;
  parentX: number;
  parentY: number;
  containingWidth: number;
  containingHeight: number;
  parentStyle: Style;
  positionedBlock: LayoutRect;
  state: FlowState;
  styles: Map<Node, Style>;
  margin: (style: Style, containingWidth: number, parentStyle: Style) => [number, number, number, number];
  layout: (node: Node, parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: LayoutRect) => void;
  flowOrigin: (node: Node) => { x: number; y: number } | undefined;
  size: (node: Node) => { width: number; height: number } | undefined;
};

/**
 * Resolve normal-flow children without creating Protocol layers. Flex/grid
 * placement remains the responsibility of the caller; this engine owns only
 * the deterministic block-flow traversal and margin collapse contract.
 */
export function layoutFlowChildren(args: FlowLayoutArgs): void {
  const { children, parent, parentX, containingWidth, containingHeight, parentStyle, positionedBlock, state, styles, margin, layout, flowOrigin, size } = args;
  for (const child of children) {
    const childStyle = styles.get(child) ?? parentStyle;
    const childPosition = childStyle.get("position") ?? "static";
    if (childStyle.get("display") === "contents") {
      layoutFlowChildren({ ...args, children: child.children, parent: parent, parentStyle: childStyle, state });
      continue;
    }
    const childMargin = margin(childStyle, containingWidth, parentStyle);
    if (childPosition === "absolute") {
      layout(child, parent, positionedBlock.x, positionedBlock.y, positionedBlock.width, positionedBlock.height, parentStyle, positionedBlock);
      continue;
    }
    const topMargin = childMargin[0];
    const collapsedMargin = state.hasFlowChild ? collapseVerticalMargins(state.previousBottomMargin, topMargin) : topMargin;
    const childParentY = state.flowY - topMargin + collapsedMargin;
    layout(child, parent, parentX, childParentY, containingWidth, containingHeight, parentStyle, positionedBlock);
    if (childStyle.get("display") === "none") continue;
    const childFlowOrigin = flowOrigin(child);
    const childSize = size(child);
    state.flowY = (childFlowOrigin?.y ?? childParentY) + (childSize?.height ?? 0);
    state.previousBottomMargin = childMargin[2];
    state.hasFlowChild = true;
  }
}
