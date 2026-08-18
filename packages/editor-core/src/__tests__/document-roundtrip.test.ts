import { describe, expect, it } from "vitest";
import {
  documentFromStoreState,
  storeStateFromDocument,
  type TimelineDocument,
} from "../document/document";
import { fixtureBasePlusOverlay } from "../testing/fixtures/projects";

/**
 * Cầu nối giữa web store và TimelineDocument:
 * documentFromStoreState / storeStateFromDocument phải là phép đối chiếu
 * giữ nguyên project (reference), lanes/clips và metadata revision/fingerprint.
 */
describe("documentFromStoreState", () => {
  it("returns null when project is null", () => {
    const result = documentFromStoreState({
      project: null,
      timelineLanes: [],
      timelineClips: [],
    });
    expect(result).toBeNull();
  });

  it("maps store fields onto document shape", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const result = documentFromStoreState({
      project,
      timelineLanes: lanes,
      timelineClips: clips,
      revision: 7,
      fingerprint: "deadbeefdeadbeef",
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lanes).toBe(lanes);
    expect(result.clips).toBe(clips);
    expect(result.revision).toBe(7);
    expect(result.fingerprint).toBe("deadbeefdeadbeef");
  });

  it("preserves project reference identity", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const result = documentFromStoreState({
      project,
      timelineLanes: lanes,
      timelineClips: clips,
    });
    expect(result?.project).toBe(project);
  });
});

describe("storeStateFromDocument", () => {
  it("round-trips documentFromStoreState", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const state = {
      project,
      timelineLanes: lanes,
      timelineClips: clips,
      revision: 3,
      fingerprint: "cafebabecafebabe",
    };
    const doc = documentFromStoreState(state);
    expect(doc).not.toBeNull();
    if (!doc) return;
    const back = storeStateFromDocument(doc);
    expect(back.project).toBe(project);
    expect(back.timelineLanes).toEqual(lanes);
    expect(back.timelineClips).toEqual(clips);
    expect(back.revision).toBe(3);
    expect(back.fingerprint).toBe("cafebabecafebabe");
  });

  it("preserves project reference", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };
    const back = storeStateFromDocument(doc);
    expect(back.project).toBe(project);
  });
});

describe("roundtrip idempotence", () => {
  it("documentFromStoreState ∘ storeStateFromDocument preserves lanes/clips", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = {
      project,
      clips,
      lanes,
      revision: 5,
      fingerprint: "0123456789abcdef",
    };
    const state = storeStateFromDocument(doc);
    const doc2 = documentFromStoreState(state);
    expect(doc2).not.toBeNull();
    if (!doc2) return;
    expect(doc2.project).toBe(project);
    expect(doc2.lanes).toEqual(lanes);
    expect(doc2.clips).toEqual(clips);
    expect(doc2.revision).toBe(5);
    expect(doc2.fingerprint).toBe("0123456789abcdef");
  });
});
