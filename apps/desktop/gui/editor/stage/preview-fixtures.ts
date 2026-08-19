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
  parseMotionProjectV1,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";

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
  const layers: SyntheticPreviewNode[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layers.push({
      id: `syn_${i}`,
      label: `N${i}`,
      x: col * 24,
      y: row * 16,
      w: 20,
      h: 12,
    });
  }
  return layers;
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
 * Minimal MotionProject + timeline with `size` text layers for DomStage paint benchmarks.
 */
export function buildStagePaintFixture(size: number): StagePaintFixture {
  const count = buildSyntheticClipCount(size);
  const cols = Math.ceil(Math.sqrt(count));
  const layers = Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `node_${i}`,
      type: "text" as const,
      parentLayerId: null,
      zIndex: i,
      timing: { start: 0, duration: 4 },
      ...visualLayerAtoms({ x: 40 + col * 24, y: 40 + row * 16, width: 20, height: 12, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
      payload: {
        text: `N${i}`,
        fontSize: 12,
        color: "#111111",
        alignment: "left",
      },
    };
  });

  const project = parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "proj_stage_bench",
      name: "Stage bench",
      locale: "vi-VN",
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#1A5D3A",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    assets: [],
    variables: [],
    components: [],
    layers,
    bindings: [],
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
      sceneId: "node_0",
      laneId: "lane_base",
      startTime: 0,
      duration: 4,
      name: "Bench",
    },
  ];

  return { project, clips, lanes };
}
