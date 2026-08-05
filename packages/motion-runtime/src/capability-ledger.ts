/**
 * Wave-1 capability ledger — only rows with pixi+worker (or planned) enter AI manifest.
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

/** Bump when wave-1 ledger columns change for AI prompts. */
export const CAPABILITY_MANIFEST_VERSION = "wave1.1";

export type CapabilityRow = {
  id: string;
  label: string;
  columns: Record<CapabilityColumn, CapabilityStatus>;
  notes?: string;
};

/** Four-primitive vertical slice + shared transform/keyframes. */
export const WAVE1_CAPABILITY_LEDGER: readonly CapabilityRow[] = [
  {
    id: "primitive.group",
    label: "Group",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
  },
  {
    id: "primitive.text",
    label: "Text",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
  },
  {
    id: "primitive.shape",
    label: "Shape (rect/ellipse)",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
  },
  {
    id: "primitive.image",
    label: "Image",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
    notes: "URI must resolve; missing URI → diagnostic placeholder",
  },
  {
    id: "anim.transform",
    label: "Transform keyframes",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
  },
  {
    id: "anim.opacity",
    label: "Opacity keyframes",
    columns: {
      schema: "yes",
      command: "yes",
      compiler: "yes",
      evaluator: "yes",
      pixi: "partial",
      worker: "partial",
      parity: "planned",
      editor: "yes",
    },
  },
] as const;

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
  return WAVE1_CAPABILITY_LEDGER.filter(capabilityReadyForAi);
}

/** Prompt fragment: wave-1 primitives even while pixi/worker are partial. */
export function wave1CapabilityPromptBlock(): string {
  const ids = WAVE1_CAPABILITY_LEDGER.map((r) => r.id).join(", ");
  return [
    `Capability manifest ${CAPABILITY_MANIFEST_VERSION}`,
    `Wave-1 vertical slice: ${ids}`,
    "Prefer group, text, shape, image + transform/opacity keyframes only.",
    "Do not invent path/video/mesh/shader capabilities outside the ledger.",
  ].join("\n");
}
