/**
 * Phase 1 tests: canonical projection, renderer guard, stable IDs.
 */
import { describe, it, expect } from "vitest";
import {
  projectToTimelineDocument,
  rederiveDocument,
  isDocumentFresh,
  assertDocumentFresh,
  validateStableIds,
  computeProjectFingerprint,
  INITIAL_REVISION,
} from "../document/canonical-projection";
import { validateTimelineDocument } from "../document/document";
import type { MotionProject } from "@motionvideo/motion-protocol";
import type { TimelineDocument } from "../document/document";

// ── Fixtures ──────────────────────────────────────────────────────────

function minimalProject(overrides?: Partial<MotionProject>): MotionProject {
  return {
    format: "motion-project",
    formatVersion: 3,
    metadata: {
      id: "test-proj",
      name: "Test Project",
      locale: "en-US",
      ...overrides?.metadata,
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      ...overrides?.composition,
    },
    dependencies: {
      compiler: { range: ">=1.0.0" },
      ...overrides?.dependencies,
    },
    timeline: {
      visualTracks: [],
      audioTracks: [],
      captionTracks: [],
      ...overrides?.timeline,
    },
    extensions: overrides?.extensions ?? {},
    scenes: overrides?.scenes ?? [],
    assets: overrides?.assets ?? [],
    components: overrides?.components ?? [],
    variables: overrides?.variables ?? [],
    bindings: overrides?.bindings ?? [],
    tokens: overrides?.tokens ?? {},
    capabilities: overrides?.capabilities ?? {},
  };
}

// ── Task 1.2: Canonical projection ────────────────────────────────────

describe("projectToTimelineDocument", () => {
  it("derives lanes/clips from empty project", () => {
    const proj = minimalProject();
    const doc = projectToTimelineDocument(proj);

    expect(doc.project).toBe(proj);
    expect(doc.revision).toBe(INITIAL_REVISION);
    expect(doc.fingerprint).toBeDefined();
    expect(doc.fingerprint).toHaveLength(16);
    expect(doc.lanes.length).toBeGreaterThanOrEqual(1);
    expect(
      doc.lanes.some((l) => l.kind === "visual" && l.role === "base"),
    ).toBe(true);
  });

  it("produces valid document per invariants", () => {
    const proj = minimalProject();
    const doc = projectToTimelineDocument(proj);
    const result = validateTimelineDocument(doc);
    expect(result.valid).toBe(true);
  });

  it("increments revision when previousRevision provided", () => {
    const proj = minimalProject();
    const doc1 = projectToTimelineDocument(proj);
    const doc2 = projectToTimelineDocument(proj, doc1.revision);

    expect(doc2.revision).toBe(doc1.revision! + 1);
  });

  it("fingerprint is identical for identical projects", () => {
    const proj1 = minimalProject();
    const proj2 = minimalProject();

    expect(computeProjectFingerprint(proj1)).toBe(
      computeProjectFingerprint(proj2),
    );
  });

  it("fingerprint changes when project changes", () => {
    const proj1 = minimalProject();
    // Construct a genuinely different project by modifying the result
    const proj2: MotionProject = {
      ...proj1,
      metadata: { ...proj1.metadata, id: "different-id" },
    };

    expect(computeProjectFingerprint(proj1)).not.toBe(
      computeProjectFingerprint(proj2),
    );
  });

  it("fingerprint is stable under JSON key ordering", () => {
    const proj1 = minimalProject();
    const proj2: MotionProject = {
      format: "motion-project",
      formatVersion: 3,
      metadata: {
        id: "test-proj",
        name: "Test Project",
        locale: "en-US",
      },
      composition: { width: 1920, height: 1080, fps: 30 },
      dependencies: { compiler: { range: ">=1.0.0" } },
      assets: [],
      components: [],
      variables: [],
      bindings: [],
      tokens: {},
      extensions: {},
      capabilities: {},
      scenes: [],
      timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
    };

    expect(computeProjectFingerprint(proj1)).toBe(
      computeProjectFingerprint(proj2),
    );
  });
});

