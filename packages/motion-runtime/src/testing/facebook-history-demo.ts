import {
  parseMotionProject,
  type MotionClip,
  type MotionNode,
  type MotionProject,
  type MotionScene,
} from "@motionvideo/motion-schema";

export const FB_HISTORY_SCENE_IDS = {
  hook: "scene.hook",
  harvard: "scene.harvard",
  newsfeed: "scene.newsfeed",
  ipo: "scene.ipo",
  meta: "scene.meta",
  outro: "scene.outro",
} as const;

const BLUE = "#1877F2";
const BLUE_DARK = "#0C1A33";
const WHITE = "#ffffff";
const INK = "#0f1419";
const MUTED = "#6b7280";
const CARD = "#f3f4f6";

type Xform = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  anchorX?: number;
  anchorY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
};

function xform(input: Xform) {
  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    scaleX: input.scaleX ?? 1,
    scaleY: input.scaleY ?? 1,
    opacity: input.opacity ?? 1,
    visible: true,
    anchorX: input.anchorX ?? 0.5,
    anchorY: input.anchorY ?? 0.5,
    flipX: false,
    flipY: false,
  };
}

function bg(id: string, fill: string): MotionNode {
  return {
    id,
    type: "shape",
    name: "Background",
    parentId: null,
    zIndex: 0,
    transform: xform({
      x: 960,
      y: 540,
      width: 1920,
      height: 1080,
      anchorX: 0.5,
      anchorY: 0.5,
    }),
    payload: { shape: "rectangle" },
    style: { fill },
  };
}

function rect(
  id: string,
  name: string,
  t: Xform,
  fill: string,
  opts?: { parentId?: string | null; zIndex?: number; cornerRadius?: number },
): MotionNode {
  return {
    id,
    type: "shape",
    name,
    parentId: opts?.parentId ?? null,
    zIndex: opts?.zIndex ?? 1,
    transform: xform(t),
    payload: {
      shape: "rectangle",
      ...(opts?.cornerRadius != null
        ? { cornerRadius: opts.cornerRadius }
        : {}),
    },
    style: { fill },
  };
}

function textNode(
  id: string,
  name: string,
  t: Xform,
  payload: {
    text: string;
    fontSize: number;
    fontWeight?: number;
    align?: "left" | "center" | "right";
  },
  fill: string,
  opts?: { parentId?: string | null; zIndex?: number },
): MotionNode {
  return {
    id,
    type: "text",
    name,
    parentId: opts?.parentId ?? null,
    zIndex: opts?.zIndex ?? 2,
    transform: xform(t),
    payload: {
      content: { kind: "plain", text: payload.text },
      fontSize: payload.fontSize,
      fontWeight: payload.fontWeight ?? 600,
      align: payload.align ?? "center",
    },
    style: { fill },
  };
}

function fadeInClip(
  id: string,
  targetId: string,
  at: number,
  duration: number,
  fromY?: number,
): MotionClip {
  const tracks: Array<{
    targetId: string;
    property: string;
    keys: Array<{ t: number; v: number; easing?: "easeOut" }>;
  }> = [
    {
      targetId,
      property: "transform.opacity",
      keys: [
        { t: 0, v: 0 },
        { t: duration, v: 1, easing: "easeOut" },
      ],
    },
  ];
  if (fromY != null) {
    tracks.push({
      targetId,
      property: "transform.y",
      keys: [
        { t: 0, v: fromY },
        { t: duration, v: fromY - 40, easing: "easeOut" },
      ],
    });
  }
  return {
    id,
    targetId,
    schedule: { kind: "absolute", at },
    duration,
    playback: { iterations: 1, direction: "normal", rate: 1 },
    source: { kind: "tracks", tracks },
  };
}

function scene(
  id: string,
  name: string,
  duration: number,
  nodes: MotionNode[],
  clips: MotionClip[],
): MotionScene {
  return { id, name, duration, nodes, clips };
}

