import type { TimelineClip } from "@/lib/editor/model/timeline-types";
import type { PointerPos } from "@/lib/editor/timeline/sessions/pointer-session-controller";

export type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MarqueeSessionState = {
  startPos: PointerPos;
  currentPos: PointerPos;
  box: MarqueeBox;
  selectedClipIds: string[];
};

export function createMarqueeSessionState(startPos: PointerPos): MarqueeSessionState {
  return {
    startPos,
    currentPos: startPos,
    box: { left: startPos.x, top: startPos.y, width: 0, height: 0 },
    selectedClipIds: [],
  };
}

export function updateMarqueeSessionState(
  state: MarqueeSessionState,
  currentPos: PointerPos,
  clipsWithRects: Array<{ clip: TimelineClip; rect: MarqueeBox }>,
): MarqueeSessionState {
  const left = Math.min(state.startPos.x, currentPos.x);
  const top = Math.min(state.startPos.y, currentPos.y);
  const width = Math.abs(currentPos.x - state.startPos.x);
  const height = Math.abs(currentPos.y - state.startPos.y);

  const box: MarqueeBox = { left, top, width, height };

  const selectedClipIds = clipsWithRects
    .filter(({ rect }) => boxesIntersect(box, rect))
    .map(({ clip }) => clip.id);

  return {
    ...state,
    currentPos,
    box,
    selectedClipIds,
  };
}

function boxesIntersect(a: MarqueeBox, b: MarqueeBox): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}