describe("rederiveDocument", () => {
  it("bumps revision and preserves fingerprint match", () => {
    const doc1 = projectToTimelineDocument(minimalProject());
    const doc2 = rederiveDocument(doc1);

    expect(doc2.revision).toBe(doc1.revision! + 1);
    expect(isDocumentFresh(doc2)).toBe(true);
  });
});

// ── Task 1.3: Renderer guard ──────────────────────────────────────────

describe("isDocumentFresh", () => {
  it("returns true for freshly projected document", () => {
    const doc = projectToTimelineDocument(minimalProject());
    expect(isDocumentFresh(doc)).toBe(true);
  });

  it("returns false for legacy document with no revision", () => {
    const proj = minimalProject();
    const doc: TimelineDocument = {
      project: proj,
      lanes: [],
      clips: [],
    };
    expect(isDocumentFresh(doc)).toBe(false);
  });

  it("returns false for legacy document with no fingerprint", () => {
    const doc: TimelineDocument = {
      project: minimalProject(),
      lanes: [],
      clips: [],
      revision: 5,
    };
    expect(isDocumentFresh(doc)).toBe(false);
  });

  it("returns false for document with revision <= 0", () => {
    const doc: TimelineDocument = {
      project: minimalProject(),
      lanes: [],
      clips: [],
      revision: 0,
      fingerprint: computeProjectFingerprint(minimalProject()),
    };
    expect(isDocumentFresh(doc)).toBe(false);
  });

  it("returns false when fingerprint mismatches project", () => {
    const doc = projectToTimelineDocument(minimalProject());
    // Create a provably different project and swap it in
    const differentProject: MotionProject = {
      ...doc.project,
      metadata: { ...doc.project.metadata, id: "tampered-id" },
    };
    const tampered: TimelineDocument = {
      ...doc,
      project: differentProject,
    };
    expect(isDocumentFresh(tampered)).toBe(false);
  });
});

describe("assertDocumentFresh", () => {
  it("does not throw for fresh document", () => {
    const doc = projectToTimelineDocument(minimalProject());
    expect(() => assertDocumentFresh(doc)).not.toThrow();
  });

  it("throws for stale document", () => {
    const doc: TimelineDocument = {
      project: minimalProject(),
      lanes: [],
      clips: [],
    };
    expect(() => assertDocumentFresh(doc)).toThrow(/stale/i);
  });
});

// ── Task 1.4: Stable ID validation ───────────────────────────────────

describe("validateStableIds", () => {
  it("returns empty for empty document", () => {
    const doc = projectToTimelineDocument(minimalProject());
    expect(validateStableIds(doc)).toHaveLength(0);
  });

  it("detects dangling scene clip references", () => {
    const proj = minimalProject();
    const doc = projectToTimelineDocument(proj);
    const badDoc: TimelineDocument = {
      ...doc,
      clips: [
        {
          id: "clip-1",
          kind: "scene",
          sceneId: "nonexistent-scene",
          laneId: doc.lanes[0]!.id,
          startTime: 0,
          duration: 5,
          name: "Ghost Clip",
        },
      ],
    };
    const violations = validateStableIds(badDoc);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.kind).toBe("dangling_scene");
  });

  it("detects dangling audio track and asset references", () => {
    const proj = minimalProject();
    const doc = projectToTimelineDocument(proj);
    const badDoc: TimelineDocument = {
      ...doc,
      clips: [
        {
          id: "clip-2",
          kind: "audio",
          audioTrackId: "nonexistent-track",
          assetId: "nonexistent-asset",
          laneId: doc.lanes[0]!.id,
          startTime: 0,
          duration: 3,
          name: "Ghost Audio",
        },
      ],
    };
    const violations = validateStableIds(badDoc);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    const kinds = violations.map((v) => v.kind);
    expect(kinds).toContain("dangling_audio_track");
    expect(kinds).toContain("dangling_asset");
  });
});
