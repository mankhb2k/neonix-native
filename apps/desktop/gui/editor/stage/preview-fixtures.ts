/**
 * Large-fixture builders for preview profiling (N7 / G2).
 * DOM StageRendererPort remains the default; Pixi is post-DOM-baseline.
 */

import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";

export const PREVIEW_FIXTURE_SIZES = [100, 500, 2000] as const;

export type PreviewFixtureSize = (typeof PREVIEW_FIXTURE_SIZES)[number];

export function buildSyntheticClipCount(size: number): number {
  return Math.max(1, size);
}

/** Lightweight scene stubs for stress painting (not full MotionProject). */
export type SyntheticPreviewNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function buildSyntheticPreviewNodes(
  size: number,
): SyntheticPreviewNode[] {
  const count = buildSyntheticClipCount(size);
  const nodes: SyntheticPreviewNode[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id: `syn_${i}`,
      label: `N${i}`,
      x: col * 24,
      y: row * 16,
      w: 20,
      h: 12,
    });
  }
  return nodes;
}

/** Dropped-frame gate target (ms) for a 60fps paint loop under fixture load. */
export const PREVIEW_FRAME_BUDGET_MS = 1000 / 60;

/** Document payload accepted by StageRendererPort.setDocument. */
export type StagePaintFixture = {
  project: MotionProject;
  clips: TimelineClip[];
  lanes: TimelineLane[];
};

/**
 * Minimal MotionProject + timeline with `size` text nodes for DomStage paint benchmarks.
 */
export function buildStagePaintFixture(size: number): StagePaintFixture {
  const count = buildSyntheticClipCount(size);
  const cols = Math.ceil(Math.sqrt(count));
  const nodes = Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `node_${i}`,
      type: "text" as const,
      parentId: null,
      zIndex: i,
      transform: {
        x: 40 + col * 24,
        y: 40 + row * 16,
        width: 20,
        height: 12,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        opacity: 1,
        visible: true,
        flipX: false,
        flipY: false,
      },
      payload: {
        text: `N${i}`,
        fontSize: 12,
        fontWeight: 500,
        align: "left" as const,
      },
    };
  });

  const project = parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "proj_stage_bench",
      name: "Stage bench",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: {
        name: "Bench",
        primaryColor: "#1A5D3A",
        fontFamily: "Be Vietnam Pro",
      },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: { sceneOrder: ["scene_bench"], audioTracks: [] },
    scenes: [
      {
        id: "scene_bench",
        name: "Bench",
        duration: 4,
        nodes,
        clips: [],
      },
    ],
    bindings: [],
    extensions: { constraints: [], events: [] },
  });

  const lanes: TimelineLane[] = [
    {
      id: "lane_base",
      kind: "visual",
      role: "base",
      name: "Main",
      order: -1,
      policy: { ...DEFAULT_VISUAL_POLICY },
    },
  ];
  const clips: TimelineClip[] = [
    {
      id: "clip_bench",
      kind: "scene",
      sceneId: "scene_bench",
      laneId: "lane_base",
      startTime: 0,
      duration: 4,
      name: "Bench",
    },
  ];

  return { project, clips, lanes };
}
