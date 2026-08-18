import { visualLayerAtoms } from "@motionvideo/motion-protocol";
/**
 * Minimal MotionProject + timeline builders for Playwright seeding.
 * Keep JSON plain — runs in Node and is serialized into page.addInitScript.
 */

export const STORAGE_KEY = "motionvideo.projects";
export const STORAGE_VERSION = 1;

const DEFAULT_POLICY = { allowOverlap: false, rippleMode: false } as const;

export type StoredEditorProject = {
  storageVersion: number;
  savedAt: string;
  project: Record<string, unknown>;
  timelineClips: TimelineClipSeed[];
  timelineLanes: TimelineLaneSeed[];
  overlayScenes: unknown[];
};

export type TimelineLaneSeed = {
  id: string;
  kind: "visual" | "audio";
  role: "base" | "overlay" | "audio";
  name: string;
  order: number;
  policy?: typeof DEFAULT_POLICY;
  locked?: boolean;
  muted?: boolean;
  visible?: boolean;
};

export type TimelineClipSeed = {
  id: string;
  kind: "scene" | "audio";
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
  sceneId?: string;
  audioTrackId?: string;
  assetId?: string;
};

function textNode(id: string, text: string) {
  return {
    id,
    type: "text" as const,
    parentLayerId: null,
    ...visualLayerAtoms({ x: 40, y: 40, width: 200, height: 40, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0, opacity: 100, visible: true }),
    payload: {
      text,
      fontSize: 24,
      color: "#111111",
      alignment: "left" as const,
    },
  };
}

function scene(id: string, name: string, duration: number) {
  return {
    id,
    duration,
    layers: [textNode(`${id}.title`, name)],
    clips: [] as unknown[],
  };
}

export function baseLane(id = "lane.main"): TimelineLaneSeed {
  return {
    id,
    kind: "visual",
    role: "base",
    name: "Main",
    order: -1,
    policy: { ...DEFAULT_POLICY },
  };
}

export function overlayLane(
  id: string,
  order: number,
  name: string,
): TimelineLaneSeed {
  return {
    id,
    kind: "visual",
    role: "overlay",
    name,
    order,
    policy: { ...DEFAULT_POLICY },
  };
}

export function audioLane(
  id: string,
  order: number,
  name: string,
): TimelineLaneSeed {
  return {
    id,
    kind: "audio",
    role: "audio",
    name,
    order,
  };
}

export function sceneClip(input: {
  id: string;
  sceneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
}): TimelineClipSeed {
  return { kind: "scene", ...input };
}

export function audioClip(input: {
  id: string;
  audioTrackId: string;
  assetId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
}): TimelineClipSeed {
  return { kind: "audio", ...input };
}

export function buildStoredProject(input: {
  projectId: string;
  name: string;
  scenes: ReturnType<typeof scene>[];
  clips: TimelineClipSeed[];
  lanes: TimelineLaneSeed[];
  audioTracks?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
}): StoredEditorProject {
  const project = {
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: input.projectId,
      name: input.name,
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
    assets: input.assets ?? [],
    variables: [],
    tokens: {},
    components: [],
    timeline: {
      visualTracks: [
        {
          id: "main-track",
          role: "main",
          order: 0,
          clips: (() => {
            let cursor = 0;
            return input.scenes.map((s) => {
              const clip = {
                id: `clip-${s.id}`,
                source: { kind: "scene", sceneId: s.id },
                start: cursor,
                duration: s.duration,
              };
              cursor += s.duration;
              return clip;
            });
          })(),
        },
      ],
      audioTracks: input.audioTracks ?? [],
      captionTracks: [],
    },
    scenes: input.scenes,
    bindings: [],
  };

  return {
    storageVersion: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    project,
    timelineClips: input.clips,
    timelineLanes: input.lanes,
    overlayScenes: [],
  };
}

