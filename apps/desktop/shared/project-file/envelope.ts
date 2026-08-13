/**
 * Desktop .mt project envelope — shared by main + renderer.
 * Structural validation only (no apps/web imports).
 */

export const EDITOR_PROJECT_FORMAT = "motion-editor-project" as const;
export const EDITOR_ENVELOPE_VERSION = 1;

export type DesktopProjectEnvelope = {
  format: typeof EDITOR_PROJECT_FORMAT;
  formatVersion: number;
  project: {
    format: string;
    formatVersion: number;
    metadata: {
      id: string;
      name: string;
      locale: string;
    };
    composition: {
      width: number;
      height: number;
      fps: number;
      background: string;
      colorSpace: string;
      audioSampleRate: number;
    };
    capabilities: Record<string, unknown>;
    dependencies: {
      compiler: { range: string };
      components: unknown[];
    };
    tokens: {
      colors?: Record<string, string>;
      fonts?: Record<string, string>;
    };
    variables: unknown[];
    assets: unknown[];
    components: unknown[];
    scenes: unknown[];
    timeline: {
      visualTracks: unknown[];
      audioTracks: unknown[];
      captionTracks: unknown[];
    };
    bindings: unknown[];
  };
  timelineClips: unknown[];
  timelineLanes: unknown[];
};

export type ProjectFileParseErrorCode = "CORRUPT_FILE" | "UNSUPPORTED_VERSION";

export class ProjectFileParseError extends Error {
  readonly code: ProjectFileParseErrorCode;

  constructor(code: ProjectFileParseErrorCode, message: string) {
    super(message);
    this.name = "ProjectFileParseError";
    this.code = code;
  }
}

export function isDesktopProjectEnvelope(
  value: unknown,
): value is DesktopProjectEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.format === EDITOR_PROJECT_FORMAT;
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      `Invalid project file: ${label} must be an object.`,
    );
  }
  return value as Record<string, unknown>;
}

/** Parse JSON text or already-parsed value into a desktop envelope. */
export function parseDesktopProjectFile(
  input: string | unknown,
): DesktopProjectEnvelope {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      throw new ProjectFileParseError(
        "CORRUPT_FILE",
        "Project file is not valid JSON.",
      );
    }
  }

  const root = assertObject(raw, "root");
  if (root.format !== EDITOR_PROJECT_FORMAT) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      `Expected format "${EDITOR_PROJECT_FORMAT}".`,
    );
  }

  if (typeof root.formatVersion !== "number") {
    throw new ProjectFileParseError("CORRUPT_FILE", "Missing formatVersion.");
  }
  if (root.formatVersion > EDITOR_ENVELOPE_VERSION) {
    throw new ProjectFileParseError(
      "UNSUPPORTED_VERSION",
      `Unsupported formatVersion ${root.formatVersion} (max ${EDITOR_ENVELOPE_VERSION}).`,
    );
  }
  if (root.formatVersion < 1) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      `Invalid formatVersion ${root.formatVersion}.`,
    );
  }

  const project = assertObject(root.project, "project");
  const metadata = assertObject(project.metadata, "project.metadata");
  if (typeof metadata.id !== "string" || !metadata.id) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      "project.metadata.id is required.",
    );
  }
  if (typeof metadata.name !== "string") {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      "project.metadata.name is required.",
    );
  }

  if (!Array.isArray(root.timelineClips)) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      "timelineClips must be an array.",
    );
  }
  if (!Array.isArray(root.timelineLanes)) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      "timelineLanes must be an array.",
    );
  }

  return {
    format: EDITOR_PROJECT_FORMAT,
    formatVersion: EDITOR_ENVELOPE_VERSION,
    project: project as DesktopProjectEnvelope["project"],
    timelineClips: root.timelineClips,
    timelineLanes: root.timelineLanes,
  };
}

export function serializeDesktopProjectEnvelope(
  envelope: DesktopProjectEnvelope,
): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function projectIdFromEnvelope(
  envelope: DesktopProjectEnvelope,
): string {
  return envelope.project.metadata.id;
}

export function projectNameFromEnvelope(
  envelope: DesktopProjectEnvelope,
): string {
  return envelope.project.metadata.name;
}

/** Derive legacy aspect-ratio label from v1 composition dimensions. */
export function envelopeAspectRatio(
  envelope: DesktopProjectEnvelope,
): "16:9" | "9:16" | "1:1" {
  const { width, height } = envelope.project.composition;
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.01) return "9:16";
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return "16:9";
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const ASPECT_SIZES: Record<
  "16:9" | "9:16" | "1:1",
  { width: number; height: number }
> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

/** In-memory blank project (not written to disk until save/saveAs). */
export function buildBlankDesktopProject(input?: {
  name?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  createId?: (prefix: string) => string;
}): {
  envelope: DesktopProjectEnvelope;
  documentJson: string;
  projectId: string;
} {
  const uid = input?.createId ?? createId;
  const name = input?.name?.trim() || "Untitled";
  const aspectRatio = input?.aspectRatio ?? "16:9";
  const projectId = uid("proj");
  const { width, height } = ASPECT_SIZES[aspectRatio];
  const envelope: DesktopProjectEnvelope = {
    format: EDITOR_PROJECT_FORMAT,
    formatVersion: EDITOR_ENVELOPE_VERSION,
    project: {
      format: "motion-project",
      formatVersion: 1,
      metadata: {
        id: projectId,
        name,
        locale: "vi-VN",
      },
      composition: {
        width,
        height,
        fps: 30,
        background: "#1A5D3A",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      capabilities: {},
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {
        colors: { brand: "#1A5D3A" },
        fonts: { display: "Be Vietnam Pro" },
      },
      variables: [
        {
          id: "project.brandName",
          type: "string",
          name: "Brand Name",
          value: name,
        },
        {
          id: "project.primaryColor",
          type: "color",
          name: "Primary Color",
          value: "#1A5D3A",
        },
      ],
      assets: [],
      components: [],
      scenes: [],
      timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
      bindings: [],
    },
    timelineClips: [],
    timelineLanes: [
      {
        id: uid("lane"),
        kind: "visual",
        role: "base",
        name: "Main",
        order: -1,
        policy: { rippleMode: true, allowOverlap: false },
      },
    ],
  };
  return {
    envelope,
    documentJson: serializeDesktopProjectEnvelope(envelope),
    projectId,
  };
}

/** Auto-save journal types (main process owns the enabled service). */
export type ProjectJournal = {
  enabled: boolean;
  record?(event: { type: string; path?: string; at: string }): void;
};

export const disabledProjectJournal: ProjectJournal = {
  enabled: false,
};
