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
import { computeProjectHashShort } from "@motionvideo/motion-protocol";
import { visualTracksToTimelineClips } from "../timeline/selectors/scene-order-clips";
import { normalizeLaneOrders } from "../timeline/timeline-clips";
import type { TimelineDocument } from "./document";

// ── Revision ──────────────────────────────────────────────────────────

/**
 * Initial revision for a freshly projected document.
 * Increments monotonically on every project mutation.
 */
export const INITIAL_REVISION = 1;

// ── Fingerprint ───────────────────────────────────────────────────────

/**
 * Compute a stable fingerprint of a MotionProject for drift detection.
 * Phase 11: delegates to @motionvideo/motion-protocol canonical hash.
 */
export function computeProjectFingerprint(project: MotionProject): string {
  return computeProjectHashShort(project as Record<string, unknown>);
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
 *   project.timeline.visualTracks → lanes + clips
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
  const { lanes, clips } = visualTracksToTimelineClips(project);
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
  const rootLayers = doc.project.layers.filter(
    (layer) => layer.parentLayerId === null,
  );
  const sceneIds = new Set(
    rootLayers
      .filter((layer) => layer.type !== "audio")
      .map((layer) => layer.id),
  );
  const audioTrackIds = new Set(
    rootLayers
      .filter((layer) => layer.type === "audio")
      .map((layer) => layer.id),
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

  // Check scene node references (group layers carry children; media leafs reference assets)
  for (const scene of rootLayers) {
    const nodes = scene.type === "group" ? scene.children : [];
    for (const node of nodes) {
      const assetId =
        node.type === "image" || node.type === "video" || node.type === "audio"
          ? node.payload.assetId
          : undefined;
      if (assetId && !assetIds.has(assetId)) {
        violations.push({
          kind: "dangling_asset",
          message: `Node "${node.id}" in scene "${scene.id}" references missing asset "${assetId}"`,
          refId: assetId,
          source: node.id,
        });
      }
    }
  }

  return violations;
}
