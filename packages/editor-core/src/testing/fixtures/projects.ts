import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";
import type { OverlaySceneItem } from "../../overlay-scenes";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../../timeline/timeline-clips";

function baseLane(id = "lane.main"): TimelineLane {
  return {
    id,
    kind: "visual",
    role: "base",
    name: "Main",
    order: -1,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

function overlayLane(id: string, order: number, name: string): TimelineLane {
  return {
    id,
    kind: "visual",
    role: "overlay",
    name,
    order,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

function sceneClip(input: {
  id: string;
  sceneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
}): TimelineClip {
  return { kind: "scene", ...input };
}

/** Scene tối giản dùng trong fixture editor (V1 group + text child). */
function scene(id: string, name: string, duration = 3) {
  return {
    id,
    type: "group" as const,
    parentLayerId: null,
    timing: { start: 0, duration },
    ...visualLayerAtoms({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    }),
    children: [
      {
        id: `${id}.title`,
        type: "text" as const,
        parentLayerId: id,
        zIndex: 0,
        timing: { start: 0, duration },
        ...visualLayerAtoms({
          x: 40,
          y: 40,
          width: 200,
          height: 40,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0,
          originY: 0,
          opacity: 100,
        }),
        payload: {
          text: name,
          fontSize: 24,
          color: "#111111",
          alignment: "left" as const,
        },
      },
    ],
  };
}

function baseProject(
  id: string,
  name: string,
  scenes: ReturnType<typeof scene>[],
): MotionProject {
  const duration = scenes.reduce(
    (sum, item) => sum + (item.timing?.duration ?? 0),
    0,
  );
  return parseMotionProject({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id,
      name,
      locale: "vi-VN",
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#FFFFFF",
      colorSpace: "srgb",
    },
    assets: [],
    components: [],
    layers: scenes.map((item, index) => ({ ...item, zIndex: index })),
  }) as MotionProject;
}

/** Project chỉ có main/base timeline. */
export function fixtureMainOnly() {
  const project = baseProject("fixture.main-only", "Main Only", [
    scene("scene.main.a", "Intro", 2),
    scene("scene.main.b", "Body", 3),
  ]);
  const lanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [
    sceneClip({
      id: "clip.main.a",
      sceneId: "scene.main.a",
      laneId: "lane.main",
      startTime: 0,
      duration: 2,
      name: "Intro",
    }),
    sceneClip({
      id: "clip.main.b",
      sceneId: "scene.main.b",
      laneId: "lane.main",
      startTime: 2,
      duration: 3,
      name: "Body",
    }),
  ];
  return { project, clips, lanes, overlayScenes: [] as OverlaySceneItem[] };
}

/** Base visual + overlay visual (cùng scene collection). */
export function fixtureBasePlusOverlay() {
  const project = baseProject("fixture.base-overlay", "Base + Overlay", [
    scene("scene.base", "Base Scene", 4),
    scene("scene.overlay", "Overlay Scene", 2),
  ]);
  const lanes: TimelineLane[] = [
    baseLane(),
    overlayLane("lane.overlay.0", 0, "Lớp 1"),
  ];
  const clips: TimelineClip[] = [
    sceneClip({
      id: "clip.base",
      sceneId: "scene.base",
      laneId: "lane.main",
      startTime: 0,
      duration: 4,
      name: "Base Scene",
    }),
    sceneClip({
      id: "clip.overlay",
      sceneId: "scene.overlay",
      laneId: "lane.overlay.0",
      startTime: 1,
      duration: 2,
      name: "Overlay Scene",
    }),
  ];
  const overlayScenes: OverlaySceneItem[] = [
    {
      id: "clip.overlay",
      name: "Overlay Scene",
      duration: 2,
      startTime: 1,
      layerIndex: 0,
    },
  ];
  return { project, clips, lanes, overlayScenes };
}

/** Main + nhiều audio track overlap (để kiểm tra migration lane). */
export function fixtureMainPlusAudioOverlap() {
  const base = baseProject(
    "fixture.main-audio-overlap",
    "Main + Audio Overlap",
    [scene("scene.main", "Main", 6)],
  );
  const project = parseMotionProject({
    ...base,
    assets: [
      {
        id: "asset.audio.a",
        assetType: "audio",
        uri: "assets/bed.mp3",
        integrity: "sha256-fixture-audio-a",
        mimeType: "audio/mpeg",
        duration: 4,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
      {
        id: "asset.audio.b",
        assetType: "audio",
        uri: "assets/sfx.mp3",
        integrity: "sha256-fixture-audio-b",
        mimeType: "audio/mpeg",
        duration: 3,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
      {
        id: "asset.audio.c",
        assetType: "audio",
        uri: "assets/vo.mp3",
        integrity: "sha256-fixture-audio-c",
        mimeType: "audio/mpeg",
        duration: 2,
        codec: "mp3",
        sampleRate: 44100,
        channels: 1,
      },
    ],

    layers: [
      ...base.layers,
      {
        id: "audio.a",
        type: "audio",
        parentLayerId: null,
        zIndex: -1,
        timing: { start: 0, duration: 4 },
        payload: {
          assetId: "asset.audio.a",
          trimStart: 0,
          playbackRate: 1,
          volume: 100,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          muted: false,
        },
      },
      {
        id: "audio.b",
        type: "audio",
        parentLayerId: null,
        zIndex: -2,
        timing: { start: 1, duration: 3 },
        payload: {
          assetId: "asset.audio.b",
          trimStart: 0,
          playbackRate: 1,
          volume: 100,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          muted: false,
        },
      },
      {
        id: "audio.c",
        type: "audio",
        parentLayerId: null,
        zIndex: -3,
        timing: { start: 2, duration: 2 },
        payload: {
          assetId: "asset.audio.c",
          trimStart: 0,
          playbackRate: 1,
          volume: 100,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          muted: false,
        },
      },
    ],
  }) as MotionProject;
  const lanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [
    sceneClip({
      id: "clip.main",
      sceneId: "scene.main",
      laneId: "lane.main",
      startTime: 0,
      duration: 6,
      name: "Main",
    }),
  ];
  return { project, clips, lanes, overlayScenes: [] as OverlaySceneItem[] };
}

/**
 * @migrationOnly — Tests legacy overlay-scene deserialization from the
 * pre-visualTracks era. Clips/Lanes are empty; scene placement is derived
 * from the envelope's overlayScenes sidecar via layerIndex.
 */
export function fixtureLegacyTrackLayerIndex() {
  // Scene placement is resolved from overlayScenes sidecar,
  // not from visualTracks or the old V2 sceneOrder field.
  const project = baseProject("fixture.legacy-track", "Legacy Track", [
    scene("scene.main", "Main", 3),
    scene("scene.ov", "Overlay", 2),
  ]);
  const overlayScenes: OverlaySceneItem[] = [
    {
      id: "scene.ov",
      name: "Overlay",
      duration: 2,
      startTime: 0.5,
      layerIndex: 0,
    },
  ];
  return {
    project,
    clips: [] as TimelineClip[],
    lanes: [] as TimelineLane[],
    overlayScenes,
  };
}

/** Nhiều scene/node để kiểm tra clone/remap reference. */
export function fixtureMultiSceneReferences() {
  const project = parseMotionProject({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "fixture.multi-ref",
      name: "Multi Scene Refs",
      locale: "vi-VN",
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#FFFFFF",
      colorSpace: "srgb",
    },
    assets: [],
    components: [],
    layers: [
      {
        id: "scene.a",
        type: "group",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...visualLayerAtoms({ x: 0, y: 0, width: 1920, height: 1080 }),
        children: [
          {
            id: "node.a.root",
            type: "group",
            parentLayerId: "scene.a",
            zIndex: 0,
            timing: { start: 0, duration: 2 },
            ...visualLayerAtoms({ x: 0, y: 0, width: 100, height: 100 }),
            children: [
              {
                id: "node.a.child",
                type: "text",
                parentLayerId: "node.a.root",
                zIndex: 0,
                timing: { start: 0, duration: 2 },
                ...visualLayerAtoms({ x: 10, y: 10, width: 80, height: 30 }),
                payload: {
                  text: "A",
                  fontSize: 18,
                  color: "#000000",
                  alignment: "left" as const,
                },
              },
            ],
          },
        ],
      },
      {
        id: "scene.b",
        type: "group",
        parentLayerId: null,
        zIndex: 1,
        timing: { start: 0, duration: 2 },
        ...visualLayerAtoms({ x: 0, y: 0, width: 1920, height: 1080 }),
        children: [
          {
            id: "node.b.title",
            type: "text",
            parentLayerId: "scene.b",
            zIndex: 0,
            timing: { start: 0, duration: 2 },
            ...visualLayerAtoms({ x: 20, y: 20, width: 120, height: 40 }),
            payload: {
              text: "B",
              fontSize: 20,
              color: "#222222",
              alignment: "left" as const,
            },
          },
        ],
      },
    ],
  }) as MotionProject;
  const lanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [
    sceneClip({
      id: "clip.a",
      sceneId: "scene.a",
      laneId: "lane.main",
      startTime: 0,
      duration: 2,
      name: "A",
    }),
    sceneClip({
      id: "clip.b",
      sceneId: "scene.b",
      laneId: "lane.main",
      startTime: 2,
      duration: 2,
      name: "B",
    }),
  ];
  return { project, clips, lanes, overlayScenes: [] as OverlaySceneItem[] };
}

export type EditorFixture = ReturnType<typeof fixtureMainOnly>;
