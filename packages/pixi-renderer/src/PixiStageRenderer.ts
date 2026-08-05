/**
 * PixiStageRenderer — real pixi.js Application + stable-key display cache.
 * Consumes EvaluatedFrame / PaintCommandBuffer from motion-runtime.
 */

import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  evaluateFrame,
  type EvaluatedFrame,
  type PaintCommand,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import type {
  MotionProject,
  NormalizedMotionProjectV2,
} from "@motionvideo/motion-schema";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";

export type StageViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type PixiStageRenderer = {
  mount(host: HTMLElement): Promise<void>;
  setProject(runtime: NormalizedMotionProjectV2): void;
  setAuthoringProject(project: MotionProject): void;
  paintFrame(frameIndex: number): EvaluatedFrame | null;
  setViewport(viewport: StageViewport): void;
  setQuality(tier: "interactive" | "high"): void;
  setBackground(color: string): void;
  setSceneId(sceneId: string | undefined): void;
  dispose(): void;
};

type CachedObject = {
  kind: string;
  display: Container | Text | Graphics | Sprite;
};

function hexToNumber(color: string | undefined, fallback = 0xffffff): number {
  if (!color) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return fallback;
  return Number.parseInt(m[1]!, 16);
}

function applyMatrix(
  display: Container | Text | Graphics | Sprite,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
  alpha: number,
  visible: boolean,
  zIndex: number,
): void {
  display.position.set(matrix.e, matrix.f);
  display.rotation = Math.atan2(matrix.b, matrix.a);
  display.scale.set(
    Math.hypot(matrix.a, matrix.b) || 1,
    Math.hypot(matrix.c, matrix.d) || 1,
  );
  display.alpha = alpha;
  display.visible = visible;
  display.zIndex = zIndex;
}

