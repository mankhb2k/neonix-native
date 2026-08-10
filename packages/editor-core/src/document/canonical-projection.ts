/**
 * Canonical projection: MotionProject → TimelineDocument.
 *
 * This is the SINGLE source of truth for deriving lanes/clips from the
 * authoring project. Every command must go through this path.
 *
 * Rule: project (canonical) → projectToTimelineDocument → TimelineDocument (derived).
 *       The inverse path (rebuildMainProject) is DEPRECATED and will be removed in Phase 3.
 */

import type { MotionProject } from "@motionvideo/motion-protocol";
import { createHash } from "node:crypto";
import { sceneOrderToTimelineClips } from "../timeline/selectors/scene-order-clips";
import { normalizeLaneOrders } from "../timeline/timeline-clips";
import type { TimelineDocument } from "./document";
import type {
  TimelineClip,
  TimelineLane,
} from "../timeline/model/timeline-types";

// ── Revision ──────────────────────────────────────────────────────────

/**
 * Initial revision for a freshly projected document.
 * Increments monotonically on every project mutation.
 */
export const INITIAL_REVISION = 1;

// ── Fingerprint ───────────────────────────────────────────────────────

/**
 * JSON.stringify with recursively sorted keys for deterministic output.
 */
function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) =>
      stableStringify(k) +
      ":" +
      stableStringify((value as Record<string, unknown>)[k]),
  );
  return "{" + pairs.join(",") + "}";
}

/**
 * Compute a stable fingerprint of a MotionProject for drift detection.
 * Uses deterministic JSON-stable keys (recursively sorted) → SHA-256.
 */
export function computeProjectFingerprint(project: MotionProject): string {
  const stable = stableStringify(project);
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

/**
 * Create a fingerprint from existing document's project for comparison.
 */
export function documentFingerprint(doc: TimelineDocument): string {
  return computeProjectFingerprint(doc.project);
}

// ── Canonical projection ──────────────────────────────────────────────

/**
 * Derive a complete TimelineDocument from a MotionProject.
 *
 * This is the canonical one-way projection:
 *   project.sceneOrder → lanes + clips
 *
 * Audio clips are derived from project.timeline.audioTracks.
 *
 * @param project The authoring project (canonical source of truth)
 * @param previousRevision If provided, revision = previousRevision + 1; else INITIAL_REVISION
 */
export function projectToTimelineDocument(
  project: MotionProject,
  previousRevision?: number,
): TimelineDocument {
  const { lanes, clips } = sceneOrderToTimelineClips(project);
  const normalizedLanes = normalizeLaneOrders(lanes);

  const revision = (previousRevision ?? INITIAL_REVISION - 1) + 1;
  const fingerprint = computeProjectFingerprint(project);

  return {
    project,
    lanes: normalizedLanes,
    clips,
    revision,
    fingerprint,
  };
}

/**
 * Re-derive lanes/clips from the document's own project, bumping revision.
 * Use this when patching the project inline and you want a fresh document.
 */
export function rederiveDocument(doc: TimelineDocument): TimelineDocument {
  return projectToTimelineDocument(doc.project, doc.revision);
}

// ── Renderer guard ────────────────────────────────────────────────────

/**
 * Check whether a TimelineDocument's lanes/clips are fresh with respect
 * to its embedded project. Renderers MUST call this before consuming.
 *
 * Returns false if:
 *  - fingerprint doesn't match project
 *  - revision is missing or zero
 *  - document has no fingerprint (legacy)
 */
export function isDocumentFresh(doc: TimelineDocument): boolean {
  if (doc.revision == null || doc.revision <= 0) return false;
  if (!doc.fingerprint) return false;
  return doc.fingerprint === computeProjectFingerprint(doc.project);
}

/**
 * Assert document freshness; throws if stale.
 * Call at renderer boundaries (Pixi, Remotion, export).
 */
export function assertDocumentFresh(doc: TimelineDocument): void {
  if (!isDocumentFresh(doc)) {
    const current = computeProjectFingerprint(doc.project);
    throw new Error(
      `[renderer-guard] Stale TimelineDocument: revision=${doc.revision}, ` +
        `stored=${doc.fingerprint}, computed=${current}. ` +
        `Re-derive via projectToTimelineDocument() before passing to renderer.`,
    );
  }
}

// ── Stable ID validation ──────────────────────────────────────────────

export type StableIdViolation = {
  kind:
    | "dangling_scene"
    | "dangling_audio_track"
    | "dangling_node"
    | "dangling_asset";
  message: string;
  refId: string;
  source: string;
};

/**
 * Validate that all clip/lane references resolve to entities in the project.
 * Unlike validateTimelineDocument (which checks structural invariants),
 * this focuses on referential integrity for stable IDs across saves.
 */
export function validateStableIds(doc: TimelineDocument): StableIdViolation[] {
  const violations: StableIdViolation[] = [];
  const sceneIds = new Set(doc.project.scenes.map((s) => s.id));
  const audioTrackIds = new Set(
    (doc.project.timeline.audioTracks ?? []).map((t) => t.id),
  );
  const assetIds = new Set((doc.project.assets ?? []).map((a) => a.id));

  for (const clip of doc.clips) {
    if (clip.kind === "scene" && !sceneIds.has(clip.sceneId)) {
      violations.push({
        kind: "dangling_scene",
        message: `Clip "${clip.id}" references missing scene "${clip.sceneId}"`,
        refId: clip.sceneId,
        source: clip.id,
      });
    }
    if (clip.kind === "audio") {
      if (clip.audioTrackId && !audioTrackIds.has(clip.audioTrackId)) {
        violations.push({
          kind: "dangling_audio_track",
          message: `Clip "${clip.id}" references missing audio track "${clip.audioTrackId}"`,
          refId: clip.audioTrackId,
          source: clip.id,
        });
      }
      if (clip.assetId && !assetIds.has(clip.assetId)) {
        violations.push({
          kind: "dangling_asset",
          message: `Clip "${clip.id}" references missing asset "${clip.assetId}"`,
          refId: clip.assetId,
          source: clip.id,
        });
      }
    }
  }

  // Check scene node references
  for (const scene of doc.project.scenes) {
    for (const node of scene.nodes) {
      if (node.assetId && !assetIds.has(node.assetId)) {
        violations.push({
          kind: "dangling_asset",
          message: `Node "${node.id}" in scene "${scene.id}" references missing asset "${node.assetId}"`,
          refId: node.assetId,
          source: node.id,
        });
      }
    }
  }

  return violations;
}
