/**
 * Pixi compositing helpers — RenderTexture offscreen, mask wiring, and
 * container nesting tree for beginLayer/beginGroup stack semantics.
 *
 * §Phase 5 tasks 5.1–5.3 in core-engine-tasks.md
 */

import {
  Container,
  RenderTexture,
  Sprite,
  Texture,
  type Filter,
} from "pixi.js";

// ── Canvas detection for Node.js test environments ───────────────────

function isCanvasAvailable(): boolean {
  try {
    return (
      typeof document !== "undefined" &&
      typeof document.createElement === "function"
    );
  } catch {
    return false;
  }
}

// ── Offscreen descriptor ──────────────────────────────────────────────

export type OffscreenSlot = {
  /** The offscreen texture all children render into. */
  renderTexture: RenderTexture;
  /** The sprite that displays the offscreen texture in the main stage. */
  proxy: Sprite;
  /** The container children are added to during paint. */
  container: Container;
  /** Filters applied to the proxy sprite (not the offscreen children). */
  filters: Filter[];
  /** Whether this slot has been used this frame (for dispose tracking). */
  live: boolean;
};

// ── Layer context ─────────────────────────────────────────────────────

export type CompositingLayer = {
  /** The container or offscreen proxy added to the parent. */
  display: Container | Sprite;
  /** Where children go — either display directly, or offscreen container. */
  childContainer: Container;
  /** Offscreen metadata, if this layer uses RenderTexture. */
  offscreen: OffscreenSlot | null;
  /** Mask configuration from beginLayer. */
  maskSourceKey?: string;
  /** Whether this layer has been rendered into this frame. */
  live: boolean;
};

// ── Nesting stack frame ───────────────────────────────────────────────

export type NestingFrame = {
  kind: "root" | "layer" | "group";
  /** The compositing layer or group container. */
  container: Container;
};

// ── Shared RenderTexture pool ─────────────────────────────────────────

/**
 * Manages RenderTexture allocation, reuse, and disposal.
 * RenderTextures are recycled by (width, height) bucket.
 */
export type RenderTexturePool = {
  acquire(width: number, height: number): RenderTexture | null;
  release(rt: RenderTexture): void;
  /** Mark all as stale — called at beginFrame. */
  beginFrame(): void;
  /** Dispose stale textures not used this frame. */
  disposeStale(): void;
  /** Full cleanup. */
  dispose(): void;
};

export function createRenderTexturePool(): RenderTexturePool {
  const pool = new Map<string, RenderTexture[]>();
  let liveThisFrame = new Set<RenderTexture>();
  const canvasOk = isCanvasAvailable();

  const bucketKey = (w: number, h: number) =>
    `${Math.ceil(w / 16) * 16}x${Math.ceil(h / 16) * 16}`;

  return {
    acquire(width: number, height: number): RenderTexture | null {
      if (!canvasOk) return null;
      const key = bucketKey(width, height);
      const bucket = pool.get(key);
      const rt = bucket?.pop();
      if (rt) {
        rt.resize(width, height);
        liveThisFrame.add(rt);
        return rt;
      }
      try {
        const newRt = RenderTexture.create({ width, height });
        liveThisFrame.add(newRt);
        return newRt;
      } catch {
        return null;
      }
    },

    release(rt: RenderTexture) {
      liveThisFrame.delete(rt);
      const key = bucketKey(rt.width, rt.height);
      let bucket = pool.get(key);
      if (!bucket) {
        bucket = [];
        pool.set(key, bucket);
      }
      // Cap pool at 4 per bucket to avoid unbounded growth
      if (bucket.length < 4) bucket.push(rt);
      else rt.destroy();
    },

    beginFrame() {
      liveThisFrame = new Set();
    },

    disposeStale() {
      for (const [, bucket] of pool) {
        for (let i = bucket.length - 1; i >= 0; i--) {
          const rt = bucket[i]!;
          if (!liveThisFrame.has(rt)) {
            rt.destroy();
            bucket.splice(i, 1);
          }
        }
      }
    },

    dispose() {
      for (const [, bucket] of pool) {
        for (const rt of bucket) rt.destroy();
      }
      pool.clear();
      liveThisFrame.clear();
    },
  };
}

// ── Compositing context ───────────────────────────────────────────────

export type CompositingContextOptions = {
  root: Container;
  width: number;
  height: number;
};

/**
 * Manages the nesting stack, offscreen slots, and mask wiring for a
 * single frame paint pass. Created at beginFrame, disposed at endFrame.
 */
export type CompositingContext = {
  /** Push a new layer scope. Returns the new parent for draw ops. */
  pushLayer(cfg: {
    key: string;
    offscreen: boolean;
    isolation: boolean;
    mask?: { mode: string; sourceKey: string };
  }): Container;

  /** Push a new group scope. Returns the new parent for child ops. */
  pushGroup(key: string, nodeId: string): Container;

  /** Pop the current layer scope. */
  popLayer(key: string): void;

  /** Pop the current group scope. */
  popGroup(key: string): void;

  /** The current parent container for draw ops. */
  currentParent: Container;

  /** All active compositing layers (used for post-frame cleanup). */
  getLayers(): ReadonlyMap<string, CompositingLayer>;

  /** Wire a mask after the mask source has been created. */
  applyMask(targetKey: string, sourceDisplay: Container): void;

  /** Mark a mask source as used (so it's in the live set). */
  markMaskSource(key: string): void;

  /** End-of-frame: flush stale offscreen slots, sync mask visibility. */
  endFrame(): void;

  /** Full cleanup (on painter dispose). */
  dispose(): void;

  /** The RenderTexture pool backing this context. */
  pool: RenderTexturePool;
};

