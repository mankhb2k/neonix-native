/**
 * PixiStageRenderer — Application lifecycle + viewport; paints via PixiFramePainter.
 */

import {
  type EvaluatedFrame,
  type EvaluatedFramePainter,
} from "@motionvideo/motion-runtime";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import { Application, Container } from "pixi.js";
import {
  createPixiFramePainter,
  hexToNumber,
  type PixiFramePainter,
  type PixiFramePainterOptions,
} from "./PixiFramePainter";

export type StageViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type PixiStageRenderer = EvaluatedFramePainter & {
  mount(host: HTMLElement): Promise<void>;
  /** Optional metadata for canvas resize; paint uses EvaluatedFrame only. */
  setProject(runtime: MotionRuntimeProject | null): void;
  setViewport(viewport: StageViewport): void;
  setQuality(tier: "interactive" | "high"): void;
  setBackground(color: string): void;
  setGraphId(graphId: string | undefined): void;
  /** Stop the Pixi ticker during buffered RAM-preview playback. */
  setTickerEnabled(enabled: boolean): void;
  dispose(): void;
};

export function createPixiStageRenderer(): PixiStageRenderer {
  let app: Application | null = null;
  let host: HTMLElement | null = null;
  let runtime: MotionRuntimeProject | null = null;
  let graphId: string | undefined;
  let background = "#ffffff";
  let quality: "interactive" | "high" = "interactive";
  let viewport: StageViewport = { scale: 1, offsetX: 0, offsetY: 0 };

  const world = new Container({ sortableChildren: true });
  let painter: PixiFramePainter = createPixiFramePainter({
    root: world,
    getBackground: () => background,
    onBackground: (color) => {
      if (color) background = color;
      if (app) app.renderer.background.color = hexToNumber(background);
    },
  });

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
      (app.canvas as HTMLCanvasElement).dataset.testid = "runtime-preview-canvas";
      app.stage.addChild(world);
      world.position.set(viewport.offsetX, viewport.offsetY);
      world.scale.set(viewport.scale);
      painter = createPixiFramePainter({
        root: world,
        getBackground: () => background,
        onBackground: (color) => {
          if (color) background = color;
          if (app) app.renderer.background.color = hexToNumber(background);
        },
        renderer: app.renderer as PixiFramePainterOptions["renderer"],
      });
    },

    setProject(next) {
      runtime = next;
      painter.clear();
    },

    paintFrame(evaluated: EvaluatedFrame) {
      const size = {
        width: evaluated.interaction.width,
        height: evaluated.interaction.height,
      };
      if (
        app &&
        (app.screen.width !== size.width || app.screen.height !== size.height)
      ) {
        app.renderer.resize(size.width, size.height);
      }
      if (evaluated.interaction.background) {
        background = evaluated.interaction.background;
        if (app) app.renderer.background.color = hexToNumber(background);
      }
      painter.paintFrame(evaluated);
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

    setGraphId(id) {
      graphId = id;
      void graphId;
      void runtime;
    },

    setTickerEnabled(enabled) {
      if (!app) return;
      if (enabled) {
        app.ticker.start();
        painter.setPaused(false);
      } else {
        app.ticker.stop();
        painter.setPaused(true);
      }
    },

    dispose() {
      painter.dispose();
      if (app) {
        app.destroy(true, { children: true });
        app = null;
      }
      if (host) {
        host.replaceChildren();
        host = null;
      }
      runtime = null;
      painter = createPixiFramePainter({
        root: world,
        getBackground: () => background,
        onBackground: (color) => {
          if (color) background = color;
          if (app) app.renderer.background.color = hexToNumber(background);
        },
      });
    },
  };
}
