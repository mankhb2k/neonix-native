/**
 * Profiler HUD — dev-only diagnostic overlay for the Pixi stage.
 *
 * §Phase 8 Task 8.6 in core-engine-tasks.md
 *
 * Renders FPS, frame time, dirty diff stats, and paint budget as a
 * Pixi Text overlay. Only shown in dev mode — no production overhead.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { PaintDiffStats } from "./paint-diff";

// ── Types ─────────────────────────────────────────────────────────────

export type ProfilerHudStats = {
  /** Frames per second (rolling average). */
  fps: number;
  /** Frame time in ms (last frame). */
  frameTimeMs: number;
  /** Dirty diff stats from the paint engine. */
  paintDiff: PaintDiffStats | null;
  /** Playback engine metrics (from Phase 6). */
  engineMetrics?: {
    totalTicks: number;
    evaluatedFrames: number;
    evaluateTimeMs: number;
    paintTimeMs: number;
    droppedFrames: number;
    starvedTicks: number;
  };
  /** Whether the engine is paused. */
  paused: boolean;
  /** Quality mode. */
  qualityMode?: string;
};

export type ProfilerHudOptions = {
  /** Position: top-left | top-right | bottom-left | bottom-right. */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Max lines to show. */
  maxLines?: number;
  /** Font size for the HUD text. */
  fontSize?: number;
  /** Callback to toggle visibility. */
  hotkey?: string;
};

const DEFAULT_OPTIONS: Required<ProfilerHudOptions> = {
  position: "top-right",
  maxLines: 10,
  fontSize: 12,
  hotkey: "KeyH",
};

// ── Implementation ────────────────────────────────────────────────────

export type ProfilerHud = {
  /** The root container — add to stage once. */
  readonly container: Container;
  /** Update the HUD with current stats. */
  update(stats: ProfilerHudStats): void;
  /** Show/hide the HUD. */
  setVisible(visible: boolean): void;
  /** Whether the HUD is visible. */
  readonly visible: boolean;
  /** Dispose. */
  dispose(): void;
};

export function createProfilerHud(
  opts?: ProfilerHudOptions,
): ProfilerHud {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const root = new Container();
  root.label = "profiler-hud";
  root.eventMode = "none";
  root.zIndex = Number.MAX_SAFE_INTEGER;

  // Semi-transparent background
  const bg = new Graphics();
  bg.label = "hud-bg";
  root.addChild(bg);

  // Text
  const style = new TextStyle({
    fontSize: options.fontSize,
    fontFamily: "monospace",
    fill: 0x00ff00,
    lineHeight: options.fontSize * 1.4,
  });
  const text = new Text({ text: "", style });
  text.label = "hud-text";
  text.x = 4;
  text.y = 4;
  root.addChild(text);

  let visible = true;
  let viewportW = 800;
  let viewportH = 600;

  function formatMs(ms: number): string {
    return ms.toFixed(1).padStart(6);
  }

  function formatPercent(n: number, total: number): string {
    if (total === 0) return "  0%";
    return `${((n / total) * 100).toFixed(0).padStart(3)}%`;
  }

  function formatFps(fps: number): string {
    if (fps >= 60) return "60";
    if (fps >= 30) return fps.toFixed(0);
    return fps.toFixed(1);
  }

  function buildText(stats: ProfilerHudStats): string {
    const lines: string[] = [];

    // FPS & frame time
    const fpsColor = stats.fps >= 55 ? "" : stats.fps >= 25 ? "⚠ " : "🔴 ";
    lines.push(`${fpsColor}FPS: ${formatFps(stats.fps)}  ${formatMs(stats.frameTimeMs)}ms`);

    // Play state
    const stateIcon = stats.paused ? "⏸" : "▶";
    const qualityStr = stats.qualityMode ? ` [${stats.qualityMode}]` : "";
    lines.push(`${stateIcon}${qualityStr}`);

    // Engine metrics
    if (stats.engineMetrics) {
      const m = stats.engineMetrics;
      lines.push(`eval:${formatMs(m.evaluateTimeMs)}ms  paint:${formatMs(m.paintTimeMs)}ms`);
      lines.push(`frames:${m.evaluatedFrames}  drop:${m.droppedFrames}  starve:${m.starvedTicks}`);
    }

    // Paint diff stats
    if (stats.paintDiff) {
      const d = stats.paintDiff;
      const skipped = d.clearsSkipped + d.filterResetsSkipped + d.styleUpdatesSkipped;
      const total = d.totalItems;
      const changeRate = total > 0 ? formatPercent(d.changedItems + d.newItems, total) : "  -";
      lines.push(`dirty:${changeRate}  skip:${skipped}  new:${d.newItems}  rm:${d.removedItems}`);
    }

    return lines.join("\n");
  }

  function drawBackground(numLines: number): void {
    bg.clear();
    const lineH = options.fontSize * 1.4;
    const w = 280;
    const h = numLines * lineH + 12;
    bg.rect(0, 0, w, h);
    bg.fill({ color: 0x000000, alpha: 0.65 });
  }

  function updatePosition(): void {
    const h = text.height + 8;
    const w = text.width + 16;

    switch (options.position) {
      case "top-left":
        root.x = 8;
        root.y = 8;
        break;
      case "top-right":
        root.x = viewportW - w - 8;
        root.y = 8;
        break;
      case "bottom-left":
        root.x = 8;
        root.y = viewportH - h - 8;
        break;
      case "bottom-right":
        root.x = viewportW - w - 8;
        root.y = viewportH - h - 8;
        break;
    }
  }

  function update(stats: ProfilerHudStats): void {
    if (!visible) return;

    const content = buildText(stats);
    text.text = content;

    const numLines = content.split("\n").length;
    drawBackground(numLines);
    updatePosition();
  }

  function setVisibility(v: boolean): void {
    visible = v;
    root.visible = v;
  }

  function dispose(): void {
    root.removeFromParent();
    root.destroy({ children: true });
  }

  return {
    container: root,
    update,
    setVisible: setVisibility,
    get visible() { return visible; },
    dispose,
  };
}