export function createCompositingContext(
  opts: CompositingContextOptions,
): CompositingContext {
  const pool = createRenderTexturePool();
  const layers = new Map<string, CompositingLayer>();
  const stack: NestingFrame[] = [{ kind: "root", container: opts.root }];
  const pendingMasks = new Map<string, { mode: string; sourceKey: string }>();
  const maskSourceKeys = new Set<string>();

  pool.beginFrame();

  const currentParent: Container = opts.root;

  function getOrCreateLayer(
    key: string,
    cfg: {
      offscreen: boolean;
      isolation: boolean;
      mask?: { mode: string; sourceKey: string };
    },
  ): CompositingLayer {
    let layer = layers.get(key);
    if (!layer) {
      const needsOffscreen = cfg.offscreen || cfg.isolation;

      if (needsOffscreen) {
        const rt = pool.acquire(opts.width, opts.height);
        if (rt) {
          const proxy = new Sprite(rt);
          proxy.label = `${key}_proxy`;
          const childContainer = new Container({ sortableChildren: true });
          childContainer.label = `${key}_offscreen`;
          layer = {
            display: proxy,
            childContainer,
            offscreen: {
              renderTexture: rt,
              proxy,
              container: childContainer,
              filters: [],
              live: true,
            },
            live: true,
          };
        } else {
          // No canvas available (test env): fallback to flat container
          const container = new Container({ sortableChildren: true });
          container.label = key;
          layer = {
            display: container,
            childContainer: container,
            offscreen: null,
            live: true,
          };
        }
      } else {
        const container = new Container({ sortableChildren: true });
        container.label = key;
        layer = {
          display: container,
          childContainer: container,
          offscreen: null,
          live: true,
        };
      }

      if (cfg.mask) {
        layer.maskSourceKey = cfg.mask.sourceKey;
        pendingMasks.set(key, cfg.mask);
      }

      layers.set(key, layer);
    } else {
      layer.live = true;
      if (layer.offscreen) layer.offscreen.live = true;
    }

    return layer;
  }

  function pushLayer(cfg: {
    key: string;
    offscreen: boolean;
    isolation: boolean;
    mask?: { mode: string; sourceKey: string };
  }): Container {
    const layer = getOrCreateLayer(cfg.key, cfg);
    const parent = stack[stack.length - 1]!.container;

    // Add display to parent if not already a child
    if (!parent.children.includes(layer.display)) {
      parent.addChild(layer.display);
    }

    stack.push({ kind: "layer", container: layer.childContainer });
    return layer.childContainer;
  }

  function pushGroup(key: string, nodeId: string): Container {
    const parent = stack[stack.length - 1]!.container;
    // Look for existing group container by key
    let groupContainer = parent.children.find((c) => c.label === key) as
      | Container
      | undefined;
    if (!groupContainer) {
      groupContainer = new Container({ sortableChildren: true });
      groupContainer.label = `${key}_${nodeId}`;
      parent.addChild(groupContainer);
    }
    stack.push({ kind: "group", container: groupContainer });
    return groupContainer;
  }

  function popLayer(key: string): void {
    const top = stack.pop();
    if (!top || top.kind !== "layer") {
      throw new Error(
        `popLayer: expected layer on stack for ${key}, got ${top?.kind}`,
      );
    }
  }

  function popGroup(key: string): void {
    const top = stack.pop();
    if (!top || top.kind !== "group") {
      throw new Error(
        `popGroup: expected group on stack for ${key}, got ${top?.kind}`,
      );
    }
  }

  function applyMask(targetKey: string, sourceDisplay: Container): void {
    const layer = layers.get(targetKey);
    if (!layer) return;
    // Apply mask to the display (proxy for offscreen, container directly)
    layer.display.mask = sourceDisplay;
    // Ensure mask source is in the scene
    if (!opts.root.children.includes(sourceDisplay)) {
      sourceDisplay.visible = false; // Mask sources are invisible by default
      opts.root.addChild(sourceDisplay);
    }
  }

  function markMaskSource(key: string): void {
    maskSourceKeys.add(key);
  }

  function endFrame(): void {
    // Wire any pending masks where both target and source now exist
    for (const [layerKey, maskCfg] of pendingMasks) {
      const layer = layers.get(layerKey);
      if (!layer) continue;
      const sourceDisplay = opts.root.children.find(
        (c) => c.label === maskCfg.sourceKey,
      ) as Container | undefined;
      if (sourceDisplay) {
        layer.display.mask = sourceDisplay;
        sourceDisplay.visible = false;
      }
    }
    pendingMasks.clear();

    // Flush offscreen textures into their proxies
    for (const [, layer] of layers) {
      if (layer.offscreen?.live) {
        layer.offscreen.proxy.texture = layer.offscreen.renderTexture;
      }
    }

    pool.disposeStale();
    maskSourceKeys.clear();
  }

  return {
    pushLayer,
    pushGroup,
    popLayer,
    popGroup,

    get currentParent() {
      return stack[stack.length - 1]!.container;
    },

    getLayers: () => layers,

    applyMask,
    markMaskSource,

    endFrame,

    dispose() {
      pool.dispose();
      layers.clear();
    },

    pool,
  };
}