/** Single base clip — persistence / scrub smoke. */
export function buildMainOnlyProject(projectId = "e2e.editor.persistence") {
  return buildStoredProject({
    projectId,
    name: "E2E Editor",
    scenes: [scene("scene.main", "E2E Clip", 4)],
    clips: [
      sceneClip({
        id: "clip.main",
        sceneId: "scene.main",
        laneId: "lane.main",
        startTime: 0,
        duration: 4,
        name: "E2E Clip",
      }),
    ],
    lanes: [baseLane()],
  });
}

/** Two overlay lanes + base — cross-lane overlay DnD (dest lane starts empty). */
export function buildOverlayCrossLaneProject(
  projectId = "e2e.editor.crosslane",
) {
  return buildStoredProject({
    projectId,
    name: "E2E Cross Lane Overlay",
    scenes: [
      scene("scene.main", "Main", 4),
      scene("scene.ov", "OvClip", 2),
    ],
    clips: [
      sceneClip({
        id: "clip.main",
        sceneId: "scene.main",
        laneId: "lane.main",
        startTime: 0,
        duration: 4,
        name: "MainClip",
      }),
      sceneClip({
        id: "clip.ov",
        sceneId: "scene.ov",
        laneId: "lane.overlay.0",
        startTime: 0,
        duration: 2,
        name: "OvClip",
      }),
    ],
    lanes: [
      baseLane(),
      overlayLane("lane.overlay.0", 0, "Lớp 1"),
      overlayLane("lane.overlay.1", 1, "Lớp 2"),
    ],
  });
}

