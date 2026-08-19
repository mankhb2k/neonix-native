// @ts-nocheck — legacy demo fixture; not part of the authoring/runtime type gate.
import {
  parseMotionProjectV1,
  type MotionProjectV1,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/patterns";
import type {
  MotionRuntimePropertyAnimation,
  RuntimeLayerGraph,
} from "@motionvideo/motion-protocol/runtime";

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
  return visualLayerAtoms({
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation,
    scaleX: input.scaleX,
    scaleY: input.scaleY,
    originX: input.anchorX,
    originY: input.anchorY,
    opacity: input.opacity,
  });
}

function bg(id: string, fill: string): MotionLayer {
  return {
    id,
    type: "shape",
    parentLayerId: null,
    zIndex: 0,
    ...xform({
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
  opts?: {
    parentLayerId?: string | null;
    zIndex?: number;
    cornerRadius?: number;
  },
): MotionLayer {
  return {
    id,
    type: "shape",
    parentLayerId: opts?.parentLayerId ?? null,
    zIndex: opts?.zIndex ?? 1,
    ...xform(t),
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
    align?: "left" | "center" | "right";
  },
  fill: string,
  opts?: { parentLayerId?: string | null; zIndex?: number },
): MotionLayer {
  return {
    id,
    type: "text",
    parentLayerId: opts?.parentLayerId ?? null,
    zIndex: opts?.zIndex ?? 2,
    ...xform(t),
    payload: {
      text: payload.text,
      fontSize: payload.fontSize,
      color: fill,
      alignment: payload.align ?? "center",
    },
  };
}

function fadeInPropertyAnimations(
  layerId: string,
  at: number,
  duration: number,
  fromY?: number,
): MotionRuntimePropertyAnimation[] {
  const items: MotionRuntimePropertyAnimation[] = [
    {
      layerId,
      property: "opacity",
      keys: [
        { t: at, v: 0 },
        { t: at + duration, v: 100, easing: "easeOut" },
      ],
    },
  ];
  if (fromY != null) {
    items.push({
      layerId,
      property: "transform.translate.y",
      keys: [
        { t: at, v: fromY },
        { t: at + duration, v: fromY - 40, easing: "easeOut" },
      ],
    });
  }
  return items;
}

function scene(
  id: string,
  name: string,
  duration: number,
  layers: MotionLayer[],
  propertyAnimations: MotionRuntimePropertyAnimation[],
): RuntimeLayerGraph & { name: string } {
  return {
    id,
    name,
    duration,
    layers: layers as RuntimeLayerGraph["layers"],
    propertyAnimations,
  };
}

function buildHook(): RuntimeLayerGraph {
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
          align: "center",
        },
        "#ffffff",
        { zIndex: 2 },
      ),
    ],
    [
      ...fadeInPropertyAnimations(titleId, 0.2, 0.8, 500),
      ...fadeInPropertyAnimations(subId, 0.6, 0.7),
      {
        layerId: accentId,
        property: "opacity",
        keys: [
          { t: 0.9, v: 0 },
          { t: 1.5, v: 100, easing: "easeOut" },
        ],
      },
      {
        layerId: accentId,
        property: "transform.scale.x",
        keys: [
          { t: 0.9, v: 1 / 3 },
          { t: 1.5, v: 1, easing: "easeOut" },
        ],
      },
    ],
  );
}

function buildHarvard(): RuntimeLayerGraph {
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
        { text: "2004", fontSize: 160, align: "center" },
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
          align: "left",
        },
        INK,
        { zIndex: 3 },
      ),
    ],
    [
      ...fadeInPropertyAnimations(yearId, 0.1, 0.7),
      ...fadeInPropertyAnimations(cardId, 0.35, 0.6),
      ...fadeInPropertyAnimations(labelId, 0.5, 0.5),
      ...fadeInPropertyAnimations(bodyId, 0.65, 0.55),
    ],
  );
}

function buildNewsfeed(): RuntimeLayerGraph {
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
        { text: "2006", fontSize: 64, align: "left" },
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
          align: "left",
        },
        MUTED,
        { zIndex: 2 },
      ),
    ],
    [
      ...fadeInPropertyAnimations(yearId, 0.1, 0.5),
      ...fadeInPropertyAnimations(titleId, 0.2, 0.5),
      ...fadeInPropertyAnimations(post1, 0.5, 0.45, 440),
      ...fadeInPropertyAnimations("newsfeed.post1text", 0.55, 0.4),
      ...fadeInPropertyAnimations(post2, 0.85, 0.45, 580),
      ...fadeInPropertyAnimations("newsfeed.post2text", 0.9, 0.4),
      ...fadeInPropertyAnimations(post3, 1.2, 0.45, 720),
      ...fadeInPropertyAnimations("newsfeed.post3text", 1.25, 0.4),
    ],
  );
}