function buildHook(): MotionScene {
  const titleId = "hook.title";
  const subId = "hook.subtitle";
  const accentId = "hook.accent";
  return scene(
    FB_HISTORY_SCENE_IDS.hook,
    "Hook",
    4,
    [
      bg("hook.bg", BLUE),
      rect(
        accentId,
        "Accent bar",
        { x: 960, y: 620, width: 120, height: 6, opacity: 0 },
        WHITE,
        { zIndex: 1, cornerRadius: 3 },
      ),
      textNode(
        titleId,
        "Title",
        { x: 960, y: 500, width: 1400, height: 120, opacity: 0 },
        {
          text: "Facebook: 20 năm một mạng xã hội",
          fontSize: 64,
          fontWeight: 700,
          align: "center",
        },
        WHITE,
        { zIndex: 2 },
      ),
      textNode(
        subId,
        "Subtitle",
        { x: 960, y: 560, width: 900, height: 48, opacity: 0 },
        {
          text: "Phân tích lịch sử để hiểu tương lai",
          fontSize: 28,
          fontWeight: 500,
          align: "center",
        },
        "rgba(255,255,255,0.85)",
        { zIndex: 2 },
      ),
    ],
    [
      fadeInClip("clip.hook.title", titleId, 0.2, 0.8, 500),
      fadeInClip("clip.hook.sub", subId, 0.6, 0.7),
      {
        id: "clip.hook.accent",
        targetId: accentId,
        schedule: { kind: "absolute", at: 0.9 },
        duration: 0.6,
        playback: { iterations: 1, direction: "normal", rate: 1 },
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: accentId,
              property: "transform.opacity",
              keys: [
                { t: 0, v: 0 },
                { t: 0.6, v: 1, easing: "easeOut" },
              ],
            },
            {
              targetId: accentId,
              property: "transform.width",
              keys: [
                { t: 0, v: 40 },
                { t: 0.6, v: 120, easing: "easeOut" },
              ],
            },
          ],
        },
      },
    ],
  );
}

function buildHarvard(): MotionScene {
  const yearId = "harvard.year";
  const cardId = "harvard.card";
  const bodyId = "harvard.body";
  const labelId = "harvard.label";
  return scene(
    FB_HISTORY_SCENE_IDS.harvard,
    "2004 · Harvard",
    5,
    [
      bg("harvard.bg", WHITE),
      textNode(
        yearId,
        "Year",
        { x: 480, y: 540, width: 600, height: 200, opacity: 0 },
        { text: "2004", fontSize: 160, fontWeight: 800, align: "center" },
        BLUE,
        { zIndex: 2 },
      ),
      rect(
        cardId,
        "Card",
        { x: 1280, y: 540, width: 640, height: 320, opacity: 0 },
        CARD,
        { zIndex: 1, cornerRadius: 24 },
      ),
      textNode(
        labelId,
        "Label",
        { x: 1280, y: 420, width: 560, height: 40, opacity: 0 },
        {
          text: "TheFacebook · Harvard",
          fontSize: 22,
          fontWeight: 600,
          align: "left",
        },
        BLUE,
        { zIndex: 3 },
      ),
      textNode(
        bodyId,
        "Body",
        { x: 1280, y: 560, width: 560, height: 160, opacity: 0 },
        {
          text: "Từ ký túc xá đến mạng xã hội toàn cầu — khởi đầu bằng kết nối sinh viên.",
          fontSize: 28,
          fontWeight: 500,
          align: "left",
        },
        INK,
        { zIndex: 3 },
      ),
    ],
    [
      fadeInClip("clip.harvard.year", yearId, 0.1, 0.7),
      fadeInClip("clip.harvard.card", cardId, 0.35, 0.6),
      fadeInClip("clip.harvard.label", labelId, 0.5, 0.5),
      fadeInClip("clip.harvard.body", bodyId, 0.65, 0.55),
    ],
  );
}

