import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repoRoot, "docs", "fixtures", "v2");
const projects = resolve(root, "projects");
const patches = resolve(root, "patches");
const acceptance = resolve(root, "acceptance");
await mkdir(acceptance, { recursive: true });

const T = (extra = {}) => ({
  x: 0,
  y: 0,
  width: 1080,
  height: 1080,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0,
  anchorY: 0,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
  ...extra,
});

const meta = (id, name, brand = "#0b1220") => ({
  id,
  name,
  aspectRatio: "1:1",
  fps: 30,
  locale: "vi-VN",
  brand: { name, primaryColor: brand },
});

const emptyExt = { constraints: [], events: [] };

function project(id, name, scenes, opts = {}) {
  return {
    format: "motion-project",
    formatVersion: 2,
    metadata: meta(id, name, opts.brand),
    dependencies: { components: opts.components ?? [] },
    assets: opts.assets ?? [],
    variables: opts.variables ?? [],
    timeline: { sceneOrder: scenes.map((s) => s.id), audioTracks: opts.audioTracks ?? [] },
    scenes,
    bindings: opts.bindings ?? [],
    extensions: emptyExt,
  };
}

const acceptProcessTrim = project(
  "accept.process-trim",
  "Accept — Process Trim Reveal",
  [
    {
      id: "scene.main",
      duration: 3,
      nodes: [
        {
          id: "bg",
          type: "shape",
          parentId: null,
          zIndex: 0,
          transform: T({ x: 540, y: 540, width: 1080, height: 1080, anchorX: 0.5, anchorY: 0.5 }),
          payload: { shape: "rectangle" },
          style: { fill: "#0f172a" },
        },
        {
          id: "inst.steps",
          type: "component",
          parentId: null,
          zIndex: 1,
          transform: T({ x: 0, y: -200, width: 1080, height: 1920 }),
          payload: {
            componentId: "comp.timeline-steps",
            componentVersion: "1.0.0",
            props: { accent: "#38bdf8" },
          },
        },
        {
          id: "title",
          type: "text",
          parentId: null,
          zIndex: 2,
          transform: T({ x: 90, y: 80, width: 900, height: 80 }),
          payload: { text: "Quy trình 3 bước", fontSize: 48, fontWeight: 700, align: "left" },
          style: { fill: "#f8fafc" },
        },
        {
          id: "path.reveal",
          type: "path",
          parentId: null,
          zIndex: 3,
          transform: T({ x: 140, y: 900, width: 800, height: 80 }),
          payload: {
            fillRule: "nonzero",
            contours: [
              {
                id: "line",
                start: { x: 0, y: 40 },
                segments: [{ kind: "line", to: { x: 800, y: 40 } }],
                closed: false,
              },
            ],
          },
          style: { stroke: "#38bdf8", strokeWidth: 10, lineCap: "round" },
          modifiers: [{ id: "reveal", type: "trim-path", start: 0, end: 0, offset: 0 }],
        },
      ],
      clips: [
        {
          id: "reveal",
          schedule: { kind: "absolute", at: 0 },
          duration: 2,
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "path.reveal",
                property: "modifiers.reveal.end",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: 1, easing: "easeInOut" },
                ],
              },
              {
                targetId: "title",
                property: "transform.opacity",
                keys: [
                  { t: 0, v: 0 },
                  { t: 0.6, v: 1 },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  {
    components: [
      {
        componentId: "comp.timeline-steps",
        version: "1.0.0",
        source: "registry.main",
        integrity: "sha256-fixture-timeline-steps-1.0.0",
      },
    ],
    variables: [{ id: "proj.accent", type: "color", name: "Accent", value: "#38bdf8" }],
    bindings: [
      {
        id: "bind.accent",
        source: { kind: "variable", variableId: "proj.accent" },
        target: { sceneId: "scene.main", nodeId: "inst.steps", property: "payload.props.accent" },
      },
    ],
    brand: "#0f172a",
  },
);

const acceptBignumberPaint = project(
  "accept.bignumber-paint",
  "Accept — Big Number Paint",
  [
    {
      id: "scene.main",
      duration: 3,
      nodes: [
        {
          id: "panel",
          type: "shape",
          parentId: null,
          zIndex: 0,
          transform: T({ x: 140, y: 180, width: 800, height: 520 }),
          payload: { shape: "rectangle", cornerRadius: 48 },
          style: {
            fill: {
              type: "linear-gradient",
              angle: 30,
              stops: [
                { id: "a", offset: 0, color: "#7c3aed" },
                { id: "b", offset: 1, color: "#06b6d4" },
              ],
            },
          },
          effects: [{ id: "glow", type: "glow", radius: 12, intensity: 0.7, color: "#22d3ee", opacity: 0.6 }],
        },
        {
          id: "inst.bn",
          type: "component",
          parentId: null,
          zIndex: 1,
          transform: T({ x: 0, y: 0, width: 1080, height: 1920 }),
          payload: {
            componentId: "comp.big-number",
            componentVersion: "1.0.0",
            props: {
              title: "Tăng trưởng",
              number: "3.2x",
              subtitle: "YoY",
              primaryColor: "#f8fafc",
              animationSpeed: 1,
            },
          },
        },
        {
          id: "dash",
          type: "path",
          parentId: null,
          zIndex: 2,
          transform: T({ x: 160, y: 780, width: 760, height: 40 }),
          payload: {
            fillRule: "nonzero",
            contours: [
              {
                id: "line",
                start: { x: 0, y: 20 },
                segments: [{ kind: "line", to: { x: 760, y: 20 } }],
                closed: false,
              },
            ],
          },
          style: { stroke: "#ffffff", strokeWidth: 8, lineCap: "round", dash: [14, 10], dashOffset: 0 },
        },
      ],
      clips: [
        {
          id: "dash",
          schedule: { kind: "absolute", at: 0 },
          duration: 2,
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "dash",
                property: "style.dashOffset",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: -60 },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  {
    components: [
      {
        componentId: "comp.big-number",
        version: "1.0.0",
        source: "registry.main",
        integrity: "sha256-fixture-big-number-1.0.0",
      },
    ],
    variables: [{ id: "proj.number", type: "string", name: "Number", value: "3.2x" }],
    bindings: [
      {
        id: "bind.number",
        source: { kind: "variable", variableId: "proj.number" },
        target: { sceneId: "scene.main", nodeId: "inst.bn", property: "payload.props.number" },
      },
    ],
    brand: "#1e1b4b",
  },
);

const acceptCompareBlend = project(
  "accept.compare-blend",
  "Accept — Compare Blend",
  [
    {
      id: "scene.main",
      duration: 2,
      nodes: [
        {
          id: "bg",
          type: "shape",
          parentId: null,
          zIndex: 0,
          transform: T({ x: 540, y: 540, width: 1080, height: 1080, anchorX: 0.5, anchorY: 0.5 }),
          payload: { shape: "rectangle" },
          style: { fill: "#020617" },
        },
        {
          id: "inst.compare",
          type: "component",
          parentId: null,
          zIndex: 1,
          transform: T({ x: 0, y: -420, width: 1080, height: 1920 }),
          payload: {
            componentId: "comp.compare",
            componentVersion: "1.0.0",
            props: {
              leftTitle: "Basic",
              rightTitle: "Pro",
              leftValue: "199K",
              rightValue: "399K",
              accentLeft: "#64748b",
              accentRight: "#14b8a6",
            },
          },
        },
        {
          id: "highlight",
          type: "shape",
          parentId: null,
          zIndex: 2,
          blendMode: "screen",
          transform: T({ x: 620, y: 420, width: 380, height: 480 }),
          payload: { shape: "rectangle", cornerRadius: 40 },
          style: { fill: "#22d3ee" },
        },
      ],
      clips: [],
    },
  ],
  {
    components: [
      {
        componentId: "comp.compare",
        version: "1.0.0",
        source: "registry.main",
        integrity: "sha256-fixture-compare-1.0.0",
      },
    ],
    variables: [
      { id: "proj.leftValue", type: "string", name: "Left", value: "199K" },
      { id: "proj.rightValue", type: "string", name: "Right", value: "399K" },
    ],
    bindings: [
      {
        id: "b1",
        source: { kind: "variable", variableId: "proj.leftValue" },
        target: { sceneId: "scene.main", nodeId: "inst.compare", property: "payload.props.leftValue" },
      },
      {
        id: "b2",
        source: { kind: "variable", variableId: "proj.rightValue" },
        target: { sceneId: "scene.main", nodeId: "inst.compare", property: "payload.props.rightValue" },
      },
    ],
    brand: "#020617",
  },
);

const golden = JSON.parse(await readFile(resolve(projects, "golden-product-promo.mt.json"), "utf8"));
const acceptTvcHook = {
  ...golden,
  metadata: { ...golden.metadata, id: "accept.tvc-hook", name: "Accept — TVC Hook Offer CTA" },
};

const acceptShowcaseLookat = project(
  "accept.showcase-lookat",
  "Accept — Showcase Look At",
  [
    {
      id: "scene.main",
      duration: 3,
      nodes: [
        {
          id: "inst.product",
          type: "component",
          parentId: null,
          zIndex: 1,
          transform: T({ x: 0, y: -300, width: 1080, height: 1920 }),
          payload: {
            componentId: "comp.product-showcase",
            componentVersion: "1.0.0",
            props: {
              productName: "Cold Brew",
              price: "49K",
              cta: "Đặt ngay",
              theme: "dark",
              primaryColor: "#c45c26",
              productImage: "asset.product",
              animationSpeed: 1,
            },
          },
        },
        {
          id: "arrow",
          type: "shape",
          parentId: null,
          zIndex: 3,
          transform: T({ x: 200, y: 700, width: 120, height: 40, anchorX: 0.5, anchorY: 0.5 }),
          payload: { shape: "rectangle", cornerRadius: 12 },
          style: { fill: "#f97316" },
          modifiers: [{ id: "look", type: "constraint", kind: "look-at", targetNodeId: "target", weight: 1 }],
        },
        {
          id: "target",
          type: "shape",
          parentId: null,
          zIndex: 4,
          transform: T({ x: 820, y: 360, width: 48, height: 48, anchorX: 0.5, anchorY: 0.5 }),
          payload: { shape: "ellipse" },
          style: { fill: "#22c55e" },
        },
        {
          id: "mover",
          type: "shape",
          parentId: null,
          zIndex: 2,
          transform: T({ x: 200, y: 200, width: 64, height: 64, anchorX: 0.5, anchorY: 0.5 }),
          payload: { shape: "ellipse" },
          style: { fill: "#eab308" },
          modifiers: [
            {
              id: "orbit",
              type: "motion-path",
              pathNodeId: "orbit.path",
              contourId: "arc",
              progress: 0,
              orientToPath: true,
              rotationOffset: 0,
              startOffset: 0,
              endOffset: 1,
            },
          ],
        },
        {
          id: "orbit.path",
          type: "path",
          parentId: null,
          zIndex: 0,
          transform: T({ x: 200, y: 160, width: 680, height: 200 }),
          payload: {
            fillRule: "nonzero",
            contours: [
              {
                id: "arc",
                start: { x: 0, y: 100 },
                segments: [
                  {
                    kind: "cubic",
                    control1: { x: 160, y: -20 },
                    control2: { x: 520, y: -20 },
                    to: { x: 680, y: 100 },
                  },
                ],
                closed: false,
              },
            ],
          },
          style: { stroke: "#334155", strokeWidth: 2 },
        },
      ],
      clips: [
        {
          id: "motion",
          schedule: { kind: "absolute", at: 0 },
          duration: 3,
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "mover",
                property: "modifiers.orbit.progress",
                keys: [
                  { t: 0, v: 0 },
                  { t: 3, v: 1 },
                ],
              },
              {
                targetId: "target",
                property: "transform.x",
                keys: [
                  { t: 0, v: 820 },
                  { t: 1.5, v: 300 },
                  { t: 3, v: 820 },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  {
    components: [
      {
        componentId: "comp.product-showcase",
        version: "1.0.0",
        source: "registry.main",
        integrity: "sha256-fixture-product-showcase-1.0.0",
      },
    ],
    assets: [golden.assets.find((a) => a.id === "asset.product")],
    variables: [{ id: "proj.cta", type: "string", name: "CTA", value: "Đặt ngay" }],
    bindings: [
      {
        id: "bind.cta",
        source: { kind: "variable", variableId: "proj.cta" },
        target: { sceneId: "scene.main", nodeId: "inst.product", property: "payload.props.cta" },
      },
    ],
    brand: "#1c1917",
  },
);

const acceptRibbonPromo = project(
  "accept.ribbon-promo",
  "Accept — Ribbon Promo",
  [
    {
      id: "scene.main",
      duration: 2,
      nodes: [
        {
          id: "card",
          type: "shape",
          parentId: null,
          zIndex: 0,
          transform: T({ x: 160, y: 220, width: 760, height: 420 }),
          payload: { shape: "rectangle", cornerRadius: 56 },
          style: {
            fill: {
              type: "linear-gradient",
              angle: 20,
              stops: [
                { id: "p", offset: 0, color: "#db2777" },
                { id: "q", offset: 1, color: "#7c3aed" },
              ],
            },
          },
        },
        {
          id: "ribbon",
          type: "path",
          parentId: null,
          zIndex: 1,
          transform: T({ x: 140, y: 700, width: 800, height: 200 }),
          payload: {
            fillRule: "nonzero",
            contours: [
              {
                id: "r",
                start: { x: 0, y: 0 },
                segments: [
                  { kind: "line", to: { x: 200, y: 0 } },
                  { kind: "line", to: { x: 400, y: 0 } },
                  { kind: "line", to: { x: 600, y: 0 } },
                  { kind: "line", to: { x: 800, y: 0 } },
                ],
                closed: false,
              },
            ],
          },
          style: { stroke: "#f9a8d4", strokeWidth: 36, lineCap: "round", dash: [20, 12], dashOffset: 0 },
          modifiers: [{ id: "bend", type: "path-bend", amount: 0 }],
        },
        {
          id: "label",
          type: "text",
          parentId: null,
          zIndex: 2,
          transform: T({ x: 200, y: 360, width: 680, height: 100 }),
          payload: { text: "Ưu đãi cuối tuần", fontSize: 56, fontWeight: 700, align: "center" },
          style: { fill: "#fff7ed" },
        },
      ],
      clips: [
        {
          id: "anim",
          schedule: { kind: "absolute", at: 0 },
          duration: 2,
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "ribbon",
                property: "modifiers.bend.amount",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: 1, easing: "easeInOut" },
                ],
              },
              {
                targetId: "ribbon",
                property: "style.dashOffset",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: -40 },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  {
    brand: "#4a044e",
    variables: [{ id: "proj.label", type: "string", name: "Label", value: "Ưu đãi cuối tuần" }],
    bindings: [
      {
        id: "bind.label",
        source: { kind: "variable", variableId: "proj.label" },
        target: { sceneId: "scene.main", nodeId: "label", property: "payload.text" },
      },
    ],
  },
);

const cutout = JSON.parse(await readFile(resolve(projects, "cutout-dialogue.mt.json"), "utf8"));
const acceptCutoutTalk = {
  ...cutout,
  metadata: { ...cutout.metadata, id: "accept.cutout-talk", name: "Accept — Cut-out Dialogue" },
};

const hierarchy = JSON.parse(await readFile(resolve(projects, "hierarchy-transform.mt.json"), "utf8"));
const acceptPropMask = {
  ...hierarchy,
  metadata: { ...hierarchy.metadata, id: "accept.prop-mask", name: "Accept — Prop Mask Hierarchy" },
};
acceptPropMask.scenes[0].nodes.push(
  {
    id: "mask.spotlight",
    type: "shape",
    parentId: null,
    zIndex: 50,
    transform: T({ x: 400, y: 500, width: 280, height: 280 }),
    payload: { shape: "ellipse" },
    style: { fill: "#ffffff", fillOpacity: 0.85 },
  },
  {
    id: "content.spotlight",
    type: "shape",
    parentId: null,
    zIndex: 51,
    mask: { sourceNodeId: "mask.spotlight", mode: "alpha", sourceVisibility: "mask-only" },
    transform: T({ x: 360, y: 460, width: 360, height: 360 }),
    payload: { shape: "rectangle", cornerRadius: 24 },
    style: { fill: "#fbbf24" },
  },
);

const look = JSON.parse(await readFile(resolve(projects, "constraint-look-at.mt.json"), "utf8"));
const acceptLookAt = {
  ...look,
  metadata: { ...look.metadata, id: "accept.look-at", name: "Accept — Look At Head" },
};
acceptLookAt.scenes[0].nodes.push({
  id: "label",
  type: "text",
  parentId: null,
  zIndex: 10,
  transform: T({ x: 120, y: 80, width: 840, height: 60 }),
  payload: { text: "Head follows target", fontSize: 36, align: "center" },
  style: { fill: "#e2e8f0" },
});

const secondary = JSON.parse(await readFile(resolve(projects, "bone-secondary-motion.mt.json"), "utf8"));
const acceptSecondaryWave = {
  ...secondary,
  metadata: { ...secondary.metadata, id: "accept.secondary-wave", name: "Accept — Secondary Wave" },
};
acceptSecondaryWave.scenes[0].nodes.push({
  id: "caption",
  type: "text",
  parentId: null,
  zIndex: 20,
  transform: T({ x: 80, y: 900, width: 920, height: 60 }),
  payload: { text: "Secondary rotation chain", fontSize: 32, align: "center" },
  style: { fill: "#cbd5e1" },
});

const morph = JSON.parse(await readFile(resolve(projects, "path-morph.mt.json"), "utf8"));
const acceptPathMorph = {
  ...morph,
  metadata: { ...morph.metadata, id: "accept.path-morph", name: "Accept — Path Morph Accent" },
};
acceptPathMorph.scenes[0].nodes.push({
  id: "caption",
  type: "text",
  parentId: null,
  zIndex: 20,
  transform: T({ x: 80, y: 900, width: 920, height: 60 }),
  payload: { text: "Expression morph", fontSize: 32, align: "center" },
  style: { fill: "#e2e8f0" },
});

const action = JSON.parse(await readFile(resolve(projects, "action-playback.mt.json"), "utf8"));
const acceptActionLoop = {
  ...action,
  metadata: { ...action.metadata, id: "accept.action-loop", name: "Accept — Multi Action Playback" },
};

const files = {
  "accept-process-trim.mt.json": acceptProcessTrim,
  "accept-bignumber-paint.mt.json": acceptBignumberPaint,
  "accept-compare-blend.mt.json": acceptCompareBlend,
  "accept-tvc-hook.mt.json": acceptTvcHook,
  "accept-showcase-lookat.mt.json": acceptShowcaseLookat,
  "accept-ribbon-promo.mt.json": acceptRibbonPromo,
  "accept-cutout-talk.mt.json": acceptCutoutTalk,
  "accept-prop-mask.mt.json": acceptPropMask,
  "accept-look-at.mt.json": acceptLookAt,
  "accept-secondary-wave.mt.json": acceptSecondaryWave,
  "accept-path-morph.mt.json": acceptPathMorph,
  "accept-action-loop.mt.json": acceptActionLoop,
};

for (const [name, data] of Object.entries(files)) {
  await writeFile(resolve(projects, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("wrote", name);
}

const patchFiles = {
  "ai-fill-accept-process-trim.json": {
    format: "motion-patch",
    formatVersion: 1,
    baseRevision: 1,
    operations: [{ op: "set", target: { variableId: "proj.accent" }, value: "#f97316" }],
  },
  "ai-fill-accept-bignumber-paint.json": {
    format: "motion-patch",
    formatVersion: 1,
    baseRevision: 1,
    operations: [
      { op: "set", target: { variableId: "proj.number" }, value: "4.8x" },
      {
        op: "set",
        target: { sceneId: "scene.main", nodeId: "inst.bn", property: "payload.props.subtitle" },
        value: "Q3 2026",
      },
    ],
  },
  "ai-fill-accept-compare-blend.json": {
    format: "motion-patch",
    formatVersion: 1,
    baseRevision: 1,
    operations: [
      { op: "set", target: { variableId: "proj.leftValue" }, value: "149K" },
      { op: "set", target: { variableId: "proj.rightValue" }, value: "299K" },
    ],
  },
  "ai-fill-accept-ribbon-promo.json": {
    format: "motion-patch",
    formatVersion: 1,
    baseRevision: 1,
    operations: [{ op: "set", target: { variableId: "proj.label" }, value: "Flash sale 24h" }],
  },
  "ai-fill-accept-showcase-lookat.json": {
    format: "motion-patch",
    formatVersion: 1,
    baseRevision: 1,
    operations: [{ op: "set", target: { variableId: "proj.cta" }, value: "Mua ngay" }],
  },
};

for (const [name, data] of Object.entries(patchFiles)) {
  await writeFile(resolve(patches, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("wrote patch", name);
}

const scorecard = {
  version: 1,
  updatedAt: "2026-07-25",
  passThreshold: 10,
  criteria: ["compile", "exportMp4", "publicApi", "visualIntent", "timing", "reuse"],
  compositions: [
    {
      id: "accept-process-trim",
      map: "infographic",
      project: "projects/accept-process-trim.mt.json",
      patch: "patches/ai-fill-accept-process-trim.json",
      frame: "expected-frames/accept-process-trim-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-bignumber-paint",
      map: "infographic",
      project: "projects/accept-bignumber-paint.mt.json",
      patch: "patches/ai-fill-accept-bignumber-paint.json",
      frame: "expected-frames/accept-bignumber-paint-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-compare-blend",
      map: "infographic",
      project: "projects/accept-compare-blend.mt.json",
      patch: "patches/ai-fill-accept-compare-blend.json",
      frame: "expected-frames/accept-compare-blend-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-tvc-hook",
      map: "product-tvc",
      project: "projects/accept-tvc-hook.mt.json",
      patch: null,
      frame: "expected-frames/accept-tvc-hook-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-showcase-lookat",
      map: "product-tvc",
      project: "projects/accept-showcase-lookat.mt.json",
      patch: "patches/ai-fill-accept-showcase-lookat.json",
      frame: "expected-frames/accept-showcase-lookat-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-ribbon-promo",
      map: "product-tvc",
      project: "projects/accept-ribbon-promo.mt.json",
      patch: "patches/ai-fill-accept-ribbon-promo.json",
      frame: "expected-frames/accept-ribbon-promo-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-cutout-talk",
      map: "cut-out",
      project: "projects/accept-cutout-talk.mt.json",
      patch: null,
      frame: "expected-frames/accept-cutout-talk-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-prop-mask",
      map: "cut-out",
      project: "projects/accept-prop-mask.mt.json",
      patch: null,
      frame: "expected-frames/accept-prop-mask-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-look-at",
      map: "cut-out",
      project: "projects/accept-look-at.mt.json",
      patch: null,
      frame: "expected-frames/accept-look-at-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-secondary-wave",
      map: "mascot",
      project: "projects/accept-secondary-wave.mt.json",
      patch: null,
      frame: "expected-frames/accept-secondary-wave-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-path-morph",
      map: "mascot",
      project: "projects/accept-path-morph.mt.json",
      patch: null,
      frame: "expected-frames/accept-path-morph-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
    {
      id: "accept-action-loop",
      map: "mascot",
      project: "projects/accept-action-loop.mt.json",
      patch: null,
      frame: "expected-frames/accept-action-loop-t1.png",
      scores: { compile: null, exportMp4: null, publicApi: null, visualIntent: null, timing: null, reuse: null },
      total: null,
      status: "pending",
      failures: [],
    },
  ],
};

await writeFile(resolve(acceptance, "scorecard.json"), `${JSON.stringify(scorecard, null, 2)}\n`);
await writeFile(resolve(acceptance, "failure-log.json"), `${JSON.stringify({ version: 1, entries: [] }, null, 2)}\n`);
await writeFile(
  resolve(acceptance, "designer-corrections.json"),
  `${JSON.stringify(
    {
      version: 1,
      description: "Phase D: count Designer internal edits after AI Author .mt + public patch",
      briefs: [],
      runs: [],
    },
    null,
    2,
  )}\n`,
);
console.log("scorecard + logs written");