function buildIpo(): RuntimeLayerGraph {
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
        { text: "2012", fontSize: 96, align: "center" },
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
          align: "center",
        },
        INK,
        { zIndex: 2 },
      ),
    ],
    [
      ...fadeInPropertyAnimations(yearId, 0.1, 0.6),
      ...fadeInPropertyAnimations(titleId, 0.35, 0.55),
      {
        layerId: barId,
        property: "opacity",
        keys: [
          { t: 0.6, v: 0 },
          { t: 1.1, v: 100, easing: "easeOut" },
        ],
      },
      {
        layerId: barId,
        property: "transform.scale.x",
        keys: [
          { t: 0.6, v: 0.5 },
          { t: 1.1, v: 2.5, easing: "easeOut" },
        ],
      },
      ...fadeInPropertyAnimations(stat1, 1.0, 0.55),
      ...fadeInPropertyAnimations(stat2, 1.25, 0.55),
    ],
  );
}

function buildMeta(): RuntimeLayerGraph {
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
        { text: "2021", fontSize: 72, align: "center" },
        WHITE,
        { zIndex: 2 },
      ),
      textNode(
        oldId,
        "Old name",
        { x: 700, y: 480, width: 400, height: 64, opacity: 0 },
        { text: "Facebook", fontSize: 40, align: "center" },
        "#ffffff",
        { zIndex: 2 },
      ),
      textNode(
        newId,
        "New name",
        { x: 1220, y: 480, width: 400, height: 64, opacity: 0 },
        { text: "Meta", fontSize: 56, align: "center" },
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
          align: "center",
        },
        "#ffffff",
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
      ...fadeInPropertyAnimations(yearId, 0.1, 0.5),
      ...fadeInPropertyAnimations(oldId, 0.4, 0.5),
      ...fadeInPropertyAnimations(newId, 0.7, 0.55),
      ...fadeInPropertyAnimations(noteId, 1.1, 0.5),
      {
        layerId: "meta.overlay",
        property: "opacity",
        keys: [
          { t: 2.2, v: 0 },
          { t: 3.0, v: 55, easing: "easeInOut" },
        ],
      },
    ],
  );
}

function buildOutro(): RuntimeLayerGraph {
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
          align: "center",
        },
        "#ffffff",
        { zIndex: 2 },
      ),
      textNode(
        brandId,
        "Brand",
        { x: 960, y: 900, width: 400, height: 40, opacity: 0 },
        {
          text: "MotiClip Demo",
          fontSize: 18,
          align: "center",
        },
        BLUE,
        { zIndex: 2 },
      ),
    ],
    [
      ...fadeInPropertyAnimations(titleId, 0.2, 0.7, 460),
      ...fadeInPropertyAnimations(ctaId, 0.7, 0.6),
      ...fadeInPropertyAnimations(brandId, 1.2, 0.5),
    ],
  );
}

/** Multi-scene narrative demo — Facebook history intro (text/shape + keyframes). */
/** Multi-scene narrative demo — Facebook history intro (text/shape + keyframes). */
export function createFacebookHistoryDemoProject(): MotionProjectV1 {
  const scenes = [
    buildHook(),
    buildHarvard(),
    buildNewsfeed(),
    buildIpo(),
    buildMeta(),
    buildOutro(),
  ];

  // Sequential placement (durations: 4+5+5+5+4+4 = 27s).
  const starts = scenes.map((scene, index) =>
    scenes.slice(0, index).reduce((sum, s) => sum + s.duration, 0),
  );

  // Each scene becomes a root group layer; its nodes are re-parented into it
  // with deterministic, unique zIndex among siblings.
  const layers: MotionLayer[] = scenes.map((scene, index) => ({
    id: scene.id,
    type: "group",
    parentLayerId: null,
    zIndex: index,
    ...xform({
      x: 960,
      y: 540,
      width: 1920,
      height: 1080,
      anchorX: 0.5,
      anchorY: 0.5,
    }),
    timing: { start: starts[index] ?? 0, duration: scene.duration },
    children: scene.layers.map((layer, childIndex) => ({
      ...layer,
      parentLayerId: scene.id,
      zIndex: childIndex,
      timing: { start: 0, duration: scene.duration },
    })),
  }));

  // Runtime propertyAnimations → authoring layer.animations (compiler lowers back).
  const animationsByLayer = new Map<
    string,
    Array<{
      id: string;
      property: string;
      kind: "keyframes";
      keys: Array<{ t: number; value: unknown; easing?: unknown }>;
    }>
  >();
  for (const [sceneIndex, scene] of scenes.entries()) {
    void sceneIndex;
    for (const [animIndex, anim] of scene.propertyAnimations.entries()) {
      const list = animationsByLayer.get(anim.layerId) ?? [];
      list.push({
        property: anim.property,
        keys: anim.keys.map((key) => ({
          t: key.t,
          value: key.v,
          ...(key.easing ? { easing: key.easing } : {}),
        })),
      });
      animationsByLayer.set(anim.layerId, list);
    }
  }

  const attachAnimations = (nodes: typeof layers): typeof layers =>
    nodes.map((node) => {
      const animations = animationsByLayer.get(node.id);
      const next = animations ? { ...node, animations } : node;
      if (next.type === "group") {
        return { ...next, children: attachAnimations(next.children) };
      }
      return next;
    });

  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "proj_facebook_history_demo",
      name: "Facebook History — Demo",
      locale: "vi-VN",
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: BLUE_DARK,
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    assets: [],
    components: [],
    layers: attachAnimations(layers),
  });
}