function buildNewsfeed(): MotionScene {
  const yearId = "newsfeed.year";
  const titleId = "newsfeed.title";
  const post1 = "newsfeed.post1";
  const post2 = "newsfeed.post2";
  const post3 = "newsfeed.post3";
  return scene(
    FB_HISTORY_SCENE_IDS.newsfeed,
    "2006 · News Feed",
    5,
    [
      bg("newsfeed.bg", "#f0f2f5"),
      textNode(
        yearId,
        "Year",
        { x: 280, y: 200, width: 280, height: 80, opacity: 0 },
        { text: "2006", fontSize: 64, fontWeight: 800, align: "left" },
        BLUE,
        { zIndex: 2 },
      ),
      textNode(
        titleId,
        "Title",
        { x: 720, y: 200, width: 800, height: 64, opacity: 0 },
        {
          text: "News Feed — dòng thời gian chung",
          fontSize: 36,
          fontWeight: 700,
          align: "left",
        },
        INK,
        { zIndex: 2 },
      ),
      rect(
        post1,
        "Post 1",
        { x: 960, y: 400, width: 720, height: 100, opacity: 0 },
        WHITE,
        { zIndex: 1, cornerRadius: 12 },
      ),
      rect(
        post2,
        "Post 2",
        { x: 960, y: 540, width: 720, height: 100, opacity: 0 },
        WHITE,
        { zIndex: 1, cornerRadius: 12 },
      ),
      rect(
        post3,
        "Post 3",
        { x: 960, y: 680, width: 720, height: 100, opacity: 0 },
        WHITE,
        { zIndex: 1, cornerRadius: 12 },
      ),
      textNode(
        "newsfeed.post1text",
        "Post text 1",
        { x: 960, y: 400, width: 640, height: 40, opacity: 0 },
        {
          text: "Bạn bè cập nhật trạng thái…",
          fontSize: 22,
          fontWeight: 500,
          align: "left",
        },
        MUTED,
        { zIndex: 2 },
      ),
      textNode(
        "newsfeed.post2text",
        "Post text 2",
        { x: 960, y: 540, width: 640, height: 40, opacity: 0 },
        {
          text: "Ảnh, liên kết, và tương tác realtime",
          fontSize: 22,
          fontWeight: 500,
          align: "left",
        },
        MUTED,
        { zIndex: 2 },
      ),
      textNode(
        "newsfeed.post3text",
        "Post text 3",
        { x: 960, y: 680, width: 640, height: 40, opacity: 0 },
        {
          text: "Thuật toán bắt đầu định hình attention",
          fontSize: 22,
          fontWeight: 500,
          align: "left",
        },
        MUTED,
        { zIndex: 2 },
      ),
    ],
    [
      fadeInClip("clip.nf.year", yearId, 0.1, 0.5),
      fadeInClip("clip.nf.title", titleId, 0.2, 0.5),
      fadeInClip("clip.nf.p1", post1, 0.5, 0.45, 440),
      fadeInClip("clip.nf.p1t", "newsfeed.post1text", 0.55, 0.4),
      fadeInClip("clip.nf.p2", post2, 0.85, 0.45, 580),
      fadeInClip("clip.nf.p2t", "newsfeed.post2text", 0.9, 0.4),
      fadeInClip("clip.nf.p3", post3, 1.2, 0.45, 720),
      fadeInClip("clip.nf.p3t", "newsfeed.post3text", 1.25, 0.4),
    ],
  );
}

function buildIpo(): MotionScene {
  const yearId = "ipo.year";
  const titleId = "ipo.title";
  const barId = "ipo.bar";
  const stat1 = "ipo.stat1";
  const stat2 = "ipo.stat2";
  return scene(
    FB_HISTORY_SCENE_IDS.ipo,
    "2012 · IPO",
    5,
    [
      bg("ipo.bg", WHITE),
      textNode(
        yearId,
        "Year",
        { x: 960, y: 280, width: 400, height: 100, opacity: 0 },
        { text: "2012", fontSize: 96, fontWeight: 800, align: "center" },
        BLUE,
        { zIndex: 2 },
      ),
      textNode(
        titleId,
        "Title",
        { x: 960, y: 400, width: 1100, height: 64, opacity: 0 },
        {
          text: "IPO & kỷ nguyên mobile",
          fontSize: 44,
          fontWeight: 700,
          align: "center",
        },
        INK,
        { zIndex: 2 },
      ),
      rect(
        barId,
        "Accent",
        { x: 960, y: 480, width: 80, height: 6, opacity: 0 },
        BLUE,
        { zIndex: 1, cornerRadius: 3 },
      ),
      textNode(
        stat1,
        "Stat 1",
        { x: 640, y: 620, width: 420, height: 120, opacity: 0 },
        {
          text: "1 tỷ+\nngười dùng",
          fontSize: 36,
          fontWeight: 700,
          align: "center",
        },
        INK,
        { zIndex: 2 },
      ),
      textNode(
        stat2,
        "Stat 2",
        { x: 1280, y: 620, width: 420, height: 120, opacity: 0 },
        {
          text: "Mobile-first\ntrở thành chuẩn",
          fontSize: 36,
          fontWeight: 700,
          align: "center",
        },
        INK,
        { zIndex: 2 },
      ),
    ],
    [
      fadeInClip("clip.ipo.year", yearId, 0.1, 0.6),
      fadeInClip("clip.ipo.title", titleId, 0.35, 0.55),
      {
        id: "clip.ipo.bar",
        targetId: barId,
        schedule: { kind: "absolute", at: 0.6 },
        duration: 0.5,
        playback: { iterations: 1, direction: "normal", rate: 1 },
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: barId,
              property: "transform.opacity",
              keys: [
                { t: 0, v: 0 },
                { t: 0.5, v: 1, easing: "easeOut" },
              ],
            },
            {
              targetId: barId,
              property: "transform.width",
              keys: [
                { t: 0, v: 40 },
                { t: 0.5, v: 200, easing: "easeOut" },
              ],
            },
          ],
        },
      },
      fadeInClip("clip.ipo.s1", stat1, 1.0, 0.55),
      fadeInClip("clip.ipo.s2", stat2, 1.25, 0.55),
    ],
  );
}

