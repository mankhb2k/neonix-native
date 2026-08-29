export type ScrubCoordinatorV3 = {
  begin(playing: boolean): void;
  update(timeUs: number): void;
  end(): boolean;
  readonly active: boolean;
  readonly resumeAfterScrub: boolean;
};

export function createScrubCoordinatorV3(onSeek: (timeUs: number) => void, onResume: () => void): ScrubCoordinatorV3 {
  let active = false;
  let resume = false;
  return { begin(playing) { active = true; resume = playing; }, update(timeUs) { if (active) onSeek(Math.max(0, timeUs)); }, end() { const shouldResume = active && resume; active = false; resume = false; if (shouldResume) onResume(); return shouldResume; }, get active() { return active; }, get resumeAfterScrub() { return resume; } };
}
