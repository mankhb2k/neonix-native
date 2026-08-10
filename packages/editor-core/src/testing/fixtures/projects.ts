import { parseMotionProjectV2, type MotionProjectV2 } from "@motionvideo/motion-protocol";
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

/** Scene tối giản dùng trong fixture editor. */
function scene(id: string, name: string, duration = 3) {
  return {
    id,
    duration,
    nodes: [
      {
        id: `${id}.title`,
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
        payload: { content: { kind: "plain" as const, text: name }, fontSize: 24, fontWeight: 600, align: "left" as const },
        style: { fill: "#111111" },
      },
    ],
    clips: [],
  };
}

function baseProject(id: string, name: string, scenes: ReturnType<typeof scene>[]): MotionProjectV2 {
  return parseMotionProjectV2({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id,
      name,
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name, primaryColor: "#1A5D3A", fontFamily: "Be Vietnam Pro" },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: {
      sceneOrder: scenes.map((s) => s.id),
      audioTracks: [],
    },
    scenes,
    bindings: [],
    extensions: { constraints: [], events: [] },
  });
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
  const base = baseProject("fixture.main-audio-overlap", "Main + Audio Overlap", [
    scene("scene.main", "Main", 6),
  ]);
  const project = parseMotionProjectV2({
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
    timeline: {
      sceneOrder: ["scene.main"],
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
          start: 2,
          volume: 0.8,
        },
        {
          id: "audio.c",
          role: "voiceover",
          assetId: "asset.audio.c",
          start: 2.5,
          volume: 1,
        },
      ],
    },
  });
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

/** Legacy lưu bằng overlay sidecar + sceneOrder, chưa có clips/lanes. */
export function fixtureLegacyTrackLayerIndex() {
  // Legacy: scene vẫn nằm trong project (schema yêu cầu schedule);
  // placement overlay lấy từ sidecar layerIndex, không từ sceneOrder.
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
  const project = parseMotionProjectV2({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "fixture.multi-ref",
      name: "Multi Scene Refs",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Refs", primaryColor: "#1A5D3A" },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: { sceneOrder: ["scene.a", "scene.b"], audioTracks: [] },
    scenes: [
      {
        id: "scene.a",
        duration: 2,
        nodes: [
          {
            id: "node.a.root",
            type: "group",
            parentId: null,
            transform: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
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
          },
          {
            id: "node.a.child",
            type: "text",
            parentId: "node.a.root",
            transform: {
              x: 10,
              y: 10,
              width: 80,
              height: 30,
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
            payload: { content: { kind: "plain", text: "A" }, fontSize: 18, fontWeight: 400, align: "left" },
            style: { fill: "#000" },
          },
        ],
        clips: [
          {
            id: "anim.a",
            targetId: "node.a.child",
            schedule: { kind: "absolute", at: 0 },
            duration: 1,
            playback: { iterations: 1, direction: "normal", rate: 1 },
            source: {
              kind: "tracks",
              tracks: [
                {
                  targetId: "node.a.child",
                  property: "transform.opacity",
                  keys: [
                    { t: 0, v: 0 },
                    { t: 1, v: 1, easing: "linear" },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        id: "scene.b",
        duration: 2,
        nodes: [
          {
            id: "node.b.title",
            type: "text",
            parentId: null,
            transform: {
              x: 20,
              y: 20,
              width: 120,
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
            payload: { content: { kind: "plain", text: "B" }, fontSize: 20, fontWeight: 600, align: "left" },
            style: { fill: "#222" },
          },
        ],
        clips: [],
      },
    ],
    bindings: [],
    extensions: {
      constraints: [
        {
          id: "constraint.a",
          type: "lookAt",
          sourceId: "node.a.child",
          targetId: "node.a.root",
        },
      ],
      events: [],
    },
  });
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
