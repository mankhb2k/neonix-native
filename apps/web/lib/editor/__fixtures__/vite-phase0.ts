/**
 * Vite Phase 0 baseline fixtures + deterministic command goldens.
 * Used by generate script and lock tests.
 */

import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "@/lib/editor/__fixtures__/projects";
import {
  CURRENT_STORAGE_VERSION,
  overlaysFromClips,
} from "@/lib/editor/persistence/project-migrations";
import { createEditorStore } from "@/lib/editor/store/create-editor-store";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  executeTimelineCommand,
  type TimelineDocument,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { parseMotionProject } from "@motionvideo/motion-protocol";

export const PHASE0_SAVED_AT = "2026-07-31T00:00:00.000Z";
/** Schema caps `scenes` / `sceneOrder` at 100 — committed large fixture stays parseable. */
export const PHASE0_LARGE_CLIP_COUNT = 100;
/**
 * In-memory stress sizes (bypass parseMotionProject) — see `large-timeline.ts`.
 * Use for virtualization DOM-budget tests, not the committed JSON envelope.
 */
export const PHASE0_STRESS_CLIP_COUNTS = [500, 2000] as const;

export type StoredEnvelope = {
  storageVersion: number;
  savedAt: string;
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  overlayScenes: ReturnType<typeof overlaysFromClips>;
};

export type DocSnapshot = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  transitions?: unknown[];
};

