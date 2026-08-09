import type { DesignLaneRole, TimelineTrackKind } from "../lanes/track-kind";

export type DesignLane = {
  id: string;
  name: string;
  role: DesignLaneRole;
  kind: "visual" | "audio";
};

export type DesignClip = {
  id: string;
  laneId: string;
  name: string;
  start: number;
  duration: number;
  kind: TimelineTrackKind;
  selected?: boolean;
};

export type DesignBoard = {
  duration: number;
  fps: number;
  lanes: DesignLane[];
  clips: DesignClip[];
  /** Layer-mode mute windows outside container [start, end]. */
  containerWindow?: { start: number; end: number };
};

/** Static CapCut-like Track Mode board for design review. */
export const DESIGN_TRACK_BOARD: DesignBoard = {
  duration: 28,
  fps: 30,
  lanes: [
    { id: "lane-overlay-1", name: "Overlay", role: "overlay", kind: "visual" },
    { id: "lane-main", name: "Main", role: "base", kind: "visual" },
    { id: "lane-audio-1", name: "Audio", role: "audio", kind: "audio" },
  ],
  clips: [
    {
      id: "c-title",
      laneId: "lane-overlay-1",
      name: "Title card",
      start: 0.5,
      duration: 3.2,
      kind: "overlay",
    },
    {
      id: "c-hook",
      laneId: "lane-main",
      name: "Hook",
      start: 0,
      duration: 4.5,
      kind: "main",
      selected: true,
    },
    {
      id: "c-harvard",
      laneId: "lane-main",
      name: "2004 · Harvard",
      start: 4.5,
      duration: 5,
      kind: "main",
    },
    {
      id: "c-news",
      laneId: "lane-main",
      name: "2006 · News Feed",
      start: 9.5,
      duration: 5.5,
      kind: "main",
    },
    {
      id: "c-ipo",
      laneId: "lane-main",
      name: "2012 · IPO",
      start: 15,
      duration: 5,
      kind: "main",
    },
    {
      id: "c-meta",
      laneId: "lane-main",
      name: "2021 · Meta",
      start: 20,
      duration: 4.5,
      kind: "main",
    },
    {
      id: "c-outro",
      laneId: "lane-main",
      name: "Outro",
      start: 24.5,
      duration: 3.5,
      kind: "main",
    },
    {
      id: "c-vo",
      laneId: "lane-audio-1",
      name: "Voiceover",
      start: 0.2,
      duration: 26,
      kind: "audio",
    },
    {
      id: "c-sfx",
      laneId: "lane-overlay-1",
      name: "Sticker",
      start: 12,
      duration: 2.5,
      kind: "overlay",
    },
  ],
};

/** Static Layer Mode board (dive into scene clip). */
export const DESIGN_LAYER_BOARD: DesignBoard = {
  duration: 28,
  fps: 30,
  containerWindow: { start: 4.5, end: 9.5 },
  lanes: [
    { id: "ly-bg", name: "Background", role: "base", kind: "visual" },
    { id: "ly-accent", name: "Accent bar", role: "overlay", kind: "visual" },
    { id: "ly-title", name: "Title", role: "overlay", kind: "visual" },
    { id: "ly-sub", name: "Subtitle", role: "overlay", kind: "visual" },
  ],
  clips: [
    {
      id: "n-bg",
      laneId: "ly-bg",
      name: "Background",
      start: 4.5,
      duration: 5,
      kind: "main",
    },
    {
      id: "n-accent",
      laneId: "ly-accent",
      name: "Accent bar",
      start: 4.7,
      duration: 4.6,
      kind: "overlay",
      selected: true,
    },
    {
      id: "n-title",
      laneId: "ly-title",
      name: "Title",
      start: 5,
      duration: 3.5,
      kind: "overlay",
    },
    {
      id: "n-sub",
      laneId: "ly-sub",
      name: "Subtitle",
      start: 5.5,
      duration: 3,
      kind: "overlay",
    },
  ],
};
