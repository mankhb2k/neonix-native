/**
 * CSS paints an element's own box decorations - background color, background
 * images, then border (CSS 2.1 Appendix E, steps 1-2) - before any of its
 * content. paint-node.ts and border-node.ts order those passes with large
 * fixed offsets (+10000 per background layer, +1000 / +100000 per background
 * image for the border) so they stack correctly among themselves, but child
 * elements are ordered by plain `layers.length` - so any decoration with a
 * non-zero offset (a border, a second background layer, a background image)
 * sorted ABOVE the element's own children and painted over them (e.g. a
 * card's border line drawn across an overflowing child badge).
 *
 * `order` only ever compares siblings (the runtime sorts each parent's
 * children independently), so lifting every non-decoration sibling of one
 * parent by the same delta keeps their relative order - including z-index
 * children, the element's own `::text` and `::outline`, which already sit
 * above the decorations - while guaranteeing they paint after every
 * decoration. Parents where no decoration currently outranks a sibling are
 * left untouched, so documents without the bug keep identical orders.
 */
type OrderedLayer = { id: string; parentLayerId?: string | null; order: number };

function isOwnDecoration(layer: OrderedLayer, parentId: string): boolean {
  const prefix = `${parentId}::`;
  if (!layer.id.startsWith(prefix)) return false;
  const pass = layer.id.slice(prefix.length);
  return pass === "paint" || pass.startsWith("paint:")
    || pass.startsWith("background:")
    || pass === "border" || pass.startsWith("border:");
}

export function raiseContentAboveOwnDecorations(layers: OrderedLayer[]): void {
  const byParent = new Map<string, OrderedLayer[]>();
  for (const layer of layers) {
    if (!layer.parentLayerId) continue;
    const siblings = byParent.get(layer.parentLayerId) ?? [];
    siblings.push(layer);
    byParent.set(layer.parentLayerId, siblings);
  }
  for (const [parentId, siblings] of byParent) {
    let maxDecoration = -Infinity;
    let minContent = Infinity;
    for (const layer of siblings) {
      if (isOwnDecoration(layer, parentId)) maxDecoration = Math.max(maxDecoration, layer.order);
      else minContent = Math.min(minContent, layer.order);
    }
    if (maxDecoration === -Infinity || minContent === Infinity || minContent > maxDecoration) continue;
    const delta = maxDecoration + 1 - minContent;
    for (const layer of siblings) if (!isOwnDecoration(layer, parentId)) layer.order += delta;
  }
}
