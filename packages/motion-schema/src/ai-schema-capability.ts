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
export const AI_SCHEMA_CAPABILITY_VERSION = "ai-schema.0";

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
    notes: "Params mostly ignored until Phase 1 registry",
  },
  {
    id: "baseline.plain-text",
    label: "Plain text node + drawText",
    phase: 0,
    columns: {
      schema: "yes",
      compiler: "yes",
      runtime: "partial",
      paint: "partial",
      pixi: "partial",
      remotion: "partial",
      ai: "yes",
    },
    notes: "Typography fields drop before paint until Phase 2",
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
      schema: "planned",
      compiler: "planned",
      runtime: "planned",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "no",
    },
  },
  {
    id: "preset.exit-typed",
    label: "Typed exit presets + params",
    phase: 1,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "no",
    },
  },
  {
    id: "text.rich-runs",
    label: "Rich text runs",
    phase: 2,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "planned",
      paint: "planned",
      pixi: "planned",
      remotion: "planned",
      ai: "no",
    },
  },
  {
    id: "caption.track",
    label: "Caption track + cues",
    phase: 3,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "planned",
      paint: "planned",
      pixi: "planned",
      remotion: "planned",
      ai: "no",
    },
  },
  {
    id: "layout.stack-advanced",
    label: "Stack EdgeInsets/justify/content sizing",
    phase: 4,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "no",
    },
  },
  {
    id: "transition.composition",
    label: "Multi-scene transition composition",
    phase: 5,
    columns: {
      schema: "partial",
      compiler: "partial",
      runtime: "planned",
      paint: "planned",
      pixi: "planned",
      remotion: "planned",
      ai: "partial",
    },
    notes: "fade/crossfade in schema; hard-cut evaluate today",
  },
  {
    id: "audio.analysis",
    label: "AudioAnalysis + beat markers",
    phase: 6,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "yes",
      paint: "yes",
      pixi: "yes",
      remotion: "yes",
      ai: "no",
    },
  },
  {
    id: "blend.extended",
    label: "darken/lighten/overlay + scene background",
    phase: 7,
    columns: {
      schema: "planned",
      compiler: "planned",
      runtime: "planned",
      paint: "planned",
      pixi: "planned",
      remotion: "planned",
      ai: "no",
    },
  },
] as const;

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