function buildMeta(): MotionScene {
  const yearId = "meta.year";
  const oldId = "meta.old";
  const newId = "meta.new";
  const noteId = "meta.note";
  return scene(
    FB_HISTORY_SCENE_IDS.meta,
    "2021 · Meta",
    4,
    [
      bg("meta.bg", BLUE),
      textNode(
        yearId,
        "Year",
        { x: 960, y: 280, width: 400, height: 80, opacity: 0 },
        { text: "2021", fontSize: 72, fontWeight: 800, align: "center" },
        WHITE,
        { zIndex: 2 },
      ),
      textNode(
        oldId,
        "Old name",
        { x: 700, y: 480, width: 400, height: 64, opacity: 0 },
        { text: "Facebook", fontSize: 40, fontWeight: 600, align: "center" },
        "rgba(255,255,255,0.7)",
        { zIndex: 2 },
      ),
      textNode(
        newId,
        "New name",
        { x: 1220, y: 480, width: 400, height: 64, opacity: 0 },
        { text: "Meta", fontSize: 56, fontWeight: 800, align: "center" },
        WHITE,
        { zIndex: 2 },
      ),
      textNode(
        noteId,
        "Note",
        { x: 960, y: 640, width: 1000, height: 64, opacity: 0 },
        {
          text: "Rebrand — từ một app đến hệ sinh thái",
          fontSize: 26,
          fontWeight: 500,
          align: "center",
        },
        "rgba(255,255,255,0.85)",
        { zIndex: 2 },
      ),
      // Dark accent plate at end of beat (static; fill change via second shape fade)
      rect(
        "meta.overlay",
        "Dark accent",
        { x: 960, y: 540, width: 1920, height: 1080, opacity: 0 },
        BLUE_DARK,
        { zIndex: 0 },
      ),
    ],
    [
      fadeInClip("clip.meta.year", yearId, 0.1, 0.5),
      fadeInClip("clip.meta.old", oldId, 0.4, 0.5),
      fadeInClip("clip.meta.new", newId, 0.7, 0.55),
      fadeInClip("clip.meta.note", noteId, 1.1, 0.5),
      {
        id: "clip.meta.dark",
        targetId: "meta.overlay",
        schedule: { kind: "absolute", at: 2.2 },
        duration: 0.8,
        playback: { iterations: 1, direction: "normal", rate: 1 },
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "meta.overlay",
              property: "transform.opacity",
              keys: [
                { t: 0, v: 0 },
                { t: 0.8, v: 0.55, easing: "easeInOut" },
              ],
            },
          ],
        },
      },
    ],
  );
}

function buildOutro(): MotionScene {
  const titleId = "outro.title";
  const ctaId = "outro.cta";
  const brandId = "outro.brand";
  return scene(
    FB_HISTORY_SCENE_IDS.outro,
    "Outro",
    4,
    [
      bg("outro.bg", BLUE_DARK),
      textNode(
        titleId,
        "Title",
        { x: 960, y: 420, width: 1400, height: 100, opacity: 0 },
        {
          text: "Hiểu quá khứ để đọc tương lai",
          fontSize: 52,
          fontWeight: 700,
          align: "center",
        },
        WHITE,
        { zIndex: 2 },
      ),
      textNode(
        ctaId,
        "CTA",
        { x: 960, y: 540, width: 900, height: 48, opacity: 0 },
        {
          text: "Kể lại lịch sử sản phẩm bằng motion — MotiClip",
          fontSize: 26,
          fontWeight: 500,
          align: "center",
        },
        "rgba(255,255,255,0.8)",
        { zIndex: 2 },
      ),
      textNode(
        brandId,
        "Brand",
        { x: 960, y: 900, width: 400, height: 40, opacity: 0 },
        {
          text: "MotiClip Demo",
          fontSize: 18,
          fontWeight: 600,
          align: "center",
        },
        BLUE,
        { zIndex: 2 },
      ),
    ],
    [
      fadeInClip("clip.outro.title", titleId, 0.2, 0.7, 460),
      fadeInClip("clip.outro.cta", ctaId, 0.7, 0.6),
      fadeInClip("clip.outro.brand", brandId, 1.2, 0.5),
    ],
  );
}

/** Multi-scene narrative demo — Facebook history intro (text/shape + keyframes). */
export function createFacebookHistoryDemoProject(): MotionProject {
  const scenes = [
    buildHook(),
    buildHarvard(),
    buildNewsfeed(),
    buildIpo(),
    buildMeta(),
    buildOutro(),
  ];

  return parseMotionProject({
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "proj_facebook_history_demo",
      name: "Facebook History — Demo",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: {
        name: "MotiClip",
        primaryColor: BLUE,
        fontFamily: "Be Vietnam Pro",
      },
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
