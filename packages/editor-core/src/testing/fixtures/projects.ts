import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
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

/** Scene tối giản dùng trong fixture editor (V1 layers). */
function scene(id: string, name: string, duration = 3) {
  return {
    id,
    duration,
    layers: [
      {
        id: `${id}.title`,
        type: "text" as const,
        parentLayerId: null,
        zIndex: 0,
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
        payload: {
          content: { kind: "plain" as const, text: name },
          fontSize: 24,
          color: "#111111",
          alignment: "left" as const,
        },
      },
    ],
    clips: [],
  };
}

function baseProject(
  id: string,
  name: string,
  scenes: ReturnType<typeof scene>[],
): MotionProject {
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
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {
      colors: { brand: "#1A5D3A" },
      fonts: { display: "Be Vietnam Pro" },
    },
    assets: [],
    variables: [],
    components: [],
    timeline: {
      visualTracks: [
        {
          id: "primary",
          role: "main",
          order: 0,
          clips: scenes.map((s, i) => ({
            id: `vclip-${i}-${s.id}`,
            source: { kind: "scene" as const, sceneId: s.id },
            start:
              i > 0
                ? scenes.slice(0, i).reduce((acc, sc) => acc + sc.duration, 0)
                : 0,
            duration: s.duration,
          })),
        },
      ],
      audioTracks: [],
      captionTracks: [],
    },
    scenes,
    bindings: [],
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
    timeline: {
      visualTracks: [
        {
          id: "primary",
          role: "main",
          order: 0,
          clips: [
            {
              id: "vclip-main",
              source: { kind: "scene" as const, sceneId: "scene.main" },
              start: 0,
              duration: 6,
            },
          ],
        },
      ],
      audioTracks: [
        {
          id: "audio.a",
          role: "bgm",
          assetId: "asset.audio.a",
          start: 0,
          duration: 4,
          volume: 1,
        },
        {
          id: "audio.b",
          role: "sfx",
          assetId: "asset.audio.b",
          start: 2,
          duration: 3,
          volume: 0.8,
        },
        {
          id: "audio.c",
          role: "voiceover",
          assetId: "asset.audio.c",
          start: 2.5,
          duration: 2,
          volume: 1,
        },
      ],
      captionTracks: [],
    },
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
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {
      colors: { brand: "#1A5D3A" },
      fonts: { display: "Be Vietnam Pro" },
    },
    assets: [],
    variables: [],
    components: [],
    timeline: {
      visualTracks: [
        {
          id: "primary",
          role: "main",
          order: 0,
          clips: [
            {
              id: "vclip-a",
              source: { kind: "scene" as const, sceneId: "scene.a" },
              start: 0,
              duration: 2,
            },
            {
              id: "vclip-b",
              source: { kind: "scene" as const, sceneId: "scene.b" },
              start: 2,
              duration: 2,
            },
          ],
        },
      ],
      audioTracks: [],
      captionTracks: [],
    },
    scenes: [
      {
        id: "scene.a",
        duration: 2,
        layers: [
          {
            id: "node.a.root",
            type: "group",
            parentLayerId: null,
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
            parentLayerId: "node.a.root",
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
            payload: {
              content: { kind: "plain", text: "A" },
              fontSize: 18,
              color: "#000000",
              alignment: "left" as const,
            },
          },
        ],
        clips: [
          {
            id: "anim.a",
            layerId: "node.a.child",
            schedule: { kind: "absolute", at: 0 },
            duration: 1,
            playback: { iterations: 1, direction: "normal", rate: 1 },
            source: {
              kind: "tracks",
              tracks: [
                {
                  layerId: "node.a.child",
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
        layers: [
          {
            id: "node.b.title",
            type: "text",
            parentLayerId: null,
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
            payload: {
              content: { kind: "plain", text: "B" },
              fontSize: 20,
              color: "#222222",
              alignment: "left" as const,
            },
          },
        ],
        clips: [],
      },
    ],
    bindings: [],
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
