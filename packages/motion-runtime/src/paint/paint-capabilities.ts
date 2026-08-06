/**
 * Paint op capability table + unsupported fallback policy.
 */

export type PaintFallbackPolicy = "preview-warn" | "export-fail" | "ledger-fallback";

export type PaintOpCapability = {
  op:
    | "beginFrame"
    | "endFrame"
    | "beginGroup"
    | "endGroup"
    | "beginLayer"
    | "endLayer"
    | "setTransform"
    | "drawText"
    | "drawShape"
    | "drawSolid"
    | "drawImage"
    | "drawPath"
    | "drawVideo"
    | "unsupported";
  pixi: "yes" | "partial" | "no" | "planned";
  remotion: "yes" | "partial" | "no" | "planned";
  worker: "yes" | "partial" | "no" | "planned";
  /** Default when a painter cannot execute the op. */
  fallback: PaintFallbackPolicy;
  notes?: string;
};

/**
 * Official paint-op capability matrix (MVP).
 * Preview uses preview-warn; export preflight fails on unsupported.
 */
export const PAINT_OP_CAPABILITIES: readonly PaintOpCapability[] = [
  { op: "beginFrame", pixi: "yes", remotion: "yes", worker: "yes", fallback: "export-fail" },
  { op: "endFrame", pixi: "yes", remotion: "yes", worker: "yes", fallback: "export-fail" },
  {
    op: "beginGroup",
    pixi: "partial",
    remotion: "partial",
    worker: "partial",
    fallback: "preview-warn",
    notes: "Pass-through until layer scopes land",
  },
  {
    op: "endGroup",
    pixi: "partial",
    remotion: "partial",
    worker: "partial",
    fallback: "preview-warn",
  },
  {
    op: "beginLayer",
    pixi: "planned",
    remotion: "planned",
    worker: "planned",
    fallback: "export-fail",
    notes: "Compositing scope; world-space draws remain flat",
  },
  {
    op: "endLayer",
    pixi: "planned",
    remotion: "planned",
    worker: "planned",
    fallback: "export-fail",
  },
  { op: "setTransform", pixi: "partial", remotion: "yes", worker: "yes", fallback: "export-fail" },
  { op: "drawText", pixi: "yes", remotion: "yes", worker: "yes", fallback: "export-fail" },
  { op: "drawShape", pixi: "partial", remotion: "partial", worker: "yes", fallback: "preview-warn" },
  { op: "drawSolid", pixi: "yes", remotion: "yes", worker: "yes", fallback: "export-fail" },
  { op: "drawImage", pixi: "yes", remotion: "yes", worker: "yes", fallback: "preview-warn" },
  { op: "drawPath", pixi: "partial", remotion: "partial", worker: "yes", fallback: "preview-warn" },
  {
    op: "drawVideo",
    pixi: "partial",
    remotion: "partial",
    worker: "partial",
    fallback: "preview-warn",
    notes: "Placeholder until mediaTime decode",
  },
  {
    op: "unsupported",
    pixi: "yes",
    remotion: "yes",
    worker: "yes",
    fallback: "export-fail",
    notes: "Must surface diagnostic; export fails",
  },
] as const;

export function getPaintOpCapability(
  op: PaintOpCapability["op"],
): PaintOpCapability | undefined {
  return PAINT_OP_CAPABILITIES.find((row) => row.op === op);
}

/**
 * Resolve fallback for a target surface.
 * Export always fails closed for unsupported ops unless ledger says ledger-fallback.
 */
export function resolvePaintFallback(
  op: PaintOpCapability["op"],
  surface: "preview" | "export",
): "warn" | "fail" | "allow-ledger-fallback" {
  const row = getPaintOpCapability(op);
  if (!row) return "fail";
  if (surface === "export") {
    if (row.fallback === "ledger-fallback") return "allow-ledger-fallback";
    return "fail";
  }
  if (row.fallback === "preview-warn") return "warn";
  if (row.fallback === "ledger-fallback") return "allow-ledger-fallback";
  return "fail";
}
