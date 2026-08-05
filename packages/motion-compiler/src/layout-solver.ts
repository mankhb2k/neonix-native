import type { MotionNode } from "@motionvideo/motion-schema";

type LayoutConstraint = Extract<
  NonNullable<MotionNode["modifiers"]>[number],
  { type: "layout" }
>["constraint"];

type MutableNode = MotionNode & {
  transform: MotionNode["transform"] & { x: number; y: number; width: number; height: number };
};

/** Deterministic layout → literal transforms; layout modifiers are compile-time only. */
export function applyLayoutConstraints(nodes: MotionNode[]): MotionNode[] {
  const byId = new Map(nodes.map((node) => [node.id, cloneNode(node)]));
  const ordered = [...byId.values()];

  for (const parent of ordered) {
    const layoutMods = (parent.modifiers ?? []).filter((modifier) => modifier.type === "layout");
    if (layoutMods.length === 0) continue;
    const children = ordered.filter((node) => node.parentId === parent.id);
    for (const modifier of layoutMods) {
      solveConstraint(parent, children, modifier.constraint);
    }
  }

  return ordered.map((node) => {
    const modifiers = (node.modifiers ?? []).filter((modifier) => modifier.type !== "layout");
    if (modifiers.length === (node.modifiers?.length ?? 0)) return node;
    const next = { ...node };
    if (modifiers.length === 0) delete next.modifiers;
    else next.modifiers = modifiers;
    return next;
  });
}

function cloneNode(node: MotionNode): MutableNode {
  return JSON.parse(JSON.stringify(node)) as MutableNode;
}

function solveConstraint(parent: MutableNode, children: MutableNode[], constraint: LayoutConstraint): void {
  if (children.length === 0) return;
  switch (constraint.kind) {
    case "stack": {
      const gap = constraint.gap ?? 0;
      const padding = constraint.padding ?? 0;
      let cursor = padding;
      for (const child of children) {
        if (constraint.direction === "vertical") {
          child.transform.y = cursor;
          child.transform.x = alignAxis(constraint.align ?? "start", parent.transform.width, child.transform.width, padding);
          cursor += child.transform.height + gap;
        } else {
          child.transform.x = cursor;
          child.transform.y = alignAxis(constraint.align ?? "start", parent.transform.height, child.transform.height, padding);
          cursor += child.transform.width + gap;
        }
      }
      return;
    }
    case "grid": {
      const gapX = constraint.gapX ?? 0;
      const gapY = constraint.gapY ?? 0;
      children.forEach((child, index) => {
        const col = index % constraint.columns;
        const row = Math.floor(index / constraint.columns);
        child.transform.x = col * (child.transform.width + gapX);
        child.transform.y = row * (child.transform.height + gapY);
      });
      return;
    }
    case "align": {
      for (const child of children) {
        if (constraint.axis === "x" || constraint.axis === "both") {
          child.transform.x = alignAxis(constraint.align, parent.transform.width, child.transform.width, 0);
        }
        if (constraint.axis === "y" || constraint.axis === "both") {
          child.transform.y = alignAxis(constraint.align, parent.transform.height, child.transform.height, 0);
        }
      }
      return;
    }
    case "distribute": {
      if (children.length === 1) return;
      const axis = constraint.axis;
      const total = axis === "x" ? parent.transform.width : parent.transform.height;
      const sizes = children.map((child) => (axis === "x" ? child.transform.width : child.transform.height));
      const occupied = sizes.reduce((sum, size) => sum + size, 0);
      const gap = (total - occupied) / (children.length - 1);
      let cursor = 0;
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index]!;
        if (axis === "x") child.transform.x = cursor;
        else child.transform.y = cursor;
        cursor += sizes[index]! + gap;
      }
      return;
    }
    case "anchor": {
      const target = children.find((child) => child.id === constraint.targetNodeId) ?? null;
      // Anchor children relative to parent origin + optional sibling target.
      const baseX = (target?.transform.x ?? 0) + (constraint.offsetX ?? 0);
      const baseY = (target?.transform.y ?? 0) + (constraint.offsetY ?? 0);
      for (const child of children) {
        if (target && child.id === target.id) continue;
        child.transform.x = baseX;
        child.transform.y = baseY;
      }
      return;
    }
  }
}

function alignAxis(align: "start" | "center" | "end", parentSize: number, childSize: number, padding: number): number {
  if (align === "center") return (parentSize - childSize) / 2;
  if (align === "end") return Math.max(padding, parentSize - childSize - padding);
  return padding;
}

/** Fit text fontSize into box; emits diagnostic strings when overflow risk remains. */
export function applyFitText(nodes: MotionNode[]): { nodes: MotionNode[]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const next = nodes.map((node) => {
    if (node.type !== "text" || !node.payload.fitText) return node;
    const { minFontSize, maxFontSize } = node.payload.fitText;
    const boxWidth = Math.max(1, node.transform.width);
    const text = node.payload.text;
    const approxCharWidth = 0.55;
    const needed = text.length === 0 ? maxFontSize : boxWidth / Math.max(1, text.length * approxCharWidth);
    const fontSize = Math.round(Math.min(maxFontSize, Math.max(minFontSize, needed)) * 100) / 100;
    if (fontSize <= minFontSize + 1e-6 && text.length * minFontSize * approxCharWidth > boxWidth) {
      diagnostics.push(`fit-text overflow risk on ${node.id}: text may exceed width at minFontSize`);
    }
    return {
      ...node,
      payload: {
        ...node.payload,
        fontSize,
      },
    };
  });
  return { nodes: next, diagnostics };
}