/** Two audio lanes + base — cross-lane audio DnD. */
export function buildAudioCrossLaneProject(projectId = "e2e.editor.audio-cross") {
  return buildStoredProject({
    projectId,
    name: "E2E Cross Lane Audio",
    scenes: [scene("scene.main", "Main", 6)],
    assets: [
      {
        id: "asset.audio.a",
        assetType: "audio",
        uri: "assets/a.mp3",
        integrity: "sha256-e2e-a",
        mimeType: "audio/mpeg",
        duration: 2,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
      {
        id: "asset.audio.b",
        assetType: "audio",
        uri: "assets/b.mp3",
        integrity: "sha256-e2e-b",
        mimeType: "audio/mpeg",
        duration: 2,
        codec: "mp3",
        sampleRate: 44100,
        channels: 2,
      },
    ],
    audioTracks: [
      {
        id: "a0",
        role: "sfx",
        assetId: "asset.audio.a",
        start: 0,
        volume: 100,
      },
      {
        id: "a1",
        role: "sfx",
        assetId: "asset.audio.b",
        start: 3,
        volume: 100,
      },
    ],
    clips: [
      sceneClip({
        id: "clip.main",
        sceneId: "scene.main",
        laneId: "lane.main",
        startTime: 0,
        duration: 6,
        name: "MainClip",
      }),
      audioClip({
        id: "a0",
        audioTrackId: "a0",
        assetId: "asset.audio.a",
        laneId: "lane.audio.0",
        startTime: 0,
        duration: 2,
        name: "AudioA",
      }),
      audioClip({
        id: "a1",
        audioTrackId: "a1",
        assetId: "asset.audio.b",
        laneId: "lane.audio.1",
        startTime: 3,
        duration: 2,
        name: "AudioB",
      }),
    ],
    lanes: [
      baseLane(),
      audioLane("lane.audio.0", 0, "Audio 1"),
      audioLane("lane.audio.1", 1, "Audio 2"),
    ],
  });
}

/** Enough audio lanes to force the tracks viewport to scroll vertically. */
export function buildScrollableAudioProject(
  projectId = "e2e.editor.audio-scroll",
  laneCount = 8,
) {
  const laneIndexes = Array.from({ length: laneCount }, (_, index) => index);
  return buildStoredProject({
    projectId,
    name: "E2E Scrollable Audio",
    scenes: [scene("scene.main", "Main", 12)],
    assets: laneIndexes.map((index) => ({
      id: `asset.audio.${index}`,
      assetType: "audio",
      uri: `assets/audio-${index}.mp3`,
      integrity: `sha256-e2e-audio-${index}`,
      mimeType: "audio/mpeg",
      duration: 2,
      codec: "mp3",
      sampleRate: 44100,
      channels: 2,
    })),
    audioTracks: laneIndexes.map((index) => ({
      id: `audio.${index}`,
      role: "sfx",
      assetId: `asset.audio.${index}`,
      start: 0,
      volume: 100,
    })),
    clips: [
      sceneClip({
        id: "clip.main",
        sceneId: "scene.main",
        laneId: "lane.main",
        startTime: 0,
        duration: 12,
        name: "MainClip",
      }),
      ...laneIndexes.map((index) =>
        audioClip({
          id: `audio.${index}`,
          audioTrackId: `audio.${index}`,
          assetId: `asset.audio.${index}`,
          laneId: `lane.audio.${index}`,
          startTime: 0,
          duration: 2,
          name: `Audio ${index + 1}`,
        }),
      ),
    ],
    lanes: [
      baseLane(),
      ...laneIndexes.map((index) =>
        audioLane(`lane.audio.${index}`, index, `Audio ${index + 1}`),
      ),
    ],
  });
}

export { scene, textNode };

const VIDEO_ATOMS = visualLayerAtoms({
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
  opacity: 100,
  visible: true,
});

/**
 * V1 protocol project: two sequential videos + a group, packed on Main.
 * Clip ids equal layer ids so packing/drill-in e2e can target strips by id.
 */
export function buildPackedMainWithGroupProject(
  projectId = "e2e.editor.pack-group",
): StoredEditorProject {
  const videoAsset = {
    id: "asset.video",
    uri: "./clip.mp4",
    assetType: "video",
    mimeType: "video/mp4",
    width: 1920,
    height: 1080,
    duration: 12,
    fps: 30,
  };
  const project = {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: projectId, name: "E2E Pack Group", locale: "vi-VN" },
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
    variables: [],
    assets: [videoAsset],
    components: [],
    timeline: { duration: 12 },
    bindings: [],
    layers: [
      {
        id: "video-a",
        type: "video",
        parentLayerId: null,
        name: "Video A",
        zIndex: 0,
        timing: { start: 0, duration: 4 },
        ...VIDEO_ATOMS,
        payload: { assetId: "asset.video", trimStart: 0 },
      },
      {
        id: "video-b",
        type: "video",
        parentLayerId: null,
        name: "Video B",
        zIndex: 1,
        timing: { start: 4, duration: 4 },
        ...VIDEO_ATOMS,
        payload: { assetId: "asset.video", trimStart: 0 },
      },
      {
        id: "hero",
        type: "group",
        parentLayerId: null,
        name: "Hero",
        zIndex: 2,
        timing: { start: 8, duration: 4 },
        ...VIDEO_ATOMS,
        children: [
          {
            id: "hero.title",
            type: "text",
            parentLayerId: "hero",
            name: "Title",
            zIndex: 0,
            timing: { start: 0, duration: 4 },
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
              visible: true,
            }),
            payload: {
              text: "Title",
              fontSize: 24,
              color: "#111111",
              alignment: "left",
            },
          },
        ],
      },
    ],
  };

  return {
    storageVersion: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    project,
    timelineClips: [
      sceneClip({
        id: "video-a",
        sceneId: "video-a",
        laneId: "lane.main",
        startTime: 0,
        duration: 4,
        name: "Video A",
      }),
      sceneClip({
        id: "video-b",
        sceneId: "video-b",
        laneId: "lane.main",
        startTime: 4,
        duration: 4,
        name: "Video B",
      }),
      sceneClip({
        id: "hero",
        sceneId: "hero",
        laneId: "lane.main",
        startTime: 8,
        duration: 4,
        name: "Hero",
      }),
    ],
    timelineLanes: [baseLane()],
    overlayScenes: [],
  };
}