export function createPixiStageRenderer(): PixiStageRenderer {
  let app: Application | null = null;
  let host: HTMLElement | null = null;
  let runtime: NormalizedMotionProjectV2 | null = null;
  let sceneId: string | undefined;
  let background = "#ffffff";
  let quality: "interactive" | "high" = "interactive";
  let viewport: StageViewport = { scale: 1, offsetX: 0, offsetY: 0 };
  let lastFrame = -1;

  const cache = new Map<string, CachedObject>();
  const world = new Container({ sortableChildren: true });
  const textureCache = new Map<string, Texture>();

  const clearCache = () => {
    for (const entry of cache.values()) {
      entry.display.destroy({ children: true });
    }
    cache.clear();
    world.removeChildren();
  };

  const ensureObject = <T extends Container | Text | Graphics | Sprite>(
    key: string,
    kind: string,
    factory: () => T,
  ): T => {
    const existing = cache.get(key);
    if (existing && existing.kind === kind) return existing.display as T;
    if (existing) {
      world.removeChild(existing.display);
      existing.display.destroy({ children: true });
      cache.delete(key);
    }
    const display = factory();
    display.label = key;
    world.addChild(display);
    cache.set(key, { kind, display });
    return display;
  };

  const paintCommands = (buffer: PaintCommandBuffer) => {
    const live = new Set<string>();
    let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null =
      null;

    for (const cmd of buffer.commands) {
      if (cmd.op === "beginFrame") {
        if (app) {
          app.renderer.background.color = hexToNumber(
            cmd.background ?? background,
          );
        }
        continue;
      }
      if (cmd.op === "endFrame") continue;
      if (cmd.op === "setTransform") {
        pendingTransform = cmd;
        continue;
      }
      if (cmd.op === "beginGroup" || cmd.op === "endGroup") {
        live.add(cmd.key);
        const c = ensureObject(
          cmd.key,
          "group",
          () => new Container({ sortableChildren: true }),
        );
        if (pendingTransform && pendingTransform.key === cmd.key) {
          applyMatrix(
            c,
            pendingTransform.matrix,
            pendingTransform.alpha,
            pendingTransform.visible,
            pendingTransform.zIndex,
          );
          pendingTransform = null;
        }
        continue;
      }
      if (cmd.op === "unsupported") {
        live.add(cmd.key);
        continue;
      }

      live.add(cmd.key);
      const xf = pendingTransform?.key === cmd.key ? pendingTransform : null;
      if (pendingTransform?.key === cmd.key) pendingTransform = null;

      if (cmd.op === "drawText") {
        const text = ensureObject(
          cmd.key,
          "text",
          () =>
            new Text({
              text: cmd.text,
              style: {
                fontSize: cmd.fontSize,
                fill: cmd.fill,
                align: cmd.align ?? "left",
                wordWrap: true,
                wordWrapWidth: Math.max(8, cmd.width),
              },
            }),
        );
        text.text = cmd.text;
        text.style.fontSize = cmd.fontSize;
        text.style.fill = cmd.fill;
        if (xf) {
          applyMatrix(text, xf.matrix, xf.alpha, xf.visible, xf.zIndex);
        }
        continue;
      }

      if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
        const g = ensureObject(cmd.key, "graphics", () => new Graphics());
        g.clear();
        const fill = cmd.fill;
        const w = cmd.width;
        const h = cmd.height;
        if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
          g.ellipse(w / 2, h / 2, w / 2, h / 2);
        } else if (cmd.op === "drawShape" && cmd.cornerRadius) {
          g.roundRect(0, 0, w, h, cmd.cornerRadius);
        } else {
          g.rect(0, 0, w, h);
        }
        g.fill(hexToNumber(fill));
        if (xf) {
          applyMatrix(g, xf.matrix, xf.alpha, xf.visible, xf.zIndex);
        }
        continue;
      }

      if (cmd.op === "drawImage") {
        let texture = Texture.WHITE;
        if (cmd.uri && textureCache.has(cmd.uri)) {
          texture = textureCache.get(cmd.uri)!;
        } else if (cmd.uri) {
          void Assets.load(cmd.uri)
            .then((loaded) => {
              textureCache.set(cmd.uri!, loaded as Texture);
              if (lastFrame >= 0) {
                // re-paint after texture ready
              }
            })
            .catch(() => {
              /* placeholder WHITE */
            });
        }
        const sprite = ensureObject(cmd.key, "sprite", () => new Sprite(texture));
        sprite.texture = texture;
        sprite.width = cmd.width;
        sprite.height = cmd.height;
        if (xf) {
          applyMatrix(sprite, xf.matrix, xf.alpha, xf.visible, xf.zIndex);
        }
      }
    }

    for (const [key, entry] of cache) {
      if (live.has(key)) continue;
      world.removeChild(entry.display);
      entry.display.destroy({ children: true });
      cache.delete(key);
    }
  };

  return {
    async mount(nextHost) {
      if (app) this.dispose();
      host = nextHost;
      app = new Application();
      await app.init({
        width: 1920,
        height: 1080,
        background: hexToNumber(background),
        antialias: quality === "high",
        resolution:
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        autoDensity: true,
        preference: "webgl",
      });
      host.appendChild(app.canvas as HTMLCanvasElement);
      app.stage.addChild(world);
      world.position.set(viewport.offsetX, viewport.offsetY);
      world.scale.set(viewport.scale);
    },

    setProject(next) {
      runtime = next;
      clearCache();
      if (lastFrame >= 0) this.paintFrame(lastFrame);
    },

    setAuthoringProject(project) {
      this.setProject(compileMotionProject(project));
    },

    paintFrame(frameIndex) {
      if (!runtime) return null;
      lastFrame = frameIndex;
      const fps = Math.max(1, Math.round(runtime.metadata.fps ?? 30));
      const time = frameIndex / fps;
      const scene =
        runtime.scenes.find((s) => s.id === sceneId) ??
        runtime.scenes.find((s) => s.id === runtime!.timeline.sceneOrder[0]) ??
        runtime.scenes[0];
      if (!scene) return null;

      const aspect = runtime.metadata.aspectRatio;
      const size =
        aspect === "9:16"
          ? { width: 1080, height: 1920 }
          : aspect === "1:1"
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 };

      if (
        app &&
        (app.screen.width !== size.width || app.screen.height !== size.height)
      ) {
        app.renderer.resize(size.width, size.height);
      }

      const assetUriById = new Map(
        runtime.assets.map((a) => [a.id, a.uri] as const),
      );

      const evaluated = evaluateFrame({
        scene,
        frame: frameIndex,
        time,
        width: size.width,
        height: size.height,
        background,
        assetUriById,
      });

      paintCommands(evaluated.paint);
      return evaluated;
    },

    setViewport(next) {
      viewport = next;
      world.position.set(next.offsetX, next.offsetY);
      world.scale.set(next.scale);
    },

    setQuality(tier) {
      quality = tier;
    },

    setBackground(color) {
      background = color;
      if (app) app.renderer.background.color = hexToNumber(color);
    },

    setSceneId(id) {
      sceneId = id;
    },

    dispose() {
      clearCache();
      textureCache.clear();
      if (app) {
        app.destroy(true, { children: true });
        app = null;
      }
      if (host) {
        host.replaceChildren();
        host = null;
      }
      runtime = null;
      lastFrame = -1;
    },
  };
}
