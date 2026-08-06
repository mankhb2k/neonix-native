/**
 * Capability ledger — wave-1 four primitives + wave-2 path/effects/video/camera.
 * Columns: schema | command | compiler | evaluator | pixi | worker | parity | editor
 */

export type CapabilityColumn =
  | "schema"
  | "command"
  | "compiler"
  | "evaluator"
  | "pixi"
  | "worker"
  | "parity"
  | "editor";

export type CapabilityStatus = "yes" | "partial" | "no" | "planned";

/** Bump when ledger columns change for AI prompts. */
export const CAPABILITY_MANIFEST_VERSION = "wave2.0";

export type CapabilityRow = {
  id: string;
  label: string;
  columns: Record<CapabilityColumn, CapabilityStatus>;
  notes?: string;
};

const yesPartial = {
  schema: "yes",
  command: "yes",
  compiler: "yes",
  evaluator: "yes",
  pixi: "yes",
  worker: "partial",
  parity: "planned",
  editor: "yes",
} as const satisfies Record<CapabilityColumn, CapabilityStatus>;

/** Four-primitive vertical slice + shared transform/keyframes. */
export const WAVE1_CAPABILITY_LEDGER: readonly CapabilityRow[] = [
  {
    id: "primitive.group",
    label: "Group",
    columns: { ...yesPartial },
    notes: "Pixi paints EvaluatedFrame.paint (no authoring compile)",
  },
  {
    id: "primitive.text",
    label: "Text",
    columns: { ...yesPartial },
    notes: "Pixi paints EvaluatedFrame.paint (no authoring compile)",
  },
  {
    id: "primitive.shape",
    label: "Shape (rect/ellipse)",
    columns: { ...yesPartial },
    notes: "Pixi paints EvaluatedFrame.paint (no authoring compile)",
  },
  {
    id: "primitive.image",
    label: "Image",
    columns: { ...yesPartial },
    notes:
      "URI must resolve; missing URI → diagnostic placeholder; Pixi paints EvaluatedFrame.paint",
  },
  {
    id: "anim.transform",
    label: "Transform keyframes",
    columns: { ...yesPartial },
    notes: "Pixi paints EvaluatedFrame.paint (no authoring compile)",
  },
  {
    id: "anim.opacity",
    label: "Opacity keyframes",
    columns: { ...yesPartial },
    notes: "Pixi paints EvaluatedFrame.paint (no authoring compile)",
  },
] as const;

/** Wave-2 coverage: path → gradient → svg → effects → video → camera. */
export const WAVE2_CAPABILITY_LEDGER: readonly CapabilityRow[] = [
  {
    id: "primitive.path",
    label: "Path + stroke + trim",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "partial",
    },
    notes: "paintContours after morph/bend/trim; drawPath paint op",
  },
  {
    id: "style.gradient",
    label: "Linear/radial gradient fill",
    columns: {
      schema: "yes",
      command: "partial",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "partial",
    },
  },
  {
    id: "primitive.svg",
    label: "SVG asset (as fitted image)",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "yes",
    },
  },
  {
    id: "style.blend",
    label: "Blend mode",
    columns: {
      schema: "yes",
      command: "partial",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "partial",
    },
  },
  {
    id: "effect.blur",
    label: "Blur / shadow / glow / color-adjust",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "partial",
    },
    notes: "Pixi: blur + drop-shadow first; glow/color-adjust follow",
  },
  {
    id: "primitive.video",
    label: "Video texture",
    columns: {
      schema: "yes",
      command: "no",
      compiler: "yes",
      evaluator: "partial",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "partial",
    },
    notes: "drawVideo placeholder until browser/worker frame decode shares paint",
  },
  {
    id: "camera.orthographic",
    label: "Camera zoom/pan/rotation view",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "yes",
      parity: "planned",
      editor: "yes",
    },
    notes: "View matrix baked into RenderSnapshot items",
  },
  {
    id: "camera.parallax",
    label: "Layered 2.5D parallax",
    columns: {
      schema: "yes",
      command: "partial",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "partial",
    },
  },
] as const;

export const CAPABILITY_LEDGER: readonly CapabilityRow[] = [
  ...WAVE1_CAPABILITY_LEDGER,
  ...WAVE2_CAPABILITY_LEDGER,
];

export function capabilityReadyForAi(row: CapabilityRow): boolean {
  const required: CapabilityColumn[] = [
    "schema",
    "command",
    "compiler",
    "evaluator",
    "pixi",
    "worker",
  ];
  return required.every((col) => row.columns[col] === "yes");
}

export function listAiAllowlistCapabilities(): CapabilityRow[] {
  return CAPABILITY_LEDGER.filter(capabilityReadyForAi);
}

/** Prompt fragment for model generation. */
export function wave1CapabilityPromptBlock(): string {
  const wave1 = WAVE1_CAPABILITY_LEDGER.map((r) => r.id).join(", ");
  const wave2 = WAVE2_CAPABILITY_LEDGER.map((r) => r.id).join(", ");
  return [
    `Capability manifest ${CAPABILITY_MANIFEST_VERSION}`,
    `Wave-1 vertical slice: ${wave1}`,
    `Wave-2 (partial): ${wave2}`,
    "Prefer group, text, shape, image, path + transform/opacity keyframes.",
    "Path: stroke + trim-path ok. Camera via setCamera. Effects via addEffect (blur/glow/color-adjust/shadow).",
    "Do not invent mesh/shader/3d capabilities outside the ledger.",
  ].join("\n");
}