/** Make `uid()` / cloneSceneWithNewIds deterministic for golden generation. */
export function withDeterministicIds<T>(fn: () => T): T {
  const original = Math.random;
  let seed = 0;
  Math.random = () => {
    seed += 1;
    // Distinct values in [0, 1) so toString(36) slices stay unique.
    return (seed % 1_000_000) / 1_000_000;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function toStoredEnvelope(input: {
  project: MotionProject;
  clips: TimelineClip[];
  lanes: TimelineLane[];
}): StoredEnvelope {
  return {
    storageVersion: CURRENT_STORAGE_VERSION,
    savedAt: PHASE0_SAVED_AT,
    project: input.project,
    timelineClips: input.clips,
    timelineLanes: input.lanes,
    overlayScenes: overlaysFromClips(input.clips, input.lanes),
  };
}

function textNode(id: string, text: string) {
  return {
    id,
    type: "text" as const,
    parentId: null,
    transform: {
      x: 40,
      y: 40,
      width: 200,
      height: 40,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0,
      anchorY: 0,
      opacity: 1,
      visible: true,
      flipX: false,
      flipY: false,
    },
    payload: { text, fontSize: 24, fontWeight: 600, align: "left" as const },
    style: { fill: "#111111" },
  };
}

export function buildPhase0SmallFixture(): StoredEnvelope {
  const { project, clips, lanes } = fixtureMainOnly();
  const projectWithId = parseMotionProject({
    ...project,
    metadata: {
      ...project.metadata,
      id: "vite-phase0.small",
      name: "Phase0 Small",
    },
  });
  return toStoredEnvelope({ project: projectWithId, clips, lanes });
}

export function buildPhase0MediumFixture(): StoredEnvelope {
  const base = fixtureBasePlusOverlay();
  const lanes: TimelineLane[] = [
    ...base.lanes,
    {
      id: "lane.audio.0",
      kind: "audio",
      role: "audio",
      name: "Audio 1",
      order: 0,
    },
    {
      id: "lane.audio.1",
      kind: "audio",
      role: "audio",
      name: "Audio 2",
      order: 1,
    },
  ];
  const clips: TimelineClip[] = [
    ...base.clips,
    {
      kind: "audio",
      id: "clip.audio.a",
      audioTrackId: "audio.a",
      assetId: "asset.audio.a",
      laneId: "lane.audio.0",
      startTime: 0,
      duration: 3,
      name: "Bed",
    },
    {
      kind: "audio",
      id: "clip.audio.b",
      audioTrackId: "audio.b",
      assetId: "asset.audio.b",
      laneId: "lane.audio.1",
      startTime: 1.5,
      duration: 2,
      name: "Sfx",
    },
  ];
  const project = parseMotionProject({
    ...base.project,
    metadata: {
      ...base.project.metadata,
      id: "vite-phase0.medium",
      name: "Phase0 Medium",
    },
    assets: [
      {
        id: "asset.audio.a",
        assetType: "audio",
        uri: "assets/bed.mp3",
        integrity: "sha256-phase0-audio-a",
        mimeType: "audio/mpeg",
        duration: 3,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
      {
        id: "asset.audio.b",
        assetType: "audio",
        uri: "assets/sfx.mp3",
        integrity: "sha256-phase0-audio-b",
        mimeType: "audio/mpeg",
        duration: 2,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
    ],
    timeline: {
      sceneOrder: base.project.timeline.sceneOrder,
      audioTracks: [
        {
          id: "audio.a",
          role: "bgm",
          assetId: "asset.audio.a",
          start: 0,
          volume: 1,
        },
        {
          id: "audio.b",
          role: "sfx",
          assetId: "asset.audio.b",
          start: 1.5,
          volume: 0.8,
        },
      ],
    },
  });
  return toStoredEnvelope({ project, clips, lanes });
}

export function buildPhase0LargeFixture(
  clipCount = PHASE0_LARGE_CLIP_COUNT,
): StoredEnvelope {
  const baseLaneId = "lane.main";
  const overlayLaneId = "lane.overlay.0";
  const audioLaneId = "lane.audio.0";
  const lanes: TimelineLane[] = [
    {
      id: baseLaneId,
      kind: "visual",
      role: "base",
      name: "Main",
      order: -1,
      policy: { ...DEFAULT_VISUAL_POLICY },
    },
    {
      id: overlayLaneId,
      kind: "visual",
      role: "overlay",
      name: "Overlay 1",
      order: 0,
      policy: { ...DEFAULT_VISUAL_POLICY },
    },
    {
      id: audioLaneId,
      kind: "audio",
      role: "audio",
      name: "Audio 1",
      order: 0,
    },
  ];

  const mainCount = Math.max(1, Math.floor(clipCount * 0.7));
  const overlayCount = Math.max(0, Math.floor(clipCount * 0.2));
  const audioCount = Math.max(0, clipCount - mainCount - overlayCount);

  const clips: TimelineClip[] = [];
  const scenes: Array<{
    id: string;
    duration: number;
    nodes: ReturnType<typeof textNode>[];
    clips: unknown[];
  }> = [];
  const assets: Array<Record<string, unknown>> = [];
  const audioTracks: Array<Record<string, unknown>> = [];

  for (let i = 0; i < mainCount; i++) {
    const sceneId = `scene.main.${i}`;
    scenes.push({
      id: sceneId,
      duration: 1,
      nodes: [textNode(`${sceneId}.title`, `Main ${i}`)],
      clips: [],
    });
    clips.push({
      kind: "scene",
      id: `clip.main.${i}`,
      sceneId,
      laneId: baseLaneId,
      startTime: i,
      duration: 1,
      name: `Main ${i}`,
    });
  }

  for (let i = 0; i < overlayCount; i++) {
    const sceneId = `scene.ov.${i}`;
    scenes.push({
      id: sceneId,
      duration: 1.5,
      nodes: [textNode(`${sceneId}.title`, `Overlay ${i}`)],
      clips: [],
    });
    clips.push({
      kind: "scene",
      id: `clip.ov.${i}`,
      sceneId,
      laneId: overlayLaneId,
      startTime: i * 2,
      duration: 1.5,
      name: `Overlay ${i}`,
    });
  }

  for (let i = 0; i < audioCount; i++) {
    const assetId = `asset.audio.${i}`;
    const trackId = `audio.${i}`;
    assets.push({
      id: assetId,
      assetType: "audio",
      uri: `assets/perf-${i}.mp3`,
      integrity: `sha256-phase0-perf-${i}`,
      mimeType: "audio/mpeg",
      duration: 2,
      codec: "mp3",
      sampleRate: 44100,
      channels: 2,
    });
    audioTracks.push({
      id: trackId,
      role: "sfx",
      assetId,
      start: i * 1.5,
      volume: 1,
    });
    clips.push({
      kind: "audio",
      id: `clip.au.${i}`,
      audioTrackId: trackId,
      assetId,
      laneId: audioLaneId,
      startTime: i * 1.5,
      duration: 2,
      name: `Audio ${i}`,
    });
  }

  const project = parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "vite-phase0.large",
      name: `Phase0 Large ${clipCount}`,
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Phase0", primaryColor: "#1A5D3A" },
    },
    dependencies: { components: [] },
    assets,
    variables: [],
    timeline: {
      sceneOrder: scenes.map((s) => s.id),
      audioTracks,
    },
    scenes,
    bindings: [],
    extensions: { constraints: [], events: [] },
  });

  return toStoredEnvelope({ project, clips, lanes });
}

function snapshotDoc(doc: TimelineDocument): DocSnapshot {
  return {
    project: doc.project,
    clips: doc.clips,
    lanes: doc.lanes,
    transitions: doc.transitions ?? [],
  };
}

function applyPure(
  doc: TimelineDocument,
  command: Parameters<typeof executeTimelineCommand>[1],
  selection?: Parameters<typeof executeTimelineCommand>[2],
): TimelineDocument {
  const result = executeTimelineCommand(doc, command, selection);
  if (result.status !== "applied") {
    throw new Error(`Command rejected: ${result.reason} — ${result.message}`);
  }
  return result.document;
}

/** Named golden outputs keyed by filename stem (without `.after.json`). */
export function buildPhase0Goldens(): Record<string, DocSnapshot> {
  return withDeterministicIds(() => {
    const { project, clips, lanes } = fixtureMainOnly();
    const baseDoc: TimelineDocument = { project, clips, lanes };
    const overlay = fixtureBasePlusOverlay();
    const overlayDoc: TimelineDocument = {
      project: overlay.project,
      clips: overlay.clips,
      lanes: overlay.lanes,
    };

    const moved = applyPure(baseDoc, {
      type: "move-clip",
      clipId: "clip.main.b",
      patch: { startTime: 3 },
    });

    const trimmed = applyPure(baseDoc, {
      type: "clip/trim",
      clipId: "clip.main.a",
      duration: 1.25,
      startTime: 0,
    });

    const split = applyPure(
      baseDoc,
      { type: "split-selected-clips", time: 1 },
      { kind: "clips", ids: ["clip.main.a"], primaryId: "clip.main.a" },
    );

    const duplicated = applyPure(
      baseDoc,
      { type: "duplicate-selected-clips" },
      { kind: "clips", ids: ["clip.main.b"], primaryId: "clip.main.b" },
    );

    const deleted = applyPure(
      overlayDoc,
      { type: "delete-selected-clips" },
      { kind: "clips", ids: ["clip.overlay"], primaryId: "clip.overlay" },
    );

    const locked = applyPure(baseDoc, {
      type: "update-lane-flags",
      laneId: "lane.main",
      patch: { locked: true },
    });

    const reordered = applyPure(overlayDoc, {
      type: "reorder-lane",
      laneId: "lane.overlay.0",
      newOrder: 0,
    });

    const store = createEditorStore();
    store.getState().loadProject(project, [], clips, lanes);
    const moveRes = store.getState().executeTimelineCommand({
      type: "move-clip",
      clipId: "clip.main.b",
      patch: { startTime: 3 },
    });
    if (moveRes.status !== "applied") {
      throw new Error(`Store move rejected: ${moveRes.reason}`);
    }
    store.getState().undo();
    const afterUndo: DocSnapshot = {
      project: store.getState().project,
      clips: store.getState().timelineClips,
      lanes: store.getState().timelineLanes,
    };
    store.getState().redo();
    const afterRedo: DocSnapshot = {
      project: store.getState().project,
      clips: store.getState().timelineClips,
      lanes: store.getState().timelineLanes,
    };

    return {
      "move-clip": snapshotDoc(moved),
      "trim-clip": snapshotDoc(trimmed),
      "split-clip": snapshotDoc(split),
      "duplicate-clip": snapshotDoc(duplicated),
      "delete-clip": snapshotDoc(deleted),
      "lane-lock": snapshotDoc(locked),
      "lane-reorder": snapshotDoc(reordered),
      "undo-after-move": afterUndo,
      "redo-after-undo": afterRedo,
    };
  });
}
