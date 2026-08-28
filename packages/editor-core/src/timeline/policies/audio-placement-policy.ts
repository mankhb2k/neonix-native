/**
 * Audio placement is intentionally independent from visual-layer occupancy.
 * Multiple clips in one audio track are a valid mix, not a collision.
 */
export type AudioPlacement = {
  startTime: number;
  insertNewLane: false;
  insertOrder: null;
  edgeGuideTime: null;
};

export function resolveAudioClipPlacement(desiredStart: number): AudioPlacement {
  return {
    startTime: Math.max(0, desiredStart),
    insertNewLane: false,
    insertOrder: null,
    edgeGuideTime: null,
  };
}
