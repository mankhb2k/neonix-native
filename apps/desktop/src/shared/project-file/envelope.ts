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
      aspectRatio: string;
      fps: number;
      locale: string;
      brand: {
        name: string;
        primaryColor: string;
        fontFamily: string;
      };
    };
    dependencies: { components: unknown[] };
    assets: unknown[];
    variables: unknown[];
    timeline: { sceneOrder: unknown[]; audioTracks: unknown[] };
    scenes: unknown[];
    bindings: unknown[];
    extensions: { constraints: unknown[]; events: unknown[] };
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
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      "Missing formatVersion.",
    );
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

export function projectIdFromEnvelope(envelope: DesktopProjectEnvelope): string {
  return envelope.project.metadata.id;
}

export function projectNameFromEnvelope(
  envelope: DesktopProjectEnvelope,
): string {
  return envelope.project.metadata.name;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** In-memory blank project (not written to disk until save/saveAs). */
export function buildBlankDesktopProject(input?: {
  name?: string;
  createId?: (prefix: string) => string;
}): { envelope: DesktopProjectEnvelope; documentJson: string; projectId: string } {
  const uid = input?.createId ?? createId;
  const name = input?.name?.trim() || "Untitled";
  const projectId = uid("proj");
  const envelope: DesktopProjectEnvelope = {
    format: EDITOR_PROJECT_FORMAT,
    formatVersion: EDITOR_ENVELOPE_VERSION,
    project: {
      format: "motion-project",
      formatVersion: 2,
      metadata: {
        id: projectId,
        name,
        aspectRatio: "16:9",
        fps: 30,
        locale: "vi-VN",
        brand: {
          name,
          primaryColor: "#1A5D3A",
          fontFamily: "Be Vietnam Pro",
        },
      },
      dependencies: { components: [] },
      assets: [],
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
      timeline: { sceneOrder: [], audioTracks: [] },
      scenes: [],
      bindings: [],
      extensions: { constraints: [], events: [] },
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

/** Skeleton: auto-save journal hooks (disabled in Phase 4 MVP). */
export type ProjectJournal = {
  enabled: boolean;
  record?(event: { type: string; path?: string; at: string }): void;
};

export const disabledProjectJournal: ProjectJournal = {
  enabled: false,
};
