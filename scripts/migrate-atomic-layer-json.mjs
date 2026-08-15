/**
 * One-shot converter: flat transform → atomic frame/transform/appearance.
 * Run from repo root: node scripts/migrate-atomic-layer-json.mjs
 */
import fs from "node:fs";
import path from "node:path";

const PROPERTY_MAP = {
  "transform.x": "transform.translate.x",
  "transform.y": "transform.translate.y",
  "transform.z": "transform.translate.z",
  "transform.rotation": "transform.rotate.z",
  "transform.rotationX": "transform.rotate.x",
  "transform.rotationY": "transform.rotate.y",
  "transform.rotationZ": "transform.rotate.z",
  "transform.scaleX": "transform.scale.x",
  "transform.scaleY": "transform.scale.y",
  "transform.anchorX": "transform.origin.x",
  "transform.anchorY": "transform.origin.y",
  "transform.anchorZ": "transform.origin.z",
  "transform.opacity": "appearance.opacity",
  "transform.visible": "appearance.visible",
  "transform.width": "frame.width",
  "transform.height": "frame.height",
};

function remapProperty(value) {
  if (typeof value !== "string") return value;
  return PROPERTY_MAP[value] ?? value;
}

function convertFlatTransform(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  if (t.translate) return null;
  if (!("x" in t) && !("width" in t) && !("scaleX" in t)) return null;
  return {
    frame: { width: t.width ?? 0, height: t.height ?? 0 },
    appearance: {
      visible: t.visible ?? true,
      opacity: t.opacity ?? 1,
    },
    transform: {
      translate: { x: t.x ?? 0, y: t.y ?? 0, z: t.z ?? 0 },
      rotate: {
        x: t.rotationX ?? 0,
        y: t.rotationY ?? 0,
        z: t.rotationZ ?? t.rotation ?? 0,
      },
      scale: {
        x: (t.scaleX ?? 1) * (t.flipX ? -1 : 1),
        y: (t.scaleY ?? 1) * (t.flipY ? -1 : 1),
        z: 1,
      },
      skew: { x: 0, y: 0 },
      origin: {
        x: t.anchorX ?? 0.5,
        y: t.anchorY ?? 0.5,
        z: t.anchorZ ?? 0,
      },
      transformStyle: "flat",
      backfaceVisibility: "visible",
      ...(t.depth !== undefined ? { depth: t.depth } : {}),
      ...(t.perspective !== undefined ? { perspective: t.perspective } : {}),
    },
  };
}

function convertLayer(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return node;
  const next = { ...node };
  const converted = convertFlatTransform(next.transform);
  if (converted) {
    next.frame = next.frame ?? converted.frame;
    next.transform = converted.transform;
    next.appearance = next.appearance ?? converted.appearance;
  }
  if (next.visible !== undefined && next.type !== "audio") {
    next.appearance = {
      visible: next.visible,
      opacity: next.appearance?.opacity ?? 1,
      ...next.appearance,
    };
    delete next.visible;
  }
  const compositing = { ...(next.compositing ?? {}) };
  if (next.blendMode) {
    compositing.blendMode = next.blendMode;
    delete next.blendMode;
  }
  if (next.mask) {
    compositing.mask = next.mask;
    delete next.mask;
  }
  if (Object.keys(compositing).length) next.compositing = compositing;

  if (next.type === "solid" && next.payload && typeof next.payload === "object") {
    const p = { ...next.payload };
    if (p.width !== undefined || p.height !== undefined) {
      next.frame = next.frame ?? {
        width: p.width ?? 0,
        height: p.height ?? 0,
      };
      delete p.width;
      delete p.height;
      next.payload = p;
    }
  }
  if (next.type === "group" && next.payload?.compositing?.mode) {
    const mode = next.payload.compositing.mode;
    next.compositing = {
      ...(next.compositing ?? {}),
      isolation: mode === "isolate" ? "isolate" : "auto",
    };
    const payload = { ...next.payload };
    delete payload.compositing;
    next.payload = Object.keys(payload).length ? payload : undefined;
  }
  if (next.type === "camera") {
    delete next.frame;
  }
    next.appearance = { visible: next.visible, opacity: 1 };
    delete next.visible;
  }
  if (Array.isArray(next.children)) {
    next.children = next.children.map(convertLayer);
  }
  if (Array.isArray(next.effects)) {
    next.effects = next.effects.map((effect) => {
      if (!effect || effect.type !== "shadow") return effect;
      if (effect.offset) return effect;
      const { offsetX, offsetY, ...rest } = effect;
      return {
        ...rest,
        offset: { x: offsetX ?? 0, y: offsetY ?? 0 },
      };
    });
  }
  return next;
}

function walk(value) {
  if (Array.isArray(value)) return value.map(walk);
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return remapProperty(value);
    return value;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "layers" && Array.isArray(v)) {
      out[k] = v.map(convertLayer);
    } else if (k === "components" && Array.isArray(v)) {
      out[k] = v.map((c) => {
        if (!c || typeof c !== "object") return c;
        const next = { ...c };
        if (Array.isArray(next.layers)) next.layers = next.layers.map(convertLayer);
        return walk(next);
      });
    } else if (k === "property" && typeof v === "string") {
      out[k] = remapProperty(v);
    } else {
      out[k] = walk(v);
    }
  }
  return out;
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules") continue;
      walkDir(full);
    } else if (name.endsWith(".json") && !name.endsWith("schema.json") && name !== "v1.json") {
      const raw = fs.readFileSync(full, "utf8");
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      const next = walk(data);
      fs.writeFileSync(full, JSON.stringify(next, null, 2) + "\n");
      console.log("updated", full);
    }
  }
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  roots.push(
    "packages/motion-protocol/src/v1/__fixtures__",
    "packages/motion-protocol/src/__fixtures__",
    "packages/motion-compiler/src/__fixtures__",
  );
}
for (const root of roots) walkDir(path.resolve(root));
