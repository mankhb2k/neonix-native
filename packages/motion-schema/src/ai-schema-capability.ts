/**
 * AI schema expansion capability matrix — end-to-end columns only.
 * A row is production-ready when every required column is "yes".
 */

export type AiSchemaCapabilityColumn =
  | "schema"
  | "compiler"
  | "runtime"
  | "paint"
  | "pixi"
  | "remotion"
  | "ai";

export type AiSchemaCapabilityStatus = "yes" | "partial" | "no" | "planned";

export type AiSchemaCapabilityRow = {
  id: string;
  label: string;
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  columns: Record<AiSchemaCapabilityColumn, AiSchemaCapabilityStatus>;
  notes?: string;
};

/** Bump when matrix rows/columns change for AI prompts. */
export const AI_SCHEMA_CAPABILITY_VERSION = "ai-schema.1";

export const AI_SCHEMA_CAPABILITY_MATRIX: readonly AiSchemaCapabilityRow[] = [
  {
    id: "baseline.entrance-preset",
    label: "Entrance presets (fade/slide/scale/pop)",
    phase: 0,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
  },
  {
    id: "baseline.plain-text",
    label: "Plain text node + drawText",
    phase: 0,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "yes",
    },
  },
  {
    id: "baseline.hard-cut",
    label: "Multi-scene hard cut",
    phase: 0,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "yes",
    },
  },
  {
    id: "preset.scene-end",
    label: "Scene-end clip schedule",
    phase: 1,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
  },
  {
    id: "preset.exit-typed",
    label: "Typed exit presets + params",
    phase: 1,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
  },
  {
    id: "text.rich-runs",
    label: "Rich text runs",
    phase: 2,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
  },
  {
    id: "caption.track",
    label: "Caption track + cues",
    phase: 3,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "partial",
      paint: "partial",
      pixi: "partial",
      remotion: "partial",
      ai: "partial",
    },
    notes: "Cue compiler + SourceRef ready; full caption paint path partial",
  },
  {
    id: "layout.stack-advanced",
    label: "Stack EdgeInsets/justify/content sizing",
    phase: 4,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
  },
  {
    id: "transition.composition",
    label: "Multi-scene transition composition",
    phase: 5,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "partial",
      pixi: "partial",
      remotion: "partial",
      ai: "yes",
    },
    notes: "Shared layer plan for fade/crossfade/slide/wipe/zoom",
  },
  {
    id: "audio.analysis",
    label: "AudioAnalysis + beat markers",
    phase: 6,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "partial",
    },
    notes: "Planner beat tools; energy never dumped into prompts",
  },
  {
    id: "blend.extended",
    label: "darken/lighten/overlay + scene background",
    phase: 7,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "yes",
    },
  },
];

export function aiSchemaCapabilityPromptBlock(): string {
  const lines = AI_SCHEMA_CAPABILITY_MATRIX.map((row) => {
    const cols = Object.entries(row.columns)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    return `- ${row.id}: ${cols}${row.notes ? ` (${row.notes})` : ""}`;
  });
  return [`AI schema capability matrix ${AI_SCHEMA_CAPABILITY_VERSION}:`, ...lines].join("\n");
}

/** Ready for production painters when schema→pixi/remotion are yes (AI column optional). */
export function aiSchemaCapabilityReady(row: AiSchemaCapabilityRow): boolean {
  const required: AiSchemaCapabilityColumn[] = [
    "schema",
    "compiler",
    "runtime",
    "paint",
    "pixi",
    "remotion",
  ];
  return required.every((col) => row.columns[col] === "yes");
}

export function listAiSchemaProductionCapabilities(): AiSchemaCapabilityRow[] {
  return AI_SCHEMA_CAPABILITY_MATRIX.filter(aiSchemaCapabilityReady);
}

export function isAiSchemaCapabilityReady(id: string): boolean {
  const row = AI_SCHEMA_CAPABILITY_MATRIX.find((item) => item.id === id);
  return row ? aiSchemaCapabilityReady(row) : false;
}
